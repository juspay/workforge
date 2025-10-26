import { spawnSync } from 'child_process';
import { SafetyCheckResult } from '../types/index.js';

/**
 * Branch Cleaner
 *
 * Handles branch deletion after worktree closure:
 * - Safe delete (git branch -d) for merged branches
 * - Force delete (git branch -D) for unmerged branches
 * - Remote branch warnings
 * - User prompts based on merge status
 */
export class BranchCleaner {
  /**
   * Delete a branch
   *
   * @param branchName - Name of branch to delete
   * @param repoRoot - Repository root path
   * @param safety - Safety check result
   * @param force - Force deletion even if not merged
   * @returns Result object with success status and message
   */
  async cleanup(
    branchName: string,
    repoRoot: string,
    safety: SafetyCheckResult,
    force: boolean = false
  ): Promise<{ success: boolean; message: string; warnings: string[] }> {
    const warnings: string[] = [];

    // Check if branch is main/master
    if (branchName === 'main' || branchName === 'master') {
      return {
        success: false,
        message: 'Cannot delete main/master branch',
        warnings: []
      };
    }

    // Determine delete strategy based on safety checks
    const strategy = this.getDeletionStrategy(safety, force);

    // Add warnings about remote branch
    if (safety.hasRemoteBranch) {
      warnings.push('Branch has a remote tracking branch. Consider deleting it as well.');
    }

    // Add warning about unpushed commits
    if (safety.hasUnpushedCommits) {
      warnings.push('Branch has unpushed commits that will be lost.');
    }

    // Execute deletion
    const args = ['branch'];

    if (strategy === 'force') {
      args.push('-D'); // Force delete
    } else {
      args.push('-d'); // Safe delete
    }

    args.push(branchName);

    const result = spawnSync('git', args, {
      cwd: repoRoot,
      encoding: 'utf8',
      stdio: 'pipe'
    });

    if (result.status === 0) {
      return {
        success: true,
        message: `Branch deleted: ${branchName}`,
        warnings
      };
    }

    // Handle errors
    const errorMessage = result.stderr || result.stdout || 'Unknown error';

    // Check for common error patterns
    if (errorMessage.includes('not fully merged')) {
      return {
        success: false,
        message:
          'Branch is not fully merged. Use --force to delete anyway, or merge the branch first.',
        warnings
      };
    }

    if (errorMessage.includes('not found')) {
      return {
        success: false,
        message: `Branch not found: ${branchName}`,
        warnings
      };
    }

    return {
      success: false,
      message: `Failed to delete branch: ${errorMessage.trim()}`,
      warnings
    };
  }

  /**
   * Delete remote branch
   *
   * @param branchName - Name of branch to delete
   * @param repoRoot - Repository root path
   * @param remoteName - Remote name (default: origin)
   * @returns Result object with success status and message
   */
  async deleteRemote(
    branchName: string,
    repoRoot: string,
    remoteName: string = 'origin'
  ): Promise<{ success: boolean; message: string }> {
    const result = spawnSync('git', ['push', remoteName, '--delete', branchName], {
      cwd: repoRoot,
      encoding: 'utf8',
      stdio: 'pipe'
    });

    if (result.status === 0) {
      return {
        success: true,
        message: `Remote branch deleted: ${remoteName}/${branchName}`
      };
    }

    const errorMessage = result.stderr || result.stdout || 'Unknown error';

    return {
      success: false,
      message: `Failed to delete remote branch: ${errorMessage.trim()}`
    };
  }

  /**
   * Check if branch can be safely deleted
   *
   * @param branchName - Branch name
   * @param repoRoot - Repository root path
   * @returns True if branch is merged and can be safely deleted
   */
  canSafelyDelete(branchName: string, repoRoot: string): boolean {
    // Check against main
    let result = spawnSync('git', ['branch', '--merged', 'main'], {
      cwd: repoRoot,
      encoding: 'utf8',
      stdio: 'pipe'
    });

    if (result.status === 0 && result.stdout.includes(branchName)) {
      return true;
    }

    // Check against master
    result = spawnSync('git', ['branch', '--merged', 'master'], {
      cwd: repoRoot,
      encoding: 'utf8',
      stdio: 'pipe'
    });

    if (result.status === 0 && result.stdout.includes(branchName)) {
      return true;
    }

    return false;
  }

  /**
   * Get deletion strategy based on safety checks
   *
   * @param safety - Safety check result
   * @param force - Force flag from user
   * @returns Deletion strategy
   */
  private getDeletionStrategy(safety: SafetyCheckResult, force: boolean): 'safe' | 'force' {
    // If user explicitly requested force, use force
    if (force) {
      return 'force';
    }

    // If branch is merged, use safe delete
    if (safety.isMerged) {
      return 'safe';
    }

    // If branch is not merged, require force
    return 'force';
  }

  /**
   * Get deletion recommendation
   *
   * @param safety - Safety check result
   * @returns Recommendation object
   */
  getRecommendation(safety: SafetyCheckResult): {
    shouldDelete: boolean;
    requiresForce: boolean;
    message: string;
  } {
    // Branch is merged - safe to delete
    if (safety.isMerged) {
      return {
        shouldDelete: true,
        requiresForce: false,
        message: 'Branch is merged and can be safely deleted.'
      };
    }

    // Branch has unpushed commits - warn user
    if (safety.hasUnpushedCommits) {
      return {
        shouldDelete: false,
        requiresForce: true,
        message: 'Branch has unpushed commits. Consider pushing first, or use --force to delete.'
      };
    }

    // Branch is not merged but has no unpushed commits
    return {
      shouldDelete: false,
      requiresForce: true,
      message: 'Branch is not merged. Consider merging first, or use --force to delete.'
    };
  }

  /**
   * List branches that would be affected
   *
   * @param branchName - Branch name
   * @param repoRoot - Repository root path
   * @returns List of related branches (local and remote)
   */
  getRelatedBranches(branchName: string, repoRoot: string): {
    local: boolean;
    remote: string[];
  } {
    const related = {
      local: false,
      remote: [] as string[]
    };

    // Check local branch
    const localResult = spawnSync('git', ['branch', '--list', branchName], {
      cwd: repoRoot,
      encoding: 'utf8',
      stdio: 'pipe'
    });

    if (localResult.status === 0 && localResult.stdout.trim() !== '') {
      related.local = true;
    }

    // Check remote branches
    const remoteResult = spawnSync('git', ['branch', '-r', '--list', `*/${branchName}`], {
      cwd: repoRoot,
      encoding: 'utf8',
      stdio: 'pipe'
    });

    if (remoteResult.status === 0) {
      const remoteBranches = remoteResult.stdout
        .split('\n')
        .map(line => line.trim())
        .filter(line => line !== '');

      related.remote = remoteBranches;
    }

    return related;
  }
}
