# Feature Requirements: Node.js Version Upgrade

## Overview
Upgrade the minimum Node.js requirement from version 18 to version 20.19.6 (LTS), ensuring the project leverages modern Node.js capabilities and maintains alignment with current LTS support timelines.

## Feature ID
`FEAT-006`

## GitHub Issue
[#7](https://github.com/lwndev/ai-skills-manager/issues/7)

## Priority
High - The production dependency `commander@14.0.2` already requires Node >=20, making the current `engines.node: ">=18.0.0"` setting incorrect. This update corrects an existing incompatibility.

## User Story
As a developer, I want the project to require Node.js 20 LTS or higher so that I can benefit from the latest stable features and security updates while using a version with long-term support.

## Functional Requirements

### FR-1: Update Package.json Engine Constraint
- Update the `engines.node` field in `package.json` from `>=18.0.0` to `>=20.19.6`
- This enforces the minimum version requirement when users install the package

### FR-2: Update README Prerequisites
- Update the README.md prerequisites section to reflect Node.js 20.19.6 or later
- Change "Node.js 18 or later" to "Node.js 20.19.6 or later"

### FR-3: Verify Build Compatibility
- Ensure the project builds successfully with Node.js 20.x
- Verify all existing tests pass under Node.js 20.x

## Non-Functional Requirements

### NFR-1: Backward Compatibility
- No backward compatibility with Node.js 18.x is required after this change
- Users on Node.js 18.x will receive a clear error message when attempting to install

### NFR-2: CI/CD Consideration
- Any CI/CD workflows using Node 18 should be updated to use Node 20+ (out of scope for this feature but noted for awareness)

## Dependencies

### Dependency Compatibility Analysis

| Package | Version | Node Engine Requirement | Compatible with 20.19.6 |
|---------|---------|------------------------|-------------------------|
| commander | 14.0.2 | `>=20` | Yes |
| js-yaml | 4.1.1 | (none) | Yes |
| jest | 30.2.0 | `^18.14.0 \|\| ^20.0.0 \|\| ^22.0.0 \|\| >=24.0.0` | Yes |
| typescript | 5.9.3 | `>=14.17` | Yes |
| @typescript-eslint/* | 8.50.1 | `^18.18.0 \|\| ^20.9.0 \|\| >=21.1.0` | Yes |
| eslint | 9.39.2 | `^18.18.0 \|\| ^20.9.0 \|\| >=21.1.0` | Yes |

**Note:** The production dependency `commander@14.0.2` already requires Node >=20, meaning Node 18 users cannot successfully run this project despite the current package.json stating `>=18.0.0`.

## Edge Cases
1. **User on Node.js 18**: npm will display an engine compatibility warning/error during install, directing them to upgrade
2. **User on Node.js 19**: Also incompatible; must use 20.19.6 or higher

## Testing Requirements

### Manual Testing
- Verify `npm install` succeeds on Node.js 20.x
- Verify `npm run build` succeeds on Node.js 20.x
- Verify `npm test` passes on Node.js 20.x
- Verify `npm install` shows engine warning/error on Node.js 18.x

## Files to Modify
1. `package.json` - Update `engines.node` field
2. `README.md` - Update prerequisites section

## Acceptance Criteria
- [x] `package.json` specifies `"node": ">=20.19.6"` in the `engines` field
- [x] README.md prerequisites section states "Node.js 20.19.6 or later"
- [x] Project builds successfully with Node.js 20.x
- [x] All existing tests pass with Node.js 20.x
