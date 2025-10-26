import * as path from 'path';
import { existsSync } from 'fs';
import { WorktreeResolver } from './WorktreeResolver.js';
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
export class SyncTargetResolver {
    worktreeResolver;
    constructor() {
        this.worktreeResolver = new WorktreeResolver();
    }
    /**
     * Resolve sync targets from options
     *
     * @param options - Sync-env command options
     * @returns SyncTargets with source and target information
     * @throws Error if targets cannot be resolved or .env files don't exist
     */
    async resolve(options) {
        // Pattern 4: Bidirectional sync (--between)
        if (options.between) {
            return this.resolveBidirectional(options.between);
        }
        // Pattern 1: Both --from and --to
        if (options.from && options.to) {
            return this.resolveBoth(options.from, options.to);
        }
        // Pattern 2: Only --from (target is main repo)
        if (options.from && !options.to) {
            return this.resolveFromOnly(options.from);
        }
        // Pattern 3: Only --to (source is main repo)
        if (!options.from && options.to) {
            return this.resolveToOnly(options.to);
        }
        // Auto-detection: Detect from current directory
        return this.autoDetect();
    }
    /**
     * Resolve bidirectional sync
     *
     * @param between - Worktree name/path for bidirectional sync
     * @returns SyncTargets (source and target will be swappable)
     */
    async resolveBidirectional(between) {
        // Resolve the worktree
        const worktree = await this.worktreeResolver.resolve(between);
        // Get main repository
        const mainRepo = await this.worktreeResolver.getMainRepo(worktree.path);
        // Build paths
        const worktreeEnvPath = path.join(worktree.path, '.env');
        const mainEnvPath = path.join(mainRepo, '.env');
        // Validate files exist
        if (!existsSync(worktreeEnvPath)) {
            throw new Error(`Environment file not found: ${worktreeEnvPath}`);
        }
        if (!existsSync(mainEnvPath)) {
            throw new Error(`Environment file not found: ${mainEnvPath}`);
        }
        // Return targets (direction will be chosen interactively)
        return {
            sourceLabel: `Main (${path.basename(mainRepo)})`,
            targetLabel: `Worktree (${worktree.branchName})`,
            sourcePath: mainEnvPath,
            targetPath: worktreeEnvPath
        };
    }
    /**
     * Resolve both --from and --to
     *
     * @param from - Source worktree name/path
     * @param to - Target worktree name/path
     * @returns SyncTargets
     */
    async resolveBoth(from, to) {
        // Resolve source
        const sourceWorktree = await this.worktreeResolver.resolve(from);
        const sourceEnvPath = path.join(sourceWorktree.path, '.env');
        if (!existsSync(sourceEnvPath)) {
            throw new Error(`Source environment file not found: ${sourceEnvPath}`);
        }
        // Resolve target
        const targetWorktree = await this.worktreeResolver.resolve(to);
        const targetEnvPath = path.join(targetWorktree.path, '.env');
        if (!existsSync(targetEnvPath)) {
            throw new Error(`Target environment file not found: ${targetEnvPath}`);
        }
        return {
            sourceLabel: sourceWorktree.isMainRepo
                ? `Main (${path.basename(sourceWorktree.path)})`
                : `Worktree (${sourceWorktree.branchName})`,
            targetLabel: targetWorktree.isMainRepo
                ? `Main (${path.basename(targetWorktree.path)})`
                : `Worktree (${targetWorktree.branchName})`,
            sourcePath: sourceEnvPath,
            targetPath: targetEnvPath
        };
    }
    /**
     * Resolve --from only (target is main repo)
     *
     * @param from - Source worktree name/path
     * @returns SyncTargets
     */
    async resolveFromOnly(from) {
        // Resolve source worktree
        const sourceWorktree = await this.worktreeResolver.resolve(from);
        const sourceEnvPath = path.join(sourceWorktree.path, '.env');
        if (!existsSync(sourceEnvPath)) {
            throw new Error(`Source environment file not found: ${sourceEnvPath}`);
        }
        // Get main repository as target
        const mainRepo = await this.worktreeResolver.getMainRepo(sourceWorktree.path);
        const targetEnvPath = path.join(mainRepo, '.env');
        if (!existsSync(targetEnvPath)) {
            throw new Error(`Target environment file not found: ${targetEnvPath}`);
        }
        return {
            sourceLabel: `Worktree (${sourceWorktree.branchName})`,
            targetLabel: `Main (${path.basename(mainRepo)})`,
            sourcePath: sourceEnvPath,
            targetPath: targetEnvPath
        };
    }
    /**
     * Resolve --to only (source is main repo)
     *
     * @param to - Target worktree name/path
     * @returns SyncTargets
     */
    async resolveToOnly(to) {
        // Resolve target worktree
        const targetWorktree = await this.worktreeResolver.resolve(to);
        const targetEnvPath = path.join(targetWorktree.path, '.env');
        if (!existsSync(targetEnvPath)) {
            throw new Error(`Target environment file not found: ${targetEnvPath}`);
        }
        // Get main repository as source
        const mainRepo = await this.worktreeResolver.getMainRepo(targetWorktree.path);
        const sourceEnvPath = path.join(mainRepo, '.env');
        if (!existsSync(sourceEnvPath)) {
            throw new Error(`Source environment file not found: ${sourceEnvPath}`);
        }
        return {
            sourceLabel: `Main (${path.basename(mainRepo)})`,
            targetLabel: `Worktree (${targetWorktree.branchName})`,
            sourcePath: sourceEnvPath,
            targetPath: targetEnvPath
        };
    }
    /**
     * Auto-detect from current directory
     *
     * If in worktree: sync from main to worktree
     * If in main repo: error (need to specify target)
     *
     * @returns SyncTargets
     */
    async autoDetect() {
        // Try to detect current worktree
        const worktree = await this.worktreeResolver.resolve();
        // If we're in main repo, we need explicit target
        if (worktree.isMainRepo) {
            throw new Error('Cannot auto-detect sync target from main repository. Use --to to specify target worktree.');
        }
        // We're in a worktree - sync from main to current worktree
        const mainRepo = await this.worktreeResolver.getMainRepo(worktree.path);
        const sourceEnvPath = path.join(mainRepo, '.env');
        const targetEnvPath = path.join(worktree.path, '.env');
        // Validate files exist
        if (!existsSync(sourceEnvPath)) {
            throw new Error(`Source environment file not found: ${sourceEnvPath}`);
        }
        if (!existsSync(targetEnvPath)) {
            throw new Error(`Target environment file not found: ${targetEnvPath}`);
        }
        return {
            sourceLabel: `Main (${path.basename(mainRepo)})`,
            targetLabel: `Worktree (${worktree.branchName})`,
            sourcePath: sourceEnvPath,
            targetPath: targetEnvPath
        };
    }
    /**
     * Validate sync targets
     *
     * Ensures source and target are different
     *
     * @param targets - Sync targets to validate
     * @returns Validation result
     */
    validate(targets) {
        // Check if source and target are the same
        if (targets.sourcePath === targets.targetPath) {
            return {
                valid: false,
                error: 'Source and target cannot be the same'
            };
        }
        // Check if files exist
        if (!existsSync(targets.sourcePath)) {
            return {
                valid: false,
                error: `Source file not found: ${targets.sourcePath}`
            };
        }
        if (!existsSync(targets.targetPath)) {
            return {
                valid: false,
                error: `Target file not found: ${targets.targetPath}`
            };
        }
        return { valid: true };
    }
    /**
     * Swap source and target (for bidirectional sync direction change)
     *
     * @param targets - Original targets
     * @returns Swapped targets
     */
    swap(targets) {
        return {
            sourceLabel: targets.targetLabel,
            targetLabel: targets.sourceLabel,
            sourcePath: targets.targetPath,
            targetPath: targets.sourcePath
        };
    }
}
//# sourceMappingURL=SyncTargetResolver.js.map