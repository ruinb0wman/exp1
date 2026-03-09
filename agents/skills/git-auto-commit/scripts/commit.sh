#!/bin/bash
# 执行 git commit 的脚本
# 用法: ./commit.sh "commit message"

set -e

MESSAGE="$1"

if [ -z "$MESSAGE" ]; then
    echo "错误: 请提供 commit message" >&2
    echo "用法: ./commit.sh \"commit message\"" >&2
    exit 1
fi

# 检查是否有已暂存的文件
STAGED_COUNT=$(git diff --cached --numstat | wc -l)

if [ "$STAGED_COUNT" -eq 0 ]; then
    echo "错误: 没有已暂存的改动，请先使用 git add" >&2
    exit 1
fi

# 执行 commit
echo "执行: git commit -m \"$MESSAGE\""
git commit -m "$MESSAGE"

echo ""
echo "✅ Commit 成功!"
git log -1 --oneline
