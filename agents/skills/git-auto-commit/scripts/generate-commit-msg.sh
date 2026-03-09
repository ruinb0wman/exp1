#!/bin/bash
# 生成 commit message 的脚本
# 用法: ./generate-commit-msg.sh [type]
# type 可选: feat|fix|docs|style|refactor|test|chore

set -e

# 获取可选的 type 参数
TYPE=${1:-""}

# 检查是否在 git 仓库中
if ! git rev-parse --git-dir > /dev/null 2>&1; then
    echo "错误: 当前目录不是 git 仓库" >&2
    exit 1
fi

# 获取改动的文件列表
STAGED_FILES=$(git diff --cached --name-only 2>/dev/null || echo "")
UNSTAGED_FILES=$(git diff --name-only 2>/dev/null || echo "")
UNTRACKED_FILES=$(git ls-files --others --exclude-standard 2>/dev/null || echo "")

# 检查是否有任何改动
if [ -z "$STAGED_FILES" ] && [ -z "$UNSTAGED_FILES" ] && [ -z "$UNTRACKED_FILES" ]; then
    echo "错误: 没有检测到任何代码改动" >&2
    exit 1
fi

# 输出改动摘要
echo "=== 改动的文件 ==="

if [ -n "$STAGED_FILES" ]; then
    echo "已暂存 (staged):"
    echo "$STAGED_FILES" | sed 's/^/  - /'
fi

if [ -n "$UNSTAGED_FILES" ]; then
    echo "未暂存 (unstaged):"
    echo "$UNSTAGED_FILES" | sed 's/^/  - /'
fi

if [ -n "$UNTRACKED_FILES" ]; then
    echo "未跟踪 (untracked):"
    echo "$UNTRACKED_FILES" | sed 's/^/  - /'
fi

echo ""
echo "=== 详细改动 ==="

# 获取暂存区的 diff
if [ -n "$STAGED_FILES" ]; then
    echo "[暂存区的改动]"
    git diff --cached --stat
    echo ""
fi

# 获取未暂存区的 diff（限制行数避免过多输出）
if [ -n "$UNSTAGED_FILES" ]; then
    echo "[未暂存的改动]"
    git diff --stat
    echo ""
fi

# 输出 type 提示
if [ -n "$TYPE" ]; then
    echo ""
    echo "建议的 commit type: $TYPE"
fi
