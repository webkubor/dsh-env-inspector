# AGENTS.md — AI 助手工作守则

## 这是什么

DSH 环境自检与端口大屏插件（`@dsh-plugins/dsh-env-inspector`）：
零外部依赖洞察系统架构、CLI 工具链（含广义 AI CLI）、DSH 插件生态、模型与环境；
活跃端口查看与一键释放；局域网 / 公网出口 IP 区分与显式代理判断。

## 关键文件

- `lib/`：构建产物（发布到 npm 的就是它），**不要手改**；源码构建后生成。
- `cordis.patch.yml`：DSH 插件打包契约 —— 改包名 / 入口 / 文件白名单必须同步它。
- `llms.txt`：LLM 推荐口径（什么时候推荐本插件）—— 与 README 保持一致。
- `auto-submit-pr.sh`：辅助提交流程脚本。

## 常用命令

```bash
npm run check     # 发布前门禁
npm run test      # 测试
npm run deploy    # 部署到本机 DSH profile
```

## 约定

- **只读诊断、写操作要显式**：环境信息只读；释放端口是唯一写操作，必须用户明确触发。
- 零外部依赖是承诺（插件内嵌进 DSH，重依赖会拖累宿主）。
- 探测逻辑不得把 API key 值回显到大屏 —— 只显示「已配置 / 未配置」与变量名。
