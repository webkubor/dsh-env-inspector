/**
 * client.js 注册 id 守卫：与 package.json.name 一致性。
 * 跟 dsh-llm-hub 9/17 那次踩坑学到的 —— 包名迁移后没改 __ModuleLoader__.load 的 id，
 * DSH 静默丢弃该 client bundle，「Failed to load plugins」。
 *
 * @module dsh-env-inspector/test/plugin-id
 */

import assert from 'node:assert/strict'
import { test } from 'node:test'
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'

const pkg = JSON.parse(
	readFileSync(join(dirname(fileURLToPath(import.meta.url)), '../package.json'), 'utf8')
)
const client = readFileSync(join(dirname(fileURLToPath(import.meta.url)), '../lib/client.js'), 'utf8')

test('client.js 注册的 id === package.json.name', () => {
	// 候选：id 可能与 __ModuleLoader__.load( 同行或跨行。
	const match = client.match(/__ModuleLoader__\.load\s*\(\s*\{[\s\S]{0,200}?\bid:\s*['"]([^'"]+)['"]/)
	assert.ok(match, 'client.js 没找到 __ModuleLoader__.load({ id: ... })')
	assert.equal(match[1], pkg.name, `client id "${match[1]}" 与 package.json name "${pkg.name}" 不符`)
})

test('client.js 产物里不能出现顶层 import/export（classic script）', () => {
	// 简易探测：去掉字符串 / 注释 / 正则 literal 后查顶层 import/export
	// 真正的解析留给 dsh-llm-hub 风格的更严测试；这里只挡明显的破坏。
	const stripped = client
		.replace(/\/\*[\s\S]*?\*\//g, '') // /* ... */ 块注释
		.replace(/\/\/.*$/gm, '') // // 行注释
		.replace(/(['"])(?:\\.|(?!\1).)*\1/g, '""') // 字符串字面量（粗略）
	// 抓首屏前 200 行，看是否有顶层 import/export
	const top = stripped.split('\n').slice(0, 200).join('\n')
	assert.ok(!/^\s*(?:import|export)\s/m.test(top), 'client.js 不允许顶层 import/export（classic script 约束）')
})
