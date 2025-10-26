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
export declare class BranchCleaner {
    /**
     * Delete a branch
     *
     * @param branchName - Name of branch to delete
     * @param repoRoot - Repository root path
     * @param safety - Safety check result
     * @param force - Force deletion even if not merged
     * @returns Result object with success status and message
     */
    cleanup(branchName: string, repoRoot: string, safety: SafetyCheckResult, force?: boolean): Promise<{
        success: boolean;
        message: string;
        warnings: string[];
    }>;
    /**
     * Delete remote branch
     *
     * @param branchName - Name of branch to delete
     * @param repoRoot - Repository root path
     * @param remoteName - Remote name (default: origin)
     * @returns Result object with success status and message
     */
    deleteRemote(branchName: string, repoRoot: string, remoteName?: string): Promise<{
        success: boolean;
        message: string;
    }>;
    /**
     * Check if branch can be safely deleted
     *
     * @param branchName - Branch name
     * @param repoRoot - Repository root path
     * @returns True if branch is merged and can be safely deleted
     */
    canSafelyDelete(branchName: string, repoRoot: string): boolean;
    /**
     * Get deletion strategy based on safety checks
     *
     * @param safety - Safety check result
     * @param force - Force flag from user
     * @returns Deletion strategy
     */
    private getDeletionStrategy;
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
    };
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
    };
}
//# sourceMappingURL=BranchCleaner.d.ts.map