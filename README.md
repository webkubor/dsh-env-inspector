<h1 align="center">🖥️ dsh-env-inspector</h1>

<p align="center">
  <strong>看清你的电脑装了什么，一键释放残留占用的开发端口。</strong><br>
  DeepSeek Harness (DSH) 环境自检与端口运维插件 —— 现代卡片仪表盘，零运行时依赖；网络出口检测仅在用户点击时发生，绝不展示秘钥明文。
</p>

<p align="center">
  <a href="https://www.npmjs.com/package/@dsh-plugins/dsh-env-inspector"><img src="https://img.shields.io/npm/v/%40dsh-plugins%2Fdsh-env-inspector?style=for-the-badge&color=3fb950&logo=npm&label=npm" alt="npm" /></a>
  <a href="https://www.npmjs.com/package/@dsh-plugins/dsh-env-inspector"><img src="https://img.shields.io/npm/dm/%40dsh-plugins%2Fdsh-env-inspector?style=for-the-badge&color=6d7f9c&label=downloads" alt="downloads" /></a>
  <img src="https://img.shields.io/badge/DSH-%E2%89%A50.1.5--rc.2-4d6bfe?style=for-the-badge" alt="DSH" />
  <img src="https://img.shields.io/badge/runtime_deps-0-5A9E6F?style=for-the-badge" alt="deps" />
  <img src="https://img.shields.io/badge/license-MIT-777?style=for-the-badge" alt="MIT" />
</p>

<p align="center">
  <a href="https://github.com/deepseek-ai/deepseek-harness"><img src="https://img.shields.io/badge/DeepSeek_Harness-Plugin-4d6bfe?style=for-the-badge" alt="DSH Plugin" /></a>
  <a href="https://github.com/topics/dsh-plugin"><img src="https://img.shields.io/badge/topic-dsh--plugin-4d6bfe?style=for-the-badge" alt="dsh-plugin" /></a>
  &nbsp;·&nbsp; <a href="README.en.md">English</a> · <a href="CHANGELOG.md">更新日志</a>
</p>

<p align="center">
  <img src="https://cdn.jsdelivr.net/gh/webkubor/picx-images-hosting@master/dsh-env-inspector/overview.png/dsh-env-tab-final-default.png" alt="电脑环境仪表盘预览图" width="100%" />
  <br />
  <sub><b>电脑环境 Dashboard</b> —— 4 项核心 Hero KPI 指标行 + 现代双列网格卡片，系统状态、工具链与端口一目了然。</sub>
</p>

---

## 🎯 解决什么痛点

| 场景 | 以前的困扰 | dsh-env-inspector 的解法 |
|---|---|---|
| **端口常遭占用报错** | 关了终端后残留的 Node/Python 进程仍霸占端口，下次启动频繁 `EADDRINUSE` | **实时探测所有监听端口，鼠标一键点击「×」安全释放（Kill 进程），页面即时自动刷新** |
| **全网监听未察觉** | 服务不经意监听在 `0.0.0.0`，暴露在局域网存在安全隐患 | **醒目黄色警告圆点标注全网监听端口**，提醒开发者关注访问控制 |
| **繁杂端口视觉干扰** | 系统高位动态端口（49152+）动辄几十个，严重干扰排查 | **智能抽屉机制**：常用开发端口一目了然，高位动态端口平滑折叠，支持一键展开/收起 |
| **排查环境低效繁琐** | 协同或调试时需频繁在终端反复敲 `node -v`、`git --version`、`lsof` 截图 | **顶部 Tab 独立大看板**：操作系统、12 款常用 CLI 就绪状态、大模型 Key 存在性全局掌控 |

---

## ✨ 核心特性

### 1. 🔌 活跃端口全景透视与一键安全释放 (Kill Process)
- **实时探测**：底层基于系统 `lsof` 探针，补全 macOS 守护进程最小 `PATH` 路径，完整捕获服务端口与占用进程名；
- **高位动态端口折叠**：区分核心服务端口与动态端口，保持界面清爽；
- **坚不可摧的安全护栏**：
  - 🛡️ **防自杀保护**：DSH 核心端口 `:3080` 永久锁定（显示 `🔒` 徽标），DSH 宿主自身的 `process.pid` 永久锁定，严禁终止；系统核心 PID 强制拦截；
  - 🔍 **状态一致性核验**：执行前服务端再次校验目标 PID 确实正在监听目标端口，杜绝因 PID 复用导致的误杀；
  - ⚡ **两阶段退出**：优先发送 `SIGTERM` 允许平滑清理，未退出时再升级为 `SIGKILL` 彻底回收；
  - 🔄 **联动即时自检**：终止后无需刷新浏览器，页面自动重拉自检，该端口瞬间消失，KPI 计数同步递减。

<p align="center">
  <img src="https://cdn.jsdelivr.net/gh/webkubor/picx-images-hosting@master/dsh-env-inspector/ports-expanded.png/dsh-env-tab-final-expanded.png" alt="端口展开抽屉" width="100%" />
  <br />
  <sub><b>动态高位端口展开抽屉</b> —— 点击「展开 N 个端口 ▾」即可浏览全部动态端口，并支持逐一释放。</sub>
</p>

### 2. 🛠️ 命令行工具链与版本嗅探
双列黑曜石圆角卡片，实时探测 12 款常见开发工具的安装与版本状态：
- 基础 CLI：`node` / `npm` / `pnpm` / `yarn` / `git` / `cs` / `docker` / `mise` / `brew`
- AI CLI：`codex` / `gemini` / `claude` / `opencode` / `agy`，另含常见 AI IDE 与本地模型工具
- 语言运行时：`python3` / `go` / `rustc`，只展示成功读取到版本的已安装运行时

### 3. 🔐 AI 模型与开发凭据（零明文、零私有泄露）
- **高低层级分明**：自动提炼并翡翠绿高亮已配置生效的模型能力（如 DeepSeek、MiniMax 等）；
- **低对比度辅助**：未配置的环境变量以微型灰度标签展示，视觉清爽不抢戏；
- **安全红线**：所有接口与组件**绝不输出、不读取、不传递任何密钥明文，零私有凭据泄露**。

### 4. 🧩 扩展插件与网络接口全览
- 自动列出当前 Web / Local profile 下加载的 DSH 扩展插件及其实际生效版本；
- 区分展示局域网 IP、公网出口 IP，并标出是否检测到显式代理配置；公网出口 IP 只在用户点击后检测。

---

## 📦 安装与启用

### 方式 A：通过 DSH 插件管理器安装（推荐）

> 前提：装好 Node.js 即可，**无需全局安装 dsh** —— 官方入口就是 `npx @deepseek-ai/dsh`。已全局安装的可把它换成 `dsh`。

```bash
npx @deepseek-ai/dsh plugin --profile web add @dsh-plugins/dsh-env-inspector
```

再把 `@dsh-plugins/dsh-env-inspector` 加进 `~/.dsh/profiles/web/package.json` 的 `dsh.profile.bundles` 数组，然后按下方重启 DSH。

### 方式 B：手动配置 Profile

在你的 DSH profile 配置（如 `~/.dsh/profiles/web/package.json`）中添加依赖与 bundle 声明：

```json
{
  "dependencies": {
    "@dsh-plugins/dsh-env-inspector": "^0.2.4"
  },
  "dsh": {
    "profile": {
      "bundles": [
        "@dsh-plugins/dsh-env-inspector"
      ]
    }
  }
}
```

执行安装并重启 DSH：
```bash
npx @deepseek-ai/dsh plugin --profile web install
# 结束当前 DSH 进程后重新运行
npx @deepseek-ai/dsh web
```

进入页面后，点击顶部导航栏中的 **「🖥️ 电脑环境」** Tab，即可开始使用。

---

## 🛡️ 架构与安全承诺

- **零运行时依赖**：代码完全基于 Node.js 原生 API 与纯 React 构建，无任何第三方三方包膨胀；
- **默认不联网**：本地自检不访问外部服务；用户主动点击“检测出口 IP”时，浏览器才向公网 IP 服务发起一次请求；
- **同源防护**：所有接口强制校验 `Sec-Fetch-Site: same-origin`，彻底杜绝恶意网页跨站探测。

---

## 🗺️ 后续落地规划 (Roadmap)

- [ ] **项目目录反查**：针对端口占用的进程，自动反查并展示其当前的工作目录（如 `/Users/.../my-vite-app`）；
- [ ] **开机幽灵端口对比**：提供“基准端口对比”模式，高亮提示当前会话中新开启但未退出的残留端口；
- [ ] **官方命名平滑演进**：待维护账号收敛后，无缝兼容并迁移至 `@dsh-plugins/dsh-env-inspector` 与 `dsh-env-inspector`。

---

## 🧩 DSH 插件全家桶

<p align="center">
  <img src="https://img.webkubor.online/projects/dsh-plugins/dsh-plugins-family.png" alt="DSH 插件全家桶：主题美化 / 模型管理 / 用户记忆 / 电脑环境" width="100%" />
</p>

<p align="center">
  <a href="https://github.com/webkubor/dsh-bloom-theme">🎨 主题美化</a> ·
  <a href="https://github.com/webkubor/dsh-llm-hub">⚡ 模型管理</a> ·
  <a href="https://github.com/webkubor/dsh-mirror">🪞 用户记忆</a> ·
  <a href="https://github.com/webkubor/dsh-env-inspector">🖥️ 电脑环境</a>
</p>

一行装齐（只需 Node.js），装完重启 DSH 即可：

```bash
npx -y @deepseek-ai/dsh plugin --profile web add dsh-bloom-theme @dsh-plugins/dsh-llm-hub @dsh-plugins/dsh-user-mirror @dsh-plugins/dsh-env-inspector && node -e 'const f=(process.env.DSH_HOME||require("os").homedir()+"/.dsh")+"/profiles/web/package.json",p=require(f),b=p.dsh.profile.bundles;for(const n of Object.keys(p.dependencies))if(/^(dsh-bloom-theme|@dsh-plugins\/)/.test(n)&&!b.includes(n))b.push(n);require("fs").writeFileSync(f,JSON.stringify(p,null,2)+"\n")'
```

---

## License

[MIT](LICENSE) © [webkubor](https://github.com/webkubor)
