/**
 * Unit tests for update API type guard functions (CHORE-014)
 *
 * Tests the internal type guards (isUpdateSuccess, etc.) used with
 * UpdateResultUnion, and the exported detailed type guards
 * (isDetailedUpdateSuccess, etc.) used with DetailedUpdateResult.
 */

import {
  isUpdateSuccess,
  isUpdateDryRunPreview,
  isUpdateRolledBack,
  isUpdateRollbackFailed,
  isUpdateCancelled,
  isDetailedUpdateSuccess,
  isDetailedUpdateDryRunPreview,
  isDetailedUpdateRolledBack,
  isDetailedUpdateRollbackFailed,
  isDetailedUpdateCancelled,
} from '../../../src/api/update';
import type {
  DetailedUpdateResult,
  DetailedUpdateSuccess,
  DetailedUpdateDryRunPreview,
  DetailedUpdateRolledBack,
  DetailedUpdateRollbackFailed,
  DetailedUpdateCancelled,
} from '../../../src/types/api';
import type { UpdateResultUnion } from '../../../src/types/update';

// --- Test fixtures: UpdateResultUnion (internal) ---

const internalSuccess: UpdateResultUnion = {
  type: 'update-success',
  skillName: 'my-skill',
  path: '/path/to/skill',
  previousFileCount: 2,
  currentFileCount: 3,
  previousSize: 500,
  currentSize: 800,
  backupPath: '/tmp/backup',
  backupWillBeRemoved: true,
};

const internalDryRun: UpdateResultUnion = {
  type: 'update-dry-run-preview',
  skillName: 'my-skill',
  path: '/path/to/skill',
  currentVersion: { path: '/path/to/skill', fileCount: 2, size: 500 },
  newVersion: { path: '/path/to/package', fileCount: 3, size: 800 },
  comparison: {
    filesAdded: [],
    filesRemoved: [],
    filesModified: [],
    addedCount: 1,
    removedCount: 0,
    modifiedCount: 0,
    sizeChange: 300,
  },
  backupPath: '/tmp/backup',
};

const internalRolledBack: UpdateResultUnion = {
  type: 'update-rolled-back',
  skillName: 'my-skill',
  path: '/path/to/skill',
  failureReason: 'validation failed',
  backupPath: '/tmp/backup',
};

const internalRollbackFailed: UpdateResultUnion = {
  type: 'update-rollback-failed',
  skillName: 'my-skill',
  path: '/path/to/skill',
  updateFailureReason: 'extraction failed',
  rollbackFailureReason: 'permission denied',
  backupPath: '/tmp/backup',
  recoveryInstructions: 'Restore from backup manually',
};

const internalCancelled: UpdateResultUnion = {
  type: 'update-cancelled',
  skillName: 'my-skill',
  reason: 'user-cancelled',
  cleanupPerformed: true,
};

const allInternalResults: UpdateResultUnion[] = [
  internalSuccess,
  internalDryRun,
  internalRolledBack,
  internalRollbackFailed,
  internalCancelled,
];

// --- Test fixtures: DetailedUpdateResult (public API) ---

const detailedSuccess: DetailedUpdateSuccess = {
  type: 'update-success',
  skillName: 'my-skill',
  path: '/path/to/skill',
  previousFileCount: 2,
  currentFileCount: 3,
  previousSize: 500,
  currentSize: 800,
  backupPath: '/tmp/backup',
  backupWillBeRemoved: true,
};

const detailedDryRun: DetailedUpdateDryRunPreview = {
  type: 'update-dry-run-preview',
  skillName: 'my-skill',
  path: '/path/to/skill',
  currentVersion: { path: '/path/to/skill', fileCount: 2, size: 500 },
  newVersion: { path: '/path/to/package', fileCount: 3, size: 800 },
  comparison: { filesAdded: [], filesRemoved: [], filesModified: [], sizeChange: 300 },
  backupPath: '/tmp/backup',
};

const detailedRolledBack: DetailedUpdateRolledBack = {
  type: 'update-rolled-back',
  skillName: 'my-skill',
  path: '/path/to/skill',
  failureReason: 'validation failed',
  backupPath: '/tmp/backup',
};

const detailedRollbackFailed: DetailedUpdateRollbackFailed = {
  type: 'update-rollback-failed',
  skillName: 'my-skill',
  path: '/path/to/skill',
  updateFailureReason: 'extraction failed',
  rollbackFailureReason: 'permission denied',
  backupPath: '/tmp/backup',
  recoveryInstructions: 'Restore from backup manually',
};

const detailedCancelled: DetailedUpdateCancelled = {
  type: 'update-cancelled',
  skillName: 'my-skill',
  reason: 'user-cancelled',
  cleanupPerformed: true,
};

const allDetailedResults: DetailedUpdateResult[] = [
  detailedSuccess,
  detailedDryRun,
  detailedRolledBack,
  detailedRollbackFailed,
  detailedCancelled,
];

// --- Tests: Internal type guards (UpdateResultUnion) ---

describe('isUpdateSuccess (internal)', () => {
  it('returns true for update-success result', () => {
    expect(isUpdateSuccess(internalSuccess)).toBe(true);
  });

  it('returns false for all other result types', () => {
    expect(isUpdateSuccess(internalDryRun)).toBe(false);
    expect(isUpdateSuccess(internalRolledBack)).toBe(false);
    expect(isUpdateSuccess(internalRollbackFailed)).toBe(false);
    expect(isUpdateSuccess(internalCancelled)).toBe(false);
  });

  it('correctly identifies success among all result types', () => {
    const matches = allInternalResults.filter(isUpdateSuccess);
    expect(matches).toHaveLength(1);
    expect(matches[0].type).toBe('update-success');
  });
});

describe('isUpdateDryRunPreview (internal)', () => {
  it('returns true for update-dry-run-preview result', () => {
    expect(isUpdateDryRunPreview(internalDryRun)).toBe(true);
  });

  it('returns false for all other result types', () => {
    expect(isUpdateDryRunPreview(internalSuccess)).toBe(false);
    expect(isUpdateDryRunPreview(internalRolledBack)).toBe(false);
    expect(isUpdateDryRunPreview(internalRollbackFailed)).toBe(false);
    expect(isUpdateDryRunPreview(internalCancelled)).toBe(false);
  });

  it('correctly identifies dry-run-preview among all result types', () => {
    const matches = allInternalResults.filter(isUpdateDryRunPreview);
    expect(matches).toHaveLength(1);
    expect(matches[0].type).toBe('update-dry-run-preview');
  });
});

describe('isUpdateRolledBack (internal)', () => {
  it('returns true for update-rolled-back result', () => {
    expect(isUpdateRolledBack(internalRolledBack)).toBe(true);
  });

  it('returns false for all other result types', () => {
    expect(isUpdateRolledBack(internalSuccess)).toBe(false);
    expect(isUpdateRolledBack(internalDryRun)).toBe(false);
    expect(isUpdateRolledBack(internalRollbackFailed)).toBe(false);
    expect(isUpdateRolledBack(internalCancelled)).toBe(false);
  });

  it('correctly identifies rolled-back among all result types', () => {
    const matches = allInternalResults.filter(isUpdateRolledBack);
    expect(matches).toHaveLength(1);
    expect(matches[0].type).toBe('update-rolled-back');
  });
});

describe('isUpdateRollbackFailed (internal)', () => {
  it('returns true for update-rollback-failed result', () => {
    expect(isUpdateRollbackFailed(internalRollbackFailed)).toBe(true);
  });

  it('returns false for all other result types', () => {
    expect(isUpdateRollbackFailed(internalSuccess)).toBe(false);
    expect(isUpdateRollbackFailed(internalDryRun)).toBe(false);
    expect(isUpdateRollbackFailed(internalRolledBack)).toBe(false);
    expect(isUpdateRollbackFailed(internalCancelled)).toBe(false);
  });

  it('correctly identifies rollback-failed among all result types', () => {
    const matches = allInternalResults.filter(isUpdateRollbackFailed);
    expect(matches).toHaveLength(1);
    expect(matches[0].type).toBe('update-rollback-failed');
  });
});

describe('isUpdateCancelled (internal)', () => {
  it('returns true for update-cancelled result', () => {
    expect(isUpdateCancelled(internalCancelled)).toBe(true);
  });

  it('returns false for all other result types', () => {
    expect(isUpdateCancelled(internalSuccess)).toBe(false);
    expect(isUpdateCancelled(internalDryRun)).toBe(false);
    expect(isUpdateCancelled(internalRolledBack)).toBe(false);
    expect(isUpdateCancelled(internalRollbackFailed)).toBe(false);
  });

  it('correctly identifies cancelled among all result types', () => {
    const matches = allInternalResults.filter(isUpdateCancelled);
    expect(matches).toHaveLength(1);
    expect(matches[0].type).toBe('update-cancelled');
  });
});

// --- Tests: Detailed type guards (DetailedUpdateResult) ---

describe('isDetailedUpdateSuccess', () => {
  it('returns true for update-success result', () => {
    expect(isDetailedUpdateSuccess(detailedSuccess)).toBe(true);
  });

  it('returns false for all other result types', () => {
    expect(isDetailedUpdateSuccess(detailedDryRun)).toBe(false);
    expect(isDetailedUpdateSuccess(detailedRolledBack)).toBe(false);
    expect(isDetailedUpdateSuccess(detailedRollbackFailed)).toBe(false);
    expect(isDetailedUpdateSuccess(detailedCancelled)).toBe(false);
  });

  it('narrows type so success fields are accessible', () => {
    const result: DetailedUpdateResult = detailedSuccess;
    if (isDetailedUpdateSuccess(result)) {
      expect(result.previousFileCount).toBe(2);
      expect(result.currentFileCount).toBe(3);
      expect(result.previousSize).toBe(500);
      expect(result.currentSize).toBe(800);
      expect(result.backupWillBeRemoved).toBe(true);
    } else {
      fail('Expected isDetailedUpdateSuccess to return true');
    }
  });

  it('correctly identifies success among all result types', () => {
    const matches = allDetailedResults.filter(isDetailedUpdateSuccess);
    expect(matches).toHaveLength(1);
    expect(matches[0].currentFileCount).toBe(3);
  });
});

describe('isDetailedUpdateDryRunPreview', () => {
  it('returns true for update-dry-run-preview result', () => {
    expect(isDetailedUpdateDryRunPreview(detailedDryRun)).toBe(true);
  });

  it('returns false for all other result types', () => {
    expect(isDetailedUpdateDryRunPreview(detailedSuccess)).toBe(false);
    expect(isDetailedUpdateDryRunPreview(detailedRolledBack)).toBe(false);
    expect(isDetailedUpdateDryRunPreview(detailedRollbackFailed)).toBe(false);
    expect(isDetailedUpdateDryRunPreview(detailedCancelled)).toBe(false);
  });

  it('narrows type so preview fields are accessible', () => {
    const result: DetailedUpdateResult = detailedDryRun;
    if (isDetailedUpdateDryRunPreview(result)) {
      expect(result.currentVersion.fileCount).toBe(2);
      expect(result.newVersion.fileCount).toBe(3);
      expect(result.comparison.sizeChange).toBe(300);
      expect(result.backupPath).toBe('/tmp/backup');
    } else {
      fail('Expected isDetailedUpdateDryRunPreview to return true');
    }
  });

  it('correctly identifies dry-run among all result types', () => {
    const matches = allDetailedResults.filter(isDetailedUpdateDryRunPreview);
    expect(matches).toHaveLength(1);
    expect(matches[0].comparison.sizeChange).toBe(300);
  });
});

describe('isDetailedUpdateRolledBack', () => {
  it('returns true for update-rolled-back result', () => {
    expect(isDetailedUpdateRolledBack(detailedRolledBack)).toBe(true);
  });

  it('returns false for all other result types', () => {
    expect(isDetailedUpdateRolledBack(detailedSuccess)).toBe(false);
    expect(isDetailedUpdateRolledBack(detailedDryRun)).toBe(false);
    expect(isDetailedUpdateRolledBack(detailedRollbackFailed)).toBe(false);
    expect(isDetailedUpdateRolledBack(detailedCancelled)).toBe(false);
  });

  it('narrows type so failure fields are accessible', () => {
    const result: DetailedUpdateResult = detailedRolledBack;
    if (isDetailedUpdateRolledBack(result)) {
      expect(result.failureReason).toBe('validation failed');
      expect(result.backupPath).toBe('/tmp/backup');
    } else {
      fail('Expected isDetailedUpdateRolledBack to return true');
    }
  });

  it('correctly identifies rolled-back among all result types', () => {
    const matches = allDetailedResults.filter(isDetailedUpdateRolledBack);
    expect(matches).toHaveLength(1);
    expect(matches[0].failureReason).toBe('validation failed');
  });
});

describe('isDetailedUpdateRollbackFailed', () => {
  it('returns true for update-rollback-failed result', () => {
    expect(isDetailedUpdateRollbackFailed(detailedRollbackFailed)).toBe(true);
  });

  it('returns false for all other result types', () => {
    expect(isDetailedUpdateRollbackFailed(detailedSuccess)).toBe(false);
    expect(isDetailedUpdateRollbackFailed(detailedDryRun)).toBe(false);
    expect(isDetailedUpdateRollbackFailed(detailedRolledBack)).toBe(false);
    expect(isDetailedUpdateRollbackFailed(detailedCancelled)).toBe(false);
  });

  it('narrows type so critical error fields are accessible', () => {
    const result: DetailedUpdateResult = detailedRollbackFailed;
    if (isDetailedUpdateRollbackFailed(result)) {
      expect(result.updateFailureReason).toBe('extraction failed');
      expect(result.rollbackFailureReason).toBe('permission denied');
      expect(result.recoveryInstructions).toBe('Restore from backup manually');
    } else {
      fail('Expected isDetailedUpdateRollbackFailed to return true');
    }
  });

  it('correctly identifies rollback-failed among all result types', () => {
    const matches = allDetailedResults.filter(isDetailedUpdateRollbackFailed);
    expect(matches).toHaveLength(1);
    expect(matches[0].recoveryInstructions).toBe('Restore from backup manually');
  });
});

describe('isDetailedUpdateCancelled', () => {
  it('returns true for update-cancelled result', () => {
    expect(isDetailedUpdateCancelled(detailedCancelled)).toBe(true);
  });

  it('returns false for all other result types', () => {
    expect(isDetailedUpdateCancelled(detailedSuccess)).toBe(false);
    expect(isDetailedUpdateCancelled(detailedDryRun)).toBe(false);
    expect(isDetailedUpdateCancelled(detailedRolledBack)).toBe(false);
    expect(isDetailedUpdateCancelled(detailedRollbackFailed)).toBe(false);
  });

  it('narrows type so cancellation fields are accessible', () => {
    const result: DetailedUpdateResult = detailedCancelled;
    if (isDetailedUpdateCancelled(result)) {
      expect(result.reason).toBe('user-cancelled');
      expect(result.cleanupPerformed).toBe(true);
    } else {
      fail('Expected isDetailedUpdateCancelled to return true');
    }
  });

  it('correctly identifies cancelled among all result types', () => {
    const matches = allDetailedResults.filter(isDetailedUpdateCancelled);
    expect(matches).toHaveLength(1);
    expect(matches[0].reason).toBe('user-cancelled');
  });
});
