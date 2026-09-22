/**
 * dsh-env-inspector UI 界面渲染回归测试。
 *
 * 验证：
 *   1) 模块加载与 slots 注册契约（挂载到 conversation.composer.bar）
 *   2) Badge 徽章状态渲染（加载中、CLI 就绪计数）
 *   3) Panel 详情面板展开渲染（系统、CLI、插件、秘钥、网络）
 *   4) PortsSection 活跃端口渲染（服务端口高亮、全网监听警告点、高位端口收拢）
 *
 * @module dsh-env-inspector/test/client-ui
 */

import assert from 'node:assert/strict'
import { test } from 'node:test'
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'

const PKG_NAME = JSON.parse(
	readFileSync(join(dirname(fileURLToPath(import.meta.url)), '../package.json'), 'utf8')
).name

let pluginDefinition = null
globalThis.window = {
	__ModuleLoader__: {
		load: (def) => { pluginDefinition = def }
	}
}
globalThis.document = {
	getElementById: () => null,
	createElement: () => ({ textContent: '', appendChild: () => {} }),
	head: { appendChild: () => {} }
}

await import('../lib/client.js')

function createReact(initialReport, initialOpen = false) {
	return {
		createElement: (type, props, ...children) => {
			if (typeof type === 'function') {
				return type({ ...(props ?? {}), children: children.flat() })
			}
			return { type, props: props ?? {}, children: children.flat() }
		},
		useState: (initial) => {
			if (typeof initial === 'boolean') {
				return [initialOpen, () => {}]
			}
			return [initialReport !== undefined ? initialReport : initial, () => {}]
		},
		useEffect: () => {},
		useCallback: (fn) => fn
	}
}

test('UI 注册契约：正确注册到 conversation.view 与 conversation.composer.dock', () => {
	assert.ok(pluginDefinition, 'client 脚本必须执行 __ModuleLoader__.load')
	assert.equal(pluginDefinition.id, PKG_NAME)

	const registeredSlots = []

	const fakeCtx = {
		effect: (fn) => fn(),
		locale: {
			register: () => {},
			bind: () => (key) => key
		},
		slots: {
			inject: (slotName, fn) => fn(),
			register: (config, comp) => {
				registeredSlots.push({ name: config.name, comp, id: config.id })
			}
		}
	}

	const exports = pluginDefinition.factory((name) => {
		if (name === 'react') return createReact(null)
		return {}
	})

	exports.apply(fakeCtx)
	const viewSlot = registeredSlots.find((s) => s.name === 'conversation.view')
	const dockSlot = registeredSlots.find((s) => s.name === 'conversation.composer.dock')

	assert.ok(viewSlot, '必须注册 conversation.view 独立 Tab')
	assert.ok(dockSlot, '必须注册 conversation.composer.dock 徽章')
	assert.ok(typeof viewSlot.comp === 'function')
	assert.ok(typeof dockSlot.comp === 'function')
})

test('UI 渲染：数据就绪时展示徽章与 CLI 计数', () => {
	const mockData = {
		cli: [{ name: 'git', ok: true, version: '2.39' }, { name: 'docker', ok: false }]
	}
	const React = createReact(mockData, false)
	const exports = pluginDefinition.factory((name) => (name === 'react' ? React : {}))

	let Component = null
	exports.apply({
		effect: (fn) => fn(),
		locale: { register: () => {}, bind: () => (key) => key },
		slots: {
			inject: (_, fn) => fn(),
			register: (_, comp) => { Component = comp }
		}
	})

	const vdom = Component({ t: (k) => k })
	assert.equal(vdom.props.className, 'dsh-env-inspector')
	const button = vdom.children[0]
	assert.equal(button.type, 'button')
	assert.ok(button.children.join('').includes('1 / 2 CLI'), '应展示已安装 1 / 2 CLI')
})

test('UI 渲染：面板展开时正确渲染活跃监听端口 (PortsSection)', () => {
	const mockData = {
		system: { os: 'macOS', arch: 'arm64' },
		cli: [{ name: 'git', ok: true }],
		ports: [
			{ port: 3080, command: 'node', pid: 10528, host: '127.0.0.1', isWildcard: false },
			{ port: 4183, command: 'node', pid: 43780, host: '*', isWildcard: true },
			{ port: 54000, command: 'lsp', pid: 9999, host: '127.0.0.1', isWildcard: false }
		],
		plugins: [],
		envKeys: [],
		kyvault: [],
		network: {}
	}
	// 模拟 open=true 展开面板
	const React = createReact(mockData, true)
	const exports = pluginDefinition.factory((name) => (name === 'react' ? React : {}))

	let Component = null
	exports.apply({
		effect: (fn) => fn(),
		locale: { register: () => {}, bind: () => (key) => key },
		slots: {
			inject: (_, fn) => fn(),
			register: (_, comp) => { Component = comp }
		}
	})

	const vdom = Component({ t: (k) => k })
	const panel = vdom.children.find((c) => c?.props?.className === 'dsh-env-inspector__panel')
	assert.ok(panel, '必须渲染 dsh-env-inspector__panel 详情浮窗')

	// 查找 portsSection 区块
	const portSection = panel.children.find((c) =>
		JSON.stringify(c).includes('portsSection')
	)
	assert.ok(portSection, '面板中必须包含 portsSection 端口自检区块')

	const portSectionJson = JSON.stringify(portSection)
	// 验证服务端口渲染
	assert.ok(portSectionJson.includes(':3080'), '应渲染 3080 端口')
	assert.ok(portSectionJson.includes(':4183'), '应渲染 4183 端口')
	// 验证全网监听黄色警告点
	assert.ok(portSectionJson.includes('dsh-env-inspector__warn-dot'), '全网监听端口应渲染警告点')
	// 验证高位端口收拢提示
	assert.ok(portSectionJson.includes('portsEphemeral'), '高位端口应作为动态端口收拢提示')
})

test('UI 渲染：全屏 Tab 独立视图正确渲染 Hero KPI 与卡片网格', () => {
	const mockData = {
		system: { os: 'macOS', arch: 'arm64', hostname: 'my-mac', cpu: 'Apple M3 Pro', memFreeGB: 4.5, memTotalGB: 18, uptimeMin: 120, pathDirs: 15 },
		cli: [{ name: 'git', ok: true, version: '2.40.0' }, { name: 'docker', ok: false, version: null }],
		ports: [
			{ port: 3080, command: 'node', pid: 1000, host: '127.0.0.1', isWildcard: false },
			{ port: 8080, command: 'caddy', pid: 2000, host: '*', isWildcard: true },
			{ port: 52000, command: 'chrome', pid: 3000, host: '127.0.0.1', isWildcard: false }
		],
		plugins: [{ profile: 'web', plugin: 'dsh-context', version: '0.54.2' }],
		envKeys: [{ name: 'OPENAI_API_KEY', configured: true }, { name: 'ANTHROPIC_API_KEY', configured: false }],
		kyvault: [{ name: 'secret://openai/key' }],
		network: { interfaces: [{ name: 'en0', address: '192.168.1.100', family: 4 }] }
	}

	let ViewComponent = null
	const React = createReact(mockData, false)
	const exports = pluginDefinition.factory((name) => (name === 'react' ? React : {}))

	exports.apply({
		effect: (fn) => fn(),
		locale: { register: () => {}, bind: () => (key) => key },
		slots: {
			inject: (_, fn) => fn(),
			register: (config, comp) => {
				if (config.name === 'conversation.view') ViewComponent = comp
			}
		}
	})

	assert.ok(ViewComponent, '必须能取得 conversation.view 注册的组件')
	const vdom = ViewComponent({ t: (k) => k })
	assert.equal(vdom.props.className, 'dsh-env-inspector__view-container')

	const json = JSON.stringify(vdom)
	// 验证 Hero KPI
	assert.ok(json.includes('dsh-env-stats-row'), '必须渲染顶部 4 KPI 容器')
	assert.ok(json.includes('1 / 2'), 'KPI 应体现 1 / 2 CLI')
	assert.ok(json.includes('2 个主要服务'), 'KPI 应体现 2 个主要端口服务')

	// 验证双列网格与卡片
	assert.ok(json.includes('dsh-env-grid'), '必须渲染双列卡片网格')
	assert.ok(json.includes('dsh-env-port-grid'), '必须渲染端口网格')
	assert.ok(json.includes(':3080'), '必须渲染 3080 端口')
	assert.ok(json.includes(':8080'), '必须渲染 8080 端口')
	assert.ok(json.includes('dsh-env-cli-grid'), '必须渲染 CLI 网格')
	assert.ok(json.includes('git'), 'CLI 卡片应包含 git')
	assert.ok(json.includes('Apple M3 Pro'), '系统卡片应包含 CPU 信息')
	assert.ok(json.includes('OPENAI_API_KEY'), '凭证卡片应包含环境变量')
	assert.ok(json.includes('secret://openai/key'), '凭证卡片应包含 Kyvault 引用')
	assert.ok(json.includes('dsh-context'), '插件与网络卡片应包含已装插件')
})
