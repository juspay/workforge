import { spawnSync } from 'child_process';
import { existsSync, readdirSync, readFileSync, rmSync } from 'fs';
import * as path from 'path';
import { WorktreeInfo, OperationResult, RemovalStrategy } from '../types/index.js';

/**
 * Worktree Remover
 *
 * Safely removes Git worktrees with proper error handling:
 * - Executes git worktree remove
 * - Handles locked worktrees
 * - Handles missing directories
 * - Handles permission errors
 * - Supports force removal
 */
export class WorktreeRemover {
  /**
   * Remove a worktree
   *
   * @param worktree - Worktree information
   * @param force - Force removal even if worktree has changes
   * @param repoRoot - Repository to run git in; defaults to the process cwd
   * @returns Result object with success status and message
   */
  async remove(
    worktree: WorktreeInfo,
    force: boolean = false,
    repoRoot: string = process.cwd()
  ): Promise<OperationResult> {
    // Check if worktree is locked
    if (worktree.isLocked && !force) {
      return {
        success: false,
        message: 'Worktree is locked. Use --force to remove anyway.'
      };
    }

    // Check if worktree is prunable (directory missing)
    if (worktree.isPrunable) {
      // Use git worktree prune instead
      return this.prune(worktree, repoRoot);
    }

    // Check if directory exists
    const exists = existsSync(worktree.path);

    if (!exists && !force) {
      return {
        success: false,
        message:
          'Worktree directory does not exist. Use git worktree prune to clean up, or use --force.'
      };
    }

    // Build git worktree remove command
    const args = ['worktree', 'remove'];

    if (force) {
      args.push('--force');

      // Git requires `remove -f -f` to override a lock; a single --force only
      // overrides the dirty-working-tree check. Without the second flag a
      // locked worktree could never be removed, and the error told the user to
      // pass the flag they had just passed.
      if (worktree.isLocked) {
        args.push('--force');
      }
    }

    args.push(worktree.path);

    // Execute removal
    const result = spawnSync('git', args, {
      cwd: repoRoot,
      encoding: 'utf8',
      stdio: 'pipe'
    });

    if (result.status === 0) {
      return {
        success: true,
        message: `Worktree removed successfully: ${worktree.path}`
      };
    }

    // Handle errors
    const errorMessage = result.stderr || result.stdout || 'Unknown error';

    // Check for common error patterns
    if (errorMessage.includes('locked')) {
      return {
        success: false,
        message: 'Worktree is locked. Use --force to remove anyway.'
      };
    }

    // Git's actual wording is "contains modified or untracked files, use
    // --force to delete it"; the previous substrings never matched, so users
    // got the raw fatal instead of this guidance.
    if (
      errorMessage.includes('contains modified or untracked files') ||
      errorMessage.includes('uncommitted changes') ||
      errorMessage.includes('modified files')
    ) {
      return {
        success: false,
        message: 'Worktree has uncommitted changes. Commit, stash, or use --force.'
      };
    }

    if (errorMessage.includes('Permission denied')) {
      return {
        success: false,
        message: 'Permission denied. Check file permissions.'
      };
    }

    return {
      success: false,
      message: `Failed to remove worktree: ${errorMessage.trim()}`
    };
  }

  /**
   * Locate the `.git/worktrees/<name>` directory belonging to a worktree path.
   *
   * The directory name is usually the path's basename but git disambiguates
   * collisions, so each candidate's `gitdir` file is read and compared instead
   * of guessing.
   *
   * @param worktreePath - Absolute path of the worktree
   * @param repoRoot - Repository to run git in
   * @returns Absolute path to the administrative directory, or null
   */
  private findAdminDir(worktreePath: string, repoRoot: string): string | null {
    const commonDir = spawnSync(
      'git',
      ['rev-parse', '--path-format=absolute', '--git-common-dir'],
      { cwd: repoRoot, encoding: 'utf8', stdio: 'pipe' }
    );

    if (commonDir.status !== 0 || !commonDir.stdout) {
      return null;
    }

    const worktreesDir = path.join(commonDir.stdout.trim(), 'worktrees');
    if (!existsSync(worktreesDir)) {
      return null;
    }

    const target = path.resolve(worktreePath);

    try {
      for (const entry of readdirSync(worktreesDir)) {
        const gitdirFile = path.join(worktreesDir, entry, 'gitdir');
        if (!existsSync(gitdirFile)) {
          continue;
        }

        // `gitdir` holds the path to the worktree's own .git file.
        const recorded = readFileSync(gitdirFile, 'utf8').trim();
        if (path.resolve(path.dirname(recorded)) === target) {
          return path.join(worktreesDir, entry);
        }
      }
    } catch {
      return null;
    }

    return null;
  }

  /**
   * Prune a single worktree whose directory has gone missing.
   *
   * Scoped deliberately: `git worktree prune` takes no path argument and would
   * discard the administrative data of *every* prunable worktree in the
   * repository, including ones the user never asked about. Removing just this
   * worktree's own directory under `.git/worktrees/` is exactly what prune
   * would do for it, and nothing more.
   *
   * @param worktree - Worktree information
   * @param repoRoot - Repository to run git in
   * @returns Result object with success status and message
   */
  private async prune(worktree: WorktreeInfo, repoRoot: string): Promise<OperationResult> {
    const adminDir = this.findAdminDir(worktree.path, repoRoot);

    if (adminDir) {
      try {
        rmSync(adminDir, { recursive: true, force: true });
        return {
          success: true,
          message: `Worktree pruned successfully: ${worktree.path}`
        };
      } catch (error) {
        return {
          success: false,
          message: `Failed to prune worktree: ${error instanceof Error ? error.message : error}`
        };
      }
    }

    // Administrative directory not found — fall back to git, which is
    // repository-wide but still the correct outcome for this worktree.
    const result = spawnSync('git', ['worktree', 'prune'], {
      cwd: repoRoot,
      encoding: 'utf8',
      stdio: 'pipe'
    });

    if (result.status === 0) {
      return {
        success: true,
        message: `Worktree pruned successfully: ${worktree.path}`
      };
    }

    return {
      success: false,
      message: `Failed to prune worktree: ${result.stderr || result.stdout || 'Unknown error'}`
    };
  }

  /**
   * Check if worktree can be removed without force
   *
   * @param worktree - Worktree information
   * @returns True if removal is safe without --force
   */
  canRemoveSafely(worktree: WorktreeInfo): boolean {
    // Cannot remove locked worktrees without force
    if (worktree.isLocked) {
      return false;
    }

    // Can prune if directory is missing
    if (worktree.isPrunable) {
      return true;
    }

    // Otherwise, check if directory exists
    return existsSync(worktree.path);
  }

  /**
   * Get removal strategy for a worktree
   *
   * @param worktree - Worktree information
   * @returns Recommended removal strategy
   */
  getRemovalStrategy(worktree: WorktreeInfo): RemovalStrategy {
    if (worktree.isPrunable) {
      return {
        strategy: 'prune',
        reason: 'Worktree directory is missing, use git worktree prune'
      };
    }

    if (worktree.isLocked) {
      return {
        strategy: 'force-remove',
        reason: 'Worktree is locked, requires --force'
      };
    }

    if (!existsSync(worktree.path)) {
      return {
        strategy: 'prune',
        reason: 'Worktree directory does not exist'
      };
    }

    return {
      strategy: 'remove',
      reason: 'Normal removal'
    };
  }

  /**
   * Unlock a worktree
   *
   * @param worktree - Worktree information
   * @returns Result object with success status and message
   */
  async unlock(worktree: WorktreeInfo): Promise<OperationResult> {
    if (!worktree.isLocked) {
      return {
        success: true,
        message: 'Worktree is not locked'
      };
    }

    const result = spawnSync('git', ['worktree', 'unlock', worktree.path], {
      encoding: 'utf8',
      stdio: 'pipe'
    });

    if (result.status === 0) {
      return {
        success: true,
        message: 'Worktree unlocked successfully'
      };
    }

    return {
      success: false,
      message: `Failed to unlock worktree: ${result.stderr || result.stdout || 'Unknown error'}`
    };
  }

  /**
   * Lock a worktree
   *
   * @param worktree - Worktree information
   * @param reason - Optional reason for locking
   * @returns Result object with success status and message
   */
  async lock(
    worktree: WorktreeInfo,
    reason?: string
  ): Promise<OperationResult> {
    if (worktree.isLocked) {
      return {
        success: true,
        message: 'Worktree is already locked'
      };
    }

    const args = ['worktree', 'lock'];

    if (reason) {
      args.push('--reason', reason);
    }

    args.push(worktree.path);

    const result = spawnSync('git', args, {
      encoding: 'utf8',
      stdio: 'pipe'
    });

    if (result.status === 0) {
      return {
        success: true,
        message: 'Worktree locked successfully'
      };
    }

    return {
      success: false,
      message: `Failed to lock worktree: ${result.stderr || result.stdout || 'Unknown error'}`
    };
  }
}
