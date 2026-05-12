---
name: skill-creator
description: Scaffolds new OpenCode Agent Skills — guides naming validation, frontmatter generation, content structure, and file placement
license: MIT
compatibility: opencode
metadata:
  audience: maintainers
  workflow: scaffolding
---

## What I do

I help you create new OpenCode Agent Skills. I handle the entire scaffolding process:

1. **Clarify purpose** — Ask what the skill should help agents do, when to use it, and any specific behaviors it should guide
2. **Name the skill** — Propose a name matching `^[a-z0-9]+(-[a-z0-9]+)*$` (1-64 chars, no leading/trailing hyphens, no consecutive hyphens)
3. **Write the description** — Keep it 1-1024 characters, specific enough for agents to know when to load this skill
4. **Determine placement** — Create the file at `.opencode/skills/<name>/SKILL.md` by default (or at a user-specified location)
5. **Build the frontmatter** — Include `name`, `description`, optionally `license`, `compatibility`, and `metadata`
6. **Write the body** — Follow the conventions from the skill docs: `## What I do`, `## When to use me`, and any section headings relevant to the skill's domain
7. **Validate** — Confirm the directory name matches `name`, the file exists, and the frontmatter is well-formed

## When to use me

Use this skill whenever the user says something like:
- "Create a skill for ..."
- "I need a new skill that ..."
- "Help me write an Agent Skill"
- "Scaffold a skill for ..."
- Any mention of creating or writing a SKILL.md

## Structure template

Each skill needs:

```
.opencode/skills/<name>/
  SKILL.md
```

### Frontmatter

```yaml
---
name: <lowercase-hyphenated-name>
description: <1-1024 char description>
license: <optional, e.g. MIT>
compatibility: <optional, e.g. opencode>
metadata:
  key: value
---
```

### Body conventions

- Use `##` headings for major sections
- Start with `## What I do` to describe the skill's behavior
- Include `## When to use me` with clear trigger phrases
- Add additional sections as needed for domain-specific guidance
- Use markdown lists, code blocks, and examples liberally

## Naming rules

- 1-64 characters
- Lowercase alphanumeric with single hyphen separators
- Must not start or end with `-`
- Must not contain consecutive `--`
- Must match the directory name containing `SKILL.md`

Equivalent regex: `^[a-z0-9]+(-[a-z0-9]+)*$`

## Validation checklist

After creating the skill, verify:
- [ ] Directory name matches `name` in frontmatter
- [ ] `name` follows the naming regex
- [ ] `description` is 1-1024 characters
- [ ] No unknown fields in frontmatter
- [ ] File is named `SKILL.md` (all caps)
- [ ] At minimum, `## What I do` and `## When to use me` sections exist
