/**
 * Unit tests for installer generator type guard functions (CHORE-014)
 *
 * Tests isInstallResult, isDryRunPreview, and isOverwriteRequired
 * for correct discriminated union narrowing behavior on
 * InstallResultUnion.
 */

import {
  isInstallResult,
  isDryRunPreview,
  isOverwriteRequired,
} from '../../../src/generators/installer';
import type {
  InstallResultUnion,
  InstallResult,
  DryRunPreview,
  OverwriteRequired,
} from '../../../src/types/install';

// --- Test fixtures ---

const installResult: InstallResult = {
  type: 'install-result',
  success: true,
  skillPath: '/path/to/skill',
  skillName: 'my-skill',
  fileCount: 3,
  size: 1024,
  wasOverwritten: false,
  errors: [],
};

const dryRunResult: DryRunPreview = {
  type: 'dry-run-preview',
  skillName: 'my-skill',
  targetPath: '/path/to/target',
  files: [{ path: 'SKILL.md', size: 512, isDirectory: false }],
  totalSize: 512,
  wouldOverwrite: false,
  conflicts: [],
};

const overwriteResult: OverwriteRequired = {
  type: 'overwrite-required',
  requiresOverwrite: true,
  skillName: 'my-skill',
  existingPath: '/path/to/existing',
  files: [
    {
      path: 'SKILL.md',
      existsInTarget: true,
      packageSize: 512,
      targetSize: 256,
      wouldModify: true,
    },
  ],
};

const allResults: InstallResultUnion[] = [installResult, dryRunResult, overwriteResult];

// --- Tests ---

describe('isInstallResult', () => {
  it('returns true for install-result', () => {
    expect(isInstallResult(installResult)).toBe(true);
  });

  it('returns false for dry-run-preview', () => {
    expect(isInstallResult(dryRunResult)).toBe(false);
  });

  it('returns false for overwrite-required', () => {
    expect(isInstallResult(overwriteResult)).toBe(false);
  });

  it('narrows type so install fields are accessible', () => {
    const result: InstallResultUnion = installResult;
    if (isInstallResult(result)) {
      expect(result.success).toBe(true);
      expect(result.skillPath).toBe('/path/to/skill');
      expect(result.fileCount).toBe(3);
      expect(result.size).toBe(1024);
      expect(result.wasOverwritten).toBe(false);
      expect(result.errors).toEqual([]);
    } else {
      fail('Expected isInstallResult to return true');
    }
  });

  it('correctly identifies install-result among all result types', () => {
    const matches = allResults.filter(isInstallResult);
    expect(matches).toHaveLength(1);
    expect(matches[0].skillPath).toBe('/path/to/skill');
  });
});

describe('isDryRunPreview', () => {
  it('returns true for dry-run-preview', () => {
    expect(isDryRunPreview(dryRunResult)).toBe(true);
  });

  it('returns false for install-result', () => {
    expect(isDryRunPreview(installResult)).toBe(false);
  });

  it('returns false for overwrite-required', () => {
    expect(isDryRunPreview(overwriteResult)).toBe(false);
  });

  it('narrows type so preview fields are accessible', () => {
    const result: InstallResultUnion = dryRunResult;
    if (isDryRunPreview(result)) {
      expect(result.targetPath).toBe('/path/to/target');
      expect(result.files).toHaveLength(1);
      expect(result.totalSize).toBe(512);
      expect(result.wouldOverwrite).toBe(false);
      expect(result.conflicts).toEqual([]);
    } else {
      fail('Expected isDryRunPreview to return true');
    }
  });

  it('correctly identifies dry-run among all result types', () => {
    const matches = allResults.filter(isDryRunPreview);
    expect(matches).toHaveLength(1);
    expect(matches[0].targetPath).toBe('/path/to/target');
  });
});

describe('isOverwriteRequired', () => {
  it('returns true for overwrite-required', () => {
    expect(isOverwriteRequired(overwriteResult)).toBe(true);
  });

  it('returns false for install-result', () => {
    expect(isOverwriteRequired(installResult)).toBe(false);
  });

  it('returns false for dry-run-preview', () => {
    expect(isOverwriteRequired(dryRunResult)).toBe(false);
  });

  it('narrows type so overwrite fields are accessible', () => {
    const result: InstallResultUnion = overwriteResult;
    if (isOverwriteRequired(result)) {
      expect(result.requiresOverwrite).toBe(true);
      expect(result.existingPath).toBe('/path/to/existing');
      expect(result.files).toHaveLength(1);
      expect(result.files[0].wouldModify).toBe(true);
    } else {
      fail('Expected isOverwriteRequired to return true');
    }
  });

  it('correctly identifies overwrite-required among all result types', () => {
    const matches = allResults.filter(isOverwriteRequired);
    expect(matches).toHaveLength(1);
    expect(matches[0].existingPath).toBe('/path/to/existing');
  });
});
