# Chore Categories Reference

This document provides detailed guidance for each chore category, including common use cases, typical affected files, and suggested acceptance criteria.

## Table of Contents

- [Dependencies](#dependencies)
- [Documentation](#documentation)
- [Refactoring](#refactoring)
- [Configuration](#configuration)
- [Cleanup](#cleanup)

---

## Dependencies

Package updates, version bumps, and security patches.

### Common Use Cases

- Updating npm packages to latest versions
- Applying security patches
- Upgrading major framework versions
- Adding new development dependencies
- Removing unused packages

### Typical Affected Files

- `package.json`
- `package-lock.json`
- Files importing updated packages (if API changes)
- Test files (if test dependencies updated)

### Suggested Acceptance Criteria

- [ ] All packages updated to specified versions
- [ ] `npm install` completes without errors
- [ ] `npm audit` shows no high/critical vulnerabilities
- [ ] All tests pass after updates
- [ ] Build completes successfully
- [ ] Application runs without runtime errors

### Notes

- For major version updates, check the changelog for breaking changes
- Consider updating one package at a time for easier rollback
- Document any breaking changes that require code modifications

---

## Documentation

README updates, comment fixes, and documentation corrections.

### Common Use Cases

- Fixing typos in README or docs
- Updating outdated instructions
- Adding missing documentation
- Correcting code comments
- Updating API documentation
- Fixing broken links

### Typical Affected Files

- `README.md`
- `docs/*.md`
- `CONTRIBUTING.md`
- `CHANGELOG.md`
- Source files with documentation comments
- JSDoc/TSDoc comments in code

### Suggested Acceptance Criteria

- [ ] All typos/errors corrected
- [ ] Instructions are accurate and up-to-date
- [ ] Links are valid and accessible
- [ ] Documentation matches current behavior
- [ ] Markdown renders correctly

### Notes

- Run a spell checker before finalizing
- Verify links with a link checker tool
- Check that code examples still work

---

## Refactoring

Code cleanup, restructuring, and naming improvements.

### Common Use Cases

- Renaming variables/functions for clarity
- Extracting repeated code into functions
- Reorganizing file structure
- Simplifying complex logic
- Improving type definitions
- Applying consistent formatting

### Typical Affected Files

- Source files in `src/`
- Test files in `tests/` or `__tests__/`
- Type definition files (`.d.ts`)
- Import statements across the codebase

### Suggested Acceptance Criteria

- [ ] All tests pass (no behavior changes)
- [ ] Build completes successfully
- [ ] No new linting errors introduced
- [ ] Code coverage maintained or improved
- [ ] All references updated (no broken imports)

### Notes

- Refactoring should not change behavior
- Run tests frequently during refactoring
- Consider using IDE refactoring tools for safety
- Update tests if function signatures change

---

## Configuration

Config file updates, tooling changes, and CI/CD modifications.

### Common Use Cases

- Updating ESLint/Prettier rules
- Modifying TypeScript configuration
- Changing build settings
- Updating CI/CD pipelines
- Adjusting development environment settings
- Updating editor configurations

### Typical Affected Files

- `tsconfig.json`
- `.eslintrc.*`
- `.prettierrc`
- `.github/workflows/*.yml`
- `jest.config.js`
- `.env.example`
- `vite.config.ts` / `webpack.config.js`

### Suggested Acceptance Criteria

- [ ] Configuration change applied correctly
- [ ] Build completes with new settings
- [ ] Linting passes with new rules
- [ ] CI/CD pipeline runs successfully
- [ ] Development workflow unaffected

### Notes

- Test configuration changes locally before committing
- Document any new configuration options
- Consider impact on team members' workflows

---

## Cleanup

Removing dead code, unused files, and deprecated features.

### Common Use Cases

- Removing unused imports
- Deleting dead code paths
- Removing deprecated files
- Cleaning up old comments (TODO, FIXME)
- Removing unused dependencies
- Deleting temporary or generated files

### Typical Affected Files

- Source files with unused code
- Test files for removed features
- `package.json` (for unused dependencies)
- Any files being deleted entirely

### Suggested Acceptance Criteria

- [ ] All unused code/files removed
- [ ] No references to removed code remain
- [ ] All tests pass
- [ ] Build completes successfully
- [ ] No runtime errors from missing code

### Notes

- Use IDE tools to find unused exports/imports
- Search for references before deleting
- Consider if "unused" code might be needed later
- Check for dynamic imports or reflection usage
