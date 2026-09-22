/**
 * dsh-env-inspector —— Client（浏览器）半。
 *
 * 设计：在 conversation.composer.bar 里塞一行紧凑的「环境徽章」 —— 让人一眼看到自己电脑
 * 装了什么；点徽章弹一个 modal（DSH 暂未发现原生 modal slot，先用 details/summary 折中实现）。
 *
 * **零依赖**：纯 React，host 半返回 JSON，client 半直接渲染。
 * **零敏感信息泄露**：client 半**不**调任何能拿到秘钥明文的接口（host 半也只返存在与否）。
 *
 * @module dsh-env-inspector/client
 */

window.__ModuleLoader__.load({
	// **必须是完整包名**（含 scope）—— 宿主按 package.json.name 找这个注册。
	// 否则 DSH 会静默丢弃该 client bundle。
	id: '@dsh-plugins/dsh-env-inspector',
	factory: (require) => {
		const module = { exports: {} }
		const exports = module.exports

		const React = require('react')
		const h = React.createElement

		const NS = 'dsh-env-inspector'
		const SELF_CHECK_URL = '/api/dsh-env-inspector/self-check'

		/**
		 * 词典：双语 —— locale 注入时用，缺省走中文（与 dsh-user-mirror 一致）。
		 * @type {object}
		 */
		const LOCALES = {
			zh: {
				title: '电脑环境',
				loading: '检查中…',
				noData: '还没读到环境信息',
				openDetail: '查看完整信息',
				systemSection: '系统',
				cliSection: '命令行工具',
				pluginsSection: '已装 DSH 插件',
				kyvaultSection: '已存秘钥（kyvault）',
				envKeysSection: '已配环境变量 key',
				networkSection: '网络接口',
				portsSection: '活跃监听端口',
				portsEphemeral: '动态高位端口',
				portAllWarning: '全网监听 (* / 0.0.0.0)',
				cliInstalled: '已装',
				cliMissing: '没装',
				envKeyConfigured: '已配',
				envKeyMissing: '未配',
				pluginVersion: '版本',
				openSourceOnGitHub: '在 GitHub 查看源码',
				footerNote: '本插件只列出存在性，秘钥明文永不显示。'
			},
			en: {
				title: 'PC environment',
				loading: 'Checking…',
				noData: 'no environment data yet',
				openDetail: 'View full details',
				systemSection: 'System',
				cliSection: 'CLI tools',
				pluginsSection: 'Installed DSH plugins',
				kyvaultSection: 'Stored secrets (kyvault)',
				envKeysSection: 'Env-var keys',
				networkSection: 'Network interfaces',
				portsSection: 'Active listening ports',
				portsEphemeral: 'Ephemeral ports',
				portAllWarning: 'All interfaces (* / 0.0.0.0)',
				cliInstalled: 'installed',
				cliMissing: 'missing',
				envKeyConfigured: 'set',
				envKeyMissing: 'unset',
				pluginVersion: 'v',
				openSourceOnGitHub: 'View source on GitHub',
				footerNote: 'This plugin only shows presence — secret values are never displayed.'
			}
		}
		const fallbackT = (key) => LOCALES.zh[key] ?? key

		/**
		 * 注入一次卡片样式 —— 用 DSH 主题变量，明暗自适应。
		 * 用了三次：徽章行 / 详情面板 / 表格行 —— class 前缀统一 dsh-env-inspector-*。
		 */
		function ensureStyle() {
			const id = 'dsh-env-inspector-style'
			if (document.getElementById(id) !== null) return
			const style = document.createElement('style')
			style.id = id
			style.textContent = [
				// composer 顶栏里的徽章容器 —— 一行 chip，不换行优先。
				'.dsh-env-inspector{display:inline-flex;align-items:center;gap:6px;flex-wrap:wrap;',
				'padding:2px 4px}',
				// 单个 chip —— 通用样式
				'.dsh-env-inspector__chip{display:inline-flex;align-items:center;height:22px;padding:0 8px;',
				'border-radius:999px;border:.5px solid var(--dsw-alias-border-l3);',
				'font-size:11px;line-height:16px;color:var(--dsw-alias-label-secondary);',
				'background:var(--dsw-alias-bg-layer-3);cursor:pointer}',
				'.dsh-env-inspector__chip:hover{background:var(--dsw-alias-interactive-bg-hover)}',
				// 详情面板 —— 在 composer 上方展开，绝对定位
				'.dsh-env-inspector__panel{position:absolute;z-index:1000;',
				'min-width:520px;max-width:80vw;max-height:60vh;overflow:auto;',
				'padding:12px 16px;border-radius:8px;',
				'border:.5px solid var(--dsw-alias-border-l1);',
				'background:var(--dsw-alias-bg-layer-2);',
				'box-shadow:0 4px 12px rgba(0,0,0,.15);',
				'font-size:12px;line-height:18px;color:var(--dsw-alias-label-primary)}',
				'.dsh-env-inspector__panel-head{display:flex;align-items:center;justify-content:space-between;',
				'gap:8px;margin-bottom:8px}',
				'.dsh-env-inspector__panel-title{font-weight:600;font-size:13px}',
				'.dsh-env-inspector__close{border:0;background:transparent;cursor:pointer;',
				'color:var(--dsw-alias-label-secondary);font-size:14px;padding:2px 6px}',
				'.dsh-env-inspector__section{margin-top:10px}',
				'.dsh-env-inspector__section-title{font-weight:600;color:var(--dsw-alias-label-primary);',
				'margin-bottom:4px;font-size:12px}',
				// 系统 / CLI 表格 —— 单 key 多行
				'.dsh-env-inspector__row{display:flex;justify-content:space-between;gap:8px;',
				'padding:2px 0;border-bottom:.5px solid var(--dsw-alias-border-l1)}',
				'.dsh-env-inspector__row:last-child{border-bottom:0}',
				'.dsh-env-inspector__key{color:var(--dsw-alias-label-secondary);font-family:ui-monospace,SFMono-Regular,Menlo,monospace}',
				'.dsh-env-inspector__val{color:var(--dsw-alias-label-primary)}',
				// 已装 / 未配 状态色
				'.dsh-env-inspector__ok{color:var(--dsw-alias-state-success-primary,#3fb950)}',
				'.dsh-env-inspector__bad{color:var(--dsw-alias-state-warn-primary)}',
				// 端口样式
				'.dsh-env-inspector__port-chip{display:inline-flex;align-items:center;gap:4px;',
				'font-family:ui-monospace,SFMono-Regular,Menlo,monospace}',
				'.dsh-env-inspector__warn-dot{display:inline-block;width:5px;height:5px;',
				'border-radius:50%;background:var(--dsw-alias-state-warn-primary,#f59e0b)}',
				// footer 注
				'.dsh-env-inspector__footer{margin-top:10px;font-size:11px;',
				'color:var(--dsw-alias-label-secondary);opacity:.75}'
			].join('')
			document.head.appendChild(style)
		}

		/**
		 * 把"已装 / 没装"渲染成 chip。
		 * @param ok
		 * @param text
		 * @returns React node
		 */
		function statusChip(ok, text) {
			return h('span', { className: `dsh-env-inspector__chip ${ok ? 'dsh-env-inspector__ok' : 'dsh-env-inspector__bad'}` }, text)
		}

		/**
		 * 系统信息行（OS / arch / node / shell ...）
		 * @param sys
		 * @param t
		 * @returns React node
		 */
		function SystemSection(sys, t) {
			const rows = [
				['OS', `${sys.os} (${sys.arch})`],
				['Hostname', sys.hostname],
				['User', `${sys.user} (home: ${sys.home})`],
				['Shell', sys.shell],
				['Node', sys.nodeVersion],
				['CPU', sys.cpu],
				['Memory', `${sys.memFreeGB} / ${sys.memTotalGB} GB free`],
				['Uptime', `${sys.uptimeMin} min`],
				['PATH dirs', `${sys.pathDirs}`]
			]
			return h('div', { className: 'dsh-env-inspector__section' },
				h('div', { className: 'dsh-env-inspector__section-title' }, t('systemSection')),
				...rows.map(([k, v]) => h('div', { key: k, className: 'dsh-env-inspector__row' },
					h('span', { className: 'dsh-env-inspector__key' }, k),
					h('span', { className: 'dsh-env-inspector__val' }, v))))
		}

		/**
		 * CLI 工具列表（行内 chip，已装绿、未装灰）。
		 * @param cli
		 * @param t
		 * @returns React node
		 */
		function CliSection(cli, t) {
			const installed = cli.filter((c) => c.ok).map((c) => c.name)
			const missing = cli.filter((c) => !c.ok).map((c) => c.name)
			return h('div', { className: 'dsh-env-inspector__section' },
				h('div', { className: 'dsh-env-inspector__section-title' }, `${t('cliSection')} (${installed.length}/${cli.length})`),
				h('div', { style: { display: 'flex', flexWrap: 'wrap', gap: '4px' } },
					...cli.map((c) => h('span', {
						key: c.name,
						className: `dsh-env-inspector__chip ${c.ok ? 'dsh-env-inspector__ok' : 'dsh-env-inspector__bad'}`,
						title: c.version ?? (c.ok ? 'installed' : 'not installed')
					}, `${c.name}${c.ok && c.version !== null ? ' · ' + c.version : ''}`))),
				(missing.length === cli.length) ? h('div', { className: 'dsh-env-inspector__footer' }, '—') : null
			)
		}

		/**
		 * 活跃监听端口（区分常用服务端口 vs 高位动态端口）。
		 * @param ports
		 * @param t
		 * @returns React node
		 */
		function PortsSection(ports, t) {
			const list = Array.isArray(ports) ? ports : []
			if (list.length === 0) return null
			const servicePorts = list.filter((p) => p.port <= 49151)
			const ephemeralPorts = list.filter((p) => p.port > 49151)
			return h('div', { className: 'dsh-env-inspector__section' },
				h('div', { className: 'dsh-env-inspector__section-title' }, `${t('portsSection')} (${servicePorts.length}${ephemeralPorts.length > 0 ? ' + ' + ephemeralPorts.length : ''})`),
				h('div', { style: { display: 'flex', flexWrap: 'wrap', gap: '4px' } },
					...servicePorts.map((p) => h('span', {
						key: `${p.port}/${p.pid}`,
						className: 'dsh-env-inspector__chip dsh-env-inspector__port-chip',
						title: `${p.command} (PID: ${p.pid ?? '—'})\n${p.host}:${p.port}${p.isWildcard ? ' [' + t('portAllWarning') + ']' : ''}`
					},
						p.isWildcard ? h('span', { className: 'dsh-env-inspector__warn-dot' }) : null,
						h('span', { style: { fontWeight: 600 } }, `:${p.port}`),
						h('span', { style: { opacity: 0.8 } }, `· ${p.command}`)
					))
				),
				ephemeralPorts.length > 0 ? h('div', { className: 'dsh-env-inspector__footer' },
					`${t('portsEphemeral')} (${ephemeralPorts.length}): ${ephemeralPorts.slice(0, 8).map((p) => `:${p.port}(${p.command})`).join(', ')}${ephemeralPorts.length > 8 ? '…' : ''}`
				) : null
			)
		}

		/**
		 * 已装的 DSH 插件。
		 * @param plugins
		 * @param t
		 * @returns React node
		 */
		function PluginsSection(plugins, t) {
			return h('div', { className: 'dsh-env-inspector__section' },
				h('div', { className: 'dsh-env-inspector__section-title' }, `${t('pluginsSection')} (${plugins.length})`),
				plugins.length === 0
					? h('div', { className: 'dsh-env-inspector__footer' }, '—')
					: h('div', null,
						...plugins.map((p) => h('div', { key: `${p.profile}/${p.plugin}`, className: 'dsh-env-inspector__row' },
							h('span', { className: 'dsh-env-inspector__key' }, `${p.plugin} @ ${p.profile}`),
							h('span', { className: 'dsh-env-inspector__val' }, `${t('pluginVersion')}${p.version}`))))
			)
		}

		/**
		 * kyvault 里已存的秘钥引用（**只显示引用名**，不显示值）。
		 * @param refs
		 * @param t
		 * @returns React node
		 */
		function KyvaultSection(refs, t) {
			return h('div', { className: 'dsh-env-inspector__section' },
				h('div', { className: 'dsh-env-inspector__section-title' }, `${t('kyvaultSection')} (${refs.length})`),
				refs.length === 0
					? h('div', { className: 'dsh-env-inspector__footer' }, '—')
					: h('div', { style: { display: 'flex', flexWrap: 'wrap', gap: '4px' } },
						...refs.map((r) => h('span', { key: r.name, className: 'dsh-env-inspector__chip' }, r.name)))
			)
		}

		/**
		 * 环境变量 key 的存在性。
		 * @param keys
		 * @param t
		 * @returns React node
		 */
		function EnvKeysSection(keys, t) {
			return h('div', { className: 'dsh-env-inspector__section' },
				h('div', { className: 'dsh-env-inspector__section-title' }, t('envKeysSection')),
				...keys.map((k) => h('div', { key: k.name, className: 'dsh-env-inspector__row' },
					h('span', { className: 'dsh-env-inspector__key' }, k.name),
					h('span', {
						className: `dsh-env-inspector__val ${k.configured ? 'dsh-env-inspector__ok' : 'dsh-env-inspector__bad'}`
					}, k.configured ? t('envKeyConfigured') : t('envKeyMissing'))))
			)
		}

		/**
		 * 网络接口列表 —— 数量多时折叠（只显示前 5 条 + N more）。
		 * @param net
		 * @param t
		 * @returns React node
		 */
		function NetworkSection(net) {
			const ifaces = Array.isArray(net.interfaces) ? net.interfaces : []
			const visible = ifaces.slice(0, 5)
			const more = ifaces.length - visible.length
			return h('div', { className: 'dsh-env-inspector__section' },
				h('div', { className: 'dsh-env-inspector__section-title' }, `网络接口 (${ifaces.length})`),
				...visible.map((iface, i) => h('div', { key: `${iface.name}/${i}`, className: 'dsh-env-inspector__row' },
					h('span', { className: 'dsh-env-inspector__key' }, `${iface.name} (${iface.family === 4 ? 'IPv4' : iface.family === 6 ? 'IPv6' : iface.family})`),
					h('span', { className: 'dsh-env-inspector__val' }, iface.address))),
				more > 0 ? h('div', { className: 'dsh-env-inspector__footer' }, `... 还有 ${more} 条`) : null
			)
		}

		/**
		 * 整个 client 组件 —— 在 composer.composer.bar 里 render。
		 * @param props - 注入的 `t`
		 * @returns React node
		 */
		function EnvInspectorBadge(props) {
			const t = typeof props.t === 'function' ? props.t : fallbackT
			const [report, setReport] = React.useState(null)
			const [open, setOpen] = React.useState(false)
			React.useEffect(() => {
				let alive = true
				fetch(SELF_CHECK_URL, { headers: { accept: 'application/json' } })
					.then((res) => res.json())
					.then((body) => { if (alive) setReport(body !== null && typeof body === 'object' ? body : null) })
					.catch(() => { if (alive) setReport(null) })
				return () => { alive = false }
			}, [])
			ensureStyle()
			const cli = Array.isArray(report?.cli) ? report.cli : []
			const installedCount = cli.filter((c) => c.ok).length
			return h('div', { className: 'dsh-env-inspector' },
				h('button', {
					type: 'button',
					className: 'dsh-env-inspector__chip',
					onClick: () => setOpen((v) => !v),
					title: t('openDetail'),
					style: { border: 0, cursor: 'pointer' }
				}, report === null
					? t('loading')
					: `${t('title')} · ${installedCount} / ${cli.length} CLI`),
				open && report !== null ? h('div', { className: 'dsh-env-inspector__panel' },
					h('div', { className: 'dsh-env-inspector__panel-head' },
						h('span', { className: 'dsh-env-inspector__panel-title' }, t('title')),
						h('button', { type: 'button', className: 'dsh-env-inspector__close', onClick: () => setOpen(false) }, '×')),
					SystemSection(report.system ?? {}, t),
					CliSection(cli, t),
					PortsSection(report.ports ?? [], t),
					PluginsSection(Array.isArray(report.plugins) ? report.plugins : [], t),
					EnvKeysSection(Array.isArray(report.envKeys) ? report.envKeys : [], t),
					KyvaultSection(Array.isArray(report.kyvault) ? report.kyvault : [], t),
					NetworkSection(report.network ?? {}, t),
					h('div', { className: 'dsh-env-inspector__footer' }, t('footerNote'))
				) : null
			)
		}

		const inject = ['slots', 'locale']

		function apply(ctx) {
			ensureStyle()
			ctx.effect(() => ctx.locale.register(NS, LOCALES), 'dsh-env-inspector: dictionaries')
			const t = ctx.locale.bind(NS)
			ctx.slots.inject('conversation.composer.bar', () => ctx.slots.register({
				name: 'conversation.composer.bar',
				id: 'dsh-env-inspector',
				order: 100,
				locale: NS,
				inject: () => ({ t })
			}, EnvInspectorBadge))
		}

		exports.apply = apply
		exports.inject = inject
		return module.exports
	}
})
