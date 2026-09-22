# dsh-env-inspector

> **让你（或别人）看到你电脑上装了什么** —— 系统、命令行工具、DSH 插件、秘钥是否存在。
> 零运行时依赖，不联网，不展示明文秘钥。

## 给谁用

| 谁 | 解决什么 |
|---|---|
| **电脑小白用户** | 别人问"你电脑装了什么" —— 不知道；装过 CLI 几个月后忘了叫什么；想 debug 不知道怎么截屏环境信息 |
| **agent / 客服帮用户 debug** | 不用问"打开设置页 → 找 key → 截图给我"这种来回 —— 让用户贴一个链接，环境一览无遗 |
| **owner 自己** | 看到自己有几把 API key 是配置的、有几个 DSH 插件、CLI 工具链齐不齐 |

## 它显示什么

**点击 composer 顶栏的徽章** → 弹出面板：

| 段 | 内容 |
|---|---|
| 系统 | OS / arch / hostname / user / shell / Node / CPU / 内存 / uptime / PATH dirs |
| CLI 工具 | node / npm / pnpm / yarn / git / cs / docker / mise / brew / codex / claude / agy —— 各自是否装 + 版本 |
| 已装 DSH 插件 | 从 web / desktop-local profile 的 package.json 读 `@dsh-plugins/*` 和 `dsh-*` 依赖 |
| 已配环境变量 key | DeepSeek / OpenAI / Anthropic / Google / Moonshot / 智谱 / MiniMax / StepFun / CF / GitHub —— 各自**是否配**（不显示值）|
| kyvault 已存秘钥 | 走过 `cs kyvault list`，列出 `secret://platform/name` 引用 —— **不显示值** |
| 网络接口 | 本机网络接口列表（IPv4 / IPv6 / internal 标志）|

## 它**不**做什么

- **不展示秘钥明文** —— 不管是 env var 还是 kyvault，都只返回"是否配置"
- **不联网** —— 所有探测走本地命令（`node --version` / `git --version` 等），不调用任何远端
- **不改任何状态** —— host 半是纯 read-only，路由只 GET
- **不写日志** —— 主人看这个面板时不会留下任何痕迹

## 安装

> **0.1.0 还是 dev 版本，未发 npm**。先在 web profile 用 `file:` 引用本地路径试用。

```sh
# 1) 在 ~/.dsh/profiles/web/package.json 里加依赖（写本地路径）：
cd ~/.dsh/profiles/web
pnpm add /Users/webkubor/dev/dsh-plugins/dsh-env-inspector
# 或者手动加 dependencies:
#   "@dsh-plugins/dsh-env-inspector": "file:/Users/webkubor/dev/dsh-plugins/dsh-env-inspector"

# 2) 把它加进 bundles —— 改 ~/.dsh/profiles/web/package.json 的 dsh.profile.bundles：
#   "@dsh-plugins/dsh-env-inspector"

# 3) 重启 DSH
~/.dsh/restart.sh
```

composer 顶栏应该出现一个徽章「电脑环境 · N / M CLI」，点开看面板。

## 自己开发

```sh
cd ~/dev/dsh-plugins/dsh-env-inspector
npm run check         # syntax check
npm test              # 单元测试（暂未填，按 dsh-llm-hub 风格用 node --test）
npm run deploy        # rsync 到 web profile 验证
```

## 包名

`@dsh-plugins/dsh-env-inspector` —— 走 org scope 过渡态，按根 README「包名为什么三种写法」规则，等 kubor 工作号解冻后切到无 scope `dsh-env-inspector`。

## License

MIT
