/**
 * killProcessOnPort 安全护栏与真实进程终止测试。
 *
 * @module dsh-env-inspector/test/kill-port
 */

import assert from 'node:assert/strict'
import { test } from 'node:test'
import { createServer } from 'node:http'
import { spawn } from 'node:child_process'
import { killProcessOnPort } from '../lib/index.js'

test('killProcessOnPort: 校验无效参数拦截', async () => {
	const res1 = await killProcessOnPort({ port: -1, pid: 100 })
	assert.equal(res1.ok, false)
	assert.ok(res1.error.includes('无效的端口号'))

	const res2 = await killProcessOnPort({ port: 8080, pid: 0 })
	assert.equal(res2.ok, false)
	assert.ok(res2.error.includes('无效或受保护的进程 ID'))

	const res3 = await killProcessOnPort({ port: 8080, pid: 1 })
	assert.equal(res3.ok, false)
	assert.ok(res3.error.includes('无效或受保护的进程 ID'))
})

test('killProcessOnPort: 防自杀保护 —— 拒绝杀 3080 与自身 PID', async () => {
	const res3080 = await killProcessOnPort({ port: 3080, pid: 99999 })
	assert.equal(res3080.ok, false)
	assert.ok(res3080.error.includes('禁止释放 DSH 核心服务端口 :3080'))

	const resSelf = await killProcessOnPort({ port: 8080, pid: process.pid })
	assert.equal(resSelf.ok, false)
	assert.ok(resSelf.error.includes('禁止终止 DSH 宿主服务自身的进程'))
})

test('killProcessOnPort: 状态一致性校验 —— 拒绝未监听或伪造的 PID', async () => {
	// 传入一个随机未占用的高位端口和随机 PID
	const res = await killProcessOnPort({ port: 59999, pid: 98765 })
	assert.equal(res.ok, false)
	assert.ok(res.error.includes('当前未被进程 PID'))
})

test('killProcessOnPort: 真实启动子进程并安全终止与释放端口', async () => {
	// 启动一个极简的子进程 node 脚本监听本地空闲端口 48999
	const testPort = 48999
	const childCode = `
		import http from 'node:http';
		const server = http.createServer((req, res) => res.end('ok'));
		server.listen(${testPort}, '127.0.0.1', () => console.log('READY'));
	`
	const child = spawn(process.execPath, ['--input-type=module', '-e', childCode], {
		stdio: ['ignore', 'pipe', 'pipe']
	})

	// 等待子进程输出 READY
	await new Promise((resolve, reject) => {
		const timeout = setTimeout(() => reject(new Error('子进程启动超时')), 5000)
		child.stdout.on('data', (d) => {
			if (d.toString().includes('READY')) {
				clearTimeout(timeout)
				resolve()
			}
		})
		child.on('error', (err) => {
			clearTimeout(timeout)
			reject(err)
		})
	})

	// 确认 PID 存在
	const childPid = child.pid
	assert.ok(childPid > 1)

	// 执行 killProcessOnPort
	const killRes = await killProcessOnPort({ port: testPort, pid: childPid })
	assert.equal(killRes.ok, true, `Kill 应当成功: ${killRes.error}`)
	assert.ok(killRes.message.includes(`已终止进程`))

	// 等待一小会儿验证子进程已被杀死
	await new Promise((resolve) => setTimeout(resolve, 300))
	let stillAlive = true
	try {
		process.kill(childPid, 0)
	} catch {
		stillAlive = false
	}
	assert.equal(stillAlive, false, '子进程应当已退出')
})
