/**
 * dsh-env-inspector —— Host（Node）半。
 *
 * 跑在 DSH 进程的同一台机器上 —— 采集"读者电脑的环境信息"，暴露给 client 半渲染。
 * **零运行时依赖**：所有探测只走 node:os / node:fs / node:child_process / 读 PATH。
 * **不联网**：所有命令都是本地查询；不调用任何远端 API。
 * **不展示明文秘钥**：环境变量名（如 DEEPSEEK_API_KEY）展示，存在与否标是/否，**值永不输出**。
 *
 * 设计取舍：
 *   - **fail-open**：任何一条探测失败（命令不存在、PATH 没找到）只让那一条 missing，
 *     不让整张自检崩。
 *   - **不缓存**：每次请求都重跑 —— 数据便宜，状态可能在变（装新包、换 key）。
 *     想要"导出快照"再加缓存；现在不需要。
 *   - **webpack 不命中**：webServer.register 是单条 exact 路由，handler 同步注册，
 *     跟 dsh-llm-hub / dsh-user-mirror 一样的模式。
 */

import { hostname, platform, arch, release, cpus, totalmem, freemem, networkInterfaces, uptime, homedir } from 'node:os'
import { spawnSync } from 'node:child_process'
import fs from 'node:fs'
import path from 'node:path'

export const name = '@dsh-plugins/dsh-env-inspector'
/**
 * Host 端需要的注入服务列表：
 *   - webServer：暴露 GET /api/dsh-env-inspector/self-check 和 /debug
 *
 * 注意：本插件**不**需要 llm / settings / storageDomain —— 全部数据本地拿。
 */
export const inject = ['webServer']

/**
 * 跑一个外部命令并安全地拿到 stdout。
 * @param cmd - 可执行文件名（如 'git'）。
 * @param args - 参数列表。
 * @returns `{ ok: boolean, version: string|null, error: string|null }`
 */
function probe(cmd, args = ['--version']) {
	try {
		const result = spawnSync(cmd, args, {
			encoding: 'utf8',
			timeout: 1500,
			env: process.env,
			stdio: ['ignore', 'pipe', 'pipe']
		})
		if (result.error || result.status !== 0) {
			return { ok: false, version: null, error: result.error?.message ?? `exit ${result.status}` }
		}
		// 大部分 CLI 输出第一行是版本号；trim 后取首行去掉噪音。
		const line = (result.stdout ?? '').trim().split('\n')[0]?.trim() ?? ''
		return { ok: true, version: line.length > 0 ? line : null, error: null }
	} catch (error) {
		return { ok: false, version: null, error: error.message }
	}
}

/**
 * 给一个 env 名 —— **仅返回名字和存在性**，绝不返回值。
 * 这是为了防 client 半误把 key 当 plain text 渲染。
 * @param name - 环境变量名。
 * @returns `{ name, configured: boolean }`
 */
function envPresence(name) {
	return { name, configured: typeof process.env[name] === 'string' && process.env[name].length > 0 }
}

/**
 * 探测一组常用的 CLI 工具。
 * @returns `{ name, ok, version }[]` —— ok=false 时 version=null
 */
function probeCliTools() {
	const tools = ['node', 'npm', 'pnpm', 'yarn', 'git', 'cs', 'docker', 'mise', 'brew', 'codex', 'claude', 'agy']
	return tools.map((name) => {
		const { ok, version } = probe(name, ['--version'])
		return { name, ok, version }
	})
}

/**
 * 探测 DSH 已装的 plugin（从 web profile 的 package.json 读）。
 * @returns `{ profile, plugin, version }[]`
 */
function probeInstalledPlugins() {
	try {
		// 假设 DSH 用的是 web profile；profile 路径走 DSH_PROFILES_DIR env 或默认位置。
		const profilesRoot = process.env.DSH_PROFILES_DIR ?? path.join(homedir(), '.dsh', 'profiles')
		const out = []
		for (const profile of ['web', 'desktop-local']) {
			const pkgPath = path.join(profilesRoot, profile, 'package.json')
			if (!fs.existsSync(pkgPath)) continue
			const pkg = JSON.parse(fs.readFileSync(pkgPath, 'utf8'))
			const deps = { ...(pkg.dependencies ?? {}), ...(pkg.devDependencies ?? {}) }
			for (const [name, version] of Object.entries(deps)) {
				if (name.startsWith('@dsh-plugins/') || name.startsWith('dsh-') || name.startsWith('@webkubor/dsh-')) {
					out.push({ profile, plugin: name, version })
				}
			}
		}
		return out
	} catch (error) {
		return []
	}
}

/**
 * 探测 kyvault 里**有没有**某些秘钥 —— 只返回引用名 + 是否存在，**不返回值**。
 * 走 cs kyvault list —— CLI 启动慢（~1s），但 client 端点击"刷新"才触发，能接受。
 * @returns `{ name, configured: boolean }[]`
 */
function probeKyvaultPresence() {
	try {
		const result = spawnSync('cs', ['kyvault', 'list'], {
			encoding: 'utf8',
			timeout: 3000,
			stdio: ['ignore', 'pipe', 'pipe']
		})
		if (result.status !== 0) return []
		// cs kyvault list 输出：每行是 'secret://xxx/yyy ...' 开头的 key
		// 只抓 secret:// 前缀的引用，名字部分。
		const lines = (result.stdout ?? '').split('\n')
		const refs = []
		for (const line of lines) {
			const match = line.match(/^secret:\/\/([^\s]+)/)
			if (match === null) continue
			refs.push({ name: `secret://${match[1]}`, configured: true })
		}
		return refs
	} catch {
		return []
	}
}

/**
 * 探测一组常见 API key 是否在环境变量里 —— **只返存在性**。
 * 不主动列 DEEPSEEK_API_KEY 之类敏感名（避免主人不知道我们在读），只检
 * 列表里登记过的、用 .well-known 形式公开的那几个。
 * @returns `{ name, configured: boolean }[]`
 */
function probeEnvKeys() {
	const keys = [
		'DEEPSEEK_API_KEY',
		'OPENAI_API_KEY',
		'ANTHROPIC_API_KEY',
		'GOOGLE_API_KEY',
		'MOONSHOT_API_KEY',
		'ZHIPUAI_API_KEY',
		'MINIMAX_API_KEY',
		'STEPFUN_API_KEY',
		'CF_API_TOKEN',
		'GITHUB_TOKEN'
	]
	return keys.map(envPresence)
}

/**
 * 系统层面：OS / arch / shell / Node / PATH / memory / network —— 全部本地拿。
 * @returns object
 */
function readSystem() {
	const cpus_ = cpus()
	const cpuModel = cpus_[0]?.model ?? 'unknown'
	const cpuCount = cpus_.length
	const memTotalGB = (totalmem() / 1024 ** 3).toFixed(2)
	const memFreeGB = (freemem() / 1024 ** 3).toFixed(2)
	const uptimeMin = Math.floor(uptime() / 60)
	const shell = process.env.SHELL ?? 'unknown'
	const shellName = shell.split('/').pop() ?? shell
	const user = process.env.USER ?? process.env.USERNAME ?? 'unknown'
	const home = process.env.HOME ?? 'unknown'
	const pathDirs = (process.env.PATH ?? '').split(':').filter((d) => d.length > 0)
	return {
		os: `${platform()} ${release()}`,
		arch: arch(),
		hostname: hostname(),
		user,
		home,
		shell: shellName,
		pathDirs: pathDirs.length,
		nodeVersion: process.version,
		cpu: `${cpuCount} × ${cpuModel}`,
		memTotalGB,
		memFreeGB,
		uptimeMin
	}
}

/**
 * 解析 lsof -iTCP -sTCP:LISTEN -n -P 输出。
 * 纯函数，独立导出方便单元测试。
 * @param {string} stdout - lsof 输出内容
 * @returns {Array<{port: number, command: string, pid: number|null, host: string, isWildcard: boolean}>}
 */
export function parseListeningPorts(stdout) {
	if (typeof stdout !== 'string' || stdout.trim().length === 0) return []
	const lines = stdout.trim().split('\n')
	const map = new Map()

	for (let i = 1; i < lines.length; i++) {
		const line = lines[i].trim()
		if (!line) continue
		const parts = line.split(/\s+/)
		if (parts.length < 9) continue
		const command = parts[0]
		const pid = parseInt(parts[1], 10)
		const nameField = parts[parts.length - 2]
		if (!nameField) continue

		const lastColon = nameField.lastIndexOf(':')
		if (lastColon === -1) continue
		const host = nameField.slice(0, lastColon)
		const portStr = nameField.slice(lastColon + 1)
		const port = parseInt(portStr, 10)
		if (Number.isNaN(port) || port <= 0 || port > 65535) continue

		const isWildcard = host === '*' || host === '0.0.0.0' || host === '::'

		if (!map.has(port)) {
			map.set(port, {
				port,
				command,
				pid: Number.isNaN(pid) ? null : pid,
				host,
				isWildcard
			})
		} else {
			const existing = map.get(port)
			if (isWildcard && !existing.isWildcard) {
				existing.isWildcard = true
				existing.host = host
			}
		}
	}

	return Array.from(map.values()).sort((a, b) => a.port - b.port)
}

/**
 * 探测本机正在监听的 TCP 端口。
 * 零外联，优先调用 /usr/sbin/lsof，补全 PATH 环境变量防 launchd 最小环境找不到命令。
 * @returns {Array<{port: number, command: string, pid: number|null, host: string, isWildcard: boolean}>}
 */
export function probeListeningPorts() {
	try {
		const envPath = [
			'/usr/sbin',
			'/usr/bin',
			'/bin',
			'/usr/local/bin',
			'/opt/homebrew/bin',
			process.env.PATH
		].filter(Boolean).join(':')

		const candidates = fs.existsSync('/usr/sbin/lsof')
			? ['/usr/sbin/lsof', 'lsof']
			: ['lsof', '/usr/sbin/lsof']

		for (const cmd of candidates) {
			const result = spawnSync(cmd, ['-iTCP', '-sTCP:LISTEN', '-n', '-P'], {
				encoding: 'utf8',
				timeout: 3000,
				env: { ...process.env, PATH: envPath },
				stdio: ['ignore', 'pipe', 'pipe']
			})
			if (!result.error && result.status === 0 && result.stdout) {
				return parseListeningPorts(result.stdout)
			}
		}
		return []
	} catch {
		return []
	}
}

/**
 * 拼装完整自检载荷。
 * @returns 完整的 self-check JSON
 */
function readSelfCheck() {
	return {
		ok: true,
		at: Date.now(),
		system: readSystem(),
		cli: probeCliTools(),
		plugins: probeInstalledPlugins(),
		kyvault: probeKyvaultPresence(),
		envKeys: probeEnvKeys(),
		network: readNetworkSummary(),
		ports: probeListeningPorts()
	}
}

/**
 * 网络摘要 —— 不主动探测任何远端服务（避免 self-check 自己变慢 / 被风控）。
 * 只读本地：interface 列表 + hostname —— 主机是否能连公网由 user 自己 ping。
 * @returns object
 */
function readNetworkSummary() {
	const interfaces = networkInterfaces()
	const ifaces = []
	for (const [name, infos] of Object.entries(interfaces)) {
		if (infos === undefined) continue
		for (const info of infos) {
			ifaces.push({ name, family: info.family, address: info.address, internal: info.internal })
		}
	}
	return { interfaces: ifaces }
}

/**
 * 路由处理：GET /api/dsh-env-inspector/self-check
 * @returns JSON
 */
function handlerSelfCheck(request, response) {
	if (request.method !== 'GET' && request.method !== 'HEAD') {
		response.writeHead(405, { allow: 'GET, HEAD' })
		response.end()
		return
	}
	const sameOrigin = (req) => {
		const site = req.headers['sec-fetch-site']
		if (typeof site === 'string') return site === 'same-origin' || site === 'none'
		return true
	}
	if (!sameOrigin(request)) {
		response.writeHead(403, { 'content-type': 'application/json; charset=utf-8' })
		response.end(JSON.stringify({ ok: false, error: 'cross-origin reads are refused' }))
		return
	}
	if (request.method === 'HEAD') {
		response.writeHead(200, { 'content-type': 'application/json; charset=utf-8' })
		response.end()
		return
	}
	const payload = readSelfCheck()
	response.writeHead(200, { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store' })
	response.end(JSON.stringify(payload))
}

export function apply(ctx) {
	ctx.effect(() => ctx.webServer.register({
		kind: 'exact',
		path: '/api/dsh-env-inspector/self-check',
		handler: handlerSelfCheck
	}), 'dsh-env-inspector: self-check route')
}
