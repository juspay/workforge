import { spawnSync } from 'child_process';
import { existsSync } from 'fs';
import * as path from 'path';
import { WorktreeInfo, SafetyCheckResult } from '../types/index.js';
import { BranchResolver } from './BranchResolver.js';

/**
 * Safety Checker
 *
 * Performs comprehensive safety checks before closing a worktree:
 * - Uncommitted changes (staged and unstaged)
 * - Unpushed commits
 * - Branch merge status
 * - Remote branch existence
 * - Detached HEAD
 * - Merge/rebase in progress
 */
export class SafetyChecker {
  /**
   * Perform all safety checks on a worktree
   *
   * @param worktree - Worktree information
   * @returns Safety check result with warnings
   */
  async check(worktree: WorktreeInfo): Promise<SafetyCheckResult> {
    const result: SafetyCheckResult = {
      hasUncommittedChanges: false,
      hasUnpushedCommits: false,
      isMerged: false,
      hasRemoteBranch: false,
      isDetachedHead: false,
      isMergeInProgress: false,
      isRebaseInProgress: false,
      warnings: [],
      canClose: true
    };

    // Check if worktree exists
    if (!existsSync(worktree.path)) {
      result.warnings.push('Worktree directory does not exist');
      result.canClose = false;
      return result;
    }

    // Check for detached HEAD
    if (worktree.branchName === 'HEAD' || !worktree.branchName) {
      result.isDetachedHead = true;
      result.warnings.push('Worktree is in detached HEAD state');
    }

    // Check for uncommitted changes
    result.hasUncommittedChanges = this.checkUncommittedChanges(worktree.path);
    if (result.hasUncommittedChanges) {
      result.warnings.push('Worktree has uncommitted changes');
      result.canClose = false;
    }

    // Check for merge in progress
    result.isMergeInProgress = this.checkMergeInProgress(worktree.path);
    if (result.isMergeInProgress) {
      result.warnings.push('Merge is in progress');
      result.canClose = false;
    }

    // Check for rebase in progress
    result.isRebaseInProgress = this.checkRebaseInProgress(worktree.path);
    if (result.isRebaseInProgress) {
      result.warnings.push('Rebase is in progress');
      result.canClose = false;
    }

    // Only check remote status if we have a proper branch
    if (!result.isDetachedHead && worktree.branchName) {
      // Refresh remote-tracking refs first. Every check below compares against
      // `origin/*`, and in a worktree workflow those refs are routinely stale —
      // which would report an already-merged branch as unmerged.
      const resolver = new BranchResolver(worktree.path);
      const remote = resolver.getRemoteName();
      if (remote) {
        resolver.fetch(remote);
      }

      // Check for remote branch
      result.hasRemoteBranch = this.checkRemoteBranch(worktree.path, worktree.branchName);

      // Check for unpushed commits
      if (result.hasRemoteBranch) {
        const unpushed = this.checkUnpushedCommits(worktree.path, worktree.branchName);
        result.hasUnpushedCommits = unpushed.hasUnpushed;
        if (unpushed.hasUnpushed) {
          result.warnings.push(
            unpushed.determined
              ? 'Branch has unpushed commits'
              : 'Could not determine whether the branch has unpushed commits — assuming it does'
          );
        }

        // Check if branch is merged into the repository's primary branch
        const merge = this.checkBranchMerged(worktree, worktree.branchName, resolver, remote);
        result.isMerged = merge.isMerged;
        if (!merge.isMerged) {
          result.warnings.push(
            merge.baseBranch
              ? `Branch has not been merged into ${merge.baseBranch}`
              : 'Could not determine the primary branch to check merge status against'
          );
        }
      } else {
        result.warnings.push('Branch does not have a remote tracking branch');
      }
    }

    return result;
  }

  /**
   * Check for uncommitted changes
   *
   * @param worktreePath - Path to worktree
   * @returns True if there are uncommitted changes
   */
  private checkUncommittedChanges(worktreePath: string): boolean {
    const result = spawnSync('git', ['status', '--porcelain'], {
      cwd: worktreePath,
      encoding: 'utf8',
      stdio: 'pipe'
    });

    if (result.status !== 0) {
      return false;
    }

    // If output is not empty, there are uncommitted changes
    return result.stdout.trim() !== '';
  }

  /**
   * Check for unpushed commits.
   *
   * The comparison needs `refs/remotes/origin/<branch>` locally. A repository
   * that has never fetched that branch cannot answer the question, and
   * reporting "nothing unpushed" there would silently green-light discarding
   * commits — so an indeterminate result is reported as unpushed instead.
   *
   * @param worktreePath - Path to worktree
   * @param branchName - Branch name
   */
  private checkUnpushedCommits(
    worktreePath: string,
    branchName: string
  ): { hasUnpushed: boolean; determined: boolean } {
    const count = (): number | null => {
      const result = spawnSync(
        'git',
        ['rev-list', '--count', `origin/${branchName}..${branchName}`],
        { cwd: worktreePath, encoding: 'utf8', stdio: 'pipe' }
      );

      if (result.status !== 0) {
        return null;
      }

      const parsed = parseInt(result.stdout.trim(), 10);
      return Number.isNaN(parsed) ? null : parsed;
    };

    let ahead = count();

    if (ahead === null) {
      // The remote-tracking ref is missing locally. Fetch just this branch and
      // retry before giving up.
      spawnSync('git', ['fetch', 'origin', branchName], {
        cwd: worktreePath,
        encoding: 'utf8',
        stdio: 'pipe',
        timeout: 20_000
      });
      ahead = count();
    }

    if (ahead === null) {
      return { hasUnpushed: true, determined: false };
    }

    return { hasUnpushed: ahead > 0, determined: true };
  }

  /**
   * Check whether the branch is merged into the repository's primary branch.
   *
   * Compares against the remote-tracking ref (`origin/<primary>`) rather than
   * the local branch: in a worktree-based workflow the local primary branch is
   * rarely pulled, so it is usually behind and would report merged branches as
   * unmerged.
   *
   * @param worktree - Worktree information
   * @param branchName - Branch name
   */
  private checkBranchMerged(
    worktree: WorktreeInfo,
    branchName: string,
    resolver: BranchResolver,
    remote: string | null
  ): { isMerged: boolean; baseBranch: string | null } {
    const primary = resolver.detectPrimaryBranch(remote);

    if (!primary) {
      return { isMerged: false, baseBranch: null };
    }

    // Prefer the remote tip; fall back to the local branch when there is no
    // remote counterpart.
    const startPoint = resolver.resolveStartPoint(primary.branch, remote);
    const base = startPoint.startPoint;

    if (!base) {
      return { isMerged: false, baseBranch: primary.branch };
    }

    // `--merged <base>` lists branches whose tip is an ancestor of <base>.
    const result = spawnSync('git', ['branch', '--merged', base, '--format=%(refname:short)'], {
      cwd: worktree.path,
      encoding: 'utf8',
      stdio: 'pipe'
    });

    if (result.status !== 0) {
      return { isMerged: false, baseBranch: base };
    }

    const merged = result.stdout
      .split('\n')
      .map(line => line.trim().replace(/^\*\s*/, ''))
      .filter(line => line.length > 0);

    return { isMerged: merged.includes(branchName), baseBranch: base };
  }

  /**
   * Check if remote branch exists
   *
   * @param worktreePath - Path to worktree
   * @param branchName - Branch name
   * @returns True if remote branch exists
   */
  private checkRemoteBranch(worktreePath: string, branchName: string): boolean {
    const result = spawnSync('git', ['ls-remote', '--heads', 'origin', branchName], {
      cwd: worktreePath,
      encoding: 'utf8',
      stdio: 'pipe'
    });

    if (result.status !== 0) {
      return false;
    }

    return result.stdout.trim() !== '';
  }

  /**
   * Check for merge in progress
   *
   * @param worktreePath - Path to worktree
   * @returns True if merge is in progress
   */
  private checkMergeInProgress(worktreePath: string): boolean {
    const mergeHeadPath = path.join(worktreePath, '.git', 'MERGE_HEAD');
    return existsSync(mergeHeadPath);
  }

  /**
   * Check for rebase in progress
   *
   * @param worktreePath - Path to worktree
   * @returns True if rebase is in progress
   */
  private checkRebaseInProgress(worktreePath: string): boolean {
    const rebaseMergePath = path.join(worktreePath, '.git', 'rebase-merge');
    const rebaseApplyPath = path.join(worktreePath, '.git', 'rebase-apply');

    return existsSync(rebaseMergePath) || existsSync(rebaseApplyPath);
  }

  /**
   * Get detailed status message for safety check
   *
   * @param result - Safety check result
   * @returns Human-readable status message
   */
  getStatusMessage(result: SafetyCheckResult): string {
    if (result.canClose && result.warnings.length === 0) {
      return 'Worktree is safe to close. No issues detected.';
    }

    const messages: string[] = [];

    if (result.hasUncommittedChanges) {
      messages.push('⚠️  Uncommitted changes detected. Commit or stash your changes first.');
    }

    if (result.isMergeInProgress) {
      messages.push('⚠️  Merge in progress. Complete or abort the merge first.');
    }

    if (result.isRebaseInProgress) {
      messages.push('⚠️  Rebase in progress. Complete or abort the rebase first.');
    }

    if (result.hasUnpushedCommits) {
      messages.push('ℹ️  Branch has unpushed commits. Consider pushing before closing.');
    }

    if (!result.isMerged && !result.isDetachedHead) {
      messages.push('ℹ️  Branch has not been merged. Consider merging before closing.');
    }

    if (result.isDetachedHead) {
      messages.push('⚠️  Worktree is in detached HEAD state.');
    }

    if (!result.hasRemoteBranch && !result.isDetachedHead) {
      messages.push('ℹ️  Branch does not have a remote tracking branch.');
    }

    return messages.join('\n');
  }

  /**
   * Check if force close is needed
   *
   * @param result - Safety check result
   * @returns True if force close is required
   */
  needsForceClose(result: SafetyCheckResult): boolean {
    return !result.canClose;
  }

  /**
   * Get count of blocking issues
   *
   * @param result - Safety check result
   * @returns Number of blocking issues
   */
  getBlockingIssueCount(result: SafetyCheckResult): number {
    let count = 0;

    if (result.hasUncommittedChanges) count++;
    if (result.isMergeInProgress) count++;
    if (result.isRebaseInProgress) count++;

    return count;
  }

  /**
   * Get count of warning issues (non-blocking)
   *
   * @param result - Safety check result
   * @returns Number of warning issues
   */
  getWarningIssueCount(result: SafetyCheckResult): number {
    let count = 0;

    if (result.hasUnpushedCommits) count++;
    if (!result.isMerged && !result.isDetachedHead) count++;
    if (!result.hasRemoteBranch && !result.isDetachedHead) count++;
    if (result.isDetachedHead) count++;

    return count;
  }
}
