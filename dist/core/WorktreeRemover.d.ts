import { WorktreeInfo } from '../types/index.js';
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
export declare class WorktreeRemover {
    /**
     * Remove a worktree
     *
     * @param worktree - Worktree information
     * @param force - Force removal even if worktree has changes
     * @returns Result object with success status and message
     */
    remove(worktree: WorktreeInfo, force?: boolean): Promise<{
        success: boolean;
        message: string;
    }>;
    /**
     * Prune worktree (when directory is missing)
     *
     * @param worktree - Worktree information
     * @returns Result object with success status and message
     */
    private prune;
    /**
     * Check if worktree can be removed without force
     *
     * @param worktree - Worktree information
     * @returns True if removal is safe without --force
     */
    canRemoveSafely(worktree: WorktreeInfo): boolean;
    /**
     * Get removal strategy for a worktree
     *
     * @param worktree - Worktree information
     * @returns Recommended removal strategy
     */
    getRemovalStrategy(worktree: WorktreeInfo): {
        strategy: 'remove' | 'prune' | 'force-remove';
        reason: string;
    };
    /**
     * Unlock a worktree
     *
     * @param worktree - Worktree information
     * @returns Result object with success status and message
     */
    unlock(worktree: WorktreeInfo): Promise<{
        success: boolean;
        message: string;
    }>;
    /**
     * Lock a worktree
     *
     * @param worktree - Worktree information
     * @param reason - Optional reason for locking
     * @returns Result object with success status and message
     */
    lock(worktree: WorktreeInfo, reason?: string): Promise<{
        success: boolean;
        message: string;
    }>;
}
//# sourceMappingURL=WorktreeRemover.d.ts.map