import * as path from 'path';
import { existsSync } from 'fs';
import { WorktreeResolver } from './WorktreeResolver.js';
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
export class SyncTargetResolver {
  private worktreeResolver: WorktreeResolver;

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
  async resolve(options: SyncEnvOptions): Promise<SyncTargets> {
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
  private async resolveBidirectional(between: string): Promise<SyncTargets> {
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
  private async resolveBoth(from: string, to: string): Promise<SyncTargets> {
    // Resolve source (try worktree first, fall back to direct path)
    const source = await this.resolvePathFlexibly(from);

    if (!existsSync(source.envPath)) {
      throw new Error(`Source environment file not found: ${source.envPath}`);
    }

    // Resolve target (try worktree first, fall back to direct path)
    const target = await this.resolvePathFlexibly(to);

    if (!existsSync(target.envPath)) {
      throw new Error(`Target environment file not found: ${target.envPath}`);
    }

    return {
      sourceLabel: source.label,
      targetLabel: target.label,
      sourcePath: source.envPath,
      targetPath: target.envPath
    };
  }

  /**
   * Resolve --from only (target is current location)
   *
   * @param from - Source worktree name/path
   * @returns SyncTargets
   */
  private async resolveFromOnly(from: string): Promise<SyncTargets> {
    // Resolve source (try worktree first, fall back to direct path)
    const source = await this.resolvePathFlexibly(from);

    if (!existsSync(source.envPath)) {
      throw new Error(`Source environment file not found: ${source.envPath}`);
    }

    // Get current location as target
    try {
      const currentWorktree = await this.worktreeResolver.resolve();
      // Use the current worktree path directly, not the main repo
      const targetEnvPath = path.join(currentWorktree.path, '.env');

      if (!existsSync(targetEnvPath)) {
        throw new Error(`Target environment file not found: ${targetEnvPath}`);
      }

      return {
        sourceLabel: source.label,
        targetLabel: currentWorktree.isMainRepo
          ? `Main (${path.basename(currentWorktree.path)})`
          : `Worktree (${currentWorktree.branchName})`,
        sourcePath: source.envPath,
        targetPath: targetEnvPath
      };
    } catch (error) {
      // If we can't detect current location, use current directory
      const cwd = process.cwd();
      const targetEnvPath = path.join(cwd, '.env');

      if (!existsSync(targetEnvPath)) {
        throw new Error(`Target environment file not found: ${targetEnvPath}`);
      }

      return {
        sourceLabel: source.label,
        targetLabel: `Current (${path.basename(cwd)})`,
        sourcePath: source.envPath,
        targetPath: targetEnvPath
      };
    }
  }

  /**
   * Resolve --to only (source is current location)
   *
   * @param to - Target worktree name/path
   * @returns SyncTargets
   */
  private async resolveToOnly(to: string): Promise<SyncTargets> {
    // Resolve target (try worktree first, fall back to direct path)
    const target = await this.resolvePathFlexibly(to);

    if (!existsSync(target.envPath)) {
      throw new Error(`Target environment file not found: ${target.envPath}`);
    }

    // Get current location as source (use current worktree/repo, not main repo)
    try {
      const currentWorktree = await this.worktreeResolver.resolve();
      // Use the current worktree path directly, not the main repo
      const sourceEnvPath = path.join(currentWorktree.path, '.env');

      if (!existsSync(sourceEnvPath)) {
        throw new Error(`Source environment file not found: ${sourceEnvPath}`);
      }

      return {
        sourceLabel: currentWorktree.isMainRepo
          ? `Main (${path.basename(currentWorktree.path)})`
          : `Worktree (${currentWorktree.branchName})`,
        targetLabel: target.label,
        sourcePath: sourceEnvPath,
        targetPath: target.envPath
      };
    } catch (error) {
      // If we can't detect current location, use current directory
      const cwd = process.cwd();
      const sourceEnvPath = path.join(cwd, '.env');

      if (!existsSync(sourceEnvPath)) {
        throw new Error(`Source environment file not found: ${sourceEnvPath}`);
      }

      return {
        sourceLabel: `Current (${path.basename(cwd)})`,
        targetLabel: target.label,
        sourcePath: sourceEnvPath,
        targetPath: target.envPath
      };
    }
  }

  /**
   * Auto-detect from current directory
   *
   * If in worktree: sync from main to worktree
   * If in main repo: error (need to specify target)
   *
   * @returns SyncTargets
   */
  private async autoDetect(): Promise<SyncTargets> {
    // Try to detect current worktree
    const worktree = await this.worktreeResolver.resolve();

    // If we're in main repo, we need explicit target
    if (worktree.isMainRepo) {
      throw new Error(
        'Cannot auto-detect sync target from main repository. Use --to to specify target worktree.'
      );
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
   * Flexibly resolve a path - try as worktree first, then as direct path
   *
   * @param input - Path or worktree name
   * @returns Object with label and envPath
   */
  private async resolvePathFlexibly(input: string): Promise<{ label: string; envPath: string; repoPath: string }> {
    try {
      // Try to resolve as worktree first
      const worktree = await this.worktreeResolver.resolve(input);
      return {
        label: worktree.isMainRepo
          ? `Main (${path.basename(worktree.path)})`
          : `Worktree (${worktree.branchName})`,
        envPath: path.join(worktree.path, '.env'),
        repoPath: worktree.path
      };
    } catch (error) {
      // If worktree resolution fails, treat as direct path
      const absolutePath = path.resolve(input);

      if (!existsSync(absolutePath)) {
        throw new Error(`Path not found: ${absolutePath}`);
      }

      // Check if it's a git repository
      const gitPath = path.join(absolutePath, '.git');
      const isRepo = existsSync(gitPath);

      return {
        label: isRepo ? `Repository (${path.basename(absolutePath)})` : `Path (${path.basename(absolutePath)})`,
        envPath: path.join(absolutePath, '.env'),
        repoPath: absolutePath
      };
    }
  }

  /**
   * Validate sync targets
   *
   * Ensures source and target are different
   *
   * @param targets - Sync targets to validate
   * @returns Validation result
   */
  validate(targets: SyncTargets): { valid: boolean; error?: string } {
    // Normalize paths for comparison (resolve symlinks, relative paths, etc.)
    const normalizedSource = path.resolve(targets.sourcePath);
    const normalizedTarget = path.resolve(targets.targetPath);

    // Check if source and target are the same
    if (normalizedSource === normalizedTarget) {
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
  swap(targets: SyncTargets): SyncTargets {
    return {
      sourceLabel: targets.targetLabel,
      targetLabel: targets.sourceLabel,
      sourcePath: targets.targetPath,
      targetPath: targets.sourcePath
    };
  }
}
