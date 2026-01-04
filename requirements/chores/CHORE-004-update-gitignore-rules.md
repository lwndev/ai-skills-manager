# Chore: Update Gitignore Rules

## Chore ID

`CHORE-004`

## Category

`configuration`

## Description

Update `.gitignore` to ensure `.idea` remains ignored and `.claude` directory is tracked with only `settings.local.json` excluded.

## Affected Files

- `.gitignore`

## Acceptance Criteria

- [ ] `.idea/*` rule remains in `.gitignore` (IDE settings should NOT be tracked)
- [ ] `.claude` directory is NOT ignored (no blanket `.claude` or `/.claude/` rule exists)
- [ ] `/.claude/settings.local.json` remains ignored
- [ ] `.claude` directory files are added to version control
- [ ] Changes validated by running `git status` to confirm expected behavior

## Notes

- `.idea/*` should remain ignored to prevent IDE-specific settings from being tracked
- `/.claude/settings.local.json` should remain ignored for user-specific local settings
- The rest of `.claude` directory (including skills) should be tracked
