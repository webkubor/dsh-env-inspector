/**
 * README.md 包名守卫：防止以后改名漏改 README。
 *
 * 跟 dsh-llm-hub 的同名守卫同思路：包名从 package.json 读，断言 README 里出现。
 * @module dsh-env-inspector/test/readme-package-name
 */

import assert from 'node:assert/strict'
import { test } from 'node:test'
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'

const pkg = JSON.parse(
	readFileSync(join(dirname(fileURLToPath(import.meta.url)), '../package.json'), 'utf8')
)
const readme = readFileSync(join(dirname(fileURLToPath(import.meta.url)), '../README.md'), 'utf8')

test('README.md 包含 package.json name（防改名漏改）', () => {
	assert.ok(readme.includes(pkg.name), `README.md 缺少当前包名 "${pkg.name}" —— 包名迁移后请同步 README`)
})
