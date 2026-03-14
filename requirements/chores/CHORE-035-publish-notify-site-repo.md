# Chore: Add Site Repo Notification to Publish Workflow

## Chore ID

`CHORE-035`

## GitHub Issue

[#125](https://github.com/lwndev/ai-skills-manager/issues/125)

## Category

`configuration`

## Description

Add a `repository-dispatch` step to the publish workflow that notifies `lwndev/ai-skills-manager-site` when a new version is published to npm. This enables the site repo to automatically pick up new CLI releases without manual intervention.

## Affected Files

- `.github/workflows/publish.yml`

## Acceptance Criteria

- [ ] Publish workflow includes a `repository-dispatch` step after the npm publish step
- [ ] Dispatch sends `cli-release` event type with the release tag version in the payload
- [ ] Step is skipped during dry-run publishes
- [ ] Uses `peter-evans/repository-dispatch@v3`
- [ ] Requires `SITE_REPO_PAT` secret for cross-repo access

## Completion

**Status:** `Completed`

**Completed:** 2026-03-14

**Pull Request:** [#126](https://github.com/lwndev/ai-skills-manager/pull/126)

## Notes

- The `SITE_REPO_PAT` secret must be configured in the repository settings with access to `lwndev/ai-skills-manager-site`
- The site repo needs a corresponding `repository_dispatch` workflow trigger listening for the `cli-release` event type
