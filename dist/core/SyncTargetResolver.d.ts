import { SyncTargets, SyncEnvOptions } from '../types/index.js';
/**
 * Sync Target Resolver
 *
 * Resolves source and target for environment sync operations:
 * - Pattern 1: --from and --to (explicit source and target)
 * - Pattern 2: --from only (to = main repo)
 * - Pattern 3: --to only (from = main repo)
 * - Pattern 4: --between (bidirectional, let user choose direction)
 * - Auto-detection: Detect from current directory if no flags
 */
export declare class SyncTargetResolver {
    private worktreeResolver;
    constructor();
    /**
     * Resolve sync targets from options
     *
     * @param options - Sync-env command options
     * @returns SyncTargets with source and target information
     * @throws Error if targets cannot be resolved or .env files don't exist
     */
    resolve(options: SyncEnvOptions): Promise<SyncTargets>;
    /**
     * Resolve bidirectional sync
     *
     * @param between - Worktree name/path for bidirectional sync
     * @returns SyncTargets (source and target will be swappable)
     */
    private resolveBidirectional;
    /**
     * Resolve both --from and --to
     *
     * @param from - Source worktree name/path
     * @param to - Target worktree name/path
     * @returns SyncTargets
     */
    private resolveBoth;
    /**
     * Resolve --from only (target is main repo)
     *
     * @param from - Source worktree name/path
     * @returns SyncTargets
     */
    private resolveFromOnly;
    /**
     * Resolve --to only (source is main repo)
     *
     * @param to - Target worktree name/path
     * @returns SyncTargets
     */
    private resolveToOnly;
    /**
     * Auto-detect from current directory
     *
     * If in worktree: sync from main to worktree
     * If in main repo: error (need to specify target)
     *
     * @returns SyncTargets
     */
    private autoDetect;
    /**
     * Validate sync targets
     *
     * Ensures source and target are different
     *
     * @param targets - Sync targets to validate
     * @returns Validation result
     */
    validate(targets: SyncTargets): {
        valid: boolean;
        error?: string;
    };
    /**
     * Swap source and target (for bidirectional sync direction change)
     *
     * @param targets - Original targets
     * @returns Swapped targets
     */
    swap(targets: SyncTargets): SyncTargets;
}
//# sourceMappingURL=SyncTargetResolver.d.ts.map