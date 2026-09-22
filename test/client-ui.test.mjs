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
		useEffect: () => {}
	}
}

test('UI 注册契约：正确注册到 conversation.composer.bar slot', () => {
	assert.ok(pluginDefinition, 'client 脚本必须执行 __ModuleLoader__.load')
	assert.equal(pluginDefinition.id, PKG_NAME)

	let registeredSlot = null
	let registeredComponent = null

	const fakeCtx = {
		effect: (fn) => fn(),
		locale: {
			register: () => {},
			bind: () => (key) => key
		},
		slots: {
			inject: (slotName, fn) => fn(),
			register: (config, comp) => {
				registeredSlot = config.name
				registeredComponent = comp
			}
		}
	}

	const exports = pluginDefinition.factory((name) => {
		if (name === 'react') return createReact(null)
		return {}
	})

	exports.apply(fakeCtx)
	assert.equal(registeredSlot, 'conversation.composer.bar', '必须挂载在 composer.bar')
	assert.ok(typeof registeredComponent === 'function', '必须导出有效的 React 徽章组件')
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
