#!/usr/bin/env bash
# auto-submit-pr.sh —— dsh-env-inspector 社区合规自动化 PR 提交脚本
#
# 社区规则门禁：The repo is at least 1 day old (MIN_AGE_DAYS = 1)
# 脚本自动校验仓库创建时间，满 24 小时后自动调用 gh pr create 发起 PR，并通过 cs notify 广播。

set -e

REPO="webkubor/dsh-env-inspector"
UPSTREAM="awesome-dsh-plugin/awesome-dsh-plugin"
BRANCH="add-dsh-env-inspector"
FORK_DIR="/Users/webkubor/dev/third-party/awesome-dsh-plugin"

echo "🔍 检查 $REPO 创建时间..."
CREATED_AT=$(gh repo view "$REPO" --json createdAt -q .createdAt)
CREATED_TS=$(date -j -f "%Y-%m-%dT%H:%M:%SZ" "$CREATED_AT" "+%s" 2>/dev/null || date -d "$CREATED_AT" "+%s")
NOW_TS=$(date "+%s")
AGE_SEC=$((NOW_TS - CREATED_TS))
AGE_HOURS=$((AGE_SEC / 3600))
MIN_AGE_SEC=86400 # 24 小时

if [ "$AGE_SEC" -lt "$MIN_AGE_SEC" ]; then
    REMAIN_MIN=$(( (MIN_AGE_SEC - AGE_SEC) / 60 ))
    echo "⚠️ 仓库创建未满 24 小时 (当前已创建: ${AGE_HOURS}h，还差 ${REMAIN_MIN} 分钟)"
    echo "⏳ 安全提交窗口：2026-09-23 11:15 之后。请届时再次运行本脚本。"
    exit 0
fi

echo "✅ 仓库已创建满 24 小时 (已存续 ${AGE_HOURS}h)，进入提交流程..."

cd "$FORK_DIR"

# 检查当前分支是否为目标分支
CURRENT_BRANCH=$(git branch --show-current)
if [ "$CURRENT_BRANCH" != "$BRANCH" ]; then
    git checkout "$BRANCH"
fi

# 检查远程是否已开 PR
EXISTING_PR=$(gh pr list --repo "$UPSTREAM" --head "webkubor:$BRANCH" --state all --json number -q '.[0].number')
if [ -n "$EXISTING_PR" ]; then
    echo "🎉 PR 已存在: https://github.com/$UPSTREAM/pull/$EXISTING_PR"
    exit 0
fi

echo "🚀 发起 PR 至 $UPSTREAM..."
PR_URL=$(gh pr create \
    --repo "$UPSTREAM" \
    --head "webkubor:$BRANCH" \
    --base main \
    --title "Add webkubor/dsh-env-inspector (tools)" \
    --body "Add @dsh-plugins/dsh-env-inspector to tools category. Fully verified locally.")

echo "🌟 PR 提交成功: $PR_URL"

# 发送飞书通知
if command -v cs >/dev/null 2>&1; then
    cs notify "🎉 DSH 插件社区 PR 已发起｜dsh-env-inspector 成功提交至 awesome-dsh-plugin 官方目录！$PR_URL" --from gemini || true
fi
