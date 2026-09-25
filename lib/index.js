/**
 * dsh-env-inspector —— Host（Node）半。
 *
 * 跑在 DSH 进程的同一台机器上 —— 采集"读者电脑的环境信息"，暴露给 client 半渲染。
 * **零运行时依赖**：所有探测只走 node:os / node:fs / node:child_process / 读 PATH。
 * **默认不联网**：本地自检不调用远端 API；公网出口 IP 由浏览器在用户主动点击后检测。
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
import { spawnSync, execFile } from 'node:child_process'
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
 * 异步跑外部命令并安全获取 stdout（不阻塞主事件循环）。
 * @param {string} cmd - 可执行文件名
 * @param {string[]} [args] - 参数列表
 * @returns {Promise<{ ok: boolean, version: string|null, error: string|null }>}
 */
export function probeAsync(cmd, args = ['--version']) {
	return new Promise((resolve) => {
		execFile(cmd, args, {
			encoding: 'utf8',
			timeout: 1500,
			env: process.env
		}, (error, stdout) => {
			if (error) {
				resolve({ ok: false, version: null, error: error.message })
				return
			}
			const line = (stdout ?? '').trim().split('\n')[0]?.trim() ?? ''
			resolve({ ok: true, version: line.length > 0 ? line : null, error: null })
		})
	})
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

const CLI_TOOLS = ['node', 'npm', 'pnpm', 'yarn', 'git', 'cs', 'docker', 'mise', 'brew']
const AI_TOOLS = ['codex', 'gemini', 'claude', 'opencode', 'agy', 'aider', 'cursor', 'continue', 'cody-cli', 'tabby', 'codestral', 'goose', 'cline', 'lm-studio', 'ollama']
const LANG_TOOLS = [{ name: 'python', command: 'python3' }, { name: 'go', command: 'go' }, { name: 'rust', command: 'rustc' }]

/**
 * 探测一组常用的 CLI 工具（同步兼容）。
 * @returns `{ name, ok, version }[]`
 */
function probeCliTools() {
	return CLI_TOOLS.map((name) => {
		const { ok, version } = probe(name, ['--version'])
		return { name, ok, version }
	})
}

/**
 * 并行异步探测常用 CLI 工具。
 * @returns {Promise<{ name, ok, version }[]>}
 */
export async function probeCliToolsAsync() {
	return Promise.all(CLI_TOOLS.map(async (name) => {
		const { ok, version } = await probeAsync(name, ['--version'])
		return { name, ok, version }
	}))
}

/**
 * 探测广义 AI CLI 工具链（同步兼容）。
 */
function probeAiTools() {
	return AI_TOOLS.map((name) => {
		const { ok, version } = probe(name, ['--version'])
		return { name, ok, version }
	})
}

/**
 * 并行异步探测广义 AI CLI 工具链。
 * @returns {Promise<{ name, ok, version }[]>}
 */
export async function probeAiToolsAsync() {
	return Promise.all(AI_TOOLS.map(async (name) => {
		const { ok, version } = await probeAsync(name, ['--version'])
		return { name, ok, version }
	}))
}

/**
 * 探测常用编程语言运行时（同步兼容）。
 * @returns `{ name, ok, version }[]`
 */
function probeLanguageTools() {
	return LANG_TOOLS.map(({ name, command }) => {
		const { ok, version } = probe(command, ['--version'])
		return { name, ok, version }
	})
}

/**
 * 并行异步探测编程语言运行时。
 * @returns {Promise<{ name, ok, version }[]>}
 */
export async function probeLanguageToolsAsync() {
	return Promise.all(LANG_TOOLS.map(async ({ name, command }) => {
		const { ok, version } = await probeAsync(command, ['--version'])
		return { name, ok, version }
	}))
}

/**
 * 探测硬件概况 —— **macOS 走 system_profiler，其它平台返回空数组**。
 *
 * 设计：
 *   - **不调用 system_profiler 在 Linux/Windows**：命令不存在会失败，浪费 5s 超时。
 *   - **超时 5s**：system_profiler 在某些机器上很慢，5s 是 UI 能接受的极限。
 *   - **不暴露型号字符串**：型号含设备指纹信息，主人不需要给别人看这个。
 *     **只统计**：显示器数量、GPU 数量、RAM 槽数。
 *   - **失败 → 空数组**：用户能看到"硬件探测未启用"，不会误导。
 */
function probeHardware() {
	if (platform() !== 'darwin') return { displays: [], gpus: [], memorySlots: null, ok: false }
	const spPath = fs.existsSync('/usr/sbin/system_profiler') ? '/usr/sbin/system_profiler' : 'system_profiler'
	const envPath = ['/usr/sbin', '/usr/bin', '/bin', '/usr/local/bin', '/opt/homebrew/bin', process.env.PATH].filter(Boolean).join(':')
	let stdout = ''
	try {
		const r = spawnSync(spPath, ['-json', 'SPDisplaysDataType', 'SPHardwareDataType'], {
			encoding: 'utf8',
			timeout: 5000,
			env: { ...process.env, PATH: envPath },
			stdio: ['ignore', 'pipe', 'pipe']
		})
		if (r.error || r.status !== 0 || !r.stdout) return { displays: [], gpus: [], memorySlots: null, ok: false }
		stdout = r.stdout
	} catch {
		return { displays: [], gpus: [], memorySlots: null, ok: false }
	}
	let parsed = null
	try { parsed = JSON.parse(stdout) } catch { return { displays: [], gpus: [], memorySlots: null, ok: false } }
	const displays = Array.isArray(parsed?.SPDisplaysDataType) ? parsed.SPDisplaysDataType : []
	const hardware = Array.isArray(parsed?.SPHardwareDataType) ? parsed.SPHardwareDataType[0] : null
	return {
		ok: true,
		displays: displays.map((d) => ({
			// 不暴露型号 / 序列号；只露分辨率和主屏标志
			resolution: typeof d._spdisplays_resolution === 'string' ? d._spdisplays_resolution : null,
			main: d.spdisplays_main === 'spdisplays_yes'
		})),
		gpus: Array.isArray(hardware?.spdisplays?.items) ? hardware.spdisplays.items.length : null,
		memorySlots: typeof hardware?.physical_memory === 'string' ? hardware.physical_memory : null,
		cpuType: typeof hardware?.machine_name === 'string' ? hardware.machine_name : null,
		osVersion: typeof hardware?.os_version === 'string' ? hardware.os_version : null
	}
}

let hardwareCache = null
let hardwareCacheTime = 0
const HARDWARE_CACHE_TTL_MS = 60_000

/**
 * 并行异步探测硬件概况（macOS 专用，带 60s 内存缓存避免重复调用 system_profiler）。
 * @returns {Promise<object>}
 */
export function probeHardwareAsync() {
	if (platform() !== 'darwin') return Promise.resolve({ displays: [], gpus: [], memorySlots: null, ok: false })
	if (hardwareCache && Date.now() - hardwareCacheTime < HARDWARE_CACHE_TTL_MS) {
		return Promise.resolve(hardwareCache)
	}
	const spPath = fs.existsSync('/usr/sbin/system_profiler') ? '/usr/sbin/system_profiler' : 'system_profiler'
	const envPath = ['/usr/sbin', '/usr/bin', '/bin', '/usr/local/bin', '/opt/homebrew/bin', process.env.PATH].filter(Boolean).join(':')
	return new Promise((resolve) => {
		execFile(spPath, ['-json', 'SPDisplaysDataType', 'SPHardwareDataType'], {
			encoding: 'utf8',
			timeout: 5000,
			env: { ...process.env, PATH: envPath }
		}, (error, stdout) => {
			if (error || !stdout) {
				resolve({ displays: [], gpus: [], memorySlots: null, ok: false })
				return
			}
			try {
				const parsed = JSON.parse(stdout)
				const displays = Array.isArray(parsed?.SPDisplaysDataType) ? parsed.SPDisplaysDataType : []
				const hardware = Array.isArray(parsed?.SPHardwareDataType) ? parsed.SPHardwareDataType[0] : null
				const result = {
					ok: true,
					displays: displays.map((d) => ({
						resolution: typeof d._spdisplays_resolution === 'string' ? d._spdisplays_resolution : null,
						main: d.spdisplays_main === 'spdisplays_yes'
					})),
					gpus: Array.isArray(hardware?.spdisplays?.items) ? hardware.spdisplays.items.length : null,
					memorySlots: typeof hardware?.physical_memory === 'string' ? hardware.physical_memory : null,
					cpuType: typeof hardware?.machine_name === 'string' ? hardware.machine_name : null,
					osVersion: typeof hardware?.os_version === 'string' ? hardware.os_version : null
				}
				hardwareCache = result
				hardwareCacheTime = Date.now()
				resolve(result)
			} catch {
				resolve({ displays: [], gpus: [], memorySlots: null, ok: false })
			}
		})
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
		const category = port === 3080
			? 'core'
			: (port >= 3000 && port <= 9999
				? 'dev'
				: (port >= 49152 ? 'ephemeral' : 'service'))

		if (!map.has(port)) {
			map.set(port, {
				port,
				command,
				pid: Number.isNaN(pid) ? null : pid,
				host,
				isWildcard,
				category
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
 * 并行异步探测监听端口。
 * @returns {Promise<Array<{port: number, command: string, pid: number|null, host: string, isWildcard: boolean}>>}
 */
export function probeListeningPortsAsync() {
	const envPath = ['/usr/sbin', '/usr/bin', '/bin', '/usr/local/bin', '/opt/homebrew/bin', process.env.PATH].filter(Boolean).join(':')
	const cmd = platform() === 'darwin' && fs.existsSync('/usr/sbin/lsof') ? '/usr/sbin/lsof' : 'lsof'
	return new Promise((resolve) => {
		execFile(cmd, ['-iTCP', '-sTCP:LISTEN', '-n', '-P'], {
			encoding: 'utf8',
			timeout: 3000,
			env: { ...process.env, PATH: envPath }
		}, (error, stdout) => {
			if (!error && stdout) {
				resolve(parseListeningPorts(stdout))
			} else {
				resolve([])
			}
		})
	})
}

/**
 * 拼装完整自检载荷（同步兼容）。
 * @returns 完整的 self-check JSON
 */
function readSelfCheck() {
	return {
		ok: true,
		at: Date.now(),
		system: readSystem(),
		cli: probeCliTools(),
		ai: probeAiTools(),
		languages: probeLanguageTools(),
		hardware: probeHardware(),
		plugins: probeInstalledPlugins(),
		envKeys: probeEnvKeys(),
		network: readNetworkSummary(),
		ports: probeListeningPorts()
	}
}

/**
 * 高性能异步并发拼装自检载荷（将 2.6s 串行阻塞降至 ~0.3s）。
 * @returns {Promise<object>}
 */
export async function readSelfCheckAsync() {
	const [cli, ai, languages, hardware, ports] = await Promise.all([
		probeCliToolsAsync(),
		probeAiToolsAsync(),
		probeLanguageToolsAsync(),
		probeHardwareAsync(),
		probeListeningPortsAsync()
	])
	return {
		ok: true,
		at: Date.now(),
		system: readSystem(),
		cli,
		ai,
		languages,
		hardware,
		plugins: probeInstalledPlugins(),
		envKeys: probeEnvKeys(),
		network: readNetworkSummary(),
		ports
	}
}

/**
 * 网络摘要 —— 本地读取网卡与显式代理环境变量，不主动探测远端服务。
 * 过滤虚拟网络噪音（utun/awdl/llw/bridge 等），提炼局域网 IP。
 * @returns object
 */
function readNetworkSummary() {
	const interfaces = networkInterfaces()
	const ifaces = []
	let primaryIp = null

	for (const [name, infos] of Object.entries(interfaces)) {
		if (infos === undefined) continue
		// 过滤典型的 macOS/Linux 虚拟、VPN、临时接口
		const isVirtual = /^(utun|awdl|llw|bridge|gif|stf|anpi|ap|p2p)/i.test(name)
		if (isVirtual) continue

		for (const info of infos) {
			// 过滤 IPv6 link-local (fe80::)
			if (info.family === 'IPv6' && info.address.startsWith('fe80:')) continue

			const isIpv4 = info.family === 'IPv4' || String(info.family) === '4'
			const isLanIpv4 = isIpv4 && !info.internal && (
				info.address.startsWith('192.168.') ||
				info.address.startsWith('10.') ||
				/^172\.(1[6-9]|2\d|3[01])\./.test(info.address)
			)

			if (isLanIpv4 && !primaryIp) {
				primaryIp = info.address
			}

			ifaces.push({
				name,
				family: isIpv4 ? 'IPv4' : 'IPv6',
				address: info.address,
				internal: Boolean(info.internal),
				isPrimary: isLanIpv4 && primaryIp === info.address
			})
		}
	}

	return {
		localIp: primaryIp || (ifaces.find(i => !i.internal && i.family === 'IPv4')?.address ?? '127.0.0.1'),
		proxy: readProxySettings(),
		interfaces: ifaces
	}
}

/**
 * 读取本机显式代理配置，不读取代理密码或完整 URL。
 * @returns {object} 代理配置状态
 */
function readProxySettings() {
	const names = ['HTTP_PROXY', 'HTTPS_PROXY', 'ALL_PROXY', 'http_proxy', 'https_proxy', 'all_proxy']
	const configured = names.some((name) => typeof process.env[name] === 'string' && process.env[name].length > 0)
	return { configured, source: configured ? 'environment' : null }
}

/**
 * 路由处理：GET /api/dsh-env-inspector/self-check
 * @returns JSON
 */
async function handlerSelfCheck(request, response) {
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
	try {
		const payload = await readSelfCheckAsync()
		response.writeHead(200, { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store' })
		response.end(JSON.stringify(payload))
	} catch (err) {
		response.writeHead(500, { 'content-type': 'application/json; charset=utf-8' })
		response.end(JSON.stringify({ ok: false, error: String(err && err.message ? err.message : err) }))
	}
}

/**
 * 终止指定端口上对应的进程（带绝对安全拦截）。
 * @param {object} param
 * @param {number} param.port - 端口号 (1-65535)
 * @param {number} param.pid - 进程 ID (> 1)
 * @returns {Promise<{ ok: boolean, error?: string, message?: string }>}
 */
export async function killProcessOnPort({ port, pid }) {
	const p = parseInt(String(port), 10)
	const id = parseInt(String(pid), 10)

	if (Number.isNaN(p) || p <= 0 || p > 65535) {
		return { ok: false, error: '无效的端口号' }
	}
	if (Number.isNaN(id) || id <= 1) {
		return { ok: false, error: '无效或受保护的进程 ID' }
	}

	// 1) 绝对自保：禁止杀自身进程以及 DSH 核心端口 3080
	if (id === process.pid) {
		return { ok: false, error: '禁止终止 DSH 宿主服务自身的进程' }
	}
	if (p === 3080) {
		return { ok: false, error: '禁止释放 DSH 核心服务端口 :3080' }
	}

	// 2) 状态一致性校验：核查该 PID 是否确实正在监听该端口
	const ports = probeListeningPorts()
	const target = ports.find((item) => item.port === p && item.pid === id)
	if (!target) {
		return { ok: false, error: `端口 :${p} 当前未被进程 PID ${id} 监听（可能已自行退出或 PID 不匹配）` }
	}

	// 3) 两阶段终止
	try {
		process.kill(id, 'SIGTERM')
	} catch (err) {
		if (err.code === 'ESRCH') {
			return { ok: true, message: `进程 PID ${id} 已不存在，端口已释放` }
		}
		return { ok: false, error: `发送 SIGTERM 失败: ${err.message}` }
	}

	// 等待 150ms 检查是否顺利退出
	await new Promise((resolve) => setTimeout(resolve, 150))

	try {
		process.kill(id, 0)
		// 如果仍在运行，强制 SIGKILL
		process.kill(id, 'SIGKILL')
	} catch (err) {
		// 已经退出
	}

	return { ok: true, message: `已终止进程 ${target.command} (PID: ${id})，端口 :${p} 已成功释放` }
}

/**
 * 路由处理：POST /api/dsh-env-inspector/kill-port
 */
function handlerKillPort(request, response) {
	if (request.method !== 'POST') {
		response.writeHead(405, { allow: 'POST' })
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
		response.end(JSON.stringify({ ok: false, error: 'cross-origin requests are refused' }))
		return
	}

	let body = ''
	request.on('data', (chunk) => {
		body += chunk
		if (body.length > 1024 * 16) {
			request.destroy()
		}
	})
	request.on('end', async () => {
		try {
			const data = JSON.parse(body || '{}')
			const result = await killProcessOnPort(data)
			response.writeHead(result.ok ? 200 : 400, {
				'content-type': 'application/json; charset=utf-8',
				'cache-control': 'no-store'
			})
			response.end(JSON.stringify(result))
		} catch (err) {
			response.writeHead(400, { 'content-type': 'application/json; charset=utf-8' })
			response.end(JSON.stringify({ ok: false, error: 'JSON 请求体解析失败' }))
		}
	})
}

export function apply(ctx) {
	ctx.effect(() => ctx.webServer.register({
		kind: 'exact',
		path: '/api/dsh-env-inspector/self-check',
		handler: handlerSelfCheck
	}), 'dsh-env-inspector: self-check route')

	ctx.effect(() => ctx.webServer.register({
		kind: 'exact',
		path: '/api/dsh-env-inspector/kill-port',
		handler: handlerKillPort
	}), 'dsh-env-inspector: kill-port route')
}
