# 更新日志

本项目遵循 [Semantic Versioning](https://semver.org/lang/zh-CN/)。

## [0.1.0] - 2026-09-22

### 新增

- **composer 顶栏徽章** —— `conversation.composer.bar` slot 注册一个紧凑按钮
  "电脑环境 · N / M CLI"，点开展开完整面板。
- **系统段**：OS / arch / hostname / user / shell / Node / CPU / 内存 / uptime / PATH dirs。
- **CLI 段**：探测 node / npm / pnpm / yarn / git / cs / docker / mise / brew / codex / claude / agy，
  各自是否装 + 版本。
- **DSH 插件段**：从 web / desktop-local profile 的 package.json 读 `@dsh-plugins/*` 和 `dsh-*` 依赖。
- **环境变量 key 段**：探测常见 API key 是否已配 —— **只返存在性，不返值**。
- **kyvault 段**：走 `cs kyvault list`，列出 `secret://platform/name` 引用 —— **只返引用名，不返值**。
- **网络段**：本机网络接口列表（IPv4 / IPv6 / internal 标志）。
- 零运行时依赖；所有探测走 node:os / node:child_process / node:fs / 读 PATH，**不联网**。
- 完整自检载荷走 `GET /api/dsh-env-inspector/self-check`，同源 + GET/HEAD only，cache-control: no-store。

### 内部

- 新加 host-only 模块（`lib/index.js` + `lib/client.js`），无 build 步骤。
- `cordis.patch.yml` 走单行 insert：`id: dsh-env-inspector-self-check`。
- 插件仓独立 git init（按 `~/dev/dsh-plugins/README.md` 的"加一个新插件时"流程）。
- 包名走过渡态 `@dsh-plugins/dsh-env-inspector`，等 `kubor` 工作号解冻后切无 scope `dsh-env-inspector`。
- **0.1.0 不发 npm** —— 先在 web profile 用 `file:` 引用本地路径内部试用。

### 不在 0.1.0 范围

- 导出"完整诊断包"按钮（zip / 文本）—— 后续看用户需求再加。
- 顶部全局 status bar —— DSH 暂无原生 status bar slot，目前走 `conversation.composer.bar` 折中。
- 自动检测更新 —— 不发 npm 就谈不上；0.2.0 再说。
