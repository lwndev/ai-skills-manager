# Bug: Publish Dispatch Sends v-Prefixed Version

## Bug ID

`BUG-003`

## GitHub Issue

[#131](https://github.com/lwndev/ai-skills-manager/issues/131)

## Category

`logic-error`

## Severity

`medium`

## Description

The publish workflow sends `github.event.release.tag_name` (e.g., `v1.8.3`) directly in the repository dispatch payload to the site repo. The site repo's version validation regex expects plain semver without the `v` prefix, causing the site build to fail at the `resolve version` step.

## Steps to Reproduce

1. Create and publish a GitHub release with tag `v1.8.3`
2. Publish workflow triggers and reaches the "Notify site repo to auto-update" step
3. Site repo receives `{"version": "v1.8.3"}`
4. Site repo's `resolve version` step rejects it with: `Error: Invalid version format: v1.8.3`

## Expected Behavior

The dispatch payload should contain plain semver (e.g., `1.8.3`) without the `v` prefix.

## Actual Behavior

The payload contains the raw tag name `v1.8.3`, which fails the site repo's semver validation regex `^[0-9]+\.[0-9]+\.[0-9]+`.

## Root Cause(s)

1. In `.github/workflows/publish.yml:77`, `github.event.release.tag_name` is interpolated directly into `client-payload` without stripping the leading `v` prefix. Git tags conventionally include the `v` (e.g., `v1.8.3`), but the site repo expects raw semver.

## Affected Files

- `.github/workflows/publish.yml`

## Acceptance Criteria

- [x] Publish workflow strips `v` prefix from tag name before sending dispatch payload (RC-1)
- [x] Dispatch payload contains plain semver (e.g., `1.8.3` not `v1.8.3`) (RC-1)
- [x] Workflow YAML passes lint validation (RC-1)

## Completion

**Status:** `Completed`

**Completed:** 2026-03-14

**Pull Request:** [#132](https://github.com/lwndev/ai-skills-manager/pull/132)
