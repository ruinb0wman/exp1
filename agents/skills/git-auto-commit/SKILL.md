---
name: git-auto-commit
description: 自动分析代码改动并生成合适的 git commit message，支持多种 commit type（feat/fix/docs/style/refactor/test/chore）。使用场景：(1) 用户要求"总结改动并提交"、(2) 用户说"commit 一下"、(3) 用户需要自动化的 git commit 流程、(4) 任何需要基于代码改动生成 commit message 的场景。
---

# Git Auto Commit Skill

自动分析代码改动，生成合适的 commit message，并执行 git commit。

## 使用流程

### 1. 获取改动信息

使用脚本获取当前代码改动的摘要：

```bash
bash agents/skills/git-auto-commit/scripts/generate-commit-msg.sh [type]
```

可选的 `type` 参数用于提示 commit 类型：
- `feat`: 新功能
- `fix`: 修复 bug
- `docs`: 文档更新
- `style`: 代码格式调整（不影响功能）
- `refactor`: 重构
- `test`: 测试相关
- `chore`: 构建/工具/其他

### 2. 分析改动并生成 Commit Message

根据脚本输出的改动信息，分析并生成符合以下格式的 commit message：

```
<type>: <简短描述>

<详细描述（可选）>
```

**Message 生成原则：**
- 使用中文或英文（根据项目习惯，此项目使用中文）
- 首字母小写
- 简短描述不超过 50 个字符
- 详细描述每行不超过 72 个字符
- 说明"做了什么"和"为什么做"

**根据改动文件推断 type：**
- 新增功能代码 → `feat`
- 修复 bug → `fix`
- 修改文档/注释 → `docs`
- 格式化/分号/空格 → `style`
- 重命名/重构代码 → `refactor`
- 测试文件 → `test`
- 配置文件/依赖更新 → `chore`

### 3. 执行 Commit

```bash
bash agents/skills/git-auto-commit/scripts/commit.sh "<生成的 message>"
```

**注意：** 执行前确保文件已通过 `git add` 暂存。

## 完整工作流示例

```bash
# 1. 查看改动并获取建议
cd /path/to/project
bash agents/skills/git-auto-commit/scripts/generate-commit-msg.sh feat

# 2. （用户确认或修改生成的 message）

# 3. 确保文件已暂存
git add .

# 4. 执行 commit
bash agents/skills/git-auto-commit/scripts/commit.sh "feat: 添加任务完成进度追踪功能"
```

## 注意事项

1. **必须暂存文件**: 脚本只提交已暂存（staged）的文件，未暂存的改动不会自动提交
2. **空改动检查**: 如果没有检测到任何改动，脚本会报错退出
3. **type 推断**: 如果用户没有指定 type，根据改动内容智能推断
4. **用户确认**: 生成 commit message 后，建议向用户展示并确认后再执行 commit

## 与用户的交互流程

```
用户: "帮我 commit 一下"
    ↓
Kimi: 执行 generate-commit-msg.sh 获取改动
    ↓
Kimi: 分析改动，生成建议的 commit message
    ↓
Kimi: 向用户展示改动摘要和建议的 message
    ↓
用户: 确认或修改
    ↓
Kimi: 执行 git add . (如果需要)
    ↓
Kimi: 执行 commit.sh 完成提交
```
