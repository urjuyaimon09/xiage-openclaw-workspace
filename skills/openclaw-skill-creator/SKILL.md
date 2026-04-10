---
name: skill-creator
description: Create new OpenClaw skills. Use when: asked to build a new skill, extend existing capabilities, or package knowledge into a reusable skill. Not for installing skills (use xiage-skills for that).
---

# Skill Creator

Create new OpenClaw skills following this workflow.

## When to Create a Skill

- Asked to build a new skill
- Extending existing capabilities with packaged knowledge
- Repetitive workflows that should be reusable
- Domain expertise that should be preserved

## Anatomy of a Skill

Every skill lives in `~/.openclaw/skills/` as a directory:

```
skill-name/
├── SKILL.md          (required) — YAML frontmatter + Markdown instructions
├── scripts/          (optional) — Executable code (Python/Bash/etc.)
├── references/      (optional) — Documentation to load into context as needed
└── assets/          (optional) — Templates, icons, fonts
```

## SKILL.md Structure

```yaml
---
name: skill-name
description: One sentence. When this skill gets triggered and what it does.
---

# Skill Name

[Markdown instructions]
```

### YAML Frontmatter (required)

- `name`: Skill identifier
- `description`: **Critical** — Only text Claude reads to decide when to trigger this skill. Be specific about trigger conditions.

### Body (Markdown)

Only loaded AFTER the skill triggers. Keep lean — token cost comes from context too.

## Freedom Levels

| Level | When to use | Example |
|-------|-------------|---------|
| High | Multiple valid approaches | "Improve the UI" |
| Medium | Some variation acceptable | Pseudocode or parameterized scripts |
| Low | Fragile, consistency critical | Specific sequence to follow |

## Workflow

1. **Identify trigger** — What situation activates this skill?
2. **Write description** — One sentence, be specific
3. **Outline steps** — High-level first, then refine
4. **Add scripts** — If same code gets rewritten repeatedly
5. **Add references** — Only if needed and >10k words; include grep patterns in SKILL.md
6. **Test** — Run the skill and verify it works

## Skill Installation

After creating SKILL.md:
1. Add to workspace skills directory
2. Add mapping to SKILLS-INDEX.md (short name → folder name → author)
3. If xiage-skills is configured, run `node xiage-skills.js install <author> <name> <url> <risk> <description>`
