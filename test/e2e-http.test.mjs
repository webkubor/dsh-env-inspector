/**
 * E2E HTTP：在一个**真的 HTTP 宿主**上验证路由、鉴权与安全护栏。
 *
 * ⚠️ 2026-10-12 重写。这份测试原来打的是本机跑着的 DSH 宿主（默认 127.0.0.1:19387，
 * 2026-10-02 之前是 3080），连不上就 `t.skip`。而 CI 里根本没有宿主在跑 —— 于是这条
 * 测试**从写下来那天起一次都没执行过**，CI 一直是绿的。这是本插件最危险的一处假绿：
 * 它的核心能力是 kill-port 真杀进程，安全护栏要是失效，测试是不会告诉任何人的。
 *
 * 改法：不再依赖外部宿主，用插件自己的 `apply()` 起一个最小宿主
 * （真实 `http.createServer` + 真实的 route handler），端口随机避开冲突。这样 CI 里
 * 每次 push 都真跑，且不依赖任何本机状态。
 *
 * 顺带钉住 SOP 第 1 条红线（路由唯一性）：假宿主的 `webServer.register` 对重复
 * `kind: 'exact'` path 直接抛错 —— 与 Cordis 真实行为一致。插件要是哪天在 apply 里
 * 注册两次同一路径，这里立刻炸，而不是等上线把整个 DSH 带崩。
 *
 * 前置条件：本机需要 `lsof`（监听端口探测依赖它）。缺了就该红，不该 skip ——
 * 静默 skip 正是这份测试原本的病根。
 */

import assert from 'node:assert/strict'
import { test, before, after } from 'node:test'
import http from 'node:http'
import { spawn, spawnSync } from 'node:child_process'

import { apply, DSH_CORE_PORTS } from '../lib/index.js'

/**
 * 起一个最小宿主：跑插件真实的 apply(ctx)，把注册到的 exact 路由接到真 HTTP 上。
 * 行为对齐 Cordis —— 同一 path 注册两次即抛错。
 */
async function startHost() {
    const routes = new Map()
    const registeredPaths = []

    const ctx = {
        effect(fn, _label) {
            fn()
            return () => {}
        },
        webServer: {
            register(route) {
                if (route.kind === 'exact' && routes.has(route.path)) {
                    throw new Error(`duplicate exact route: ${route.path}`)
                }
                routes.set(route.path, route.handler)
                registeredPaths.push(route.path)
            }
        }
    }

    apply(ctx)

    const server = http.createServer((req, res) => {
        const path = (req.url ?? '/').split('?')[0]
        const handler = routes.get(path)
        if (!handler) {
            res.writeHead(404, { 'content-type': 'text/plain; charset=utf-8' })
            return res.end('not found')
        }
        return handler(req, res)
    })

    await new Promise((resolve, reject) => {
        server.once('error', reject)
        server.listen(0, '127.0.0.1', resolve) // 0 = 让内核分配空闲端口
    })

    const { port } = server.address()
    return {
        baseUrl: `http://127.0.0.1:${port}`,
        registeredPaths,
        close: () => new Promise((resolve) => server.close(resolve))
    }
}

/** 起一个占用指定端口的独立子进程，用来当 kill-port 的靶子。 */
async function startTargetProcess(port) {
    const child = spawn(process.execPath, [
        '--input-type=module',
        '-e',
        `import http from 'node:http';
         http.createServer((req, res) => res.end('ok'))
             .listen(${port}, '127.0.0.1', () => console.log('READY'));`
    ], { stdio: ['ignore', 'pipe', 'pipe'] })

    await new Promise((resolve, reject) => {
        const timer = setTimeout(() => reject(new Error('靶子进程启动超时')), 5000)
        child.stdout.on('data', (d) => {
            if (d.toString().includes('READY')) {
                clearTimeout(timer)
                resolve()
            }
        })
        child.on('error', (err) => {
            clearTimeout(timer)
            reject(err)
        })
    })
    return child
}

const JSON_HEADERS = { 'Sec-Fetch-Site': 'same-origin', Accept: 'application/json' }

test('E2E HTTP: 安全护栏、真实端口释放与跨源拒绝', async (t) => {
    // 监听端口探测靠 lsof。缺了就红 —— 别退回 skip。
    const lsof = spawnSync('sh', ['-c', 'command -v lsof || command -v /usr/sbin/lsof'], { encoding: 'utf8' })
    if (lsof.status !== 0 || !lsof.stdout.trim()) {
        throw new Error('找不到 lsof —— 本测试依赖它探测监听端口。请安装 lsof，不要跳过本测试。')
    }

    const host = await startHost()
    t.after(() => host.close())

    const selfCheck = () => fetch(`${host.baseUrl}/api/dsh-env-inspector/self-check`, { headers: JSON_HEADERS })
    const killPort = (port, pid, headers = {}) => fetch(`${host.baseUrl}/api/dsh-env-inspector/kill-port`, {
        method: 'POST',
        headers: { 'Sec-Fetch-Site': 'same-origin', 'Content-Type': 'application/json', ...headers },
        body: JSON.stringify({ port, pid })
    })

    // ── 0. 路由注册：唯一且齐全 ──────────────────────────────────────────────
    assert.deepEqual(
        [...new Set(host.registeredPaths)].sort(),
        [...host.registeredPaths].sort(),
        `同一路径被注册了多次：${host.registeredPaths.join(', ')}`
    )
    assert.ok(
        host.registeredPaths.includes('/api/dsh-env-inspector/self-check') &&
        host.registeredPaths.includes('/api/dsh-env-inspector/kill-port'),
        `路由注册不全: ${host.registeredPaths.join(', ')}`
    )

    // ── 1. 自检能跑通，并看得见靶子端口 ──────────────────────────────────────
    const testPort = 48998
    const child = await startTargetProcess(testPort)
    const targetPid = child.pid
    assert.ok(targetPid > 1)
    t.after(() => {
        try { process.kill(targetPid, 'SIGKILL') } catch { /* 已终止 */ }
    })

    const resSelfCheck = await selfCheck()
    assert.equal(resSelfCheck.status, 200)
    const report = await resSelfCheck.json()
    const target = report.ports.find((p) => p.port === testPort)
    assert.ok(target, `自检报告中必须包含靶子端口 ${testPort}`)
    assert.equal(target.pid, targetPid)

    // ── 2. 核心端口护栏 ──────────────────────────────────────────────────────
    // ⚠️ 光遍历 DSH_CORE_PORTS 是**自指**的：表里有什么就测什么，表漏了真实宿主端口
    // 它照样绿。这条测试原本就栽在「两边各写一份」的坑上（护栏只挡 3080、漏了 19387，
    // 而测试也只测 3080），所以这里必须有一句**不依赖那张表**的硬断言。
    for (const port of DSH_CORE_PORTS) {
        const res = await killPort(port, 99999)
        assert.equal(res.status, 400, `核心端口 :${port} 应被拦截，实际 HTTP ${res.status}`)
        const json = await res.json()
        assert.equal(json.ok, false)
        assert.ok(json.error.includes(`禁止释放 DSH 核心服务端口 :${port}`), `:${port} 拦截文案不对: ${json.error}`)
    }

    // 当前宿主端口写死在这儿独立断言：桌面端换端口时，这句会先红，提醒把新端口
    // 加进 DSH_CORE_PORTS，而不是等用户在生产上把宿主杀了。
    {
        const res = await killPort(19387, 99999)
        assert.equal(res.status, 400, '当前桌面端宿主端口 19387 必须被拦截')
        assert.ok((await res.json()).error.includes('禁止释放 DSH 核心服务端口 :19387'))
    }

    // ── 3. 跨源请求一律拒绝（这条护栏此前完全没有覆盖） ──────────────────────
    const resCross = await killPort(testPort, targetPid, { 'Sec-Fetch-Site': 'cross-site' })
    assert.equal(resCross.status, 403, `跨源 kill-port 应被 403，实际 HTTP ${resCross.status}`)
    assert.equal((await resCross.json()).ok, false)
    // 被拒之后进程必须还活着 —— 403 是真的没执行，不是执行了但回了个错码。
    assert.doesNotThrow(() => process.kill(targetPid, 0), '跨源请求竟然把进程杀了')

    // ── 4. 方法校验：GET 不该触发任何终止 ────────────────────────────────────
    const resGet = await fetch(`${host.baseUrl}/api/dsh-env-inspector/kill-port`, { headers: JSON_HEADERS })
    assert.equal(resGet.status, 405, `GET kill-port 应为 405，实际 HTTP ${resGet.status}`)

    // ── 5. 真实终止并释放端口 ────────────────────────────────────────────────
    const resKill = await killPort(testPort, targetPid)
    assert.equal(resKill.status, 200)
    const killJson = await resKill.json()
    assert.equal(killJson.ok, true)
    assert.ok(killJson.message.includes('已成功释放') || killJson.message.includes('已终止进程'))

    // ── 6. 释放后端口消失，且 lsof 底层也查不到 ──────────────────────────────
    const reportAfter = await (await selfCheck()).json()
    assert.equal(
        reportAfter.ports.find((p) => p.port === testPort),
        undefined,
        `释放后自检报告中不能再包含端口 ${testPort}`
    )
    const lsofRes = spawnSync('sh', ['-c', `lsof -i:${testPort} -n -P || true`], { encoding: 'utf8' })
    assert.equal((lsofRes.stdout || '').trim(), '', 'lsof 应该再查不到该端口的任何监听')
})