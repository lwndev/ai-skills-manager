# Chore: Fix npm audit Vulnerabilities (Round 2)

## Chore ID

`CHORE-022`

## GitHub Issue

[#96](https://github.com/lwndev/ai-skills-manager/issues/96)

## Category

`dependencies`

## Description

Address 2 npm audit vulnerabilities (1 high, 1 moderate) that are blocking the pre-commit audit hook. The high-severity `minimatch` finding is new (GHSA-7r86-cg39-jmmj, GHSA-23c5-xmqv-rm74) and affects the 10.0.0–10.2.2 range that CHORE-021's override targets. The moderate `ajv` finding persists from CHORE-021 and remains unfixable upstream.

## Affected Files

- `package.json`
- `package-lock.json`

## Acceptance Criteria

- [ ] `npm audit --audit-level=high` reports 0 high-severity vulnerabilities
- [ ] `npm audit --omit=dev` reports 0 vulnerabilities (zero production vulnerabilities)
- [ ] Pre-commit audit hook passes without `SKIP_AUDIT=1`
- [ ] `npm run quality` passes (lint + tests + coverage)

## Completion

**Status:** `Completed`

**Completed:** 2026-02-27

**Pull Request:** [#PR](https://github.com/lwndev/ai-skills-manager/pull/PR)

## Notes

- Follows up on CHORE-021 ([#92](https://github.com/lwndev/ai-skills-manager/issues/92), PR [#93](https://github.com/lwndev/ai-skills-manager/pull/93)) which resolved the original 31 high-severity minimatch findings
- The `minimatch` override in `package.json` needs bumping past 10.2.2 to resolve the new advisories
- The `ajv` moderate finding (GHSA-2g4f-4pwh-qvx6) remains unfixable — ESLint 9 bundles ajv v6 internally and ajv v8 has a completely different API
- `npm audit fix` reports the high-severity finding is fixable
