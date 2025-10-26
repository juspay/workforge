import { WorktreeInfo } from '../types/index.js';
import { Logger } from './Logger.js';
/**
 * List Display
 *
 * Displays worktree information in various formats:
 * - Table format (default)
 * - JSON format (for scripting)
 * - Simple format (compact)
 */
export declare class ListDisplay {
    private logger;
    constructor(logger?: Logger);
    /**
     * Display worktrees in specified format
     *
     * @param worktrees - Array of worktree information
     * @param format - Display format
     * @param sortBy - Sort field
     */
    show(worktrees: WorktreeInfo[], format?: 'table' | 'json' | 'simple', sortBy?: 'name' | 'path' | 'age'): void;
    /**
     * Display worktrees in table format
     */
    private showTable;
    /**
     * Display worktrees in JSON format
     */
    private showJSON;
    /**
     * Display worktrees in simple format
     */
    private showSimple;
    /**
     * Display detailed worktree information
     */
    showDetailed(worktree: WorktreeInfo): void;
    /**
     * Display worktree count summary
     */
    showSummary(totalCount: number, mainRepoCount: number, worktreeCount: number): void;
    /**
     * Get status badge for worktree
     */
    private getStatusBadge;
    /**
     * Sort worktrees
     */
    private sortWorktrees;
    /**
     * Truncate path for display
     */
    private truncatePath;
    /**
     * Truncate string for display
     */
    private truncate;
}
//# sourceMappingURL=ListDisplay.d.ts.map