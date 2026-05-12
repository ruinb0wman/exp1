---
name: git-commit-manager
description: >
  Guides git commit workflow with conventional commit messages.
  Analyzes changes, suggests commit types (feat/fix/refactor/ci/dosc/chore),
  generates Chinese descriptions, and manages staging/commit/push flow.
  Push is only performed when explicitly requested by the user.
---

## What I do

I help manage git commits for this project by:

1. **Analyzing changes** — Runs `git status` + `git diff` + `git log` to understand
   the current state and recent commit history.
2. **Generating commit messages** — Analyzes changed files to infer the type of
   change and generate a conventional commit message with Chinese description.
3. **Interactive commit flow** — Presents the suggested commit message, waits for
   user confirmation or edits, then executes `git add` + `git commit`.
4. **Push on demand** — Only pushes when the user explicitly asks for it.

## When to use me

Use this skill when the user says something like:
- "提交" / "帮我提交" / "提交代码"
- "commit" / "create a commit" / "make a commit"
- "推送到远程" / "push"
- Any request involving git staging, committing, or pushing

## Commit Message Conventions

This project uses **conventional commits** with **Chinese descriptions**:

```
<type>: <Chinese description>
```

### Commit Types (from project history)

| Type       | Usage                           | Example                                 |
|------------|----------------------------------|-----------------------------------------|
| `feat`     | New feature                      | `feat: 实现开机自启与静默启动功能`        |
| `fix`      | Bug fix                          | `fix: 移除 tauri.conf.json 中重复配置`    |
| `refactor` | Code refactoring (no behavior change) | `refactor: 移除跨设备同步功能`        |
| `ci`       | CI/CD changes                    | `ci: 本地构建只生成二进制，CI 只打包`     |
| `docs`     | Documentation changes            | `docs: 更新 README`                      |
| `chore`    | Maintenance/tooling              | `chore: 更新依赖版本`                    |

### Message Length

- Keep the Chinese description concise (1 sentence, under 100 chars)
- Focus on **why** (what changed and why), not **how**

### References

- Use issue/PR numbers appended in parentheses or after a colon, if relevant
- Example: `fix: 修复多语言切换后页面崩溃问题 (#42)`

## Workflow

### Step 1: Assess State

```bash
git status          # Check staged/unstaged/untracked files
git diff            # See unstaged changes
git diff --cached   # See staged changes
git log -10 --oneline  # Recent commits for style reference
```

### Step 2: Determine Commit Type

Analyze changed files against these rules:
- **`feat`** — New feature, new component, new API endpoint, new command
- **`fix`** — Bug fix, crash fix, incorrect behavior fix
- **`refactor`** — Restructuring code, renaming, moving files, removing dead code
- **`ci`** — GitHub Actions, Tauri CI, build scripts, workflow files
- **`docs`** — README, AGENTS.md, CHANGELOG, comments-only changes
- **`chore`** — Dependencies, config, package.json, tooling, formatting

If multiple types apply, choose the most significant one. If ambiguous, ask the
user.

### Step 3: Generate & Propose Message

Generate a commit message and present it to the user:

```
Suggested commit message:
  feat: 添加用户头像上传功能

? Accept, edit, or cancel? (accept/edit/cancel)
```

Let the user choose:
- **accept** — Use as-is
- **edit** — User provides custom message
- **cancel** — Abort the commit

### Step 4: Execute Commit

```bash
git add <files>           # Stage the files
git commit -m "<message>" # Commit with the message
```

### Step 5: Push (only if requested)

```bash
git push                  # Push to remote
```

## Safety Rules

These rules are strictly enforced to prevent destructive git operations:

1. **NEVER** modify git config
2. **NEVER** run destructive commands (push --force, hard reset, rebase, etc.)
   unless the user explicitly requests them with clear understanding
3. **NEVER** skip hooks (--no-verify, --no-gpg-sign) unless the user explicitly
   requests it
4. **NEVER** force push to main/master — warn the user if they request it
5. **AVOID** `git commit --amend` — only use when ALL conditions are met:
   - User explicitly requested amend (or pre-commit hook modified auto-files)
   - HEAD commit was created by you in this conversation
   - Commit has NOT been pushed to remote yet
6. If commit FAILED or was REJECTED by a hook: NEVER amend — fix the issue and
   create a NEW commit
7. If already pushed to remote: NEVER amend unless user explicitly requests it
   (requires force push)
8. Create meaningful commits — don't batch unrelated changes together
9. Stage files to match the commit scope: don't include unrelated files

## Tips

- Use `git add -p` for partial staging when a file has mixed changes
- Use `git restore <file>` to unstage or discard changes when needed
- Suggest splitting into multiple commits if the changes are large and
  belong to separate concerns
