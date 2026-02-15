# ASM Manual Test Plan

> **Version:** v1.7.0
> **Date:** 2026-02-14
> **Branch:** `main`
> **Prerequisites:** `npm run build` completes successfully, `npm run quality` passes

---

## 1. Scaffold Command (`asm scaffold`)

### 1.1 Basic Scaffolding

| # | Test Case | Command | Expected Result |
|---|-----------|---------|-----------------|
| 1.1.1 | Scaffold with minimal args | `node dist/cli.js scaffold test-basic -d "A basic skill"` | Creates `.claude/skills/test-basic/SKILL.md` with basic template, name=test-basic, description set |
| 1.1.2 | Scaffold with no description | `node dist/cli.js scaffold test-nodesc` | Creates SKILL.md with `TODO: Add description` placeholder |
| 1.1.3 | Scaffold to personal scope | `node dist/cli.js scaffold test-personal -d "Personal skill" --personal` | Creates `~/.claude/skills/test-personal/SKILL.md` |
| 1.1.4 | Scaffold to custom output | `node dist/cli.js scaffold test-custom -d "Custom path" -o /tmp/skills-test` | Creates `/tmp/skills-test/test-custom/SKILL.md` |
| 1.1.5 | Scaffold with project flag | `node dist/cli.js scaffold test-project -d "Project skill" -p` | Creates `.claude/skills/test-project/SKILL.md` |

### 1.2 Template Types

| # | Test Case | Command | Expected Result |
|---|-----------|---------|-----------------|
| 1.2.1 | Basic template (default) | `node dist/cli.js scaffold test-tmpl-basic -d "Basic" -t basic` | SKILL.md with basic template, no context:fork |
| 1.2.2 | Forked template | `node dist/cli.js scaffold test-tmpl-forked -d "Forked" -t forked` | SKILL.md with `context: fork`, tools=[Read,Glob,Grep] |
| 1.2.3 | With-hooks template | `node dist/cli.js scaffold test-tmpl-hooks -d "Hooks" -t with-hooks` | SKILL.md with hooks section, tools=[Bash,Read,Write] |
| 1.2.4 | Internal template | `node dist/cli.js scaffold test-tmpl-internal -d "Internal" -t internal` | SKILL.md with `user-invocable: false`, tools=[Read,Grep] |
| 1.2.5 | Invalid template type | `node dist/cli.js scaffold test-bad -t agent` | Error: invalid template type (exit 1) |

### 1.3 Spec Fields (CHORE-013)

| # | Test Case | Command | Expected Result |
|---|-----------|---------|-----------------|
| 1.3.1 | License field | `node dist/cli.js scaffold test-license -d "Licensed" --license MIT` | SKILL.md frontmatter contains `license: MIT` |
| 1.3.2 | Compatibility field | `node dist/cli.js scaffold test-compat -d "Compat" --compatibility "claude-code>=2.1"` | Frontmatter contains `compatibility: claude-code>=2.1` |
| 1.3.3 | Metadata field (multi-entry) | `node dist/cli.js scaffold test-meta -d "Meta" --metadata author=test --metadata category=utility` | Frontmatter contains `metadata:` with both key-value pairs |
| 1.3.4 | All spec fields combined | `node dist/cli.js scaffold test-allspec -d "All spec" --license Apache-2.0 --compatibility "claude-code>=2.0" --metadata version=1.0` | All three fields present in frontmatter |
| 1.3.5 | Metadata with equals in value | `node dist/cli.js scaffold test-meta-eq -d "Eq" --metadata "expr=a=b"` | Frontmatter contains `expr: a=b` (first `=` is delimiter) |

### 1.4 Removed Fields (CHORE-013 Breaking Changes)

| # | Test Case | Command | Expected Result |
|---|-----------|---------|-----------------|
| 1.4.1 | --model flag rejected | `node dist/cli.js scaffold test-model -d "Model" --model sonnet` | Error: unknown option '--model' |
| 1.4.2 | --memory flag rejected | `node dist/cli.js scaffold test-memory -d "Memory" --memory project` | Error: unknown option '--memory' |
| 1.4.3 | Agent template rejected | `node dist/cli.js scaffold test-agent -d "Agent" -t agent` | Error: invalid template type |

### 1.5 Additional Options

| # | Test Case | Command | Expected Result |
|---|-----------|---------|-----------------|
| 1.5.1 | Custom allowed tools | `node dist/cli.js scaffold test-tools -d "Tools" -a "Bash,Read,Write"` | SKILL.md lists Bash, Read, Write as allowed-tools |
| 1.5.2 | Force overwrite | Create `test-force` first, then: `node dist/cli.js scaffold test-force -d "Forced" -f` | Overwrites without prompting |
| 1.5.3 | No user invocable | `node dist/cli.js scaffold test-noinvoke -d "Hidden" --no-user-invocable` | `user-invocable: false` in frontmatter |
| 1.5.4 | Argument hint | `node dist/cli.js scaffold test-hint -d "Hint" --argument-hint "<file-path>"` | `argument-hint: <file-path>` in frontmatter |
| 1.5.5 | Minimal mode | `node dist/cli.js scaffold test-minimal -d "Minimal" --minimal` | Shorter SKILL.md without educational guidance |
| 1.5.6 | Context flag | `node dist/cli.js scaffold test-ctx -d "Context" --context fork` | `context: fork` in frontmatter |
| 1.5.7 | Agent flag | `node dist/cli.js scaffold test-agent-field -d "Agent" --agent "CLI extension"` | `agent: CLI extension` in frontmatter |
| 1.5.8 | Hooks flag | `node dist/cli.js scaffold test-hooks-flag -d "Hooks" --hooks` | Hooks section in frontmatter |

### 1.6 Validation & Edge Cases

| # | Test Case | Command | Expected Result |
|---|-----------|---------|-----------------|
| 1.6.1 | Invalid name (uppercase) | `node dist/cli.js scaffold TestBad -d "Bad"` | Error: invalid skill name (exit 1) |
| 1.6.2 | Invalid name (path traversal) | `node dist/cli.js scaffold "../escape" -d "Bad"` | Error: security validation |
| 1.6.3 | Name too long (>64 chars) | `node dist/cli.js scaffold a-very-long-skill-name-that-exceeds-the-maximum-allowed-length-of-sixty-four -d "Long"` | Error: name exceeds max length |
| 1.6.4 | Argument hint too long (>200) | `node dist/cli.js scaffold test-long-hint -d "Hint" --argument-hint "$(python3 -c 'print("x"*201)')"` | Error: argument hint exceeds max |
| 1.6.5 | Existing dir without force | Create dir first, then: `node dist/cli.js scaffold test-exists -d "Exists"` | Prompts for confirmation or errors (non-TTY) |
| 1.6.6 | Reserved word in name | `node dist/cli.js scaffold my-claude-skill -d "Reserved"` | Error: name contains reserved word "claude" |
| 1.6.7 | Reserved word "anthropic" | `node dist/cli.js scaffold anthropic-helper -d "Reserved"` | Error: name contains reserved word "anthropic" |
| 1.6.8 | Description too long (>1024) | `node dist/cli.js scaffold test-long-desc -d "$(python3 -c 'print("x"*1025)')"` | Error: description exceeds max length |
| 1.6.9 | Description with angle brackets | `node dist/cli.js scaffold test-angles -d "Use <div> tags"` | Error: description cannot contain angle brackets |
| 1.6.10 | Compatibility too long (>500) | `node dist/cli.js scaffold test-long-compat -d "Compat" --compatibility "$(python3 -c 'print("x"*501)')"` | Error: compatibility exceeds max length |
| 1.6.11 | Empty metadata key | `node dist/cli.js scaffold test-empty-key -d "Bad" --metadata "=value"` | Error: empty metadata key |

### 1.7 Interactive Mode

| # | Test Case | Command | Expected Result |
|---|-----------|---------|-----------------|
| 1.7.1 | Launch interactive mode | `node dist/cli.js scaffold test-interactive -i` | Guided prompts for template, context, agent, hooks, minimal, description, argument hint, tools, license, compat, metadata |
| 1.7.2 | Interactive does not ask for model/memory | `node dist/cli.js scaffold test-interactive2 -i` | No prompts for model or memory (removed in CHORE-013) |
| 1.7.3 | Interactive with output flag | `node dist/cli.js scaffold test-iout -i -o /tmp/skills-test` | Interactive prompts but outputs to specified path |
| 1.7.4 | Interactive requires TTY | `echo "" \| node dist/cli.js scaffold test-pipe -i` | Error: interactive mode requires a TTY |
| 1.7.5 | Interactive ignores template flags | `node dist/cli.js scaffold test-iflag -i -t forked` | Template prompt still shown (--template ignored in interactive) |

---

## 2. Validate Command (`asm validate`)

### 2.1 Valid Skills

| # | Test Case | Command | Expected Result |
|---|-----------|---------|-----------------|
| 2.1.1 | Validate a valid skill | Scaffold a skill first, then: `node dist/cli.js validate .claude/skills/test-basic` | PASS with all checks green (exit 0) |
| 2.1.2 | Validate with directory path | `node dist/cli.js validate .claude/skills/test-basic/` | Same as above — accepts directory |
| 2.1.3 | Validate with SKILL.md path | `node dist/cli.js validate .claude/skills/test-basic/SKILL.md` | Same as above — accepts file path |

### 2.2 Invalid Skills — Structure Errors

| # | Test Case | Command | Expected Result |
|---|-----------|---------|-----------------|
| 2.2.1 | Non-existent path | `node dist/cli.js validate /tmp/no-such-skill` | FAIL: fileExists check (exit 1) |
| 2.2.2 | Missing frontmatter | Create SKILL.md with no `---` markers | FAIL: frontmatterValid check |
| 2.2.3 | Missing required fields | Create SKILL.md with frontmatter but no name/description | FAIL: requiredFields check |
| 2.2.4 | Invalid name format | Edit SKILL.md: `name: Bad_Name!` | FAIL: nameFormat check |
| 2.2.5 | Name/directory mismatch | Scaffold `test-a`, then edit name to `test-b` | FAIL: nameMatchesDirectory check |
| 2.2.6 | Unknown frontmatter keys | Add `foo: bar` to frontmatter | FAIL: allowedProperties check |
| 2.2.7 | Empty frontmatter | Create SKILL.md with `---` markers but nothing between | FAIL: frontmatterValid (empty) |

### 2.3 Output Modes

| # | Test Case | Command | Expected Result |
|---|-----------|---------|-----------------|
| 2.3.1 | Quiet mode (valid) | `node dist/cli.js validate .claude/skills/test-basic -q` | Single line: "PASS" |
| 2.3.2 | Quiet mode (invalid) | `node dist/cli.js validate /tmp/no-such-skill -q` | Single line: "FAIL" (exit 1) |
| 2.3.3 | JSON mode (valid) | `node dist/cli.js validate .claude/skills/test-basic -j` | Valid JSON with `valid: true` |
| 2.3.4 | JSON mode (invalid) | Create invalid skill, then: `node dist/cli.js validate <path> -j` | Valid JSON with `valid: false`, errors array |
| 2.3.5 | JSON mode (error) | `node dist/cli.js validate /tmp/no-such-skill -j` | Valid JSON with `valid: false`, error message |

### 2.4 Spec Field Validation (CHORE-013)

| # | Test Case | Command | Expected Result |
|---|-----------|---------|-----------------|
| 2.4.1 | Valid license field | Scaffold with `--license MIT`, validate | PASS |
| 2.4.2 | Valid compatibility | Scaffold with `--compatibility "claude-code>=2.1"`, validate | PASS |
| 2.4.3 | Valid metadata | Scaffold with `--metadata key=value`, validate | PASS |
| 2.4.4 | Compatibility too long (>500) | Manually set compatibility to 501+ chars | FAIL: compatibilityFormat check |
| 2.4.5 | Compatibility non-string | Manually set `compatibility: 123` in frontmatter | FAIL: compatibilityFormat (must be string) |
| 2.4.6 | Compatibility empty string | Manually set `compatibility: ""` in frontmatter | FAIL: compatibilityFormat (cannot be empty) |

### 2.5 Claude Code 2.1.x Field Validation

| # | Test Case | Setup | Expected Result |
|---|-----------|-------|-----------------|
| 2.5.1 | Valid context: fork | Scaffold with `--context fork`, validate | PASS: contextFormat check |
| 2.5.2 | Invalid context value | Manually set `context: invalid` in frontmatter | FAIL: contextFormat check |
| 2.5.3 | Valid agent field | Scaffold with `--agent "My agent"`, validate | PASS: agentFormat check |
| 2.5.4 | Invalid agent (non-string) | Manually set `agent: 123` in frontmatter | FAIL: agentFormat check |
| 2.5.5 | Valid hooks field | Scaffold with `--hooks`, validate | PASS: hooksFormat check |
| 2.5.6 | Invalid hooks (non-object) | Manually set `hooks: "bad"` in frontmatter | FAIL: hooksFormat check |
| 2.5.7 | Hooks with unknown key (warning) | Manually add `hooks: { CustomHook: "./script.sh" }` | PASS with warning: unknown hook key |
| 2.5.8 | Valid user-invocable: false | Scaffold with `--no-user-invocable`, validate | PASS: userInvocableFormat check |
| 2.5.9 | Invalid user-invocable (non-bool) | Manually set `user-invocable: "yes"` in frontmatter | FAIL: userInvocableFormat check |
| 2.5.10 | Valid argument-hint | Scaffold with `--argument-hint "<path>"`, validate | PASS: argumentHintFormat check |
| 2.5.11 | Argument-hint too long (>200) | Manually set argument-hint to 201+ chars | FAIL: argumentHintFormat check |

### 2.6 FEAT-014 Field Validation

| # | Test Case | Setup | Expected Result |
|---|-----------|-------|-----------------|
| 2.6.1 | Valid version field | Manually add `version: "1.0.0"` to frontmatter | PASS: versionFormat check |
| 2.6.2 | Invalid version (non-string) | Manually set `version: 1.0` in frontmatter | FAIL: versionFormat (must be string) |
| 2.6.3 | Valid tools field | Manually add `tools: [Read, Write]` to frontmatter | PASS: toolsFormat check |
| 2.6.4 | Invalid tools (non-array) | Manually set `tools: "Read"` in frontmatter | FAIL: toolsFormat check |
| 2.6.5 | Valid color field | Manually add `color: "#ff0000"` to frontmatter | PASS: colorFormat check |
| 2.6.6 | Valid keep-coding-instructions | Manually add `keep-coding-instructions: true` | PASS: keepCodingInstructionsFormat check |
| 2.6.7 | Invalid keep-coding-instructions | Manually set `keep-coding-instructions: "yes"` | FAIL: keepCodingInstructionsFormat (must be boolean) |
| 2.6.8 | Valid disable-model-invocation | Manually add `disable-model-invocation: true` | PASS: disableModelInvocationFormat check |
| 2.6.9 | Invalid disable-model-invocation | Manually set `disable-model-invocation: 1` | FAIL: disableModelInvocationFormat (must be boolean) |
| 2.6.10 | Valid allowed-tools field | Scaffold with `-a "Bash,Read"`, validate | PASS: allowedToolsFormat check |

### 2.7 Validation Check Order

The validate command runs checks in this order. Early failures prevent later checks from running:

1. `fileExists` — SKILL.md exists
2. `frontmatterValid` — Valid YAML frontmatter
3. `requiredFields` — name and description present
4. `allowedProperties` — No unexpected frontmatter keys
5. `nameFormat` — Valid hyphen-case, max 64 chars, no reserved words
6. `descriptionFormat` — No angle brackets, max 1024 chars
7. `compatibilityFormat` — Valid string, max 500 chars
8. `contextFormat` — Must be "fork" if present
9. `agentFormat` — Must be non-empty string if present
10. `hooksFormat` — Must be object with valid hook entries
11. `userInvocableFormat` — Must be boolean if present
12. `argumentHintFormat` — Must be string, max 200 chars
13. `keepCodingInstructionsFormat` — Must be boolean if present
14. `toolsFormat` — Must be array of valid tool entries
15. `colorFormat` — Must be valid color string
16. `disableModelInvocationFormat` — Must be boolean if present
17. `versionFormat` — Must be non-empty string if present
18. `allowedToolsFormat` — Must be valid tool list
19. `nameMatchesDirectory` — Frontmatter name equals parent directory name

### 2.8 Allowed Frontmatter Keys Reference

Validation accepts only these top-level keys: `name`, `description`, `license`, `compatibility`, `allowed-tools`, `metadata`, `context`, `agent`, `hooks`, `user-invocable`, `argument-hint`, `keep-coding-instructions`, `tools`, `color`, `disable-model-invocation`, `version`.

---

## 3. Package Command (`asm package`)

### 3.1 Basic Packaging

| # | Test Case | Command | Expected Result |
|---|-----------|---------|-----------------|
| 3.1.1 | Package a valid skill | `node dist/cli.js package .claude/skills/test-basic` | Creates `test-basic.skill` in current dir (exit 0) |
| 3.1.2 | Package to custom output | `node dist/cli.js package .claude/skills/test-basic -o /tmp` | Creates `/tmp/test-basic.skill` |
| 3.1.3 | Package with force | Create package first, then: `node dist/cli.js package .claude/skills/test-basic -f` | Overwrites without prompting |
| 3.1.4 | Package with skip validation | `node dist/cli.js package .claude/skills/test-basic -s` | Packages without running validation |
| 3.1.5 | Quiet mode | `node dist/cli.js package .claude/skills/test-basic -q` | Outputs only the package path |

### 3.2 Error Cases

| # | Test Case | Command | Expected Result |
|---|-----------|---------|-----------------|
| 3.2.1 | Package invalid skill | Create invalid skill, then package | Exit 1: validation failed |
| 3.2.2 | Non-existent path | `node dist/cli.js package /tmp/no-such-skill` | Exit 2: file system error |
| 3.2.3 | Existing package no force | Run package twice without -f | Prompts for overwrite or exits (non-TTY) |
| 3.2.4 | Quiet mode overwrite blocked | Package exists, run: `node dist/cli.js package <skill> -q` | Exit 2: fails in quiet mode (no prompt) |

### 3.3 Package Contents Verification

| # | Test Case | Command | Expected Result |
|---|-----------|---------|-----------------|
| 3.3.1 | Package is valid ZIP | `unzip -t test-basic.skill` | Valid ZIP archive |
| 3.3.2 | Contains SKILL.md | `unzip -l test-basic.skill` | Lists SKILL.md |
| 3.3.3 | Excludes .git, node_modules | Add `.git/` dir, package | .git not in archive |
| 3.3.4 | Excludes .DS_Store | Touch `.DS_Store` in skill dir, package | .DS_Store not in archive |
| 3.3.5 | Excludes log files | Touch `debug.log` in skill dir, package | .log files not in archive |
| 3.3.6 | Excludes __pycache__ | Create `__pycache__/` dir, package | __pycache__ not in archive |

### 3.4 Exit Codes Reference

| Exit Code | Meaning |
|-----------|---------|
| 0 | Package created successfully |
| 1 | Skill validation failed |
| 2 | File system error (path not found, permission denied) |
| 3 | Package creation error |

---

## 4. Install Command (`asm install`)

### 4.1 Basic Installation

| # | Test Case | Command | Expected Result |
|---|-----------|---------|-----------------|
| 4.1.1 | Install to project scope | `node dist/cli.js install test-basic.skill` | Installs to `.claude/skills/test-basic/` (exit 0) |
| 4.1.2 | Install to personal scope | `node dist/cli.js install test-basic.skill -s personal` | Installs to `~/.claude/skills/test-basic/` |
| 4.1.3 | Install with force | `node dist/cli.js install test-basic.skill -f` | Overwrites without prompting |
| 4.1.4 | Install with dry-run | `node dist/cli.js install test-basic.skill -n` | Shows what would be installed, no files created |
| 4.1.5 | Install quiet | `node dist/cli.js install test-basic.skill -q` | Minimal output |
| 4.1.6 | Install to custom path | `node dist/cli.js install test-basic.skill -s /tmp/custom-skills` | Installs to `/tmp/custom-skills/test-basic/` |

### 4.2 Conflict Detection

| # | Test Case | Command | Expected Result |
|---|-----------|---------|-----------------|
| 4.2.1 | Existing skill (no force) | Install same skill twice | Prompts for overwrite or errors (non-TTY) |
| 4.2.2 | Existing skill (force) | Install twice with `-f` | Overwrites cleanly |
| 4.2.3 | Thorough comparison | `node dist/cli.js install test-basic.skill -t` | Uses content hashing for file comparison |
| 4.2.4 | Quiet mode overwrite blocked | Skill exists, run: `node dist/cli.js install <pkg> -q` | Fails in quiet mode (no prompt, exit 2) |

### 4.3 Error Cases

| # | Test Case | Command | Expected Result |
|---|-----------|---------|-----------------|
| 4.3.1 | Non-existent package | `node dist/cli.js install no-such.skill` | Error: file not found (exit 2) |
| 4.3.2 | Invalid package (not ZIP) | `echo "not a zip" > fake.skill && node dist/cli.js install fake.skill` | Error: invalid package (exit 3) |
| 4.3.3 | Package missing SKILL.md | Create ZIP without SKILL.md, rename to .skill | Error: invalid package structure |

### 4.4 Installed Skill Verification

| # | Test Case | Steps | Expected Result |
|---|-----------|-------|-----------------|
| 4.4.1 | Verify installed files | Install, then check `.claude/skills/<name>/SKILL.md` | SKILL.md exists with correct content |
| 4.4.2 | Validate after install | Install, then `node dist/cli.js validate .claude/skills/<name>` | Passes validation |
| 4.4.3 | List after install | Install, then `node dist/cli.js list` | Skill appears in list |

### 4.5 Exit Codes Reference

| Exit Code | Meaning |
|-----------|---------|
| 0 | Skill installed successfully |
| 1 | Validation failed (package or post-installation) |
| 2 | File system error (path not found, permission denied) |
| 3 | Package extraction error |
| 4 | User cancelled installation |

---

## 5. Uninstall Command (`asm uninstall`)

### 5.1 Basic Uninstallation

| # | Test Case | Command | Expected Result |
|---|-----------|---------|-----------------|
| 5.1.1 | Uninstall single skill | `node dist/cli.js uninstall test-basic` | Prompts, then removes (exit 0) |
| 5.1.2 | Uninstall with force | `node dist/cli.js uninstall test-basic -f` | Removes without prompting |
| 5.1.3 | Uninstall with dry-run | `node dist/cli.js uninstall test-basic -n` | Shows what would be removed, no changes |
| 5.1.4 | Uninstall personal scope | `node dist/cli.js uninstall test-personal -s personal` | Removes from `~/.claude/skills/` |
| 5.1.5 | Uninstall quiet | `node dist/cli.js uninstall test-basic -q -f` | Minimal output |

### 5.2 Batch Operations

| # | Test Case | Command | Expected Result |
|---|-----------|---------|-----------------|
| 5.2.1 | Uninstall multiple | `node dist/cli.js uninstall skill-a skill-b -f` | Removes both skills |
| 5.2.2 | Bulk force (3+ skills) | `node dist/cli.js uninstall a b c -f` | Requires typing "yes" for safety confirmation |
| 5.2.3 | Partial failure | Uninstall mix of existing + non-existing | Exit 4: partial failure, reports which failed |
| 5.2.4 | Batch dry-run | `node dist/cli.js uninstall skill-a skill-b -n` | Shows preview for each skill, no changes |

### 5.3 Security

| # | Test Case | Command | Expected Result |
|---|-----------|---------|-----------------|
| 5.3.1 | Path traversal attempt | `node dist/cli.js uninstall "../escape"` | Exit 5: security error |
| 5.3.2 | Invalid characters | `node dist/cli.js uninstall "skill;rm -rf"` | Exit 5: invalid name |
| 5.3.3 | Symlink escape | Create symlink skill pointing outside, uninstall | Exit 5: symlink detected |
| 5.3.4 | Null byte injection | `node dist/cli.js uninstall "test\x00bad"` | Exit 5: control character rejected |
| 5.3.5 | Uppercase name rejected | `node dist/cli.js uninstall TestSkill` | Exit 5: invalid name format |
| 5.3.6 | Absolute path rejected | `node dist/cli.js uninstall "/etc/passwd"` | Exit 5: absolute path rejected |

### 5.4 Error Cases

| # | Test Case | Command | Expected Result |
|---|-----------|---------|-----------------|
| 5.4.1 | Non-existent skill | `node dist/cli.js uninstall no-such-skill -f` | Exit 1: skill not found |
| 5.4.2 | Custom scope rejected | `node dist/cli.js uninstall test-basic -s /custom/path` | Exit 5: only project/personal allowed |
| 5.4.3 | Quiet mode cancel blocked | `node dist/cli.js uninstall test-basic -q` (no -f) | Exit 3: fails in quiet (no prompt) |

### 5.5 Exit Codes Reference

| Exit Code | Meaning |
|-----------|---------|
| 0 | Skill(s) uninstalled successfully |
| 1 | Skill not found |
| 2 | File system error (permission denied, etc.) |
| 3 | User cancelled uninstallation |
| 4 | Partial failure (some skills removed, some failed) |
| 5 | Security error (invalid name, symlink, path traversal) |

---

## 6. Update Command (`asm update`)

### 6.1 Basic Update

| # | Test Case | Steps | Expected Result |
|---|-----------|-------|-----------------|
| 6.1.1 | Update installed skill | Install v1, package v2, then: `node dist/cli.js update test-basic test-basic-v2.skill` | Updates to v2, shows version comparison (exit 0) |
| 6.1.2 | Update with force | `node dist/cli.js update test-basic new.skill -f` | Skips confirmation |
| 6.1.3 | Update dry-run | `node dist/cli.js update test-basic new.skill -n` | Shows changes without applying |
| 6.1.4 | Update personal scope | `node dist/cli.js update test-personal new.skill -s personal` | Updates in `~/.claude/skills/` |
| 6.1.5 | Update quiet | `node dist/cli.js update test-basic new.skill -q -f` | Minimal output |

### 6.2 Backup Behavior

| # | Test Case | Command | Expected Result |
|---|-----------|---------|-----------------|
| 6.2.1 | Default backup (cleaned up) | `node dist/cli.js update test-basic new.skill -f` | Backup created in `~/.asm/backups/`, removed after success |
| 6.2.2 | Keep backup | `node dist/cli.js update test-basic new.skill -f --keep-backup` | Backup preserved in `~/.asm/backups/` |
| 6.2.3 | No backup | `node dist/cli.js update test-basic new.skill -f --no-backup` | No backup created |

### 6.3 Rollback

| # | Test Case | Steps | Expected Result |
|---|-----------|-------|-----------------|
| 6.3.1 | Rollback on validation failure | Create package that would fail post-update validation | Exit 6: rollback performed, original restored |

### 6.4 Error Cases

| # | Test Case | Command | Expected Result |
|---|-----------|---------|-----------------|
| 6.4.1 | Skill not found | `node dist/cli.js update no-such-skill new.skill` | Exit 1: not found |
| 6.4.2 | Invalid package | `node dist/cli.js update test-basic fake.skill` | Exit 4: invalid package |
| 6.4.3 | Security violation | `node dist/cli.js update "../escape" new.skill` | Exit 5: security error |
| 6.4.4 | Quiet mode cancel blocked | `node dist/cli.js update test-basic new.skill -q` (no -f) | Exit 3: fails in quiet (no prompt) |

### 6.5 Exit Codes Reference

| Exit Code | Meaning |
|-----------|---------|
| 0 | Skill updated successfully |
| 1 | Skill not found |
| 2 | File system error (permission denied, disk full) |
| 3 | User cancelled update |
| 4 | Invalid new package |
| 5 | Security error (path traversal, invalid name) |
| 6 | Rollback performed (update failed, original restored) |
| 7 | Rollback failed (critical — manual intervention required) |

---

## 7. List Command (`asm list` / `asm ls`)

### 7.1 Basic Listing

| # | Test Case | Command | Expected Result |
|---|-----------|---------|-----------------|
| 7.1.1 | List all skills | `node dist/cli.js list` | Grouped display: name, version (if present), description |
| 7.1.2 | List alias | `node dist/cli.js ls` | Same as `list` |
| 7.1.3 | List project only | `node dist/cli.js list -s project` | Only project-scoped skills |
| 7.1.4 | List personal only | `node dist/cli.js list -s personal` | Only personal-scoped skills |
| 7.1.5 | List with no skills | (Remove all skills first) | "No skills installed." with getting-started hints (exit 0) |
| 7.1.6 | Invalid scope | `node dist/cli.js list -s invalid` | Error: invalid scope (exit 1) |

### 7.2 Output Modes

| # | Test Case | Command | Expected Result |
|---|-----------|---------|-----------------|
| 7.2.1 | JSON output (non-recursive) | `node dist/cli.js list -j` | Valid JSON array of skill objects |
| 7.2.2 | Quiet output | `node dist/cli.js list -q` | One skill name per line |
| 7.2.3 | JSON with scope | `node dist/cli.js list -j -s project` | JSON filtered to project scope |

### 7.3 Recursive Discovery

| # | Test Case | Command | Expected Result |
|---|-----------|---------|-----------------|
| 7.3.1 | Recursive mode | `node dist/cli.js list -r` | Discovers skills in nested `.claude/skills/` dirs |
| 7.3.2 | With depth limit | `node dist/cli.js list -r -d 1` | Only 1 level deep |
| 7.3.3 | Depth 0 | `node dist/cli.js list -r -d 0` | Root only |
| 7.3.4 | JSON recursive | `node dist/cli.js list -r -j` | JSON object: `{ skills: [...], depthLimitReached: bool }` |
| 7.3.5 | Invalid depth (negative) | `node dist/cli.js list -r -d -1` | Error: depth must be 0-10 (exit 1) |
| 7.3.6 | Invalid depth (>10) | `node dist/cli.js list -r -d 11` | Error: depth must be 0-10 (exit 1) |
| 7.3.7 | Invalid depth (non-number) | `node dist/cli.js list -r -d abc` | Error: depth must be a number (exit 1) |
| 7.3.8 | Personal scope not recursive | `node dist/cli.js list -r -s personal` | Personal scope scanned at root only (never recursive) |
| 7.3.9 | Depth limit warning | Set depth low, have nested skills beyond it | Warning displayed about depth limit in normal mode |

### 7.4 Display

| # | Test Case | Steps | Expected Result |
|---|-----------|-------|-----------------|
| 7.4.1 | Long description truncation | Scaffold skill with 100+ char description, list | Description truncated to ~60 chars with "..." |
| 7.4.2 | Internal skills shown | Scaffold with `--no-user-invocable`, list | Skill IS shown (asm does not filter by user-invocable) |
| 7.4.3 | Version display | Scaffold with `--metadata version=1.0`, list | Version shown as `(v1.0)` next to name |
| 7.4.4 | Skills grouped by scope | Install to both project and personal, list | Skills grouped under "Project skills" and "Personal skills" headers |
| 7.4.5 | Recursive grouped by location | `list -r` with nested skills | Project skills grouped by `.claude/skills/` directory location |

> **Note:** The help text states "Skills with user-invocable: false are loaded but hidden from this listing." This describes Claude Code's `/skills` menu behavior, not `asm list`. The `asm list` command shows all skills regardless of user-invocable setting.

---

## 8. End-to-End Workflows

### 8.1 Full Lifecycle

| # | Test Case | Steps | Expected Result |
|---|-----------|-------|-----------------|
| 8.1.1 | Create → Validate → Package → Install → List → Update → Uninstall | 1. `scaffold test-e2e -d "E2E test"`<br>2. `validate .claude/skills/test-e2e`<br>3. `package .claude/skills/test-e2e -o /tmp`<br>4. Remove `.claude/skills/test-e2e`<br>5. `install /tmp/test-e2e.skill`<br>6. `list`<br>7. Edit SKILL.md, package as v2<br>8. `update test-e2e /tmp/test-e2e.skill -f`<br>9. `uninstall test-e2e -f` | All steps succeed, skill fully lifecycle-managed |

### 8.2 Cross-Scope Operations

| # | Test Case | Steps | Expected Result |
|---|-----------|-------|-----------------|
| 8.2.1 | Project and personal coexist | Install same skill to both scopes | Both appear in `list`, can be independently managed |
| 8.2.2 | Scope-specific uninstall | Uninstall from project only | Personal copy preserved |

### 8.3 Spec Fields E2E

| # | Test Case | Steps | Expected Result |
|---|-----------|-------|-----------------|
| 8.3.1 | Spec fields survive packaging | Scaffold with license/compat/metadata → validate → package → install → validate | All spec fields preserved through full lifecycle |
| 8.3.2 | FEAT-014 fields survive packaging | Manually add version/tools/color fields → validate → package → install → validate | All FEAT-014 fields preserved through lifecycle |

### 8.4 Output Mode Consistency

| # | Test Case | Steps | Expected Result |
|---|-----------|-------|-----------------|
| 8.4.1 | Quiet mode across commands | Run scaffold, validate -q, package -q, install -q, list -q, uninstall -q -f | All commands produce minimal output, exit codes correct |
| 8.4.2 | JSON mode across commands | Run validate -j, list -j | All JSON-capable commands produce valid parseable JSON |

---

## Test Environment Cleanup

After running manual tests, clean up:

```bash
# Remove test skills from project scope
rm -rf .claude/skills/test-*

# Remove test skills from personal scope
rm -rf ~/.claude/skills/test-*

# Remove test packages
rm -f /tmp/test-*.skill
rm -f *.skill

# Remove backups
rm -rf ~/.asm/backups/test-*

# Remove temp dirs
rm -rf /tmp/skills-test
```

---

## Test Execution Notes

- **Non-TTY behavior:** When running in non-interactive terminals (CI, piped), confirmation prompts should either error or default to safe behavior (no overwrite/delete). Quiet mode always fails rather than prompting.
- **Exit codes:** Verify exit codes with `echo $?` after each command
- **Signal handling:** Test Ctrl+C during long operations (package, install) to verify graceful cleanup
- **File permissions:** On macOS, test with restricted directories to verify EACCES handling
- **Debug mode:** Set `ASM_DEBUG=1` to enable debug logging for troubleshooting test failures
