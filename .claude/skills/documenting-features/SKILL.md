---
name: documenting-features
description: Creates structured feature requirement documents for software features. Use when defining new features, writing requirements, specifying CLI commands, API endpoints, or when the user asks for feature documentation, requirements, specs, or PRDs.
---

# Documenting Features

Create comprehensive feature requirement documents that capture user stories, functional requirements, edge cases, and acceptance criteria.

## When to Use This Skill

- User requests feature requirements or specifications
- Defining a new CLI command or API endpoint
- Documenting expected behavior for implementation
- Creating acceptance criteria for a feature

## Flexibility

Adapt sections based on feature type:

- **CLI commands**: Include full Command Syntax section with arguments, options, examples
- **API endpoints**: Include API Integration section, skip Command Syntax
- **UI features**: Focus on user flows and interactions, skip command syntax
- **Internal features**: May skip user-facing documentation sections

## Quick Start

1. Identify the feature scope and purpose
2. Define the user story and priority
3. Document command syntax/API interface (if applicable)
4. List functional and non-functional requirements
5. Specify output format, edge cases, and testing requirements

## File Locations

- `requirements/features/` - Feature requirement documents
- `requirements/implementation/` - Implementation plans
- `docs/features/` - User-facing feature documentation

## Template

See [templates/feature-requirements.md](templates/feature-requirements.md) for the full template.

### Structure Overview

```
# Feature Requirements: [Feature Name]
- Overview, Feature ID, Priority
- User Story
- Command Syntax (for CLI) or API Integration (for APIs)
- Functional Requirements (FR-1, FR-2, ...)
- Output Format
- Non-Functional Requirements (NFR-1, NFR-2, ...)
- Dependencies
- Edge Cases
- Testing Requirements
- Acceptance Criteria
```

### Numbering Conventions

- **FR-1, FR-2**: Functional requirements - specific behaviors
- **NFR-1, NFR-2**: Non-functional requirements - performance, security, error handling

## Verification Checklist

Before finalizing, verify:

- [ ] User story captures "who, what, why"
- [ ] All arguments/options documented with defaults
- [ ] Output format specified with example
- [ ] Error handling covers failure modes
- [ ] Edge cases identified
- [ ] Acceptance criteria are testable

## Reference Examples

- [feature-requirements-example-search-command.md](reference/feature-requirements-example-search-command.md) - CLI search command with API integration
- [feature-requirements-example-episodes-command.md](reference/feature-requirements-example-episodes-command.md) - CLI command with date filtering and formatting
