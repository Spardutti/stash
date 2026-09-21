<!-- claude-skills:skill-evaluation:start -->
## Skills

BEFORE writing ANY code, you MUST:

1. List EVERY skill available: check `.claude/skills/` (project) and `~/.claude/skills/` (global). The system-reminder's available-skills section is a hint, not the source of truth — if it's missing or empty, still check the directories.
2. For each skill, write: [skill-name] → ACTIVATE / SKIP — [one-line reason]
3. Call Skill(name) for every skill marked ACTIVATE
4. Emit the literal token `[skills-checked]` on its own line
5. Only THEN proceed to implementation

A PreToolUse gate hook blocks Write/Edit/MultiEdit until the `[skills-checked]` token appears in your response since the most recent user prompt. The gate fires once per turn — the first blocked edit is the signal to evaluate skills, then retry. If you skip the evaluation, your response is INCOMPLETE and WRONG.
<!-- claude-skills:skill-evaluation:end -->

<!-- claude-skills:file-size:start -->
## File Size Enforcement

- **Never write a file longer than 200 lines of code.** If a file would exceed 200 lines, split it into smaller modules before writing.
- This rule applies during skill evaluation: if the code you're about to write would exceed 200 lines in any single file, refactor into multiple files first.
- Skill evaluation must check this limit as part of every ACTIVATE decision.
<!-- claude-skills:file-size:end -->
