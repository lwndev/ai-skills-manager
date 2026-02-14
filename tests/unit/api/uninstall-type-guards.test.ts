/**
 * Unit tests for uninstall API type guard functions (CHORE-014)
 *
 * Tests isUninstallSuccess, isUninstallNotFound, and
 * isUninstallDryRunPreview for correct discriminated union
 * narrowing behavior.
 */

import {
  isUninstallSuccess,
  isUninstallNotFound,
  isUninstallDryRunPreview,
} from '../../../src/api/uninstall';
import type {
  DetailedUninstallResult,
  DetailedUninstallSuccess,
  DetailedUninstallNotFound,
  DetailedUninstallDryRunPreview,
} from '../../../src/types/api';

// --- Test fixtures ---

/** Derived from DetailedUninstallResult.results to stay in sync with source type */
type UninstallDetailedItem = DetailedUninstallResult['results'][number];

const successResult: DetailedUninstallSuccess = {
  type: 'success',
  skillName: 'my-skill',
  path: '/path/to/skill',
  filesRemoved: 5,
  bytesFreed: 2048,
};

const notFoundResult: DetailedUninstallNotFound = {
  type: 'not-found',
  skillName: 'missing-skill',
  searchedPath: '/path/to/search',
};

const dryRunResult: DetailedUninstallDryRunPreview = {
  type: 'dry-run-preview',
  skillName: 'my-skill',
  path: '/path/to/skill',
  files: [
    {
      relativePath: 'SKILL.md',
      absolutePath: '/path/to/skill/SKILL.md',
      size: 512,
      isDirectory: false,
      isSymlink: false,
    },
  ],
  totalSize: 512,
};

const allResults: UninstallDetailedItem[] = [successResult, notFoundResult, dryRunResult];

// --- Tests ---

describe('isUninstallSuccess', () => {
  it('returns true for success result', () => {
    expect(isUninstallSuccess(successResult)).toBe(true);
  });

  it('returns false for not-found result', () => {
    expect(isUninstallSuccess(notFoundResult)).toBe(false);
  });

  it('returns false for dry-run-preview result', () => {
    expect(isUninstallSuccess(dryRunResult)).toBe(false);
  });

  it('narrows type so success fields are accessible', () => {
    const result: UninstallDetailedItem = successResult;
    if (isUninstallSuccess(result)) {
      expect(result.path).toBe('/path/to/skill');
      expect(result.filesRemoved).toBe(5);
      expect(result.bytesFreed).toBe(2048);
    } else {
      fail('Expected isUninstallSuccess to return true');
    }
  });

  it('correctly identifies success among all result types', () => {
    const matches = allResults.filter(isUninstallSuccess);
    expect(matches).toHaveLength(1);
    expect(matches[0].filesRemoved).toBe(5);
  });
});

describe('isUninstallNotFound', () => {
  it('returns true for not-found result', () => {
    expect(isUninstallNotFound(notFoundResult)).toBe(true);
  });

  it('returns false for success result', () => {
    expect(isUninstallNotFound(successResult)).toBe(false);
  });

  it('returns false for dry-run-preview result', () => {
    expect(isUninstallNotFound(dryRunResult)).toBe(false);
  });

  it('narrows type so not-found fields are accessible', () => {
    const result: UninstallDetailedItem = notFoundResult;
    if (isUninstallNotFound(result)) {
      expect(result.skillName).toBe('missing-skill');
      expect(result.searchedPath).toBe('/path/to/search');
    } else {
      fail('Expected isUninstallNotFound to return true');
    }
  });

  it('correctly identifies not-found among all result types', () => {
    const matches = allResults.filter(isUninstallNotFound);
    expect(matches).toHaveLength(1);
    expect(matches[0].searchedPath).toBe('/path/to/search');
  });
});

describe('isUninstallDryRunPreview', () => {
  it('returns true for dry-run-preview result', () => {
    expect(isUninstallDryRunPreview(dryRunResult)).toBe(true);
  });

  it('returns false for success result', () => {
    expect(isUninstallDryRunPreview(successResult)).toBe(false);
  });

  it('returns false for not-found result', () => {
    expect(isUninstallDryRunPreview(notFoundResult)).toBe(false);
  });

  it('narrows type so preview fields are accessible', () => {
    const result: UninstallDetailedItem = dryRunResult;
    if (isUninstallDryRunPreview(result)) {
      expect(result.path).toBe('/path/to/skill');
      expect(result.files).toHaveLength(1);
      expect(result.files[0].relativePath).toBe('SKILL.md');
      expect(result.totalSize).toBe(512);
    } else {
      fail('Expected isUninstallDryRunPreview to return true');
    }
  });

  it('correctly identifies dry-run among all result types', () => {
    const matches = allResults.filter(isUninstallDryRunPreview);
    expect(matches).toHaveLength(1);
    expect(matches[0].totalSize).toBe(512);
  });
});
