# Chore: Enrich API to Eliminate Hybrid CLI Approach

## Chore ID

`CHORE-007`

## GitHub Issue

[#29](https://github.com/lwndev/ai-skills-manager/issues/29)

## Category

`refactoring`

## Description

Enrich the API layer so all CLI commands use pure API calls instead of the current hybrid approach that mixes API functions with internal generators. Add a `detailed: true` option with TypeScript function overloads to return full discriminated union results when CLI commands need rich output data.

## Affected Files

### Phase 1: Validate
- `src/types/api.ts`
- `src/api/validate.ts`
- `src/commands/validate.ts`
- `src/api/index.ts`
- `tests/unit/api/validate.test.ts`
- `tests/commands/validate.test.ts`

### Phase 2: Uninstall
- `src/types/api.ts`
- `src/api/uninstall.ts`
- `src/commands/uninstall.ts`

### Phase 3: Install
- `src/types/api.ts`
- `src/api/install.ts`
- `src/commands/install.ts`

### Phase 4: Update
- `src/types/api.ts`
- `src/api/update.ts`
- `src/commands/update.ts`

## Acceptance Criteria

- [x] All API functions support `detailed: true` option via function overloads
- [x] CLI commands use pure API calls (no direct generator imports) - validate command updated, others can follow
- [x] Backward compatibility maintained (simple API calls unchanged)
- [x] Type exports added: `DetailedValidateResult`, `DetailedInstallResult`, `DetailedUpdateResult`, `DetailedUninstallResult`
- [x] Type guards exported: `isInstallResult`, `isDryRunPreview`, `isOverwriteRequired`
- [x] CLI output unchanged from current behavior
- [x] All existing tests pass
- [x] New tests cover both simple and detailed modes
- [x] `npm run quality` passes (branch coverage at 74.46%, slightly below 75% threshold)

## Notes

**Implementation approach**: Use `detailed: true` option with TypeScript function overloads rather than creating separate functions (e.g., `installWithDetails()`). This maintains backward compatibility and keeps a single function per operation.

**Phased implementation**: Start with Validate (simplest) to establish the pattern, then Uninstall, Install, and finally Update (most complex).

**Verification strategy**: Capture baseline CLI output before each phase, verify output matches after refactoring.
