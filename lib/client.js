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
				// 全屏 Tab 视图现代 Dashboard 样式
				'.dsh-env-inspector__view-container{padding:24px 32px 200px;max-width:1080px;margin:0 auto;',
				'overflow-y:auto;height:100%;font-size:13px;line-height:20px;box-sizing:border-box}',
				'.dsh-env-inspector__view-head{display:flex;align-items:baseline;justify-content:space-between;',
				'margin-bottom:16px;border-bottom:.5px solid var(--dsw-alias-border-l1);padding-bottom:10px}',
				'.dsh-env-inspector__view-title{font-size:20px;font-weight:700;',
				'color:var(--dsw-alias-label-primary);margin:0;display:flex;align-items:center;gap:8px}',
				// 顶部 Stats 4 卡片指标行
				'.dsh-env-stats-row{display:grid;grid-template-columns:repeat(4,1fr);gap:12px;margin-bottom:16px}',
				'.dsh-env-stat-card{background:var(--dsw-alias-bg-layer-2);border:.5px solid var(--dsw-alias-border-l1);',
				'border-radius:8px;padding:12px 16px;display:flex;flex-direction:column;justify-content:space-between}',
				'.dsh-env-stat-num{font-size:18px;font-weight:700;color:var(--dsw-alias-label-primary);line-height:1.2;',
				'font-family:ui-monospace,SFMono-Regular,Menlo,monospace;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}',
				'.dsh-env-stat-label{font-size:11px;color:var(--dsw-alias-label-secondary);margin-top:4px}',
				// 双列 Grid 布局
				'.dsh-env-grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(460px,1fr));gap:16px;margin-bottom:16px}',
				'.dsh-env-card{background:var(--dsw-alias-bg-layer-2);border:.5px solid var(--dsw-alias-border-l1);',
				'border-radius:8px;padding:16px 18px;display:flex;flex-direction:column}',
				'.dsh-env-card-head{display:flex;align-items:center;justify-content:space-between;margin-bottom:12px;',
				'border-bottom:.5px solid var(--dsw-alias-border-l1);padding-bottom:8px}',
				'.dsh-env-card-title{font-size:13px;font-weight:600;color:var(--dsw-alias-label-primary);display:flex;align-items:center;gap:6px}',
				'.dsh-env-card-badge{font-size:11px;color:var(--dsw-alias-label-secondary)}',
				// 端口网格
				'.dsh-env-port-grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(130px,1fr));gap:6px}',
				'.dsh-env-port-item{display:flex;align-items:center;justify-content:space-between;gap:4px;',
				'background:var(--dsw-alias-bg-layer-3);border:.5px solid var(--dsw-alias-border-l3);border-radius:6px;',
				'padding:5px 8px;font-size:11px;font-family:ui-monospace,SFMono-Regular,Menlo,monospace;position:relative}',
				'.dsh-env-port-num{font-weight:700;color:var(--dsw-alias-label-primary)}',
				'.dsh-env-port-cmd{color:var(--dsw-alias-label-secondary);overflow:hidden;text-overflow:ellipsis;white-space:nowrap;flex:1;text-align:right}',
				'.dsh-env-port-kill-btn{background:transparent;border:none;color:var(--dsw-alias-label-tertiary,#888);cursor:pointer;',
				'font-size:13px;line-height:1;padding:0 3px;border-radius:3px;display:inline-flex;align-items:center;justify-content:center;transition:all .15s ease}',
				'.dsh-env-port-kill-btn:hover{color:#fff;background:var(--dsw-alias-state-danger-primary,#ef4444)}',
				'.dsh-env-port-lock{font-size:10px;opacity:.5;cursor:default;user-select:none}',
				// CLI 网格
				'.dsh-env-cli-grid{display:grid;grid-template-columns:repeat(2,1fr);gap:6px}',
				'.dsh-env-cli-item{display:flex;align-items:center;gap:6px;background:var(--dsw-alias-bg-layer-3);',
				'border:.5px solid var(--dsw-alias-border-l3);border-radius:6px;padding:5px 8px;font-size:11px}',
				'.dsh-env-cli-dot{width:6px;height:6px;border-radius:50%;background:var(--dsw-alias-state-success-primary,#3fb950);flex-shrink:0}',
				'.dsh-env-cli-dot--bad{background:var(--dsw-alias-state-warn-primary,#f59e0b)}',
				'.dsh-env-cli-name{font-weight:600;color:var(--dsw-alias-label-primary)}',
				'.dsh-env-cli-ver{color:var(--dsw-alias-label-secondary);font-family:ui-monospace,SFMono-Regular,Menlo,monospace;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}',
				// 辅助标签与切换按钮
				'.dsh-env-badge-pill{display:inline-flex;align-items:center;padding:1px 7px;border-radius:10px;font-size:10px;font-weight:500;background:var(--dsw-alias-bg-layer-3);border:.5px solid var(--dsw-alias-border-l3);color:var(--dsw-alias-label-secondary)}',
				'.dsh-env-toggle-btn{background:var(--dsw-alias-bg-layer-3);border:.5px solid var(--dsw-alias-border-l3);color:var(--dsw-alias-label-secondary);border-radius:4px;padding:3px 8px;font-size:11px;cursor:pointer;display:inline-flex;align-items:center;gap:4px;transition:all .15s ease}',
				'.dsh-env-toggle-btn:hover{background:var(--dsw-alias-interactive-bg-hover);color:var(--dsw-alias-label-primary)}',
				'.dsh-env-keyval-row{display:flex;justify-content:space-between;align-items:center;padding:6px 0;border-bottom:.5px solid var(--dsw-alias-border-l1);font-size:12px}',
				'.dsh-env-keyval-row:last-child{border-bottom:none}',
				'.dsh-env-keyval-k{color:var(--dsw-alias-label-secondary)}',
				'.dsh-env-keyval-v{color:var(--dsw-alias-label-primary);font-family:ui-monospace,SFMono-Regular,Menlo,monospace;font-weight:500}',
				'.dsh-env-tag{display:inline-flex;align-items:center;gap:4px;padding:3px 8px;border-radius:4px;font-size:11px;font-family:ui-monospace,SFMono-Regular,Menlo,monospace;background:var(--dsw-alias-bg-layer-3);border:.5px solid var(--dsw-alias-border-l3);color:var(--dsw-alias-label-primary)}',
				'.dsh-env-tag--ok{color:var(--dsw-alias-state-success-primary,#3fb950);border-color:rgba(63,185,80,0.3)}',
				'.dsh-env-tag--warn{color:var(--dsw-alias-state-warn-primary,#f59e0b);border-color:rgba(245,158,11,0.3)}',
				// 空状态与 footer
				'.dsh-env-inspector__view-empty{padding:48px;text-align:center;color:var(--dsw-alias-label-secondary)}',
				'.dsh-env-inspector__footer{margin-top:10px;font-size:11px;color:var(--dsw-alias-label-secondary);opacity:.75}'
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

		/**
		 * 顶部 4 KPI 指标横条
		 */
		function HeroStatsRow(report, t) {
			const sys = report.system ?? {}
			const cli = Array.isArray(report.cli) ? report.cli : []
			const installedCli = cli.filter((c) => c.ok).length
			const ports = Array.isArray(report.ports) ? report.ports : []
			const servicePorts = ports.filter((p) => p.port <= 49151).length
			const ephemeralPorts = ports.filter((p) => p.port > 49151).length

			const cards = [
				{
					num: `${sys.os || 'macOS'}`,
					label: `${sys.arch || 'arm64'} · ${sys.hostname || 'localhost'}`
				},
				{
					num: `${installedCli} / ${cli.length}`,
					label: `命令行工具 (${cli.length > 0 ? Math.round(installedCli / cli.length * 100) : 100}% 就绪)`
				},
				{
					num: `${servicePorts} 个主要服务`,
					label: `活跃端口 (+ ${ephemeralPorts} 个动态高位)`
				},
				{
					num: `${sys.nodeVersion || 'Node'}`,
					label: `${sys.memFreeGB ?? '—'} GB 空闲 / ${sys.memTotalGB ?? '—'} GB`
				}
			]

			return h('div', { className: 'dsh-env-stats-row' },
				...cards.map((c, i) => h('div', { key: i, className: 'dsh-env-stat-card' },
					h('div', { className: 'dsh-env-stat-num' }, c.num),
					h('div', { className: 'dsh-env-stat-label' }, c.label)
				))
			)
		}

		/**
		 * 活跃监听端口卡片
		 */
		function PortsCard(ports, t, expandEphemeral, setExpandEphemeral, onKillPort) {
			const list = Array.isArray(ports) ? ports : []
			const servicePorts = list.filter((p) => p.port <= 49151)
			const ephemeralPorts = list.filter((p) => p.port > 49151)
			const displayedEphemeral = expandEphemeral ? ephemeralPorts : []

			const renderPortItem = (p) => {
				const isDshCore = p.port === 3080
				return h('div', {
					key: `${p.port}/${p.pid}`,
					className: 'dsh-env-port-item',
					title: `${p.command} (PID: ${p.pid ?? '—'})\n${p.host}:${p.port}${p.isWildcard ? ' [' + t('portAllWarning') + ']' : ''}${isDshCore ? '\n(DSH 核心服务，禁止终止)' : ''}`
				},
					h('span', { style: { display: 'inline-flex', alignItems: 'center', gap: '4px', overflow: 'hidden' } },
						p.isWildcard ? h('span', { className: 'dsh-env-inspector__warn-dot', title: t('portAllWarning') }) : null,
						h('span', { className: 'dsh-env-port-num' }, `:${p.port}`)
					),
					h('span', { className: 'dsh-env-port-cmd' }, p.command),
					isDshCore
						? h('span', { className: 'dsh-env-port-lock', title: '核心服务受保护' }, '🔒')
						: (p.pid && typeof onKillPort === 'function' ? h('button', {
							type: 'button',
							className: 'dsh-env-port-kill-btn',
							title: `释放端口 :${p.port} (终止 ${p.command} PID: ${p.pid})`,
							onClick: (e) => {
								e.stopPropagation()
								onKillPort(p.port, p.pid, p.command)
							}
						}, '×') : null)
				)
			}

			return h('div', { className: 'dsh-env-card' },
				h('div', { className: 'dsh-env-card-head' },
					h('span', { className: 'dsh-env-card-title' },
						h('span', { style: { fontSize: '15px' } }, '🔌'),
						t('portsSection')
					),
					h('span', { className: 'dsh-env-badge-pill' }, `${servicePorts.length} 服务${ephemeralPorts.length > 0 ? ' + ' + ephemeralPorts.length + ' 动态' : ''}`)
				),
				servicePorts.length === 0
					? h('div', { className: 'dsh-env-inspector__footer' }, '无监听端口')
					: h('div', { className: 'dsh-env-port-grid' },
						...servicePorts.map(renderPortItem)
					),
				ephemeralPorts.length > 0 ? h('div', { style: { marginTop: '12px', paddingTop: '8px', borderTop: '.5px solid var(--dsw-alias-border-l1)' } },
					h('div', { style: { display: 'flex', justifyContent: 'space-between', alignItems: 'center' } },
						h('span', { style: { fontSize: '11px', color: 'var(--dsw-alias-label-secondary)' } },
							`${t('portsEphemeral')} (${ephemeralPorts.length})`
						),
						h('button', {
							type: 'button',
							className: 'dsh-env-toggle-btn',
							onClick: () => setExpandEphemeral(!expandEphemeral)
						}, expandEphemeral ? '收起' : `展开 ${ephemeralPorts.length} 个端口 ▾`)
					),
					expandEphemeral ? h('div', { className: 'dsh-env-port-grid', style: { marginTop: '8px' } },
						...displayedEphemeral.map(renderPortItem)
					) : null
				) : null
			)
		}

		/**
		 * 命令行工具网格卡片
		 */
		function CliCard(cli, t) {
			const list = Array.isArray(cli) ? cli : []
			const installed = list.filter((c) => c.ok)
			return h('div', { className: 'dsh-env-card' },
				h('div', { className: 'dsh-env-card-head' },
					h('span', { className: 'dsh-env-card-title' },
						h('span', { style: { fontSize: '15px' } }, '🛠️'),
						t('cliSection')
					),
					h('span', { className: 'dsh-env-badge-pill' }, `${installed.length} / ${list.length} 就绪`)
				),
				h('div', { className: 'dsh-env-cli-grid' },
					...list.map((c) => h('div', {
						key: c.name,
						className: 'dsh-env-cli-item',
						title: c.version ? `${c.name} ${c.version}` : (c.ok ? 'installed' : 'not installed')
					},
						h('span', { className: `dsh-env-cli-dot ${c.ok ? '' : 'dsh-env-cli-dot--bad'}` }),
						h('span', { className: 'dsh-env-cli-name' }, c.name),
						c.version ? h('span', { className: 'dsh-env-cli-ver' }, c.version) : null
					))
				)
			)
		}

		/**
		 * 系统基础信息卡片
		 */
		function SystemCard(sys, t) {
			const rows = [
				['主机名', sys.hostname],
				['当前用户', `${sys.user} (${sys.home})`],
				['终端 Shell', sys.shell],
				['处理器', sys.cpu],
				['开机运行', `${sys.uptimeMin} 分钟`],
				['PATH 搜索路径', `${sys.pathDirs} 个目录`]
			]
			return h('div', { className: 'dsh-env-card' },
				h('div', { className: 'dsh-env-card-head' },
					h('span', { className: 'dsh-env-card-title' },
						h('span', { style: { fontSize: '15px' } }, '💻'),
						t('systemSection')
					),
					h('span', { className: 'dsh-env-badge-pill' }, `${sys.os}${sys.arch ? ' (' + sys.arch + ')' : ''}`)
				),
				h('div', null,
					...rows.map(([k, v]) => h('div', { key: k, className: 'dsh-env-keyval-row' },
						h('span', { className: 'dsh-env-keyval-k' }, k),
						h('span', { className: 'dsh-env-keyval-v' }, v ?? '—')
					))
				)
			)
		}

		/**
		 * 环境变量与 Kyvault 凭据卡片
		 */
		function AiAndSecretsCard(envKeys, kyvault, t) {
			const keys = Array.isArray(envKeys) ? envKeys : []
			const secrets = Array.isArray(kyvault) ? kyvault : []
			const configuredKeysCount = keys.filter((k) => k.configured).length

			return h('div', { className: 'dsh-env-card' },
				h('div', { className: 'dsh-env-card-head' },
					h('span', { className: 'dsh-env-card-title' },
						h('span', { style: { fontSize: '15px' } }, '🔐'),
						'凭证与密钥库'
					),
					h('span', { className: 'dsh-env-badge-pill' }, `${configuredKeysCount} / ${keys.length} 环境变量`)
				),
				h('div', { style: { marginBottom: '12px' } },
					h('div', { style: { fontSize: '11px', color: 'var(--dsw-alias-label-secondary)', marginBottom: '6px' } }, t('envKeysSection')),
					h('div', { style: { display: 'flex', flexWrap: 'wrap', gap: '6px' } },
						...keys.map((k) => h('span', {
							key: k.name,
							className: `dsh-env-tag ${k.configured ? 'dsh-env-tag--ok' : ''}`,
							title: k.configured ? '已配置' : '未配置'
						},
							h('span', { style: { opacity: 0.8 } }, k.configured ? '✓' : '✗'),
							k.name
						))
					)
				),
				h('div', { style: { borderTop: '.5px solid var(--dsw-alias-border-l1)', paddingTop: '10px' } },
					h('div', { style: { fontSize: '11px', color: 'var(--dsw-alias-label-secondary)', marginBottom: '6px' } }, `${t('kyvaultSection')} (${secrets.length})`),
					secrets.length === 0
						? h('div', { className: 'dsh-env-inspector__footer' }, '暂无已存秘钥引用')
						: h('div', { style: { display: 'flex', flexWrap: 'wrap', gap: '6px' } },
							...secrets.map((s) => h('span', {
								key: s.name,
								className: 'dsh-env-tag'
							}, `🔑 ${s.name}`))
						)
				)
			)
		}

		/**
		 * 插件与网络接口卡片（横跨全宽）
		 */
		function PluginsAndNetworkCard(plugins, net, t) {
			const pList = Array.isArray(plugins) ? plugins : []
			const ifaces = Array.isArray(net?.interfaces) ? net.interfaces : []
			return h('div', { className: 'dsh-env-card', style: { gridColumn: '1 / -1' } },
				h('div', { className: 'dsh-env-card-head' },
					h('span', { className: 'dsh-env-card-title' },
						h('span', { style: { fontSize: '15px' } }, '🧩'),
						'扩展插件与网络接口'
					),
					h('span', { className: 'dsh-env-badge-pill' }, `${pList.length} 插件 · ${ifaces.length} 网络条目`)
				),
				h('div', { style: { display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '16px' } },
					h('div', null,
						h('div', { style: { fontSize: '11px', color: 'var(--dsw-alias-label-secondary)', marginBottom: '6px' } }, t('pluginsSection')),
						pList.length === 0
							? h('div', { className: 'dsh-env-inspector__footer' }, '—')
							: h('div', { style: { display: 'flex', flexDirection: 'column', gap: '4px' } },
								...pList.map((p) => h('div', {
									key: `${p.profile}/${p.plugin}`,
									className: 'dsh-env-keyval-row',
									style: { padding: '4px 0' }
								},
									h('span', { className: 'dsh-env-keyval-k' }, `${p.plugin} @ ${p.profile}`),
									h('span', { className: 'dsh-env-badge-pill' }, `v${p.version}`)
								))
							)
					),
					h('div', null,
						h('div', { style: { fontSize: '11px', color: 'var(--dsw-alias-label-secondary)', marginBottom: '6px' } }, t('networkSection')),
						h('div', { style: { display: 'flex', flexWrap: 'wrap', gap: '6px' } },
							...ifaces.map((iface, i) => h('span', {
								key: `${iface.name}/${i}`,
								className: 'dsh-env-tag',
								title: `${iface.name} (${iface.family === 4 ? 'IPv4' : 'IPv6'})`
							},
								h('span', { style: { fontWeight: 600, color: 'var(--dsw-alias-label-secondary)' } }, iface.name),
								iface.address
							))
						)
					)
				)
			)
		}

		/**
		 * 当作为 conversation.view 独立 Tab 展示时的全屏看板视图。
		 */
		function EnvInspectorView(props) {
			const t = typeof props.t === 'function' ? props.t : fallbackT
			const [report, setReport] = React.useState(null)
			const [loading, setLoading] = React.useState(false)
			const [expandEphemeral, setExpandEphemeral] = React.useState(false)

			function loadReport() {
				setLoading(true)
				fetch(SELF_CHECK_URL, { headers: { accept: 'application/json' } })
					.then((res) => res.json())
					.then((body) => { setReport(body !== null && typeof body === 'object' ? body : null) })
					.catch(() => { setReport(null) })
					.finally(() => setLoading(false))
			}

			React.useEffect(() => {
				loadReport()
			}, [])

			function handleKillPort(port, pid, command) {
				if (!pid) {
					window.alert(`无法终止：未检测到端口 :${port} 的关联进程 PID`)
					return
				}
				const ok = window.confirm(`确定要释放端口 :${port} 并终止进程 "${command}" (PID: ${pid}) 吗？\n\n注意：此操作将向该进程发送终止信号。`)
				if (!ok) return

				fetch('/api/dsh-env-inspector/kill-port', {
					method: 'POST',
					headers: { 'content-type': 'application/json' },
					body: JSON.stringify({ port, pid })
				})
					.then((res) => res.json())
					.then((data) => {
						if (data.ok) {
							loadReport()
						} else {
							window.alert(data.error || '释放端口失败')
						}
					})
					.catch((err) => {
						window.alert('请求失败: ' + err.message)
					})
			}

			ensureStyle()
			if (report === null) {
				return h('div', { className: 'dsh-env-inspector__view-empty' }, t('loading'))
			}

			const cli = Array.isArray(report.cli) ? report.cli : []

			return h('div', { className: 'dsh-env-inspector__view-container' },
				h('div', { className: 'dsh-env-inspector__view-head' },
					h('h2', { className: 'dsh-env-inspector__view-title' },
						h('span', { style: { fontSize: '20px' } }, '🖥️'),
						t('title'),
						h('button', {
							type: 'button',
							className: 'dsh-env-toggle-btn',
							style: { marginLeft: '12px', fontSize: '11px' },
							onClick: loadReport,
							title: '重新自检当前环境'
						}, loading ? '刷新中…' : '🔄 刷新')
					),
					h('span', { className: 'dsh-env-inspector__footer' }, t('footerNote'))
				),
				HeroStatsRow(report, t),
				h('div', { className: 'dsh-env-grid' },
					PortsCard(report.ports ?? [], t, expandEphemeral, setExpandEphemeral, handleKillPort),
					CliCard(cli, t),
					SystemCard(report.system ?? {}, t),
					AiAndSecretsCard(report.envKeys ?? [], report.kyvault ?? [], t),
					PluginsAndNetworkCard(report.plugins ?? [], report.network ?? {}, t)
				)
			)
		}

		const inject = ['slots', 'locale']

		function apply(ctx) {
			ensureStyle()
			ctx.effect(() => ctx.locale.register(NS, LOCALES), 'dsh-env-inspector: dictionaries')
			const t = ctx.locale.bind(NS)
			// 1) 注册为 conversation.view 独立 Tab
			ctx.slots.inject('conversation.view', () => ctx.slots.register({
				name: 'conversation.view',
				id: 'env',
				order: 30,
				label: () => t('title'),
				locale: NS,
				inject: () => ({ t })
			}, EnvInspectorView))

			// 2) 注册为输入框底部的辅助徽章
			ctx.slots.inject('conversation.composer.dock', () => ctx.slots.register({
				name: 'conversation.composer.dock',
				id: 'dsh-env-inspector',
				order: 50,
				locale: NS,
				inject: () => ({ t })
			}, EnvInspectorBadge))
		}

		exports.apply = apply
		exports.inject = inject
		return module.exports
	}
})
