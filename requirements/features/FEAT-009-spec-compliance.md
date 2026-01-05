# Feature Requirements: Agent Skills Specification Compliance

## Overview

Address gaps between the current AI Skills Manager implementation and the Agent Skills specification to ensure full compliance and correct validation of skills.

## Feature ID
`FEAT-009`

## GitHub Issue
[#22](https://github.com/lwndev/ai-skills-manager/issues/22)

## Priority
High - Critical gap causes valid skills to fail validation; other gaps reduce spec compliance

## User Story

As a skill developer, I want the validation system to fully comply with the Agent Skills specification so that valid skills pass validation and invalid skills are correctly rejected.

## Functional Requirements

### FR-1: Add `compatibility` Field Support (Critical)

**Current behavior:** Skills with the `compatibility` field are rejected with "unknown key" error.

**Required behavior:** Accept `compatibility` as a valid frontmatter field.

**Location:** `src/validators/frontmatter.ts:11-17`

**Change:** Add `'compatibility'` to the `ALLOWED_KEYS` set:
```typescript
const ALLOWED_KEYS = new Set([
  'name',
  'description',
  'license',
  'compatibility',  // ADD THIS
  'allowed-tools',
  'metadata',
]);
```

**Validation rules per spec:**
- Optional field
- Must be 1-500 characters if provided
- String type

### FR-2: Directory Name Validation

**Current behavior:** A skill with `name: foo` in directory `bar/` passes validation.

**Required behavior:** Validate that the skill's `name` field matches its parent directory name.

**Spec reference:** "Must match the parent directory name" (spec line 63)

**Implementation:** Create a new validator or extend existing validation to verify:
```typescript
parsedFrontmatter.name === path.basename(skillDir)
```

**Error message:** `Skill name 'foo' does not match directory name 'bar'. The name field must match the parent directory name.`

### FR-3: File Size Warnings

**Current behavior:** No warnings for large SKILL.md files.

**Required behavior:** Issue warnings (not errors) when SKILL.md exceeds recommended limits.

**Spec recommendations:**
- Instructions should be < 5000 tokens
- Keep main SKILL.md under 500 lines

**Implementation:**
- Count lines in SKILL.md content (body after frontmatter)
- Estimate tokens (rough heuristic: ~4 characters per token)
- Issue warning if lines > 500 or estimated tokens > 5000

**Warning messages:**
- `Warning: SKILL.md body has {N} lines (recommended: <500 lines)`
- `Warning: SKILL.md body is approximately {N} tokens (recommended: <5000 tokens)`

**Note:** These produce warnings, not validation failures. Exit code remains 0 if no errors.

### FR-4: Support Space-Delimited `allowed-tools` Format

**Current behavior:** `allowed-tools` is treated as YAML array (`string[]`).

**Required behavior:** Support space-delimited string format per spec, while maintaining backward compatibility with array format.

**Spec format:** `allowed-tools: Bash(git:*) Bash(jq:*) Read`

**Implementation:**
- Accept both string (space-delimited) and array formats
- When parsing string format, split on whitespace to get individual tools
- Internal representation should normalize to array for consistency

**Examples of valid formats:**
```yaml
# Space-delimited string (per spec)
allowed-tools: Bash(git:*) Bash(jq:*) Read

# Array format (backwards compatible)
allowed-tools:
  - Bash(git:*)
  - Bash(jq:*)
  - Read
```

## Output Format

### Validation with Warnings
```
Validating skill: my-skill

Checks:
  ✓ SKILL.md exists
  ✓ Valid YAML frontmatter
  ✓ Required fields present
  ✓ No unknown properties
  ✓ Name format valid
  ✓ Name matches directory
  ✓ Description format valid
  ✓ Compatibility format valid

Warnings:
  ⚠ SKILL.md body has 650 lines (recommended: <500 lines)

Skill is valid!
```

### Directory Name Mismatch Error
```
Validating skill: bar

Checks:
  ✓ SKILL.md exists
  ✓ Valid YAML frontmatter
  ✓ Required fields present
  ✓ No unknown properties
  ✓ Name format valid
  ✗ Name matches directory

Error: Skill name 'foo' does not match directory name 'bar'.
       The name field must match the parent directory name.

Skill validation failed.
```

### JSON Output with Warnings
```json
{
  "valid": true,
  "skillPath": "./my-skill",
  "checks": {
    "fileExists": { "passed": true },
    "frontmatterValid": { "passed": true },
    "requiredFields": { "passed": true },
    "allowedProperties": { "passed": true },
    "nameFormat": { "passed": true },
    "nameMatchesDirectory": { "passed": true },
    "descriptionFormat": { "passed": true },
    "compatibilityFormat": { "passed": true }
  },
  "warnings": [
    "SKILL.md body has 650 lines (recommended: <500 lines)"
  ],
  "errors": []
}
```

## Non-Functional Requirements

### NFR-1: Backward Compatibility
- Existing valid skills must continue to pass validation
- Array format for `allowed-tools` must remain supported
- New warnings should not break CI/CD pipelines (exit code 0 for warnings-only)

### NFR-2: Error Message Quality
- All new error messages should be actionable
- Include the actual vs expected values
- Reference the spec requirement where helpful

### NFR-3: Performance
- Line counting and token estimation should be efficient
- No significant impact on validation speed

## Dependencies

- Existing validation infrastructure in `src/validators/`
- Node.js `path` module for directory name extraction
- Existing frontmatter parsing

## Edge Cases

1. **Skill in root directory**: Directory name may be `.` - handle appropriately or skip validation
2. **Symlinked skill directories**: Use resolved path for directory name comparison
3. **Empty `compatibility` field**: Should fail validation (spec says 1-500 chars if provided)
4. **`compatibility` exactly 500 chars**: Should pass
5. **`compatibility` with 501 chars**: Should fail with descriptive error
6. **Mixed `allowed-tools` format**: Single value could be either format - handle gracefully
7. **Whitespace in `allowed-tools` string**: Trim and split on whitespace
8. **SKILL.md with only frontmatter (no body)**: 0 lines, 0 tokens - should pass with no warnings
9. **Very long lines in SKILL.md**: Don't double-count tokens due to line length

## Testing Requirements

### Unit Tests

**FR-1: Compatibility field**
- Valid `compatibility` field (1-500 chars)
- Empty `compatibility` field (error)
- `compatibility` exceeding 500 chars (error)
- Missing `compatibility` (no error - it's optional)

**FR-2: Directory name validation**
- Name matches directory name (pass)
- Name differs from directory name (fail)
- Skill at various path depths
- Path with trailing slash

**FR-3: File size warnings**
- SKILL.md with < 500 lines (no warning)
- SKILL.md with exactly 500 lines (no warning)
- SKILL.md with > 500 lines (warning)
- SKILL.md with estimated < 5000 tokens (no warning)
- SKILL.md with estimated > 5000 tokens (warning)
- Both line and token warnings together

**FR-4: allowed-tools format**
- Space-delimited string format (valid)
- Array format (valid)
- Empty string (valid - no tools)
- Empty array (valid - no tools)
- Single tool in string format
- Tools with special characters (parentheses, asterisks)

### Integration Tests
- Full validation with all new checks
- JSON output includes new fields
- Warnings display correctly
- Exit codes correct (0 with warnings, 1 with errors)

### Manual Testing
- Validate skills with `compatibility` field
- Validate skills with mismatched directory names
- Validate large skills to trigger warnings
- Validate skills using both `allowed-tools` formats

## Acceptance Criteria

- [ ] `compatibility` field is accepted as a valid frontmatter property
- [ ] `compatibility` field validation enforces 1-500 character limit when present
- [ ] Skill name is validated against parent directory name
- [ ] Clear error message when name doesn't match directory
- [ ] Warning issued for SKILL.md exceeding 500 lines
- [ ] Warning issued for SKILL.md exceeding ~5000 tokens
- [ ] Warnings do not cause validation failure (exit code 0)
- [ ] Space-delimited `allowed-tools` format is supported
- [ ] Array `allowed-tools` format continues to work
- [ ] JSON output includes warnings array
- [ ] All existing tests continue to pass
- [ ] New tests cover all functional requirements
- [ ] Tests pass with >80% coverage
