import assert from 'node:assert/strict'
import { test } from 'node:test'
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { execFileSync } from 'node:child_process'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const root = path.resolve(__dirname, '..')

test('TypeScript definitions: types/index.d.ts & types/client.d.ts exist', () => {
	assert.ok(fs.existsSync(path.join(root, 'types/index.d.ts')), 'types/index.d.ts 必须存在')
	assert.ok(fs.existsSync(path.join(root, 'types/client.d.ts')), 'types/client.d.ts 必须存在')
	assert.ok(fs.existsSync(path.join(root, 'tsconfig.json')), 'tsconfig.json 必须存在')
})

test('TypeScript definitions: package.json exports.types configured', () => {
	const pkg = JSON.parse(fs.readFileSync(path.join(root, 'package.json'), 'utf8'))
	assert.equal(pkg.types, './types/index.d.ts')
	assert.equal(pkg.exports['.'].types, './types/index.d.ts')
	assert.equal(pkg.exports['./client'].types, './types/client.d.ts')
	assert.ok(pkg.files.includes('types'), 'files 白名单必须包含 types')
})

test('TypeScript definitions: tsc --noEmit check passes with 0 errors', () => {
	// ⚠️ 2026-10-12 修：这里原来写死**另一个仓库**的绝对路径
	// （../dsh-bloom-theme/node_modules/.bin/tsc），而且「找不到就直接 return」。
	// 两个后果叠在一起：本机因为 bloom 的 node_modules 恰好在，所以这条测试是真跑的；
	// CI 上那个路径不存在 → 静默 return → 永远绿。而类型定义恰恰是本插件对外承诺的
	// 契约（exports.types 指向它），最需要校验的地方反而没有校验。
	//
	// 改法：typescript 变成本包自己的 devDependency，tsc 从本地 node_modules 解析，
	// 解析不到就**报错**而不是静默跳过 —— 静默 skip 是这份测试库反复出问题的根源。
	const tscBin = path.join(root, 'node_modules', '.bin', 'tsc')
	assert.ok(
		fs.existsSync(tscBin),
		`找不到本地 tsc（${tscBin}）。请在本包 devDependencies 里声明 typescript —— ` +
		'不允许静默跳过类型检查。'
	)
	const stdout = execFileSync(tscBin, ['--project', 'tsconfig.json', '--noEmit'], {
		cwd: root,
		encoding: 'utf8'
	})
	assert.equal((stdout || '').trim(), '')
})
