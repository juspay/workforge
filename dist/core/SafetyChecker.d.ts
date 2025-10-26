import { WorktreeInfo, SafetyCheckResult } from '../types/index.js';
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
export declare class SafetyChecker {
    /**
     * Perform all safety checks on a worktree
     *
     * @param worktree - Worktree information
     * @returns Safety check result with warnings
     */
    check(worktree: WorktreeInfo): Promise<SafetyCheckResult>;
    /**
     * Check for uncommitted changes
     *
     * @param worktreePath - Path to worktree
     * @returns True if there are uncommitted changes
     */
    private checkUncommittedChanges;
    /**
     * Check for unpushed commits
     *
     * @param worktreePath - Path to worktree
     * @param branchName - Branch name
     * @returns True if there are unpushed commits
     */
    private checkUnpushedCommits;
    /**
     * Check if branch is merged into main/master
     *
     * @param worktreePath - Path to worktree
     * @param branchName - Branch name
     * @returns True if branch is merged
     */
    private checkBranchMerged;
    /**
     * Check if remote branch exists
     *
     * @param worktreePath - Path to worktree
     * @param branchName - Branch name
     * @returns True if remote branch exists
     */
    private checkRemoteBranch;
    /**
     * Check for merge in progress
     *
     * @param worktreePath - Path to worktree
     * @returns True if merge is in progress
     */
    private checkMergeInProgress;
    /**
     * Check for rebase in progress
     *
     * @param worktreePath - Path to worktree
     * @returns True if rebase is in progress
     */
    private checkRebaseInProgress;
    /**
     * Get detailed status message for safety check
     *
     * @param result - Safety check result
     * @returns Human-readable status message
     */
    getStatusMessage(result: SafetyCheckResult): string;
    /**
     * Check if force close is needed
     *
     * @param result - Safety check result
     * @returns True if force close is required
     */
    needsForceClose(result: SafetyCheckResult): boolean;
    /**
     * Get count of blocking issues
     *
     * @param result - Safety check result
     * @returns Number of blocking issues
     */
    getBlockingIssueCount(result: SafetyCheckResult): number;
    /**
     * Get count of warning issues (non-blocking)
     *
     * @param result - Safety check result
     * @returns Number of warning issues
     */
    getWarningIssueCount(result: SafetyCheckResult): number;
}
//# sourceMappingURL=SafetyChecker.d.ts.map