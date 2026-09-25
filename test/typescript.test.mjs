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
	const tscBin = '/Users/webkubor/dev/dsh-plugins/dsh-bloom-theme/node_modules/.bin/tsc'
	if (!fs.existsSync(tscBin)) return
	const stdout = execFileSync(tscBin, ['--project', 'tsconfig.json', '--noEmit'], {
		cwd: root,
		encoding: 'utf8'
	})
	assert.equal((stdout || '').trim(), '')
})
