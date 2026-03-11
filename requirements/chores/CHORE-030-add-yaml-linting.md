# Chore: Add YAML Linting

## Chore ID

`CHORE-030`

## GitHub Issue

[#94](https://github.com/lwndev/ai-skills-manager/issues/94)

## Category

`configuration`

## Description

Add YAML linting to the project's quality checks by integrating `eslint-plugin-yml` into the existing ESLint flat config. This catches syntax errors, duplicate keys, and indentation issues in CI workflow files that currently have no lint coverage.

## Affected Files

- `package.json` — new dev dependency (`eslint-plugin-yml`)
- `eslint.config.js` — YAML plugin and Prettier-compatible rule configuration
- `.github/workflows/*.yml` — potential fixes from linting

## Acceptance Criteria

- [ ] `eslint-plugin-yml` installed as a dev dependency
- [ ] `eslint.config.js` updated with YAML plugin and Prettier-compatible rules
- [ ] `*.yml` files are not excluded from ESLint ignores
- [ ] `npm run lint` lints YAML files without errors
- [ ] `npm run quality` passes
- [ ] No changes to existing YAML file behavior (lint-only, no functional changes)

## Completion

**Status:** `Pending`

**Completed:** YYYY-MM-DD

**Pull Request:** [#N](https://github.com/lwndev/ai-skills-manager/pull/N)

## Notes

- Use the Prettier-compatible config from `eslint-plugin-yml` to avoid formatting conflicts with any existing Prettier setup.
- The plugin integrates directly into ESLint 9 flat config, so no new scripts or tools are needed — linting runs via the existing `npm run lint` command.
