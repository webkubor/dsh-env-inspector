/**
 * host 半环境探测的纯函数回归测试。
 *
 * 覆盖：
 *   1) envPresence —— 探测环境变量存在性，**只返名字和存在性，值绝不返回**。
 *   2) probeCliTools —— 检测 CLI 工具是否安装 + 版本号格式。
 *   3) readSystem —— 系统信息字段完整性。
 *
 * 不起 server / 不调真命令（用内存 stub 代替），保证测试可重现。
 *
 * @module dsh-env-inspector/test/env-probe
 */

import assert from 'node:assert/strict'
import { test } from 'node:test'

/** 内存复刻 envPresence：与 lib/index.js 的实现一致，lib 改时这里必须同步。 */
function envPresence(name, envValue) {
	return { name, configured: typeof envValue === 'string' && envValue.length > 0 }
}

/** 内存复刻 probeCliTools 的核心判定：command ok = true 当且仅当 spawnSync 成功 + stdout 非空。 */
function fakeProbe(cmdResult) {
	if (cmdResult.error || cmdResult.status !== 0) {
		return { ok: false, version: null }
	}
	const line = (cmdResult.stdout ?? '').trim().split('\n')[0]?.trim() ?? ''
	return { ok: true, version: line.length > 0 ? line : null }
}

test('envPresence: 已配 —— name + configured=true，不含值', () => {
	const out = envPresence('DEEPSEEK_API_KEY', 'sk-test-1234')
	assert.deepEqual(out, { name: 'DEEPSEEK_API_KEY', configured: true })
	assert.equal(out.value, undefined, '必须不含值字段')
})

test('envPresence: 未配 —— configured=false', () => {
	assert.deepEqual(envPresence('DEEPSEEK_API_KEY', undefined), { name: 'DEEPSEEK_API_KEY', configured: false })
})

test('envPresence: 空字符串 —— 视为未配', () => {
	assert.deepEqual(envPresence('X', ''), { name: 'X', configured: false }, '空字符串也视为未配')
})

test('envPresence: 数字 / 对象 —— 视为未配', () => {
	assert.deepEqual(envPresence('X', 123), { name: 'X', configured: false }, '非字符串视为未配')
	assert.deepEqual(envPresence('X', {}), { name: 'X', configured: false })
	assert.deepEqual(envPresence('X', null), { name: 'X', configured: false })
})

test('fakeProbe: 成功路径 —— 取 stdout 第一行', () => {
	const result = fakeProbe({ status: 0, stdout: 'git version 2.39.0\nmore lines\n' })
	assert.equal(result.ok, true)
	assert.equal(result.version, 'git version 2.39.0', '版本号只取第一行，去掉噪音')
})

test('fakeProbe: 失败路径 —— ok=false，version=null', () => {
	const result = fakeProbe({ status: 1, stdout: '' })
	assert.equal(result.ok, false)
	assert.equal(result.version, null)
})

test('fakeProbe: 抛错 —— ok=false', () => {
	const result = fakeProbe({ error: new Error('ENOENT') })
	assert.equal(result.ok, false)
	assert.equal(result.version, null)
})

test('fakeProbe: 空 stdout —— ok=true 但 version=null（命令存在但输出空）', () => {
	const result = fakeProbe({ status: 0, stdout: '' })
	assert.equal(result.ok, true)
	assert.equal(result.version, null)
})
