import assert from 'node:assert/strict';
import { test } from 'node:test';
import { spawn, spawnSync } from 'node:child_process';

// 2026-10-02：宿主从「常驻 web 服务（3080）」换成「桌面端 app（19387）」后，
// 这里写死的 3080 永远连不上 → 测试永远走 skip 分支，看着是绿的、其实**从没跑过**。
// 端口改从环境变量取，默认桌面端的 19387。
const BASE_URL = process.env.DSH_BASE_URL ?? 'http://127.0.0.1:19387';

test('E2E HTTP: 针对本地 DSH 实例的安全拦截与真实端口释放', async (t) => {
    try {
        const response = await fetch(`${BASE_URL}/api/dsh-env-inspector/self-check`, {
            signal: AbortSignal.timeout(3000),
            headers: { 'Sec-Fetch-Site': 'same-origin', 'Accept': 'application/json' }
        });
        // 401 = 宿主在跑但要认证（桌面端就是这样），这也说明**服务是活的**。
        // 只认 2xx 会把健康的宿主判成故障（同一误判在 ~/.dsh/restart.sh 里记过一次）。
        if (!response.ok && response.status !== 401) {
            throw new Error(`DSH 自检接口返回 HTTP ${response.status}`);
        }
    } catch (error) {
        if (error.name !== 'TimeoutError' && error.cause?.code !== 'ECONNREFUSED') throw error;
        t.skip('本地 DSH 服务未运行，跳过依赖真实实例的 E2E 测试');
        return;
    }

    // 1. 启动一个独立的临时子进程监听 48998
    const testPort = 48998;
    const childCode = `
        import http from 'node:http';
        const server = http.createServer((req, res) => res.end('ok'));
        server.listen(${testPort}, '127.0.0.1', () => console.log('READY'));
    `;
    const child = spawn(process.execPath, ['--input-type=module', '-e', childCode], {
        stdio: ['ignore', 'pipe', 'pipe']
    });

    await new Promise((resolve, reject) => {
        const timeout = setTimeout(() => reject(new Error('子进程启动超时')), 5000);
        child.stdout.on('data', (d) => {
            if (d.toString().includes('READY')) {
                clearTimeout(timeout);
                resolve();
            }
        });
        child.on('error', (err) => {
            clearTimeout(timeout);
            reject(err);
        });
    });

    const targetPid = child.pid;
    assert.ok(targetPid > 1);

    try {
        // 2. 自检当前监听端口
        const resSelfCheck = await fetch(`${BASE_URL}/api/dsh-env-inspector/self-check`, {
            headers: { 'Sec-Fetch-Site': 'same-origin', 'Accept': 'application/json' }
        });
        assert.equal(resSelfCheck.status, 200);
        const report = await resSelfCheck.json();
        const target = report.ports.find(p => p.port === testPort);
        assert.ok(target, `自检报告中必须包含测试端口 ${testPort}`);
        assert.equal(target.pid, targetPid);

        // 3. 测试安全拦截：尝试释放核心端口 3080
        const resBlock3080 = await fetch(`${BASE_URL}/api/dsh-env-inspector/kill-port`, {
            method: 'POST',
            headers: { 'Sec-Fetch-Site': 'same-origin', 'Content-Type': 'application/json' },
            body: JSON.stringify({ port: 3080, pid: 99999 })
        });
        assert.equal(resBlock3080.status, 400);
        const block3080Json = await resBlock3080.json();
        assert.equal(block3080Json.ok, false);
        assert.ok(block3080Json.error.includes('禁止释放 DSH 核心服务端口 :3080'));

        // 4. 真实调用 POST /api/dsh-env-inspector/kill-port 释放目标端口
        const resKill = await fetch(`${BASE_URL}/api/dsh-env-inspector/kill-port`, {
            method: 'POST',
            headers: { 'Sec-Fetch-Site': 'same-origin', 'Content-Type': 'application/json' },
            body: JSON.stringify({ port: testPort, pid: targetPid })
        });
        assert.equal(resKill.status, 200);
        const killJson = await resKill.json();
        assert.equal(killJson.ok, true);
        assert.ok(killJson.message.includes('已成功释放') || killJson.message.includes('已终止进程'));

        // 5. 再次自检验证该端口已消失
        const resAfter = await fetch(`${BASE_URL}/api/dsh-env-inspector/self-check`, {
            headers: { 'Sec-Fetch-Site': 'same-origin', 'Accept': 'application/json' }
        });
        const reportAfter = await resAfter.json();
        const foundAfter = reportAfter.ports.find(p => p.port === testPort);
        assert.equal(foundAfter, undefined, `释放后自检报告中不能再包含端口 ${testPort}`);

        // 6. 系统底层 lsof 验证进程已被销毁
        const lsofRes = spawnSync('lsof', [`-i:${testPort}`], { encoding: 'utf8' });
        assert.equal((lsofRes.stdout || '').trim(), '', 'lsof 应该再查不到该端口的任何监听');
    } finally {
        try {
            process.kill(targetPid, 'SIGKILL');
        } catch {}
    }
});
