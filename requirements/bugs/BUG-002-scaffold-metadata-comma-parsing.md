# Bug: Scaffold Metadata Comma Parsing

## Bug ID

`BUG-002`

## GitHub Issue

[#71](https://github.com/lwndev/ai-skills-manager/issues/71)

## Category

`logic-error`

## Severity

`medium`

## Description

The interactive scaffold metadata prompt splits input on commas to parse multiple `key=value` pairs, which means metadata values containing commas are incorrectly split into separate pairs. The CLI `--metadata` flag does not have this problem because Commander's variadic `<pairs...>` syntax passes each pair as a separate shell argument.

## Steps to Reproduce

1. Run `asm scaffold` in interactive mode
2. Reach the metadata prompt: `Metadata key=value pairs (comma-separated)`
3. Enter a value containing a comma: `description=A tool, for testing`
4. Observe the parsed result

## Expected Behavior

The input `description=A tool, for testing` should produce `{ description: "A tool, for testing" }` — preserving the full value after the first `=`.

## Actual Behavior

The input is split on the comma, producing `{ description: "A tool" }` with `for testing` either parsed as a malformed pair (triggering a validation error) or silently discarded.

## Root Cause(s)

1. The metadata input parser in `src/commands/scaffold-interactive.ts:242` and `:260` uses `.split(',')` to separate pairs. This naive split cannot distinguish between commas that delimit pairs and commas that are part of a value. The validation function (line 242) and the parsing logic (line 260) both share this flaw.

2. The prompt UX uses a single free-text input for all metadata pairs (`src/commands/scaffold-interactive.ts:237-257`), which forces the use of a delimiter character. A multi-entry loop prompt (as suggested in issue #70) would eliminate the need for comma-delimiting entirely, making values with commas naturally supported.

## Affected Files

- `src/commands/scaffold-interactive.ts`

## Acceptance Criteria

- [ ] Metadata values containing commas are handled correctly in interactive scaffold mode (RC-1, RC-2)
- [ ] The validation function correctly validates metadata entries that contain commas in values (RC-1)
- [ ] Test case added for metadata values containing commas (RC-1)
- [ ] Existing metadata input without commas in values continues to work (RC-1)

## Completion

**Status:** `Pending`

**Completed:** YYYY-MM-DD

**Pull Request:** [#N](https://github.com/lwndev/ai-skills-manager/pull/N)

## Notes

- Issue #70 proposes a multi-entry loop prompt for metadata, which would be the preferred fix as it eliminates the parsing ambiguity entirely and improves UX.
- The CLI `--metadata` flag (`src/commands/scaffold.ts:39`) uses Commander's variadic `<pairs...>` syntax and is not affected — each `key=value` is a separate shell argument, so commas in values are preserved.
- The allowed-tools prompt (`scaffold-interactive.ts:198`) also uses `.split(',')` but tool names should never contain commas, so that usage is fine.
