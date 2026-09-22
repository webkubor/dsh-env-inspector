/**
 * dsh-env-inspector —— Client（浏览器）半。
 *
 * 设计：
 * 1. 注册为 conversation.view 独立 Tab「电脑环境」，提供现代、克制、高美感的环境监控大屏；
 * 2. 注册为 conversation.composer.dock 底部辅助徽章，提供秒级速查面板。
 *
 * 核心原则：
 * - 零外部依赖：纯原生 React createElement，无任何三方 UI 库包袱；
 * - 零隐私泄露：不输出私有秘钥库，模型凭据仅显示通用环境变量存在性（不含值）；
 * - 极简高质感：过滤虚拟网卡噪音、端口分组与悬浮释放、主 IP 一键速查。
 *
 * @module dsh-env-inspector/client
 */

window.__ModuleLoader__.load({
	id: '@dsh-plugins/dsh-env-inspector',
	factory: (require) => {
		const module = { exports: {} }
		const exports = module.exports

		const React = require('react')
		const h = React.createElement

		const NS = 'dsh-env-inspector'
		const SELF_CHECK_URL = '/api/dsh-env-inspector/self-check'

		/**
		 * 词典：双语 —— 支持中英文。
		 */
		const LOCALES = {
			zh: {
				title: '电脑环境',
				loading: '正在自检环境…',
				noData: '尚未获取到环境信息',
				openDetail: '查看完整信息',
				systemSection: '系统概览',
				cliSection: '命令行工具链',
				pluginsSection: '已装 DSH 插件',
				modelCredentialsSection: '模型与开发凭据',
				networkSection: '网络适配器',
				primaryIp: '本机主 IP',
				copyIp: '复制 IP',
				copied: '已复制',
				portsSection: '活跃监听端口',
				devPortsTitle: '开发与应用服务',
				servicePortsTitle: '系统后台服务',
				portsEphemeral: '动态临时高位端口',
				portAllWarning: '公网通配监听 (* / 0.0.0.0)',
				portProtected: '核心受保护',
				portKill: '释放',
				portKillConfirm: '确定要释放端口 :{port} 并终止进程 "{command}" (PID: {pid}) 吗？',
				cliInstalled: '已就绪',
				cliMissing: '未安装',
				configured: '已配置',
				unconfigured: '未配置',
				pluginVersion: '版本',
				openSourceOnGitHub: '在 GitHub 查看源码',
				footerNote: '所有检查均为本机只读探测，敏感秘钥明文永不读取与展示。',
				suiteTitle: 'Webkubor DSH 扩展家族',
				suiteDesc: '专为 DeepSeek Harness 打造的极致美学与效能工具套件',
				suiteActive: '已激活',
				suiteCopyInstall: '复制安装',
				suiteCopied: '已复制!',
				refresh: '刷新',
				refreshing: '自检中…',
				lastCheck: '上次自检: ',
				justNow: '刚刚',
				aiSection: 'AI 工具链',
				aiInstalled: '已就绪',
				aiMissing: '未安装',
				hardwareSection: '硬件概况',
				hardwareNotAvailable: '当前平台未启用硬件探测',
				displaysLabel: '显示器',
				gpusLabel: '显卡',
				cpuLabel: '机型',
				osLabel: '系统版本',
				memSlotsLabel: '物理内存',
				copyFullDiagnostic: '复制完整诊断',
				copiedDiagnostic: '已复制完整诊断',
				trustNote: '本机不上传、只你看 —— 复制到剪贴板后粘给 agent 或客服即可。'
			},
			en: {
				title: 'PC Environment',
				loading: 'Inspecting environment…',
				noData: 'No environment data yet',
				openDetail: 'View full details',
				systemSection: 'System Overview',
				cliSection: 'CLI Toolchain',
				pluginsSection: 'Installed DSH Plugins',
				modelCredentialsSection: 'Model & Dev Credentials',
				networkSection: 'Network Adapters',
				primaryIp: 'Primary IP',
				copyIp: 'Copy IP',
				copied: 'Copied',
				portsSection: 'Active Listening Ports',
				devPortsTitle: 'Dev & App Services',
				servicePortsTitle: 'System & Background Services',
				portsEphemeral: 'Ephemeral Dynamic Ports',
				portAllWarning: 'All interfaces (* / 0.0.0.0)',
				portProtected: 'Protected',
				portKill: 'Kill',
				portKillConfirm: 'Release port :{port} and terminate process "{command}" (PID: {pid})?',
				cliInstalled: 'Ready',
				cliMissing: 'Missing',
				configured: 'Configured',
				unconfigured: 'Unconfigured',
				pluginVersion: 'v',
				openSourceOnGitHub: 'View source on GitHub',
				footerNote: 'All inspections are read-only locally. Secret values are never read or displayed.',
				suiteTitle: 'Webkubor DSH Plugin Suite',
				suiteDesc: 'Ecosystem crafted for DeepSeek Harness: Aesthetics, Routing & Memory',
				suiteActive: 'Active',
				suiteCopyInstall: 'Install Cmd',
				suiteCopied: 'Copied!',
				refresh: 'Refresh',
				refreshing: 'Inspecting…',
				lastCheck: 'Last checked: ',
				justNow: 'just now',
				aiSection: 'AI Toolchain',
				aiInstalled: 'Ready',
				aiMissing: 'Missing',
				hardwareSection: 'Hardware Overview',
				hardwareNotAvailable: 'Hardware inspection not available on this platform',
				displaysLabel: 'Displays',
				gpusLabel: 'GPUs',
				cpuLabel: 'Machine',
				osLabel: 'OS version',
				memSlotsLabel: 'Physical memory',
				copyFullDiagnostic: 'Copy full diagnostic',
				copiedDiagnostic: 'Full diagnostic copied',
				trustNote: 'Never leaves this machine — paste it to your agent or support to share.'
			}
		}
		const fallbackT = (key) => LOCALES.zh[key] ?? key

		/**
		 * 全局持久化缓存与发布订阅（解决切 Tab 重新检查与闪烁白屏）
		 */
		const CACHE_KEY = 'dsh_env_inspector_store_v1'
		let globalReportCache = null
		let globalReportTimestamp = 0
		const cacheListeners = new Set()

		function getStoredReport() {
			if (globalReportCache !== null) {
				return { report: globalReportCache, timestamp: globalReportTimestamp }
			}
			try {
				const raw = localStorage.getItem(CACHE_KEY)
				if (raw) {
					const data = JSON.parse(raw)
					if (data && typeof data.report === 'object') {
						globalReportCache = data.report
						globalReportTimestamp = data.timestamp || 0
						return { report: globalReportCache, timestamp: globalReportTimestamp }
					}
				}
			} catch (e) {}
			return { report: null, timestamp: 0 }
		}

		function updateStoredReport(report) {
			if (!report || typeof report !== 'object') return
			globalReportCache = report
			globalReportTimestamp = Date.now()
			try {
				localStorage.setItem(CACHE_KEY, JSON.stringify({
					report: globalReportCache,
					timestamp: globalReportTimestamp
				}))
			} catch (e) {}
			cacheListeners.forEach((listener) => {
				try { listener(globalReportCache, globalReportTimestamp) } catch (e) {}
			})
		}

		function formatDisplayTime(ts, t) {
			if (!ts) return ''
			const diff = Math.floor((Date.now() - ts) / 1000)
			if (diff < 15) return t ? t('justNow') : '刚刚'
			if (diff < 60) return `${diff}s 前`
			const d = new Date(ts)
			const h = String(d.getHours()).padStart(2, '0')
			const m = String(d.getMinutes()).padStart(2, '0')
			const s = String(d.getSeconds()).padStart(2, '0')
			return `${h}:${m}:${s}`
		}

		/**
		 * 注入现代美学样式表 —— 深度契合 DSH 设计规范，自适应明暗主题。
		 */
		function ensureStyle() {
			const id = 'dsh-env-inspector-style'
			if (document.getElementById(id) !== null) return
			const style = document.createElement('style')
			style.id = id
			style.textContent = [
				// 通用微动画与滚动条收敛
				'.dsh-env-inspector *{box-sizing:border-box}',
				'::-webkit-scrollbar{width:6px;height:6px}',
				'::-webkit-scrollbar-thumb{background:var(--dsw-alias-border-l2,rgba(128,128,128,0.3));border-radius:3px}',
				'::-webkit-scrollbar-track{background:transparent}',

				// composer 底部辅助徽章
				'.dsh-env-inspector{display:inline-flex;align-items:center;gap:6px;padding:2px 4px}',
				'.dsh-env-inspector__chip{display:inline-flex;align-items:center;height:24px;padding:0 10px;',
				'border-radius:12px;border:1px solid var(--dsw-alias-border-l2);font-size:11px;font-weight:500;',
				'color:var(--dsw-alias-label-secondary);background:var(--dsw-alias-bg-layer-2);cursor:pointer;',
				'transition:all .18s ease;user-select:none;gap:5px}',
				'.dsh-env-inspector__chip:hover{background:var(--dsw-alias-interactive-bg-hover);color:var(--dsw-alias-label-primary);border-color:var(--dsw-alias-border-l1)}',
				'.dsh-env-status-dot{width:6px;height:6px;border-radius:50%;background:var(--dsw-alias-state-success-primary,#10b981);display:inline-block;box-shadow:0 0 6px rgba(16,185,129,0.4)}',

				// 弹出轻量快捷面板（右下角徽标展开）
				'.dsh-env-inspector__panel{position:absolute;z-index:1000;min-width:480px;max-width:85vw;max-height:65vh;overflow-y:auto;',
				'padding:16px 20px;border-radius:12px;border:1px solid var(--dsw-alias-border-l1);',
				'background:var(--dsw-alias-bg-layer-2);box-shadow:0 12px 32px rgba(0,0,0,.2);',
				'font-size:12px;line-height:18px;color:var(--dsw-alias-label-primary);backdrop-filter:blur(16px)}',
				'.dsh-env-inspector__panel-head{display:flex;align-items:center;justify-content:space-between;margin-bottom:12px;padding-bottom:8px;border-bottom:1px solid var(--dsw-alias-border-l2)}',
				'.dsh-env-inspector__panel-title{font-weight:600;font-size:13px;display:flex;align-items:center;gap:6px}',
				'.dsh-env-inspector__close{border:0;background:transparent;cursor:pointer;color:var(--dsw-alias-label-secondary);font-size:16px;padding:2px 6px;border-radius:4px;transition:all .15s}',
				'.dsh-env-inspector__close:hover{color:var(--dsw-alias-label-primary);background:var(--dsw-alias-interactive-bg-hover)}',
				'.dsh-env-inspector__section{margin-top:12px}',
				'.dsh-env-inspector__section-title{font-weight:600;color:var(--dsw-alias-label-secondary);margin-bottom:6px;font-size:11px;text-transform:uppercase;letter-spacing:.5px}',
				'.dsh-env-inspector__row{display:flex;justify-content:space-between;gap:8px;padding:4px 0;border-bottom:1px solid var(--dsw-alias-border-l3)}',
				'.dsh-env-inspector__row:last-child{border-bottom:0}',
				'.dsh-env-inspector__key{color:var(--dsw-alias-label-secondary);font-family:ui-monospace,SFMono-Regular,Menlo,monospace}',
				'.dsh-env-inspector__val{color:var(--dsw-alias-label-primary);font-weight:500}',

				// 全屏 Tab 大屏容器
				'.dsh-env-inspector__view-container{padding:28px 36px 180px;max-width:1120px;margin:0 auto;overflow-y:auto;height:100%;box-sizing:border-box;font-size:13px;line-height:20px}',
				'.dsh-env-view-head{display:flex;align-items:center;justify-content:space-between;margin-bottom:20px;padding-bottom:12px;border-bottom:1px solid var(--dsw-alias-border-l2)}',
				'.dsh-env-view-title{font-size:20px;font-weight:700;color:var(--dsw-alias-label-primary);margin:0;display:flex;align-items:center;gap:10px}',

				// 顶部 Hero Stats 行
				'.dsh-env-stats-row{display:grid;grid-template-columns:repeat(4,1fr);gap:14px;margin-bottom:20px}',
				'.dsh-env-stat-card{background:var(--dsw-alias-bg-layer-2);border:1px solid var(--dsw-alias-border-l2);border-radius:10px;',
				'padding:14px 18px;display:flex;flex-direction:column;justify-content:space-between;box-shadow:0 1px 3px rgba(0,0,0,.03);transition:transform .18s,border-color .18s}',
				'.dsh-env-stat-card:hover{border-color:var(--dsw-alias-border-l1);transform:translateY(-1px)}',
				'.dsh-env-stat-num{font-size:20px;font-weight:700;color:var(--dsw-alias-label-primary);line-height:1.2;font-family:ui-monospace,SFMono-Regular,Menlo,monospace;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}',
				'.dsh-env-stat-label{font-size:12px;color:var(--dsw-alias-label-secondary);margin-top:6px;display:flex;align-items:center;gap:6px}',

				// 卡片 Grid
				'.dsh-env-grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(480px,1fr));gap:18px;margin-bottom:20px}',
				'.dsh-env-card{background:var(--dsw-alias-bg-layer-2);border:1px solid var(--dsw-alias-border-l2);border-radius:10px;',
				'padding:18px 20px;display:flex;flex-direction:column;box-shadow:0 1px 3px rgba(0,0,0,.03);transition:border-color .18s}',
				'.dsh-env-card:hover{border-color:var(--dsw-alias-border-l1)}',
				'.dsh-env-card-head{display:flex;align-items:center;justify-content:space-between;margin-bottom:14px;padding-bottom:10px;border-bottom:1px solid var(--dsw-alias-border-l3)}',
				'.dsh-env-card-title{font-size:14px;font-weight:600;color:var(--dsw-alias-label-primary);display:flex;align-items:center;gap:8px}',
				'.dsh-env-badge-pill{display:inline-flex;align-items:center;padding:2px 9px;border-radius:12px;font-size:11px;font-weight:500;background:var(--dsw-alias-bg-layer-3);border:1px solid var(--dsw-alias-border-l3);color:var(--dsw-alias-label-secondary)}',

				// 端口分组与优雅悬浮释放 (Hover Reveal)
				'.dsh-env-port-group{margin-bottom:14px}',
				'.dsh-env-port-group:last-child{margin-bottom:0}',
				'.dsh-env-port-group-title{font-size:11px;font-weight:600;color:var(--dsw-alias-label-secondary);margin-bottom:8px;text-transform:uppercase;letter-spacing:.5px;display:flex;align-items:center;justify-content:space-between}',
				'.dsh-env-port-grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(140px,1fr));gap:8px}',
				'.dsh-env-port-item{display:flex;align-items:center;justify-content:space-between;gap:6px;background:var(--dsw-alias-bg-layer-3);',
				'border:1px solid var(--dsw-alias-border-l3);border-radius:8px;padding:6px 10px;font-size:11px;font-family:ui-monospace,SFMono-Regular,Menlo,monospace;',
				'position:relative;overflow:hidden;transition:all .18s ease}',
				'.dsh-env-port-item:hover{background:var(--dsw-alias-interactive-bg-hover);border-color:var(--dsw-alias-border-l2)}',
				'.dsh-env-port-num{font-weight:700;color:var(--dsw-alias-label-primary)}',
				'.dsh-env-port-cmd{color:var(--dsw-alias-label-secondary);overflow:hidden;text-overflow:ellipsis;white-space:nowrap;flex:1;text-align:right}',
				'.dsh-env-port-pid{font-size:10px;color:var(--dsw-alias-label-tertiary,#888);margin-left:2px;opacity:.75}',
				'.dsh-env-port-kill-btn{display:none;position:absolute;right:0;top:0;bottom:0;width:34px;background:var(--dsw-alias-state-danger-primary,#ef4444);',
				'color:#fff;border:none;cursor:pointer;align-items:center;justify-content:center;font-size:12px;font-weight:600;transition:background .15s}',
				'.dsh-env-port-item:hover .dsh-env-port-kill-btn{display:flex}',
				'.dsh-env-port-kill-btn:hover{background:#dc2626}',
				'.dsh-env-port-lock{font-size:11px;opacity:.5;cursor:default;user-select:none;margin-left:4px}',
				'.dsh-env-warn-dot{display:inline-block;width:5px;height:5px;border-radius:50%;background:var(--dsw-alias-state-warn-primary,#f59e0b);margin-right:2px}',

				// CLI 工具网格
				'.dsh-env-cli-grid{display:grid;grid-template-columns:repeat(2,1fr);gap:8px}',
				'.dsh-env-cli-item{display:flex;align-items:center;justify-content:space-between;background:var(--dsw-alias-bg-layer-3);',
				'border:1px solid var(--dsw-alias-border-l3);border-radius:8px;padding:7px 12px;font-size:12px;transition:border-color .15s}',
				'.dsh-env-cli-item:hover{border-color:var(--dsw-alias-border-l2)}',
				'.dsh-env-cli-name{font-weight:600;color:var(--dsw-alias-label-primary);display:flex;align-items:center;gap:6px}',
				'.dsh-env-cli-ver{color:var(--dsw-alias-label-secondary);font-family:ui-monospace,SFMono-Regular,Menlo,monospace;font-size:11px}',

				// 系统信息键值行
				'.dsh-env-keyval-row{display:flex;justify-content:space-between;align-items:center;padding:7px 0;border-bottom:1px solid var(--dsw-alias-border-l3);font-size:12px}',
				'.dsh-env-keyval-row:last-child{border-bottom:none}',
				'.dsh-env-keyval-k{color:var(--dsw-alias-label-secondary)}',
				'.dsh-env-keyval-v{color:var(--dsw-alias-label-primary);font-family:ui-monospace,SFMono-Regular,Menlo,monospace;font-weight:500;text-align:right}',

				// 模型凭据区域（高低层级分明）
				'.dsh-env-models-section{display:flex;flex-direction:column;gap:12px}',
				'.dsh-env-models-ready{display:flex;flex-wrap:wrap;gap:8px}',
				'.dsh-env-model-ready-tag{display:inline-flex;align-items:center;gap:6px;padding:5px 11px;border-radius:6px;font-size:12px;font-weight:600;',
				'background:rgba(16,185,129,0.08);border:1px solid rgba(16,185,129,0.3);color:var(--dsw-alias-state-success-primary,#10b981);font-family:ui-monospace,SFMono-Regular,Menlo,monospace}',
				'.dsh-env-models-unready{display:flex;flex-wrap:wrap;gap:6px;opacity:.65}',
				'.dsh-env-model-unready-tag{display:inline-flex;align-items:center;gap:4px;padding:3px 8px;border-radius:4px;font-size:11px;',
				'background:var(--dsw-alias-bg-layer-3);border:1px solid var(--dsw-alias-border-l3);color:var(--dsw-alias-label-secondary);font-family:ui-monospace,SFMono-Regular,Menlo,monospace}',

				// 局域网主 IP 突出展示与一键复制
				'.dsh-env-ip-hero{display:flex;align-items:center;justify-content:space-between;background:var(--dsw-alias-bg-layer-3);border:1px solid var(--dsw-alias-border-l2);border-radius:8px;padding:10px 14px;margin-bottom:12px}',
				'.dsh-env-ip-val{font-size:17px;font-weight:700;font-family:ui-monospace,SFMono-Regular,Menlo,monospace;color:var(--dsw-alias-label-primary);letter-spacing:.5px}',
				'.dsh-env-copy-btn{border:1px solid var(--dsw-alias-border-l2);background:var(--dsw-alias-bg-layer-2);color:var(--dsw-alias-label-primary);border-radius:6px;padding:3px 10px;font-size:11px;cursor:pointer;transition:all .15s}',
				'.dsh-env-copy-btn:hover{background:var(--dsw-alias-interactive-bg-hover)}',

				// 辅助切换与操作
				'.dsh-env-toggle-btn{background:var(--dsw-alias-bg-layer-3);border:1px solid var(--dsw-alias-border-l3);color:var(--dsw-alias-label-secondary);border-radius:6px;padding:4px 10px;font-size:11px;cursor:pointer;display:inline-flex;align-items:center;gap:5px;transition:all .15s}',
				'.dsh-env-toggle-btn:hover{background:var(--dsw-alias-interactive-bg-hover);color:var(--dsw-alias-label-primary);border-color:var(--dsw-alias-border-l2)}',
				'.dsh-env-footer-note{margin-top:14px;font-size:11px;color:var(--dsw-alias-label-tertiary,#888);opacity:.8}',
				// 一键复制完整诊断 —— 跟 owner 0.1.1 的卡片风格统一
				'.dsh-env-diagnostic-bar{display:flex;flex-direction:column;align-items:flex-start;gap:6px;',
				'margin-top:14px;padding:10px 12px;border-radius:8px;',
				'border:1px dashed var(--dsw-alias-border-l2);background:var(--dsw-alias-bg-layer-1)}',
				'.dsh-env-diagnostic-actions{display:flex;gap:8px;align-items:center}',
				'.dsh-env-trust-note{margin:0;font-size:11px;color:var(--dsw-alias-label-tertiary);opacity:.85;',
				'line-height:1.45}',

				// 顶部自检刷新与缓存状态栏
				'@keyframes dsh-env-spin{from{transform:rotate(0deg)}to{transform:rotate(360deg)}}',
				'.dsh-env-spin{display:inline-block;animation:dsh-env-spin .85s linear infinite}',
				'.dsh-env-refresh-bar{display:inline-flex;align-items:center;gap:8px;margin-left:14px}',
				'.dsh-env-refresh-btn{background:var(--dsw-alias-bg-layer-3);border:1px solid var(--dsw-alias-border-l3);color:var(--dsw-alias-label-secondary);border-radius:6px;padding:4px 10px;font-size:11px;font-weight:550;cursor:pointer;display:inline-flex;align-items:center;gap:5px;transition:all .15s}',
				'.dsh-env-refresh-btn:hover{background:var(--dsw-alias-interactive-bg-hover);color:var(--dsw-alias-label-primary);border-color:var(--dsw-alias-border-l2)}',
				'.dsh-env-refresh-btn.is-loading{opacity:.75;pointer-events:none}',
				'.dsh-env-time-tag{font-size:11px;color:var(--dsw-alias-label-tertiary);font-variant-numeric:tabular-nums;display:inline-flex;align-items:center;gap:4px}',

				// ── Webkubor 插件全家桶互导矩阵 ──
				'.dsh-suite-dock{margin-top:24px;padding:16px 20px;background:var(--dsw-alias-bg-layer-2,rgba(255,255,255,0.03));border:1px solid var(--dsw-alias-border-l2,rgba(255,255,255,0.08));border-radius:12px;backdrop-filter:blur(10px)}',
				'.dsh-suite-head{display:flex;align-items:center;justify-content:space-between;margin-bottom:14px;flex-wrap:wrap;gap:8px}',
				'.dsh-suite-title{font-size:13px;font-weight:650;color:var(--dsw-alias-label-primary);margin:0;display:flex;align-items:center;gap:6px}',
				'.dsh-suite-desc{font-size:11px;color:var(--dsw-alias-label-tertiary);letter-spacing:.2px}',
				'.dsh-suite-cards{display:grid;grid-template-columns:repeat(auto-fit,minmax(210px,1fr));gap:12px}',
				'.dsh-suite-card{display:flex;flex-direction:column;justify-content:space-between;padding:12px 14px;border-radius:10px;background:var(--dsw-alias-bg-layer-3,rgba(255,255,255,0.02));border:1px solid var(--dsw-alias-border-l3,rgba(255,255,255,0.05));transition:all .2s cubic-bezier(0.16,1,0.3,1)}',
				'.dsh-suite-card:hover{transform:translateY(-2px);border-color:var(--dsw-alias-border-l1,rgba(255,255,255,0.2));box-shadow:0 6px 20px rgba(0,0,0,0.18)}',
				'.dsh-suite-card-top{display:flex;align-items:center;gap:8px;margin-bottom:6px}',
				'.dsh-suite-card-icon{font-size:18px;line-height:1}',
				'.dsh-suite-card-name{font-size:12.5px;font-weight:600;color:var(--dsw-alias-label-primary);text-decoration:none}',
				'.dsh-suite-card-desc{font-size:11px;color:var(--dsw-alias-label-secondary);line-height:1.45;margin-bottom:12px;flex:1}',
				'.dsh-suite-card-bottom{display:flex;align-items:center;justify-content:space-between;gap:8px;margin-top:auto;font-size:11px}',
				'.dsh-suite-badge-active{display:inline-flex;align-items:center;gap:4px;color:var(--dsw-alias-state-success-primary,#10b981);font-weight:600;font-size:11px}',
				'.dsh-suite-badge-active-dot{width:6px;height:6px;border-radius:50%;background:#10b981;box-shadow:0 0 8px rgba(16,185,129,0.6)}',
				'.dsh-suite-btn-action{cursor:pointer;padding:3px 9px;border-radius:5px;font-size:10.5px;font-weight:550;background:var(--dsw-alias-interactive-bg-subtle,rgba(255,255,255,0.06));border:1px solid var(--dsw-alias-border-l2);color:var(--dsw-alias-label-primary);transition:all .15s;text-decoration:none;display:inline-flex;align-items:center;gap:4px}',
				'.dsh-suite-btn-action:hover{background:var(--dsw-alias-interactive-bg-hover,rgba(255,255,255,0.12));border-color:var(--dsw-alias-border-l1)}',
				'.dsh-suite-link{color:var(--dsw-alias-label-tertiary);text-decoration:none;font-size:10.5px;display:inline-flex;align-items:center}',
				'.dsh-suite-link:hover{color:var(--dsw-alias-label-primary)}'
			].join('')
			document.head.appendChild(style)
		}

		/**
		 * 一键复制完整诊断 —— 让小白用户在截图之外，**粘贴一份结构化 JSON** 给 agent / 客服。
		 *
		 * **绝不离开本机**：clipboard.writeText 是浏览器 API，写到本机剪贴板。**不会** fetch 到任何远端。
		 *
		 * 为什么需要：截图只能让对方看个大概，agent 经常需要**精确的版本号 / 路径 / 接口名**才能判断问题。JSON 比截图快得多。
		 *
		 * @param report - 完整自检 JSON
		 * @param t - 词典
		 */
		function DiagnosticCopyBar(report, t) {
			const [feedback, setFeedback] = React.useState(null)
			function handleCopy() {
				// 只把对 debug 有用的字段塞进去；不包含 at 时间戳（每次都变，会污染 diff）
				const summary = {
					at: report?.at,
					os: report?.system?.os,
					arch: report?.system?.arch,
					node: report?.system?.nodeVersion,
					hostname: report?.system?.hostname,
					cli: Array.isArray(report?.cli) ? report.cli.map((c) => ({ n: c.name, ok: c.ok, v: c.version })) : [],
					ai: Array.isArray(report?.ai) ? report.ai.map((c) => ({ n: c.name, ok: c.ok, v: c.version })) : [],
					plugins: Array.isArray(report?.plugins) ? report.plugins.map((p) => `${p.profile}/${p.plugin}@${p.version}`) : [],
					envKeys: Array.isArray(report?.envKeys) ? report.envKeys.map((k) => `${k.name}=${k.configured ? 'set' : 'unset'}`) : [],
					ports: Array.isArray(report?.ports) ? report.ports.map((p) => `${p.port}/${p.protocol || 'tcp'}/${p.command || ''}/${p.pid}`) : [],
					hardware: report?.hardware ?? null,
					network: report?.network ?? null
				}
				const text = JSON.stringify(summary, null, 2)
				if (navigator.clipboard) {
					navigator.clipboard.writeText(text)
						.then(() => setFeedback('ok'))
						.catch(() => setFeedback('fail'))
				} else {
					// 极老的浏览器 fallback
					const ta = document.createElement('textarea')
					ta.value = text
					document.body.appendChild(ta)
					ta.select()
					try { document.execCommand('copy'); setFeedback('ok') } catch { setFeedback('fail') }
					document.body.removeChild(ta)
				}
				setTimeout(() => setFeedback(null), 2200)
			}
			return h('div', { className: 'dsh-env-diagnostic-bar' },
				h('div', { className: 'dsh-env-diagnostic-actions' },
					h('button', {
						type: 'button',
						className: 'dsh-env-refresh-btn',
						onClick: handleCopy,
						title: t('copyFullDiagnostic')
					},
						feedback === 'ok' ? `✓ ${t('copiedDiagnostic')}` : `📋 ${t('copyFullDiagnostic')}`)
				),
				h('p', { className: 'dsh-env-trust-note' }, t('trustNote'))
			)
		}

		/**
		 * Webkubor 插件全家桶互导矩阵组件
		 */
		function WebkuborSuiteDock(installedPlugins, t) {
			const [copiedPkg, setCopiedPkg] = React.useState(null)

			const installedNames = new Set(
				(Array.isArray(installedPlugins) ? installedPlugins : []).map((p) => p.plugin || '')
			)

			const suite = [
				{
					id: '@dsh-plugins/dsh-bloom-theme',
					aliases: ['dsh-bloom-theme', '@dsh-plugins/dsh-bloom-theme'],
					name: 'Bloom Theme',
					icon: '🎨',
					desc: '极致毛玻璃优雅美学、艺术壁纸与暗黑/亮色主题',
					repo: 'https://github.com/webkubor/dsh-bloom-theme',
					pkg: '@dsh-plugins/dsh-bloom-theme'
				},
				{
					id: '@dsh-plugins/dsh-llm-hub',
					aliases: ['dsh-llm-hub', '@dsh-plugins/dsh-llm-hub'],
					name: 'LLM Hub',
					icon: '⚡',
					desc: '多模型统一聚合、秒级切换与故障智能重试',
					repo: 'https://github.com/webkubor/dsh-llm-hub',
					pkg: '@dsh-plugins/dsh-llm-hub'
				},
				{
					id: '@dsh-plugins/dsh-user-mirror',
					aliases: ['dsh-user-mirror', 'dsh-mirror', '@dsh-plugins/dsh-user-mirror'],
					name: 'User Mirror',
					icon: '🪞',
					desc: '用户角色数字画像、习惯偏好与记忆网络',
					repo: 'https://github.com/webkubor/dsh-mirror',
					pkg: '@dsh-plugins/dsh-user-mirror'
				},
				{
					id: '@dsh-plugins/dsh-env-inspector',
					aliases: ['dsh-env-inspector', '@dsh-plugins/dsh-env-inspector'],
					name: 'Env Inspector',
					icon: '🖥️',
					desc: '端口监听释放、CLI工具链与环境大屏',
					repo: 'https://github.com/webkubor/dsh-env-inspector',
					pkg: '@dsh-plugins/dsh-env-inspector',
					isCurrent: true
				}
			]

			const handleCopy = (pkg) => {
				const cmd = `dsh plugin install ${pkg}`
				if (navigator.clipboard) {
					navigator.clipboard.writeText(cmd)
				}
				setCopiedPkg(pkg)
				setTimeout(() => setCopiedPkg(null), 2000)
			}

			return h('div', { className: 'dsh-suite-dock' },
				h('div', { className: 'dsh-suite-head' },
					h('h3', { className: 'dsh-suite-title' },
						h('span', null, '🌟'),
						t('suiteTitle')
					),
					h('span', { className: 'dsh-suite-desc' }, t('suiteDesc'))
				),
				h('div', { className: 'dsh-suite-cards' },
					...suite.map((item) => {
						const isInstalled = item.isCurrent || item.aliases.some((a) => installedNames.has(a))
						const isCopied = copiedPkg === item.pkg

						return h('div', { key: item.id, className: 'dsh-suite-card' },
							h('div', { className: 'dsh-suite-card-top' },
								h('span', { className: 'dsh-suite-card-icon' }, item.icon),
								h('a', {
									href: item.repo,
									target: '_blank',
									rel: 'noopener noreferrer',
									className: 'dsh-suite-card-name'
								}, item.name)
							),
							h('div', { className: 'dsh-suite-card-desc' }, item.desc),
							h('div', { className: 'dsh-suite-card-bottom' },
								isInstalled ? (
									h('span', { className: 'dsh-suite-badge-active' },
										h('span', { className: 'dsh-suite-badge-active-dot' }),
										t('suiteActive')
									)
								) : (
									h('button', {
										type: 'button',
										className: 'dsh-suite-btn-action',
										onClick: () => handleCopy(item.pkg),
										title: `安装命令: dsh plugin install ${item.pkg}`
									}, isCopied ? `✓ ${t('suiteCopied')}` : `⚡ ${t('suiteCopyInstall')}`)
								),
								h('a', {
									href: item.repo,
									target: '_blank',
									rel: 'noopener noreferrer',
									className: 'dsh-suite-link'
								}, 'GitHub ↗')
							)
						)
					})
				)
			)
		}

		/**
		 * 顶部 4 块核心 KPI 状态行
		 */
		function HeroStatsRow(report, t) {
			const sys = report.system ?? {}
			const cli = Array.isArray(report.cli) ? report.cli : []
			const installedCli = cli.filter((c) => c.ok).length
			const ports = Array.isArray(report.ports) ? report.ports : []
			const devPorts = ports.filter((p) => p.category === 'dev' || p.category === 'core' || (p.port && p.port <= 49151)).length
			const ephemeralPorts = ports.filter((p) => p.category === 'ephemeral' || (p.port && p.port > 49151)).length
			const net = report.network ?? {}
			const primaryIp = net.primaryIp ?? '127.0.0.1'
			const envKeys = Array.isArray(report.envKeys) ? report.envKeys : []
			const readyModels = envKeys.filter((k) => k.configured).length

			const kpiCards = [
				{
					num: `${sys.os || 'macOS'}`,
					label: `${sys.cpu?.split('×')[0]?.trim() ?? '12'} 核 · ${sys.arch || 'arm64'}`
				},
				{
					num: `${installedCli} / ${cli.length}`,
					label: `${cli.length > 0 ? Math.round((installedCli / cli.length) * 100) : 100}% 命令行工具就绪`
				},
				{
					num: `${devPorts} 个主要服务`,
					label: `活跃端口 (+ ${ephemeralPorts} 个动态高位)`
				},
				{
					num: primaryIp,
					label: `${readyModels} 款模型凭据已装配`
				}
			]

			return h('div', { className: 'dsh-env-stats-row' },
				...kpiCards.map((kpi, idx) => h('div', { key: idx, className: 'dsh-env-stat-card' },
					h('div', { className: 'dsh-env-stat-num' }, kpi.num),
					h('div', { className: 'dsh-env-stat-label' },
						idx === 0 ? h('span', { className: 'dsh-env-status-dot' }) : null,
						kpi.label
					)
				))
			)
		}

		/**
		 * 活跃监听端口卡片（带分组与悬浮释放）
		 */
		function PortsCard(ports, t, expandEphemeral, setExpandEphemeral, onKillPort) {
			const list = Array.isArray(ports) ? ports : []
			const devPorts = list.filter((p) => p.category === 'core' || p.category === 'dev' || (!p.category && p.port <= 49151))
			const servicePorts = list.filter((p) => p.category === 'service')
			const ephemeralPorts = list.filter((p) => p.category === 'ephemeral' || (!p.category && p.port > 49151))
			const displayedEphemeral = expandEphemeral ? ephemeralPorts : []

			const renderPortItem = (p) => {
				const isDshCore = p.port === 3080
				return h('div', {
					key: `${p.port}/${p.pid}`,
					className: 'dsh-env-port-item',
					title: `${p.command} (PID: ${p.pid ?? '—'})\n${p.host}:${p.port}${p.isWildcard ? ' [' + t('portAllWarning') + ']' : ''}`
				},
					h('span', { style: { display: 'inline-flex', alignItems: 'center', gap: '4px', overflow: 'hidden' } },
						p.isWildcard ? h('span', { className: 'dsh-env-warn-dot', title: t('portAllWarning') }) : null,
						h('span', { className: 'dsh-env-port-num' }, `:${p.port}`)
					),
					h('span', { className: 'dsh-env-port-cmd' },
						p.command,
						p.pid ? h('span', { className: 'dsh-env-port-pid' }, `#${p.pid}`) : null
					),
					isDshCore
						? h('span', { className: 'dsh-env-port-lock', title: t('portProtected') }, '🔒')
						: (p.pid && typeof onKillPort === 'function' ? h('button', {
							type: 'button',
							className: 'dsh-env-port-kill-btn',
							title: `释放端口 :${p.port} (终止 PID ${p.pid})`,
							onClick: (e) => {
								e.stopPropagation()
								onKillPort(p.port, p.pid, p.command)
							}
						}, t('portKill')) : null)
				)
			}

			return h('div', { className: 'dsh-env-card' },
				h('div', { className: 'dsh-env-card-head' },
					h('span', { className: 'dsh-env-card-title' },
						h('span', { style: { fontSize: '16px' } }, '🔌'),
						t('portsSection')
					),
					h('span', { className: 'dsh-env-badge-pill' }, `${devPorts.length} 开发 + ${servicePorts.length} 服务`)
				),

				// 1. 开发与应用服务分组
				h('div', { className: 'dsh-env-port-group' },
					h('div', { className: 'dsh-env-port-group-title' }, t('devPortsTitle')),
					devPorts.length === 0
						? h('div', { style: { fontSize: '11px', color: 'var(--dsw-alias-label-secondary)' } }, '—')
						: h('div', { className: 'dsh-env-port-grid' }, ...devPorts.map(renderPortItem))
				),

				// 2. 系统与后台服务分组
				servicePorts.length > 0 ? h('div', { className: 'dsh-env-port-group' },
					h('div', { className: 'dsh-env-port-group-title' }, t('servicePortsTitle')),
					h('div', { className: 'dsh-env-port-grid' }, ...servicePorts.map(renderPortItem))
				) : null,

				// 3. 动态临时高位端口折叠展示
				ephemeralPorts.length > 0 ? h('div', { style: { marginTop: '10px', paddingTop: '10px', borderTop: '1px solid var(--dsw-alias-border-l3)' } },
					h('div', { style: { display: 'flex', justifyContent: 'space-between', alignItems: 'center' } },
						h('span', { style: { fontSize: '11px', color: 'var(--dsw-alias-label-secondary)' } },
							`${t('portsEphemeral')} (${ephemeralPorts.length})`
						),
						h('button', {
							type: 'button',
							className: 'dsh-env-toggle-btn',
							onClick: () => setExpandEphemeral(!expandEphemeral)
						}, expandEphemeral ? '收起 ▴' : `展开 ${ephemeralPorts.length} 个端口 ▾`)
					),
					expandEphemeral ? h('div', { className: 'dsh-env-port-grid', style: { marginTop: '8px' } },
						...ephemeralPorts.map(renderPortItem)
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
						h('span', { style: { fontSize: '16px' } }, '🛠️'),
						t('cliSection')
					),
					h('span', { className: 'dsh-env-badge-pill' }, `${installed.length} / ${list.length} ${t('cliInstalled')}`)
				),
				h('div', { className: 'dsh-env-cli-grid' },
					...list.map((c) => h('div', {
						key: c.name,
						className: 'dsh-env-cli-item',
						title: c.version ? `${c.name} ${c.version}` : (c.ok ? t('cliInstalled') : t('cliMissing'))
					},
						h('span', { className: 'dsh-env-cli-name' },
							h('span', {
								className: 'dsh-env-status-dot',
								style: { background: c.ok ? 'var(--dsw-alias-state-success-primary,#10b981)' : 'var(--dsw-alias-state-warn-primary,#f59e0b)', boxShadow: 'none' }
							}),
							c.name
						),
						h('span', { className: 'dsh-env-cli-ver' }, c.version ?? (c.ok ? '✓' : '✗'))
					))
				)
			)
		}

		/**
		 * AI 工具链卡片（CliCard 的镜像 + 标题不同）——
		 * 专门列**广义 AI CLI / IDE / 代理**：aider / cursor / continue / cody / tabby /
		 * opencode / goose / cline / lm-studio / ollama。
		 *
		 * 为什么单列：普通 CLI tools 已经有 `codex / claude / agy`，但小白用户装过
		 * aider / cursor 之类几个月就忘了叫什么 —— 这里给一个独立位置让用户一眼看到。
		 */
		function AiToolsCard(ai, t) {
			const list = Array.isArray(ai) ? ai : []
			const installed = list.filter((c) => c.ok)
			return h('div', { className: 'dsh-env-card' },
				h('div', { className: 'dsh-env-card-head' },
					h('span', { className: 'dsh-env-card-title' },
						h('span', { style: { fontSize: '16px' } }, '🤖'),
						t('aiSection')
					),
					h('span', { className: 'dsh-env-badge-pill' }, `${installed.length} / ${list.length} ${t('aiInstalled')}`)
				),
				h('div', { className: 'dsh-env-cli-grid' },
					...list.map((c) => h('div', {
						key: c.name,
						className: 'dsh-env-cli-item',
						title: c.version ? `${c.name} ${c.version}` : (c.ok ? t('aiInstalled') : t('aiMissing'))
					},
						h('span', { className: 'dsh-env-cli-name' },
							h('span', {
								className: 'dsh-env-status-dot',
								style: { background: c.ok ? 'var(--dsw-alias-state-success-primary,#10b981)' : 'var(--dsw-alias-state-warn-primary,#f59e0b)', boxShadow: 'none' }
							}),
							c.name
						),
						h('span', { className: 'dsh-env-cli-ver' }, c.version ?? (c.ok ? '✓' : '✗'))
					))
				)
			)
		}

		/**
		 * 硬件概况卡片 —— macOS 走 system_profiler；其它平台显示"未启用"。
		 *
		 * **不暴露设备型号 / 序列号 / UUID** —— 这些是设备指纹信息，不该给别人看。
		 * 只统计数量：显示器数、显卡数、内存总容量、机型代号（machine_name）。
		 */
		function HardwareCard(hw, t) {
			if (!hw || hw.ok !== true) {
				return h('div', { className: 'dsh-env-card' },
					h('div', { className: 'dsh-env-card-head' },
						h('span', { className: 'dsh-env-card-title' },
							h('span', { style: { fontSize: '16px' } }, '🖥️'),
							t('hardwareSection')
						)),
					h('div', { className: 'dsh-env-card-body' },
						h('span', { style: { color: 'var(--dsw-alias-label-secondary)', opacity: 0.7, fontSize: '12px' } },
							t('hardwareNotAvailable'))
					)
				)
			}
			const rows = []
			if (typeof hw.cpuType === 'string') rows.push([t('cpuLabel'), hw.cpuType])
			if (typeof hw.osVersion === 'string') rows.push([t('osLabel'), hw.osVersion])
			if (typeof hw.displays !== 'undefined') rows.push([t('displaysLabel'), `${hw.displays.length}${hw.displays.some((d) => d.main) ? ' · main' : ''}`])
			if (typeof hw.gpus === 'number') rows.push([t('gpusLabel'), String(hw.gpus)])
			if (typeof hw.memorySlots === 'string') rows.push([t('memSlotsLabel'), hw.memorySlots])
			return h('div', { className: 'dsh-env-card' },
				h('div', { className: 'dsh-env-card-head' },
					h('span', { className: 'dsh-env-card-title' },
						h('span', { style: { fontSize: '16px' } }, '🖥️'),
						t('hardwareSection')
					)),
				h('div', { className: 'dsh-env-cli-grid' },
					...rows.map(([k, v]) => h('div', { key: k, className: 'dsh-env-cli-item' },
						h('span', { className: 'dsh-env-cli-name' }, k),
						h('span', { className: 'dsh-env-cli-ver' }, v)))
				)
			)
		}

		/**
		 * 系统概览卡片
		 */
		function SystemCard(sys, t) {
			const rows = [
				['主机名', sys.hostname],
				['当前用户', `${sys.user} (${sys.home})`],
				['终端 Shell', sys.shell],
				['处理器架构', `${sys.cpu} (${sys.arch})`],
				['内存状态', `${sys.memFreeGB} GB 可用 / ${sys.memTotalGB} GB 总计`],
				['开机运行', `${sys.uptimeMin} 分钟`],
				['PATH 目录数', `${sys.pathDirs} 个`]
			]
			return h('div', { className: 'dsh-env-card' },
				h('div', { className: 'dsh-env-card-head' },
					h('span', { className: 'dsh-env-card-title' },
						h('span', { style: { fontSize: '16px' } }, '💻'),
						t('systemSection')
					),
					h('span', { className: 'dsh-env-badge-pill' }, `${sys.os || 'darwin'}`)
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
		 * 模型与开发凭据卡片（高低分层，已配置高亮，未配置降噪）
		 */
		function ModelCredentialsCard(envKeys, t) {
			const keys = Array.isArray(envKeys) ? envKeys : []
			const readyKeys = keys.filter((k) => k.configured)
			const unreadyKeys = keys.filter((k) => !k.configured)

			return h('div', { className: 'dsh-env-card' },
				h('div', { className: 'dsh-env-card-head' },
					h('span', { className: 'dsh-env-card-title' },
						h('span', { style: { fontSize: '16px' } }, '🔐'),
						t('modelCredentialsSection')
					),
					h('span', { className: 'dsh-env-badge-pill' }, `${readyKeys.length} / ${keys.length} ${t('configured')}`)
				),
				h('div', { className: 'dsh-env-models-section' },
					// 1. 已配置的模型供应商（重点高亮展示）
					h('div', null,
						h('div', { style: { fontSize: '11px', fontWeight: 600, color: 'var(--dsw-alias-label-secondary)', marginBottom: '8px' } },
							`已就绪能力 (${readyKeys.length})`
						),
						readyKeys.length === 0
							? h('div', { style: { fontSize: '11px', color: 'var(--dsw-alias-label-secondary)' } }, '未检测到配置的环境变量')
							: h('div', { className: 'dsh-env-models-ready' },
								...readyKeys.map((k) => h('span', {
									key: k.name,
									className: 'dsh-env-model-ready-tag',
									title: `${k.name} 已配置生效`
								},
									h('span', { style: { fontSize: '12px' } }, '✓'),
									k.name
								))
							)
					),

					// 2. 待配置项（视觉降噪呈现）
					unreadyKeys.length > 0 ? h('div', { style: { paddingTop: '8px', borderTop: '1px solid var(--dsw-alias-border-l3)' } },
						h('div', { style: { fontSize: '11px', color: 'var(--dsw-alias-label-tertiary,#888)', marginBottom: '6px' } },
							`未配置环境变量 (${unreadyKeys.length})`
						),
						h('div', { className: 'dsh-env-models-unready' },
							...unreadyKeys.map((k) => h('span', {
								key: k.name,
								className: 'dsh-env-model-unready-tag',
								title: `${k.name} 未配置`
							},
								h('span', { style: { opacity: 0.5 } }, '·'),
								k.name
							))
						)
					) : null
				)
			)
		}

		/**
		 * 扩展插件与网络适配器卡片（全宽双栏，内含主 IP 一键复制）
		 */
		function PluginsAndNetworkCard(plugins, net, t) {
			const pList = Array.isArray(plugins) ? plugins : []
			const ifaces = Array.isArray(net?.interfaces) ? net.interfaces : []
			const primaryIp = net?.primaryIp ?? (ifaces.find((i) => !i.internal && i.family === 'IPv4')?.address ?? '127.0.0.1')
			const [copied, setCopied] = React.useState(false)

			function copyIp() {
				if (navigator.clipboard && primaryIp) {
					navigator.clipboard.writeText(primaryIp).then(() => {
						setCopied(true)
						setTimeout(() => setCopied(false), 2000)
					}).catch(() => {})
				}
			}

			return h('div', { className: 'dsh-env-card', style: { gridColumn: '1 / -1' } },
				h('div', { className: 'dsh-env-card-head' },
					h('span', { className: 'dsh-env-card-title' },
						h('span', { style: { fontSize: '16px' } }, '🧩'),
						'扩展插件与网络接口'
					),
					h('span', { className: 'dsh-env-badge-pill' }, `${pList.length} 个 DSH 插件 · ${ifaces.length} 个物理接口`)
				),
				h('div', { style: { display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: '24px' } },
					// 左栏：已装 DSH 插件
					h('div', null,
						h('div', { style: { fontSize: '11px', fontWeight: 600, color: 'var(--dsw-alias-label-secondary)', marginBottom: '8px' } }, t('pluginsSection')),
						pList.length === 0
							? h('div', { style: { fontSize: '11px', color: 'var(--dsw-alias-label-secondary)' } }, '—')
							: h('div', { style: { display: 'flex', flexDirection: 'column', gap: '4px' } },
								...pList.map((p) => h('div', {
									key: `${p.profile}/${p.plugin}`,
									className: 'dsh-env-keyval-row',
									style: { padding: '5px 0' }
								},
									h('span', { className: 'dsh-env-keyval-k' },
										h('span', { style: { fontWeight: 600, color: 'var(--dsw-alias-label-primary)' } }, p.plugin),
										h('span', { style: { fontSize: '10px', marginLeft: '6px', opacity: 0.6 } }, `@ ${p.profile}`)
									),
									h('span', { className: 'dsh-env-badge-pill' }, `v${p.version}`)
								))
							)
					),

					// 右栏：网络主 IP 突出展示与物理网卡
					h('div', null,
						h('div', { style: { fontSize: '11px', fontWeight: 600, color: 'var(--dsw-alias-label-secondary)', marginBottom: '8px' } }, t('primaryIp')),
						h('div', { className: 'dsh-env-ip-hero' },
							h('span', { className: 'dsh-env-ip-val' }, primaryIp),
							h('button', {
								type: 'button',
								className: 'dsh-env-copy-btn',
								onClick: copyIp
							}, copied ? t('copied') : t('copyIp'))
						),
						h('div', { style: { fontSize: '11px', color: 'var(--dsw-alias-label-secondary)', marginBottom: '6px' } }, t('networkSection')),
						h('div', { style: { display: 'flex', flexWrap: 'wrap', gap: '6px' } },
							...ifaces.map((iface, i) => h('span', {
								key: `${iface.name}/${i}`,
								className: 'dsh-env-port-item',
								style: { padding: '4px 8px' },
								title: `${iface.name} (${iface.family}) ${iface.internal ? 'Internal' : ''}`
							},
								h('span', { style: { fontWeight: 600, color: 'var(--dsw-alias-label-secondary)' } }, iface.name),
								h('span', { style: { fontFamily: 'ui-monospace,SFMono-Regular,Menlo,monospace', color: 'var(--dsw-alias-label-primary)' } }, iface.address)
							))
						)
					)
				)
			)
		}

		/**
		 * 活跃监听端口（微型弹窗面板内呈现）。
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
						p.isWildcard ? h('span', { className: 'dsh-env-inspector__warn-dot', title: t('portAllWarning') }) : null,
						`:${p.port}· ${p.command}`
					)),
					ephemeralPorts.length > 0 ? h('span', {
						className: 'dsh-env-inspector__chip',
						style: { opacity: 0.7 }
					}, `+${ephemeralPorts.length} ${t('portsEphemeral')}`) : null
				)
			)
		}

		/**
		 * 当作为 conversation.view 独立 Tab 展示时的看板视图。
		 */
		function EnvInspectorView(props) {
			const t = typeof props.t === 'function' ? props.t : fallbackT
			const initialStore = getStoredReport()
			const [report, setReport] = React.useState(initialStore.report)
			const [lastUpdated, setLastUpdated] = React.useState(initialStore.timestamp)
			const [loading, setLoading] = React.useState(false)
			const [expandEphemeral, setExpandEphemeral] = React.useState(false)

			function loadReport(force = false) {
				// 非强制刷新且 30 秒内有缓存，直接跳过后台请求
				if (!force && globalReportCache !== null && Date.now() - globalReportTimestamp < 30000) {
					return
				}
				setLoading(true)
				fetch(SELF_CHECK_URL, { headers: { accept: 'application/json' } })
					.then((res) => res.json())
					.then((body) => {
						if (body !== null && typeof body === 'object') {
							updateStoredReport(body)
							setReport(body)
							setLastUpdated(Date.now())
						}
					})
					.catch(() => {})
					.finally(() => setLoading(false))
			}

			React.useEffect(() => {
				const onCacheUpdate = (newReport, ts) => {
					setReport(newReport)
					setLastUpdated(ts)
				}
				cacheListeners.add(onCacheUpdate)
				// 进入 Tab：有缓存则立即展现并静默校验，无缓存则加载
				loadReport(false)
				return () => cacheListeners.delete(onCacheUpdate)
			}, [])

			function handleKillPort(port, pid, command) {
				if (!pid) {
					window.alert(`无法终止：未检测到端口 :${port} 的关联进程 PID`)
					return
				}
				const promptMsg = t('portKillConfirm')
					.replace('{port}', String(port))
					.replace('{command}', String(command))
					.replace('{pid}', String(pid))
				const ok = window.confirm(promptMsg)
				if (!ok) return

				fetch('/api/dsh-env-inspector/kill-port', {
					method: 'POST',
					headers: { 'content-type': 'application/json' },
					body: JSON.stringify({ port, pid })
				})
					.then((res) => res.json())
					.then((data) => {
						if (data.ok) {
							loadReport(true)
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
				return h('div', { style: { padding: '48px', textAlign: 'center', color: 'var(--dsw-alias-label-secondary)' } },
					h('span', { className: 'dsh-env-spin', style: { marginRight: '8px' } }, '🔄'),
					t('loading')
				)
			}

			const cli = Array.isArray(report.cli) ? report.cli : []

			return h('div', { className: 'dsh-env-inspector__view-container' },
				h('div', { className: 'dsh-env-view-head' },
					h('h2', { className: 'dsh-env-view-title' },
						h('span', { style: { fontSize: '22px' } }, '🖥️'),
						t('title'),
						h('div', { className: 'dsh-env-refresh-bar' },
							h('button', {
								type: 'button',
								className: 'dsh-env-refresh-btn' + (loading ? ' is-loading' : ''),
								onClick: () => loadReport(true),
								disabled: loading,
								title: t('refresh')
							},
								h('span', { className: loading ? 'dsh-env-spin' : '' }, '🔄'),
								loading ? t('refreshing') : t('refresh')
							),
							lastUpdated ? h('span', { className: 'dsh-env-time-tag' },
								`${t('lastCheck')}${formatDisplayTime(lastUpdated, t)}`
							) : null
						)
					),
					h('span', { className: 'dsh-env-footer-note' }, t('footerNote'))
				),
				HeroStatsRow(report, t),
				h('div', { className: 'dsh-env-grid' },
					PortsCard(report.ports ?? [], t, expandEphemeral, setExpandEphemeral, handleKillPort),
					CliCard(cli, t),
					AiToolsCard(report.ai ?? [], t),
					SystemCard(report.system ?? {}, t),
					HardwareCard(report.hardware ?? null, t),
					ModelCredentialsCard(report.envKeys ?? [], t),
					PluginsAndNetworkCard(report.plugins ?? [], report.network ?? {}, t)
				),
				DiagnosticCopyBar(report, t),
				WebkuborSuiteDock(report.plugins ?? [], t)
			)
		}

		/**
		 * 输入框底部的辅助徽章与浮层弹窗
		 */
		function EnvInspectorBadge(props) {
			const t = typeof props.t === 'function' ? props.t : fallbackT
			const [open, setOpen] = React.useState(false)
			const initialStore = getStoredReport()
			const [report, setReport] = React.useState(initialStore.report)

			React.useEffect(() => {
				const onCacheUpdate = (newReport) => setReport(newReport)
				cacheListeners.add(onCacheUpdate)
				return () => cacheListeners.delete(onCacheUpdate)
			}, [])

			function handleToggle() {
				if (!open && report === null) {
					fetch(SELF_CHECK_URL, { headers: { accept: 'application/json' } })
						.then((res) => res.json())
						.then((body) => {
							if (body && typeof body === 'object') {
								updateStoredReport(body)
								setReport(body)
							}
						})
						.catch(() => {})
				}
				setOpen(!open)
			}

			ensureStyle()
			const cli = Array.isArray(report?.cli) ? report.cli : []
			const installedCli = cli.filter((c) => c.ok).length
			const ports = Array.isArray(report?.ports) ? report.ports : []

			return h('div', { className: 'dsh-env-inspector', style: { position: 'relative' } },
				h('button', {
					type: 'button',
					className: 'dsh-env-inspector__chip',
					onClick: handleToggle,
					title: '点击查看电脑环境指标'
				},
					h('span', { className: 'dsh-env-status-dot' }),
					'电脑环境' + (report ? ` · ${installedCli} / ${cli.length} CLI` : '')
				),
				open && report ? h('div', { className: 'dsh-env-inspector__panel' },
					h('div', { className: 'dsh-env-inspector__panel-head' },
						h('span', { className: 'dsh-env-inspector__panel-title' },
							h('span', null, '🖥️'),
							t('title')
						),
						h('button', {
							type: 'button',
							className: 'dsh-env-inspector__close',
							onClick: () => setOpen(false)
						}, '×')
					),
					h('div', { className: 'dsh-env-inspector__row' },
						h('span', { className: 'dsh-env-inspector__key' }, 'OS'),
						h('span', { className: 'dsh-env-inspector__val' }, `${report.system?.os} (${report.system?.arch})`)
					),
					h('div', { className: 'dsh-env-inspector__row' },
						h('span', { className: 'dsh-env-inspector__key' }, 'Primary IP'),
						h('span', { className: 'dsh-env-inspector__val' }, report.network?.primaryIp ?? '127.0.0.1')
					),
					h('div', { className: 'dsh-env-inspector__row' },
						h('span', { className: 'dsh-env-inspector__key' }, 'CLI Tools'),
						h('span', { className: 'dsh-env-inspector__val' }, `${installedCli} / ${cli.length} 就绪`)
					),
					PortsSection(report.ports ?? [], t),
					h('div', { className: 'dsh-env-footer-note' }, t('footerNote'))
				) : null
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
