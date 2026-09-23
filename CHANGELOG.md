# 更新日志

本项目遵循 [Semantic Versioning](https://semver.org/lang/zh-CN/)。

## [0.2.2] - 2026-09-23

### 🐛 修复电脑环境面板卡片溢出

- 响应式卡片在窄容器下允许降为单列，不再超出内容边界。
- CLI 工具卡片列宽允许收缩；过长的工具名和版本号以省略号显示，避免撑破卡片。
- 增加布局回归断言，覆盖网格收缩和长文本省略规则。

## [0.2.0] - 2026-09-22

### ✨ 扩展信息来源 + 让小白用户放心

#### 广义 AI CLI 工具链（新）
- **独立 AiToolsCard**：跟 CliCard 区分，专门列 aider / cursor / continue / cody-cli /
  tabby / codestral / opencode / goose / cline / lm-studio / ollama 共 11 款广 AI 工具。
- **不重复**：普通 CLI 卡已有 `codex / claude / agy`，AiToolsCard 故意不重列。
- 渲染样式复用 `dsh-env-cli-grid` + `dsh-env-cli-item`，跟 CliCard 视觉一致。

#### 硬件概况卡片（新，仅 macOS）
- 走 `/usr/sbin/system_profiler -json SPDisplaysDataType SPHardwareDataType`。
- 字段：显示器数（+ main 屏标志）、显卡数、物理内存容量、机型代号、macOS 版本。
- **不暴露 fingerprint**：型号字符串 / 序列号 / Hardware UUID 一律**不展示**——测试断言 grep
  `serial|uuid` 都命中不到。
- 非 macOS 平台返 `{ ok: false }`，UI 显示 "硬件探测未启用"。

#### 一键复制完整诊断 + 信任提示（新）
- 在 grid 下方加 `DiagnosticCopyBar`：📋 复制完整诊断按钮 + 「本机不上传、只你看」提示文案。
- **结构化 JSON 输出**：精简字段名（`{n, ok, v}` 而不是 `{name, ok, version}`），不包含 token 明文。
- **绝不离开本机**：`navigator.clipboard.writeText` 写到本机剪贴板，不发任何 fetch。
- 兼容老浏览器（`document.execCommand('copy')` fallback）。

### 内部

- `lib/index.js` 加 `probeAiTools()` + `probeHardware()` 两个纯本地探测函数；两者均 fail-open。
- `lib/client.js` 加 `AiToolsCard` / `HardwareCard` / `DiagnosticCopyBar` 三个组件；
  复用 0.1.1 已有的 `dsh-env-card-*` 样式 + `dsw-alias-*` 主题变量。
- LOCALES 加 14 条（中英各 7 条：aiSection / aiInstalled / aiMissing / hardwareSection /
  hardwareNotAvailable / displaysLabel / gpusLabel / cpuLabel / osLabel / memSlotsLabel /
  copyFullDiagnostic / copiedDiagnostic / trustNote）。
- 27 个单测全过（含新加的 probeHardware 平台门、probeHardware 不暴露 fingerprint、
  DiagnosticCopyBar JSON 清洗）。

### 不在 0.2.0 范围

- 浏览器探测（Chrome / Safari / Firefox / Arc / Edge / Brave 是否装）：0.2.0 还没做；用 `ls
  /Applications` 检测本地 Mac，但 owner 答 "不需要"所以留 0.3.0。
- 磁盘 / 挂载点：同原因，0.3.0。
- 端口全网监听（`0.0.0.0`）警告：0.1.1 已做，不在本版。

## [0.1.1] - 2026-09-22

### ✨ UI 体验升级：缓存秒开 + 全家桶互导矩阵 + GEO 优化

#### 缓存与刷新体验（解决切 Tab 白屏问题）
- **内存 + LocalStorage 双层持久化 Store**：首次自检后数据跨 Tab 切换永久保留，再次进入「电脑环境」Tab 时 **0ms 即时渲染**，彻底消除空白白屏；
- **SWR（Stale-While-Revalidate）静默校验**：切进 Tab 时展示缓存内容，若距离上次自检超过 30 秒则在后台静默发起新探测，数据返回后无缝平滑替换；
- **「🔄 刷新」按钮**：标题栏右侧新增高颜值刷新控件，点击触发强制全量探测；自检进行时图标平滑旋转 + 「自检中…」文字防止误触；按钮旁实时显示「上次自检: 刚刚 / 15s 前 / 15:12:08」时间戳；
- **Badge ↔ View 双向联动**：输入框底部徽章（Badge）与全屏 Tab 视图（View）共享同一 Store，释放端口后两者同步更新。

#### Webkubor DSH 扩展家族互导矩阵（Suite Dock）
- 视图底部新增「🌟 Webkubor DSH 扩展家族」卡片矩阵，展示 Bloom Theme / LLM Hub / User Mirror / Env Inspector 四款插件；
- **智能状态感知**：自动探知本地已安装的插件，已安装显示「🟢 已激活」微呼吸绿点，未安装显示「⚡ 复制安装」一键复制 `dsh plugin install ...` 命令；
- 卡片支持悬浮 `translateY(-2px)` 微浮动效果与 GitHub 直链。

#### GEO（生成式引擎优化）
- 新增 `llms.txt`：结构化声明功能、使用场景与安装命令，为 DeepSeek/GPT Search/Perplexity AI 爬虫提供高质量语义锚点；
- 新增 `screenshots.json`：声明 `assets/preview.png` 官方截图协议，官方插件市场 Storefront 自动抓取轮播；
- 新增高颜值 UI 预览截图（`assets/preview.png`，1792×1008 Retina 精度）。

#### 自动化提 PR 工具
- 新增 `auto-submit-pr.sh`：自动检测仓库年龄是否满足社区 24 小时门禁，满足条件后自动调用 `gh pr create` 发起社区收录 PR。

## [0.1.0] - 2026-09-22

### 🎉 首发正式版：电脑环境自检与端口运维中心

`dsh-env-inspector` 是面向 DeepSeek Harness (DSH) 的现代本地开发环境自检与端口诊断插件。
零外部运行时依赖、不联网、绝不泄露敏感秘钥明文。

#### 1. 现代卡片式仪表盘 (Modern Card Dashboard)
- **4 核心 Hero KPI 状态横条**：
  - 操作系统与架构（如 `darwin 25.5.0 (arm64)`）；
  - CLI 命令行工具链就绪率（如 `12 / 12` 100% 就绪）；
  - 活跃端口统计（主要服务端口 + 动态高位端口）；
  - Node 运行时与内存剩余容量（GB）。
- **双列网格布局**：
  - 深度适配 DSH 主题色与明暗自适应变量，带来通透清爽的视觉留白；
  - 底部预留 200px 安全滚动区域，避免被固定的底部输入框（Composer）遮挡。

#### 2. 活跃监听端口实时探测与一键释放 (Kill Process)
- **端口实时嗅探**：深度兼容 macOS 守护进程最小 `PATH` 环境，解析 `lsof` 输出，自动识别通配监听（`*` / `0.0.0.0`）并以黄色微圆点警示；
- **高位动态端口折叠抽屉**：默认收拢 49152+ 的动态高位端口，支持一键平滑展开与收起；
- **一键释放（Kill）与坚固安全护栏**：
  - 每个端口条目提供轻量级终止按钮（`×`）；
  - **防自杀保护**：DSH 核心端口 `3080` 永久锁定并展示 `🔒` 标识，严禁终止；自身 Node 进程（`process.pid`）与系统核心 PID 强制受保护；
  - **状态一致性核验**：终止前服务端重新核对目标 PID 确实正在监听目标端口，杜绝 PID 复用导致的误杀；
  - **优雅退出两阶段**：先发送 `SIGTERM` 允许清理退出，未响应再发送 `SIGKILL` 彻底释放；
  - **即时自检联动**：释放成功后无需刷新页面，界面自动即时触发重检，目标端口瞬间消失，KPI 同步递减。

#### 3. 工具链与凭证安全状态透视
- **命令行工具链**：探测 12 款常见开发者工具（`node`, `npm`, `pnpm`, `yarn`, `git`, `cs`, `docker`, `mise`, `brew`, `codex`, `claude`, `agy`）的就绪状态与版本号；
- **AI 凭据透明度**：核对 10 款常见大模型环境变量的存在性（仅返回布尔值），高低分层突出已就绪能力，**严格杜绝输出任何密钥明文或私有账本**；
- **系统基础与网络接口**：清晰列出 Hostname、User、Shell、CPU 核心、开机时间、PATH 目录数及本机 IPv4 / IPv6 接口。

#### 4. 双挂载入口与工程化
- 支持在顶部全屏 Tab（`conversation.view`）以及输入框底栏徽章（`conversation.composer.dock`）双向挂载；
- 内置双语词典（中/英），开箱即用；
- 具备 23 项全量自动化测试（单元测试、算法解析、安全拦截、真实子进程与针对 DSH 真实实例的 HTTP E2E 测试全部 100% 通过）。

---

## 🗺️ 后续落地计划 (Roadmap)

- [ ] **端口占用进程来源深度解析**：识别常见本地开发框架（如 Vite、Next.js、Webpack、Flask、Docker 等）并展示专属图标与项目目录路径；
- [ ] **历史端口占用快照对比**：支持记录开机基准端口，一键标记“新增的后台幽灵端口”；
- [ ] **无 scope 迁移**：随 npm 维护账号解冻收敛，平滑迁移至官方命名 `dsh-env-inspector` 并保持向后兼容。
