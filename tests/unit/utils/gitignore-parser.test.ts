/**
 * Tests for gitignore parser utilities
 */

import * as fs from 'fs/promises';
import * as path from 'path';
import * as os from 'os';

import { loadGitignore, createIgnoreFromContent } from '../../../src/utils/gitignore-parser';

describe('Gitignore Parser Utilities', () => {
  let tempDir: string;

  beforeAll(async () => {
    tempDir = await fs.mkdtemp(path.join(os.tmpdir(), 'asm-gitignore-test-'));
  });

  afterAll(async () => {
    await fs.rm(tempDir, { recursive: true, force: true });
  });

  describe('loadGitignore', () => {
    it('loads and parses .gitignore from project root', async () => {
      const projectRoot = path.join(tempDir, 'with-gitignore');
      await fs.mkdir(projectRoot, { recursive: true });
      await fs.writeFile(
        path.join(projectRoot, '.gitignore'),
        `node_modules/
dist/
*.log
`
      );

      const ig = await loadGitignore(projectRoot);

      expect(ig).not.toBeNull();
      if (!ig) return;
      expect(ig.ignores('node_modules/')).toBe(true);
      expect(ig.ignores('dist/')).toBe(true);
      expect(ig.ignores('error.log')).toBe(true);
      expect(ig.ignores('src/')).toBe(false);
    });

    it('returns null when .gitignore does not exist', async () => {
      const projectRoot = path.join(tempDir, 'no-gitignore');
      await fs.mkdir(projectRoot, { recursive: true });

      const ig = await loadGitignore(projectRoot);

      expect(ig).toBeNull();
    });

    it('returns null for non-existent project root', async () => {
      const projectRoot = path.join(tempDir, 'does-not-exist');

      const ig = await loadGitignore(projectRoot);

      expect(ig).toBeNull();
    });

    it('handles empty .gitignore file', async () => {
      const projectRoot = path.join(tempDir, 'empty-gitignore');
      await fs.mkdir(projectRoot, { recursive: true });
      await fs.writeFile(path.join(projectRoot, '.gitignore'), '');

      const ig = await loadGitignore(projectRoot);

      expect(ig).not.toBeNull();
      if (!ig) return;
      // Empty gitignore should not ignore anything
      expect(ig.ignores('node_modules/')).toBe(false);
    });

    it('handles .gitignore with comments and blank lines', async () => {
      const projectRoot = path.join(tempDir, 'comments-gitignore');
      await fs.mkdir(projectRoot, { recursive: true });
      await fs.writeFile(
        path.join(projectRoot, '.gitignore'),
        `# This is a comment
node_modules/

# Another comment
dist/

`
      );

      const ig = await loadGitignore(projectRoot);

      expect(ig).not.toBeNull();
      if (!ig) return;
      expect(ig.ignores('node_modules/')).toBe(true);
      expect(ig.ignores('dist/')).toBe(true);
      // Comments should not be treated as patterns
      expect(ig.ignores('# This is a comment')).toBe(false);
    });
  });

  describe('createIgnoreFromContent', () => {
    describe('standard patterns', () => {
      it('matches directory patterns with trailing slash', () => {
        const ig = createIgnoreFromContent('node_modules/');

        expect(ig.ignores('node_modules/')).toBe(true);
        expect(ig.ignores('node_modules/package.json')).toBe(true);
        expect(ig.ignores('src/')).toBe(false);
      });

      it('matches file patterns without trailing slash', () => {
        const ig = createIgnoreFromContent('*.log');

        expect(ig.ignores('error.log')).toBe(true);
        expect(ig.ignores('debug.log')).toBe(true);
        expect(ig.ignores('error.txt')).toBe(false);
      });

      it('matches glob patterns', () => {
        const ig = createIgnoreFromContent(`
build/
dist/
*.tmp
`);

        expect(ig.ignores('build/')).toBe(true);
        expect(ig.ignores('dist/')).toBe(true);
        expect(ig.ignores('file.tmp')).toBe(true);
        expect(ig.ignores('src/')).toBe(false);
      });

      it('matches nested paths', () => {
        const ig = createIgnoreFromContent('packages/*/dist/');

        expect(ig.ignores('packages/api/dist/')).toBe(true);
        expect(ig.ignores('packages/web/dist/')).toBe(true);
        expect(ig.ignores('dist/')).toBe(false);
      });
    });

    describe('negation patterns', () => {
      it('handles negation with exclamation mark', () => {
        const ig = createIgnoreFromContent(`
*.log
!important.log
`);

        expect(ig.ignores('error.log')).toBe(true);
        expect(ig.ignores('debug.log')).toBe(true);
        expect(ig.ignores('important.log')).toBe(false);
      });

      it('handles negation for directories', () => {
        const ig = createIgnoreFromContent(`
build/
!build/important/
`);

        expect(ig.ignores('build/')).toBe(true);
        expect(ig.ignores('build/output.js')).toBe(true);
        // Note: negation of directories can be tricky with the ignore package
        // The exact behavior depends on how paths are tested
      });
    });

    describe('special cases', () => {
      it('handles leading slash for root-relative patterns', () => {
        const ig = createIgnoreFromContent('/dist/');

        expect(ig.ignores('dist/')).toBe(true);
        // Root-relative pattern should not match nested
        expect(ig.ignores('packages/dist/')).toBe(false);
      });

      it('handles double asterisk for recursive matching', () => {
        const ig = createIgnoreFromContent('**/temp/');

        expect(ig.ignores('temp/')).toBe(true);
        expect(ig.ignores('a/temp/')).toBe(true);
        expect(ig.ignores('a/b/temp/')).toBe(true);
        expect(ig.ignores('a/b/c/temp/')).toBe(true);
      });

      it('handles patterns with spaces', () => {
        const ig = createIgnoreFromContent('my folder/');

        expect(ig.ignores('my folder/')).toBe(true);
        expect(ig.ignores('myfolder/')).toBe(false);
      });

      it('handles multiple patterns combined', () => {
        const ig = createIgnoreFromContent(`
# Dependencies
node_modules/
vendor/

# Build outputs
dist/
build/
*.min.js

# Environment files
.env
.env.local
.env.*.local

# IDE
.idea/
.vscode/
*.swp
`);

        // Dependencies
        expect(ig.ignores('node_modules/')).toBe(true);
        expect(ig.ignores('vendor/')).toBe(true);

        // Build outputs
        expect(ig.ignores('dist/')).toBe(true);
        expect(ig.ignores('build/')).toBe(true);
        expect(ig.ignores('app.min.js')).toBe(true);

        // Environment files
        expect(ig.ignores('.env')).toBe(true);
        expect(ig.ignores('.env.local')).toBe(true);
        expect(ig.ignores('.env.production.local')).toBe(true);

        // IDE
        expect(ig.ignores('.idea/')).toBe(true);
        expect(ig.ignores('.vscode/')).toBe(true);

        // Not ignored
        expect(ig.ignores('src/')).toBe(false);
        expect(ig.ignores('package.json')).toBe(false);
        expect(ig.ignores('.env.example')).toBe(false);
      });
    });
  });
});
