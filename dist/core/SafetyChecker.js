import { spawnSync } from 'child_process';
import { existsSync } from 'fs';
import * as path from 'path';
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
    async check(worktree) {
        const result = {
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
            // Check for remote branch
            result.hasRemoteBranch = this.checkRemoteBranch(worktree.path, worktree.branchName);
            // Check for unpushed commits
            if (result.hasRemoteBranch) {
                result.hasUnpushedCommits = this.checkUnpushedCommits(worktree.path, worktree.branchName);
                if (result.hasUnpushedCommits) {
                    result.warnings.push('Branch has unpushed commits');
                }
                // Check if branch is merged
                result.isMerged = this.checkBranchMerged(worktree.path, worktree.branchName);
                if (!result.isMerged) {
                    result.warnings.push('Branch has not been merged into main/master');
                }
            }
            else {
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
    checkUncommittedChanges(worktreePath) {
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
     * Check for unpushed commits
     *
     * @param worktreePath - Path to worktree
     * @param branchName - Branch name
     * @returns True if there are unpushed commits
     */
    checkUnpushedCommits(worktreePath, branchName) {
        // Get commits ahead of remote
        const result = spawnSync('git', ['rev-list', '--count', `origin/${branchName}..${branchName}`], {
            cwd: worktreePath,
            encoding: 'utf8',
            stdio: 'pipe'
        });
        if (result.status !== 0) {
            // Assume no unpushed commits if command fails
            return false;
        }
        const count = parseInt(result.stdout.trim(), 10);
        return count > 0;
    }
    /**
     * Check if branch is merged into main/master
     *
     * @param worktreePath - Path to worktree
     * @param branchName - Branch name
     * @returns True if branch is merged
     */
    checkBranchMerged(worktreePath, branchName) {
        // Check against main first
        let result = spawnSync('git', ['branch', '--merged', 'main'], {
            cwd: worktreePath,
            encoding: 'utf8',
            stdio: 'pipe'
        });
        if (result.status === 0) {
            const mergedBranches = result.stdout;
            if (mergedBranches.includes(branchName)) {
                return true;
            }
        }
        // Check against master as fallback
        result = spawnSync('git', ['branch', '--merged', 'master'], {
            cwd: worktreePath,
            encoding: 'utf8',
            stdio: 'pipe'
        });
        if (result.status === 0) {
            const mergedBranches = result.stdout;
            if (mergedBranches.includes(branchName)) {
                return true;
            }
        }
        return false;
    }
    /**
     * Check if remote branch exists
     *
     * @param worktreePath - Path to worktree
     * @param branchName - Branch name
     * @returns True if remote branch exists
     */
    checkRemoteBranch(worktreePath, branchName) {
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
    checkMergeInProgress(worktreePath) {
        const mergeHeadPath = path.join(worktreePath, '.git', 'MERGE_HEAD');
        return existsSync(mergeHeadPath);
    }
    /**
     * Check for rebase in progress
     *
     * @param worktreePath - Path to worktree
     * @returns True if rebase is in progress
     */
    checkRebaseInProgress(worktreePath) {
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
    getStatusMessage(result) {
        if (result.canClose && result.warnings.length === 0) {
            return 'Worktree is safe to close. No issues detected.';
        }
        const messages = [];
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
    needsForceClose(result) {
        return !result.canClose;
    }
    /**
     * Get count of blocking issues
     *
     * @param result - Safety check result
     * @returns Number of blocking issues
     */
    getBlockingIssueCount(result) {
        let count = 0;
        if (result.hasUncommittedChanges)
            count++;
        if (result.isMergeInProgress)
            count++;
        if (result.isRebaseInProgress)
            count++;
        return count;
    }
    /**
     * Get count of warning issues (non-blocking)
     *
     * @param result - Safety check result
     * @returns Number of warning issues
     */
    getWarningIssueCount(result) {
        let count = 0;
        if (result.hasUnpushedCommits)
            count++;
        if (!result.isMerged && !result.isDetachedHead)
            count++;
        if (!result.hasRemoteBranch && !result.isDetachedHead)
            count++;
        if (result.isDetachedHead)
            count++;
        return count;
    }
}
//# sourceMappingURL=SafetyChecker.js.map