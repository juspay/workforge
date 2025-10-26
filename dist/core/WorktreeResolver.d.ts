import { WorktreeInfo } from '../types/index.js';
/**
 * Worktree Resolver
 *
 * Discovers and resolves worktree information from various input patterns:
 * 1. Explicit path
 * 2. Name-based lookup
 * 3. Auto-detect from current directory
 */
export declare class WorktreeResolver {
    /**
     * Resolve worktree from path, name, or auto-detect
     *
     * @param inputPath - Optional explicit path to worktree
     * @param name - Optional worktree name to search for
     * @returns WorktreeInfo
     * @throws Error if worktree cannot be resolved
     */
    resolve(inputPath?: string, name?: string): Promise<WorktreeInfo>;
    /**
     * Get all worktrees for a repository
     *
     * @param repoRoot - Repository root path
     * @returns Array of WorktreeInfo
     */
    getWorktrees(repoRoot: string): Promise<WorktreeInfo[]>;
    /**
     * Find worktree by branch name
     *
     * @param branchName - Branch name to search for (partial match)
     * @returns WorktreeInfo or null if not found
     */
    findByBranchName(branchName: string): Promise<WorktreeInfo | null>;
    /**
     * Check if directory is a worktree
     *
     * @param directory - Directory path to check
     * @returns True if it's a worktree
     */
    isWorktree(directory: string): Promise<boolean>;
    /**
     * Get main repository path from worktree
     *
     * @param worktreePath - Path to worktree
     * @returns Main repository path
     */
    getMainRepo(worktreePath: string): Promise<string>;
    /**
     * Resolve worktree by explicit path
     */
    private resolveByPath;
    /**
     * Resolve worktree by name (search all worktrees)
     */
    private resolveByName;
    /**
     * Auto-detect worktree from current directory
     */
    private autoDetect;
    /**
     * Find repository root by walking up directory tree
     *
     * @param startDir - Starting directory
     * @returns Repository root or null if not found
     */
    private findRepoRoot;
    /**
     * Parse git worktree list --porcelain output
     *
     * Format:
     * worktree /path/to/worktree
     * HEAD abc123def456
     * branch refs/heads/branch-name
     * locked reason (optional)
     *
     * @param output - Output from git worktree list --porcelain
     * @returns Array of WorktreeInfo
     */
    private parseWorktreeList;
    /**
     * Complete partial worktree info with defaults
     */
    private completeWorktreeInfo;
}
//# sourceMappingURL=WorktreeResolver.d.ts.map