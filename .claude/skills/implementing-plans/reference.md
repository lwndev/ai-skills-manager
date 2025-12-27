# Implementation Patterns

Guidance for common implementation scenarios during phase execution.

## Creating New Files

Follow project conventions:
- Check existing files for patterns (imports, exports, naming)
- Use consistent code style
- Add appropriate type annotations (TypeScript projects)

## Installing Dependencies

Always follow this sequence:
1. Install the dependency first (`npm install package-name`)
2. Verify installation succeeded
3. Then write code that uses the dependency

Never write import statements for packages that haven't been installed yet.

## Creating Test Files

Follow the project's test structure:
- Mirror source file paths under `tests/` or `__tests__/`
- Use the same testing framework as existing tests
- Include both positive and negative test cases

## Error Recovery

**Step fails or is unclear:**
- Report which step and what the issue is
- Ask user for clarification or permission to skip

**Dependency conflict:**
- Report the conflict details
- Suggest resolution options
- Wait for user decision

**Deliverable cannot be completed:**
- Mark remaining deliverables as incomplete
- Document why in your response
- Ask user how to proceed
