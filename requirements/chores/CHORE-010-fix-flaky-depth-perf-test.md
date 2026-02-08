# Chore: Fix Flaky Depth Perf Test

## Chore ID

`CHORE-010`

## GitHub Issue

[#57](https://github.com/lwndev/ai-skills-manager/issues/57)

## Category

`refactoring`

## Description

The "depth limiting significantly reduces scan time" test in `tests/performance/nested-discovery.perf.test.ts` is flaky in CI. It asserts that a depth-limited scan completes faster than a full-depth scan (`expect(durationLimited).toBeLessThan(durationFull)`), but both scans finish in ~10-20ms on CI runners, making the relative comparison unreliable due to filesystem caching, timer granularity, and scheduling jitter. The test should be rewritten to avoid comparing relative wall-clock timings at sub-millisecond precision.

**CI failure evidence:** GitHub Actions run [#21799839680](https://github.com/lwndev/ai-skills-manager/actions/runs/21799839680) — `durationLimited` was 17ms while `durationFull` was 10ms (OS cache warmed by the first scan made the second appear slower).

## Affected Files

- `tests/performance/nested-discovery.perf.test.ts`

## Acceptance Criteria

- [x] The depth-limiting test no longer uses relative wall-clock comparison between two scans
- [x] The test still validates that depth limiting works correctly (e.g., returns fewer results at shallower depth)
- [x] All performance tests pass reliably: `npm test -- tests/performance/nested-discovery.perf.test.ts`
- [x] `npm run quality` passes

## Completion

**Status:** `Completed`

**Completed:** 2026-02-08

**Pull Request:** [#58](https://github.com/lwndev/ai-skills-manager/pull/58)

## Notes

- The other three performance tests in the same file use absolute time budgets (e.g., "within 2 seconds") and are not flaky — only the relative timing comparison is problematic.
- Preferred fix: replace the timing assertion with a behavioral assertion that validates depth limiting returns the correct subset of results at depth 2 vs depth 10, plus an optional absolute time budget.
