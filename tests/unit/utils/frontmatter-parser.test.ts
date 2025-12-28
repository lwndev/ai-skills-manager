import { parseFrontmatter, extractRawFrontmatter } from '../../../src/utils/frontmatter-parser';

describe('parseFrontmatter', () => {
  describe('valid frontmatter', () => {
    it('parses simple frontmatter with name and description', () => {
      const content = `---
name: my-skill
description: A helpful skill
---

# My Skill

Content here.
`;
      const result = parseFrontmatter(content);
      expect(result.success).toBe(true);
      expect(result.data).toEqual({
        name: 'my-skill',
        description: 'A helpful skill',
      });
    });

    it('parses frontmatter with all allowed fields', () => {
      const content = `---
name: my-skill
description: A helpful skill
license: MIT
allowed-tools:
  - Read
  - Write
  - Bash
metadata:
  author: test
  version: 1.0.0
---

Content.
`;
      const result = parseFrontmatter(content);
      expect(result.success).toBe(true);
      expect(result.data).toEqual({
        name: 'my-skill',
        description: 'A helpful skill',
        license: 'MIT',
        'allowed-tools': ['Read', 'Write', 'Bash'],
        metadata: {
          author: 'test',
          version: '1.0.0',
        },
      });
    });

    it('parses frontmatter with multiline description', () => {
      const content = `---
name: my-skill
description: |
  This is a multiline
  description that spans
  multiple lines.
---

Content.
`;
      const result = parseFrontmatter(content);
      expect(result.success).toBe(true);
      expect(result.data?.description).toContain('multiline');
      expect(result.data?.description).toContain('multiple lines');
    });

    it('handles frontmatter with leading whitespace', () => {
      const content = `  ---
name: my-skill
description: Test
---

Content.
`;
      const result = parseFrontmatter(content);
      expect(result.success).toBe(true);
      expect(result.data?.name).toBe('my-skill');
    });

    it('returns raw frontmatter string', () => {
      const content = `---
name: my-skill
description: Test
---

Content.
`;
      const result = parseFrontmatter(content);
      expect(result.success).toBe(true);
      expect(result.raw).toContain('name: my-skill');
      expect(result.raw).toContain('description: Test');
    });
  });

  describe('empty content', () => {
    it('returns error for empty string', () => {
      const result = parseFrontmatter('');
      expect(result.success).toBe(false);
      expect(result.error).toContain('empty');
    });

    it('returns error for whitespace only', () => {
      const result = parseFrontmatter('   \n\n  ');
      expect(result.success).toBe(false);
      expect(result.error).toContain('empty');
    });
  });

  describe('missing opening delimiter', () => {
    it('returns error when file does not start with ---', () => {
      const content = `name: my-skill
description: Test
---

Content.
`;
      const result = parseFrontmatter(content);
      expect(result.success).toBe(false);
      expect(result.error).toContain('Missing YAML frontmatter');
      expect(result.error).toContain('start with "---"');
    });

    it('returns error for plain markdown without frontmatter', () => {
      const content = `# My Skill

This is just markdown.
`;
      const result = parseFrontmatter(content);
      expect(result.success).toBe(false);
      expect(result.error).toContain('Missing YAML frontmatter');
    });
  });

  describe('missing closing delimiter', () => {
    it('returns error when closing --- is missing', () => {
      const content = `---
name: my-skill
description: Test

Content here.
`;
      const result = parseFrontmatter(content);
      expect(result.success).toBe(false);
      expect(result.error).toContain('Unclosed YAML frontmatter');
      expect(result.error).toContain('Missing closing "---"');
    });
  });

  describe('empty frontmatter', () => {
    it('returns error for empty frontmatter block', () => {
      const content = `---
---

Content.
`;
      const result = parseFrontmatter(content);
      expect(result.success).toBe(false);
      expect(result.error).toContain('empty');
    });

    it('returns error for frontmatter with only whitespace', () => {
      const content = `---

---

Content.
`;
      const result = parseFrontmatter(content);
      expect(result.success).toBe(false);
      expect(result.error).toContain('empty');
    });
  });

  describe('invalid YAML syntax', () => {
    it('returns error for invalid YAML', () => {
      const content = `---
name: my-skill
description: [unclosed bracket
---

Content.
`;
      const result = parseFrontmatter(content);
      expect(result.success).toBe(false);
      expect(result.error).toContain('Invalid YAML');
    });

    it('returns error for invalid indentation', () => {
      const content = `---
name: my-skill
  description: Test
---

Content.
`;
      const result = parseFrontmatter(content);
      expect(result.success).toBe(false);
      expect(result.error).toContain('Invalid YAML');
    });

    it('returns error for YAML that parses to non-object', () => {
      const content = `---
- item1
- item2
---

Content.
`;
      const result = parseFrontmatter(content);
      expect(result.success).toBe(false);
      expect(result.error).toContain('must be a YAML object');
    });
  });

  describe('edge cases', () => {
    it('handles frontmatter with --- inside content', () => {
      const content = `---
name: my-skill
description: Test
---

# Heading

Some content with ---dashes--- in it.
`;
      const result = parseFrontmatter(content);
      expect(result.success).toBe(true);
      expect(result.data?.name).toBe('my-skill');
    });

    it('handles frontmatter with empty description', () => {
      const content = `---
name: my-skill
description: ""
---

Content.
`;
      const result = parseFrontmatter(content);
      expect(result.success).toBe(true);
      expect(result.data?.description).toBe('');
    });

    it('handles frontmatter with numeric values', () => {
      const content = `---
name: my-skill
description: Test
metadata:
  version: 1.0
  count: 42
---

Content.
`;
      const result = parseFrontmatter(content);
      expect(result.success).toBe(true);
      expect(result.data?.metadata).toEqual({
        version: 1.0,
        count: 42,
      });
    });

    it('handles frontmatter with special characters in strings', () => {
      const content = `---
name: my-skill
description: "A skill with 'quotes' and: colons"
---

Content.
`;
      const result = parseFrontmatter(content);
      expect(result.success).toBe(true);
      expect(result.data?.description).toContain('quotes');
      expect(result.data?.description).toContain('colons');
    });
  });
});

describe('extractRawFrontmatter', () => {
  it('returns raw frontmatter string for valid content', () => {
    const content = `---
name: my-skill
description: Test
---

Content.
`;
    const raw = extractRawFrontmatter(content);
    expect(raw).toContain('name: my-skill');
    expect(raw).not.toContain('---');
  });

  it('returns null for invalid content', () => {
    const content = `# No frontmatter here`;
    const raw = extractRawFrontmatter(content);
    expect(raw).toBeNull();
  });
});
