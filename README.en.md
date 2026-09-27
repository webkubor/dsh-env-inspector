<h1 align="center">🖥️ dsh-env-inspector</h1>

<p align="center">
  <strong>See what your machine actually has — and reclaim the dev ports stuck in the background.</strong><br>
  Environment inspection and port ops for DeepSeek Harness (DSH) — a modern card dashboard, zero runtime dependencies. Network egress is probed only on click, and secrets are never printed.
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
  &nbsp;·&nbsp; <a href="README.md">中文</a> · <a href="CHANGELOG.md">Changelog</a>
</p>

<p align="center">
  <img src="https://cdn.jsdelivr.net/gh/webkubor/picx-images-hosting@master/dsh-env-inspector/overview.png/dsh-env-tab-final-default.png" alt="Environment dashboard" width="100%" />
  <br />
  <sub><b>Environment dashboard</b> — a hero KPI row plus a two-column card grid: system, toolchain, and ports at a glance.</sub>
</p>

---

## 🎯 What it solves

| Situation | The usual pain | What dsh-env-inspector does |
|---|---|---|
| **Ports keep getting taken** | A stray Node/Python process from a closed terminal still holds the port, and the next start fails with `EADDRINUSE` | **Lists every listening port; click "×" to release it safely (kill the process) and the view refreshes itself** |
| **Listening on all interfaces by accident** | A service quietly binds `0.0.0.0` and is reachable from the LAN | **Flags wildcard-bound ports with a yellow warning dot** so access control gets a second look |
| **High ports drown out signal** | Dozens of ephemeral ports (49152+) make the real ones hard to find | **Smart drawer**: common dev ports stay visible, ephemeral ones collapse by default and expand on demand |
| **Slow environment triage** | Debugging means typing `node -v`, `git --version`, `lsof` over and over | **A dedicated dashboard tab**: OS, 12 common CLIs, and model-key presence in one place |

---

## ✨ Features

### 1. 🔌 Port overview with one-click safe release
- **Live probing** via the system `lsof` probe, with a minimal `PATH` fallback so macOS daemons are found too.
- **Ephemeral-port collapsing** to keep the list readable.
- **Safety rails that hold**:
  - 🛡️ **No self-immolation**: DSH's own port `:3080` is permanently locked (shown with a `🔒` badge), as is the DSH host's own `process.pid`; core system PIDs are refused outright.
  - 🔍 **Consistency re-check**: before killing, the server verifies the target PID really is listening on that port — so PID reuse can't cause a wrong kill.
  - ⚡ **Two-phase exit**: `SIGTERM` first to allow graceful cleanup, escalating to `SIGKILL` only if needed.
  - 🔄 **Auto re-scan**: no browser refresh required — the port disappears and the KPI count drops immediately.

<p align="center">
  <img src="https://cdn.jsdelivr.net/gh/webkubor/picx-images-hosting@master/dsh-env-inspector/ports-expanded.png/dsh-env-tab-final-expanded.png" alt="Expanded port drawer" width="100%" />
  <br />
  <sub><b>Ephemeral port drawer</b> — click "expand N ports ▾" to browse and release them individually.</sub>
</p>

### 2. 🛠️ Toolchain and version sniffing
Two-column rounded cards that detect 12 common developer tools and their versions:
- Core CLI: `node` / `npm` / `pnpm` / `yarn` / `git` / `cs` / `docker` / `mise` / `brew`
- AI CLI: `codex` / `gemini` / `claude` / `opencode` / `agy`, plus common AI IDEs and local model tooling
- Runtimes: `python3` / `go` / `rustc` — only shown when a version is actually readable

### 3. 🔐 Model keys and credentials (never in plaintext)
- **Configured** model providers are surfaced and highlighted in green.
- **Unconfigured** environment variables appear as small dim tags, out of the way.
- **Hard rule**: no endpoint or component ever prints, reads, or forwards a secret value.

### 4. 🧩 Plugins and network interfaces
- Lists the DSH plugins loaded in the current Web / Local profile, with their effective versions.
- Shows LAN IP and public egress IP separately, and whether an explicit proxy is configured. The public IP is probed only after you click.

---

## 📦 Install

### Option A — via the DSH plugin manager (recommended)

```bash
dsh plugin add @dsh-plugins/dsh-env-inspector
```

### Option B — via npm

```bash
npm i -g @dsh-plugins/dsh-env-inspector
```

Then restart DSH and open the **计算机环境 / Environment** tab.

---

## 🔒 Security notes

- No secret value is ever rendered, logged, or transmitted — only presence/absence.
- Port-kill refuses DSH's own port and PID, core system PIDs, and re-verifies PID↔port binding before acting.
- Network egress detection is user-initiated only.

---

## License

MIT © webkubor
