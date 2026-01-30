/**
 * Git Utils Tests
 */

import { describe, expect, it } from 'vitest';
import { isGitRepo } from './git-utils.js';

describe('git-utils', () => {
  describe('isGitRepo', () => {
    it('returns true for a git repository', async () => {
      // The claimcheck directory itself is a git repo
      const result = await isGitRepo(process.cwd());
      expect(result).toBe(true);
    });

    it('returns false for a non-git directory', async () => {
      const result = await isGitRepo('/tmp');
      expect(result).toBe(false);
    });
  });

  // Note: More comprehensive tests would require setting up test fixtures
  // with actual git repositories
  describe('getStagedFiles', () => {
    it.todo('returns staged files');
  });

  describe('getCommitFiles', () => {
    it.todo('returns files changed in a commit');
  });

  describe('getAllChangedFiles', () => {
    it.todo('returns all changed files');
  });
});
