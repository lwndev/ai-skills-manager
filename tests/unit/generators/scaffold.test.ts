import * as fs from 'fs/promises';
import * as path from 'path';
import * as os from 'os';
import {
  resolveOutputPath,
  directoryExists,
  createScaffold,
  promptConfirmation,
  ScaffoldOptions,
} from '../../../src/generators/scaffold';

// Mock readline for promptConfirmation tests
jest.mock('readline', () => ({
  createInterface: jest.fn().mockReturnValue({
    question: jest.fn((question: string, callback: (answer: string) => void) => {
      // Default to 'n' (no) for tests
      callback('n');
    }),
    close: jest.fn(),
  }),
}));

describe('resolveOutputPath', () => {
  const originalCwd = process.cwd();

  afterEach(() => {
    process.chdir(originalCwd);
  });

  it('uses --output path when provided', () => {
    const options: ScaffoldOptions = {
      name: 'my-skill',
      output: '/custom/path',
    };

    const result = resolveOutputPath(options);
    expect(result).toBe('/custom/path/my-skill');
  });

  it('uses ~/.claude/skills/ for --personal', () => {
    const options: ScaffoldOptions = {
      name: 'my-skill',
      personal: true,
    };

    const result = resolveOutputPath(options);
    expect(result).toBe(path.join(os.homedir(), '.claude', 'skills', 'my-skill'));
  });

  it('uses .claude/skills/ in cwd for --project (default)', () => {
    const options: ScaffoldOptions = {
      name: 'my-skill',
      project: true,
    };

    const result = resolveOutputPath(options);
    expect(result).toBe(path.join(process.cwd(), '.claude', 'skills', 'my-skill'));
  });

  it('defaults to project path when no location specified', () => {
    const options: ScaffoldOptions = {
      name: 'my-skill',
    };

    const result = resolveOutputPath(options);
    expect(result).toBe(path.join(process.cwd(), '.claude', 'skills', 'my-skill'));
  });

  it('--output takes precedence over --personal', () => {
    const options: ScaffoldOptions = {
      name: 'my-skill',
      output: '/custom/path',
      personal: true,
    };

    const result = resolveOutputPath(options);
    expect(result).toBe('/custom/path/my-skill');
  });

  it('--output takes precedence over --project', () => {
    const options: ScaffoldOptions = {
      name: 'my-skill',
      output: '/custom/path',
      project: true,
    };

    const result = resolveOutputPath(options);
    expect(result).toBe('/custom/path/my-skill');
  });
});

describe('directoryExists', () => {
  let tempDir: string;

  beforeEach(async () => {
    tempDir = await fs.mkdtemp(path.join(os.tmpdir(), 'scaffold-test-'));
  });

  afterEach(async () => {
    await fs.rm(tempDir, { recursive: true, force: true });
  });

  it('returns true for existing directory', async () => {
    const result = await directoryExists(tempDir);
    expect(result).toBe(true);
  });

  it('returns false for non-existent path', async () => {
    const result = await directoryExists(path.join(tempDir, 'nonexistent'));
    expect(result).toBe(false);
  });

  it('returns false for file path', async () => {
    const filePath = path.join(tempDir, 'file.txt');
    await fs.writeFile(filePath, 'test');
    const result = await directoryExists(filePath);
    expect(result).toBe(false);
  });
});

describe('createScaffold', () => {
  let tempDir: string;

  beforeEach(async () => {
    tempDir = await fs.mkdtemp(path.join(os.tmpdir(), 'scaffold-test-'));
  });

  afterEach(async () => {
    await fs.rm(tempDir, { recursive: true, force: true });
  });

  it('creates skill directory structure', async () => {
    const options: ScaffoldOptions = {
      name: 'test-skill',
      output: tempDir,
      force: true,
    };

    const result = await createScaffold(options);

    expect(result.success).toBe(true);
    expect(result.skillPath).toBe(path.join(tempDir, 'test-skill'));

    // Verify directory exists
    const dirExists = await directoryExists(result.skillPath);
    expect(dirExists).toBe(true);
  });

  it('creates SKILL.md file', async () => {
    const options: ScaffoldOptions = {
      name: 'test-skill',
      output: tempDir,
      force: true,
    };

    const result = await createScaffold(options);
    const skillMdPath = path.join(result.skillPath, 'SKILL.md');

    const content = await fs.readFile(skillMdPath, 'utf-8');
    expect(content).toContain('---');
    expect(content).toContain('name: test-skill');
  });

  it('creates scripts directory with .gitkeep', async () => {
    const options: ScaffoldOptions = {
      name: 'test-skill',
      output: tempDir,
      force: true,
    };

    const result = await createScaffold(options);
    const scriptsPath = path.join(result.skillPath, 'scripts');
    const gitkeepPath = path.join(scriptsPath, '.gitkeep');

    const scriptsDirExists = await directoryExists(scriptsPath);
    expect(scriptsDirExists).toBe(true);

    const gitkeepExists = await fs
      .stat(gitkeepPath)
      .then(() => true)
      .catch(() => false);
    expect(gitkeepExists).toBe(true);
  });

  it('includes description in generated SKILL.md', async () => {
    const options: ScaffoldOptions = {
      name: 'test-skill',
      description: 'A test skill for unit testing',
      output: tempDir,
      force: true,
    };

    const result = await createScaffold(options);
    const skillMdPath = path.join(result.skillPath, 'SKILL.md');

    const content = await fs.readFile(skillMdPath, 'utf-8');
    expect(content).toContain('description: A test skill for unit testing');
  });

  it('includes allowed-tools in generated SKILL.md', async () => {
    const options: ScaffoldOptions = {
      name: 'test-skill',
      allowedTools: ['Bash', 'Read'],
      output: tempDir,
      force: true,
    };

    const result = await createScaffold(options);
    const skillMdPath = path.join(result.skillPath, 'SKILL.md');

    const content = await fs.readFile(skillMdPath, 'utf-8');
    expect(content).toContain('allowed-tools:');
    expect(content).toContain('  - Bash');
    expect(content).toContain('  - Read');
  });

  it('returns list of created files', async () => {
    const options: ScaffoldOptions = {
      name: 'test-skill',
      output: tempDir,
      force: true,
    };

    const result = await createScaffold(options);

    expect(result.filesCreated).toContain(path.join(result.skillPath, 'scripts', '.gitkeep'));
    expect(result.filesCreated).toContain(path.join(result.skillPath, 'SKILL.md'));
  });

  it('overwrites existing directory with --force', async () => {
    const skillPath = path.join(tempDir, 'existing-skill');
    await fs.mkdir(skillPath, { recursive: true });
    await fs.writeFile(path.join(skillPath, 'old-file.txt'), 'old content');

    const options: ScaffoldOptions = {
      name: 'existing-skill',
      output: tempDir,
      force: true,
    };

    const result = await createScaffold(options);

    expect(result.success).toBe(true);
    const skillMdExists = await fs
      .stat(path.join(skillPath, 'SKILL.md'))
      .then(() => true)
      .catch(() => false);
    expect(skillMdExists).toBe(true);
  });

  it('returns error when file system operation fails', async () => {
    // Create a read-only directory to cause write failure
    const readOnlyDir = path.join(tempDir, 'readonly');
    await fs.mkdir(readOnlyDir, { recursive: true });

    // Create a file where the skill directory should be created
    // This will cause mkdir to fail when trying to create the skill directory
    const blockingFile = path.join(readOnlyDir, 'blocked-skill');
    await fs.writeFile(blockingFile, 'blocking');

    const options: ScaffoldOptions = {
      name: 'blocked-skill',
      output: readOnlyDir,
      force: true,
    };

    const result = await createScaffold(options);

    expect(result.success).toBe(false);
    expect(result.error).toBeDefined();
    expect(result.error).toContain('Failed to create scaffold');
  });

  it('returns cancelled when user declines overwrite prompt', async () => {
    // Create existing directory
    const existingSkillPath = path.join(tempDir, 'existing-skill');
    await fs.mkdir(existingSkillPath, { recursive: true });

    const options: ScaffoldOptions = {
      name: 'existing-skill',
      output: tempDir,
      // force is NOT set, so it will prompt
    };

    // The mock returns 'n' by default, so user declines
    const result = await createScaffold(options);

    expect(result.success).toBe(false);
    expect(result.error).toBe('Operation cancelled by user');
  });
});

describe('promptConfirmation', () => {
  it('returns false when user answers no', async () => {
    // Mock is set to return 'n'
    const result = await promptConfirmation('Test question?');
    expect(result).toBe(false);
  });
});
