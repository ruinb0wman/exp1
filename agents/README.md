# Agents 目录

本目录统一管理所有 AI 相关的配置、技能和记忆。

## 目录结构

```
agents/
├── skills/          # AI Skills（可执行的工作流）
│   └── git-commit/  # Git 提交助手
├── memories/        # 项目记忆/上下文
│   └── project-context.md
├── prompts/         # 提示词片段（用于 Agent 配置）
└── README.md        # 本文件
```

## 使用方法

### Skills

在对话中通过 `/skill:<name>` 调用：

```
/skill:git-commit
```

**当前可用的 Skills：**

| Skill | 说明 |
|-------|------|
| `git-commit` | 分析 git 改动，生成 commit message 并提交 |

### Memories

Memories 是项目的长期记忆，包含项目概况、技术栈、规范等信息。

启动对话时可以通过 `/import` 导入：

```
/import agents/memories/project-context.md
```

或者在 `AGENTS.md` 中引用，让 AI 自动加载。

### Prompts

Prompts 目录存放可复用的提示词片段，用于构建自定义 Agent。

## 扩展指南

### 添加新 Skill

1. 在 `skills/` 下创建新目录，如 `my-skill/`
2. 创建 `SKILL.md` 文件，包含以下内容：
   ```markdown
   ---
   name: my-skill
   description: 简短描述
   ---
   
   # My Skill
   
   详细的工作步骤说明...
   ```
3. 在 `agents/README.md` 中更新 Skill 列表

### 添加新 Memory

1. 在 `memories/` 下创建 `.md` 文件
2. 使用清晰的标题和结构组织内容
3. 可通过 `/import` 在对话中加载

## 与 AGENTS.md 的关系

- `AGENTS.md`：项目级别的 Agent 说明，随代码仓库维护
- `agents/`：AI 执行层面的配置和技能

两者互补，共同提升 AI 在项目中工作的效果。
