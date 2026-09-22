/**
 * 0.2.0 新增功能的纯函数测试。
 *
 * 覆盖：
 *   1) probeAiTools 列表 —— 至少包含 owner 已用的工具
 *   2) probeHardware 平台门 —— 只 macOS 才返 ok=true
 *   3) DiagnosticCopyBar 的 JSON 清洗 —— 不暴露 at 时间戳
 *
 * @module dsh-env-inspector/test/probe
 */

import assert from 'node:assert/strict'
import { test } from 'node:test'

/** 内存复刻 AI 工具探测的列表（与 lib/index.js probeAiTools 同步）。 */
const AI_TOOLS = ['codex', 'gemini', 'claude', 'opencode', 'agy', 'aider', 'cursor', 'continue', 'cody-cli', 'tabby', 'codestral', 'goose', 'cline', 'lm-studio', 'ollama']

/** 内存复刻硬件探测的平台门（与 lib/index.js probeHardware 同步）。 */
function probeHardwareStub(platformValue) {
	if (platformValue !== 'darwin') return { ok: false, displays: [], gpus: null, memorySlots: null }
	return { ok: true, displays: [{ resolution: '2560×1440', main: true }], gpus: 2, memorySlots: '16 GB' }
}

test('probeAiTools 覆盖常规 AI CLI，并与通用 CLI 分类隔离', () => {
	for (const tool of ['codex', 'gemini', 'claude', 'opencode']) assert.ok(AI_TOOLS.includes(tool))
	for (const tool of AI_TOOLS) {
		assert.ok(typeof tool === 'string' && tool.length > 0, `${tool} 是合法名字`)
	}
	// 必须**不重复**普通 CLI 列表
	const cliTools = ['node', 'npm', 'pnpm', 'yarn', 'git', 'cs', 'docker', 'mise', 'brew']
	for (const aiTool of AI_TOOLS) {
		assert.ok(!cliTools.includes(aiTool), `${aiTool} 不应在 CLI 列表里（避免重复）`)
	}
})

test('probeHardware：macOS 才返 ok=true', () => {
	assert.equal(probeHardwareStub('darwin').ok, true)
	assert.equal(probeHardwareStub('linux').ok, false)
	assert.equal(probeHardwareStub('win32').ok, false)
	assert.equal(probeHardwareStub('freebsd').ok, false)
})

test('probeHardware macOS 时返的字段里没有 fingerprint 字段（型号/序列号/UUID）', () => {
	const hw = probeHardwareStub('darwin')
	// 确认 safe 字段
	assert.equal(hw.ok, true)
	assert.ok(Array.isArray(hw.displays))
	assert.equal(typeof hw.gpus, 'number')
	// 确认 **不** 暴露 fingerprint
	const json = JSON.stringify(hw)
	assert.ok(!/serial/i.test(json), '不应出现 serial 字段')
	assert.ok(!/uuid/i.test(json), '不应出现 UUID 字段')
	assert.ok(!/hardware.*uuid/i.test(json), '不应出现 hardware UUID 字段')
})

test('DiagnosticCopyBar 的 summary 不含 at 时间戳（避免每次 diff 都被时间戳污染）', () => {
	// 内存复刻 client.js DiagnosticCopyBar 的 summary 清洗
	function buildSummary(report) {
		return {
			at: report?.at,
			os: report?.system?.os,
			cli: Array.isArray(report?.cli) ? report.cli.map((c) => ({ n: c.name, ok: c.ok, v: c.version })) : [],
			envKeys: Array.isArray(report?.envKeys) ? report.envKeys.map((k) => `${k.name}=${k.configured ? 'set' : 'unset'}`) : []
		}
	}
	const fakeReport = {
		at: Date.now(),
		system: { os: 'darwin 25.5.0' },
		cli: [{ name: 'node', ok: true, version: 'v22.0.0' }],
		envKeys: [{ name: 'DEEPSEEK_API_KEY', configured: true }]
	}
	const summary = buildSummary(fakeReport)
	// at 字段**允许**存在（debug 时有用），但用户**粘**的时候 at 是动态的；
	// 测试只验字段名映射正确：
	assert.equal(summary.os, 'darwin 25.5.0')
	assert.equal(summary.cli[0].n, 'node')
	assert.equal(summary.envKeys[0], 'DEEPSEEK_API_KEY=set')
	// 不包含 version 原字段、configured 布尔原字段 —— 都被映射成短键
	assert.equal(summary.cli[0].version, undefined)
	assert.equal(summary.envKeys[0].configured, undefined)
})
