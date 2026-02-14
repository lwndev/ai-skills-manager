/**
 * Unit tests for install API type guard functions (CHORE-014)
 *
 * Tests isDetailedInstallSuccess, isDetailedInstallDryRunPreview,
 * and isDetailedInstallOverwriteRequired for correct discriminated
 * union narrowing behavior.
 */

import {
  isDetailedInstallSuccess,
  isDetailedInstallDryRunPreview,
  isDetailedInstallOverwriteRequired,
} from '../../../src/api/install';
import type {
  DetailedInstallResult,
  DetailedInstallSuccess,
  DetailedInstallDryRunPreview,
  DetailedInstallOverwriteRequired,
} from '../../../src/types/api';

// --- Test fixtures ---

const successResult: DetailedInstallSuccess = {
  type: 'install-success',
  skillPath: '/path/to/skill',
  skillName: 'my-skill',
  fileCount: 3,
  size: 1024,
  wasOverwritten: false,
};

const dryRunResult: DetailedInstallDryRunPreview = {
  type: 'install-dry-run-preview',
  skillName: 'my-skill',
  targetPath: '/path/to/target',
  files: [{ path: 'SKILL.md', size: 512, isDirectory: false }],
  totalSize: 512,
  wouldOverwrite: false,
  conflicts: [],
};

const overwriteResult: DetailedInstallOverwriteRequired = {
  type: 'install-overwrite-required',
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

const allResults: DetailedInstallResult[] = [successResult, dryRunResult, overwriteResult];

// --- Tests ---

describe('isDetailedInstallSuccess', () => {
  it('returns true for install-success result', () => {
    expect(isDetailedInstallSuccess(successResult)).toBe(true);
  });

  it('returns false for install-dry-run-preview result', () => {
    expect(isDetailedInstallSuccess(dryRunResult)).toBe(false);
  });

  it('returns false for install-overwrite-required result', () => {
    expect(isDetailedInstallSuccess(overwriteResult)).toBe(false);
  });

  it('narrows type so skillPath is accessible', () => {
    const result: DetailedInstallResult = successResult;
    if (isDetailedInstallSuccess(result)) {
      // TypeScript should allow direct access without assertion
      expect(result.skillPath).toBe('/path/to/skill');
      expect(result.fileCount).toBe(3);
      expect(result.size).toBe(1024);
      expect(result.wasOverwritten).toBe(false);
    } else {
      fail('Expected isDetailedInstallSuccess to return true');
    }
  });

  it('correctly identifies success among all result types', () => {
    const matches = allResults.filter(isDetailedInstallSuccess);
    expect(matches).toHaveLength(1);
    expect(matches[0].skillPath).toBe('/path/to/skill');
  });
});

describe('isDetailedInstallDryRunPreview', () => {
  it('returns true for install-dry-run-preview result', () => {
    expect(isDetailedInstallDryRunPreview(dryRunResult)).toBe(true);
  });

  it('returns false for install-success result', () => {
    expect(isDetailedInstallDryRunPreview(successResult)).toBe(false);
  });

  it('returns false for install-overwrite-required result', () => {
    expect(isDetailedInstallDryRunPreview(overwriteResult)).toBe(false);
  });

  it('narrows type so targetPath and files are accessible', () => {
    const result: DetailedInstallResult = dryRunResult;
    if (isDetailedInstallDryRunPreview(result)) {
      expect(result.targetPath).toBe('/path/to/target');
      expect(result.files).toHaveLength(1);
      expect(result.totalSize).toBe(512);
      expect(result.wouldOverwrite).toBe(false);
      expect(result.conflicts).toEqual([]);
    } else {
      fail('Expected isDetailedInstallDryRunPreview to return true');
    }
  });

  it('correctly identifies dry-run among all result types', () => {
    const matches = allResults.filter(isDetailedInstallDryRunPreview);
    expect(matches).toHaveLength(1);
    expect(matches[0].targetPath).toBe('/path/to/target');
  });
});

describe('isDetailedInstallOverwriteRequired', () => {
  it('returns true for install-overwrite-required result', () => {
    expect(isDetailedInstallOverwriteRequired(overwriteResult)).toBe(true);
  });

  it('returns false for install-success result', () => {
    expect(isDetailedInstallOverwriteRequired(successResult)).toBe(false);
  });

  it('returns false for install-dry-run-preview result', () => {
    expect(isDetailedInstallOverwriteRequired(dryRunResult)).toBe(false);
  });

  it('narrows type so existingPath and files are accessible', () => {
    const result: DetailedInstallResult = overwriteResult;
    if (isDetailedInstallOverwriteRequired(result)) {
      expect(result.existingPath).toBe('/path/to/existing');
      expect(result.files).toHaveLength(1);
      expect(result.files[0].wouldModify).toBe(true);
    } else {
      fail('Expected isDetailedInstallOverwriteRequired to return true');
    }
  });

  it('correctly identifies overwrite-required among all result types', () => {
    const matches = allResults.filter(isDetailedInstallOverwriteRequired);
    expect(matches).toHaveLength(1);
    expect(matches[0].existingPath).toBe('/path/to/existing');
  });
});
