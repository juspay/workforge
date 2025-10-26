import { spawnSync } from 'child_process';
import { existsSync, readFileSync } from 'fs';
import * as path from 'path';
import { WorktreeInfo } from '../types/index.js';

/**
 * Worktree Resolver
 *
 * Discovers and resolves worktree information from various input patterns:
 * 1. Explicit path
 * 2. Name-based lookup
 * 3. Auto-detect from current directory
 */
export class WorktreeResolver {
  /**
   * Resolve worktree from path, name, or auto-detect
   *
   * @param inputPath - Optional explicit path to worktree
   * @param name - Optional worktree name to search for
   * @returns WorktreeInfo
   * @throws Error if worktree cannot be resolved
   */
  async resolve(inputPath?: string, name?: string): Promise<WorktreeInfo> {
    // Pattern 1: Explicit path provided
    if (inputPath) {
      return this.resolveByPath(inputPath);
    }

    // Pattern 2: Name-based lookup
    if (name) {
      return this.resolveByName(name);
    }

    // Pattern 3: Auto-detect from current directory
    return this.autoDetect();
  }

  /**
   * Get all worktrees for a repository
   *
   * @param repoRoot - Repository root path
   * @returns Array of WorktreeInfo
   */
  async getWorktrees(repoRoot: string): Promise<WorktreeInfo[]> {
    const result = spawnSync('git', ['worktree', 'list', '--porcelain'], {
      cwd: repoRoot,
      encoding: 'utf8',
      stdio: 'pipe'
    });

    if (result.status !== 0) {
      throw new Error('Failed to list worktrees');
    }

    return this.parseWorktreeList(result.stdout);
  }

  /**
   * Find worktree by branch name
   *
   * @param branchName - Branch name to search for (partial match)
   * @returns WorktreeInfo or null if not found
   */
  async findByBranchName(branchName: string): Promise<WorktreeInfo | null> {
    // Find repo root from current directory
    const repoRoot = await this.findRepoRoot(process.cwd());
    if (!repoRoot) {
      throw new Error('Not inside a Git repository');
    }

    const worktrees = await this.getWorktrees(repoRoot);

    // Find worktree with matching branch
    for (const worktree of worktrees) {
      if (worktree.branchName.includes(branchName)) {
        return worktree;
      }
    }

    return null;
  }

  /**
   * Check if directory is a worktree
   *
   * @param directory - Directory path to check
   * @returns True if it's a worktree
   */
  async isWorktree(directory: string): Promise<boolean> {
    const gitPath = path.join(directory, '.git');

    if (!existsSync(gitPath)) {
      return false;
    }

    try {
      // Read .git file
      const gitFile = readFileSync(gitPath, 'utf8').trim();

      // Worktrees have .git file pointing to gitdir
      // Main repos have .git directory
      return gitFile.startsWith('gitdir:');
    } catch {
      return false;
    }
  }

  /**
   * Get main repository path from worktree
   *
   * @param worktreePath - Path to worktree
   * @returns Main repository path
   */
  async getMainRepo(worktreePath: string): Promise<string> {
    const gitPath = path.join(worktreePath, '.git');

    if (!existsSync(gitPath)) {
      throw new Error('Not a Git repository or worktree');
    }

    // Read .git file
    const gitFile = readFileSync(gitPath, 'utf8').trim();

    if (gitFile.startsWith('gitdir:')) {
      // This is a worktree
      // .git file contains: gitdir: /path/to/main/repo/.git/worktrees/name
      const match = gitFile.match(/^gitdir: (.+)$/);
      if (match) {
        const gitDir = path.resolve(worktreePath, match[1]);
        // Navigate up: .git/worktrees/name -> .git -> main repo
        const mainRepoGitDir = path.dirname(path.dirname(gitDir));
        const mainRepoPath = path.dirname(mainRepoGitDir);

        if (existsSync(mainRepoPath)) {
          return mainRepoPath;
        }
      }
    }

    // This is the main repository
    return worktreePath;
  }

  /**
   * Resolve worktree by explicit path
   */
  private async resolveByPath(inputPath: string): Promise<WorktreeInfo> {
    const absolutePath = path.resolve(inputPath);

    if (!existsSync(absolutePath)) {
      throw new Error(`Worktree not found at path: ${absolutePath}`);
    }

    // Check if it's a worktree or main repo
    const isWorktree = await this.isWorktree(absolutePath);
    const mainRepo = await this.getMainRepo(absolutePath);

    // Get all worktrees to find this one
    const worktrees = await this.getWorktrees(mainRepo);

    // Find matching worktree
    const matching = worktrees.find(w => w.path === absolutePath);

    if (!matching) {
      throw new Error(`Could not find worktree information for: ${absolutePath}`);
    }

    return matching;
  }

  /**
   * Resolve worktree by name (search all worktrees)
   */
  private async resolveByName(name: string): Promise<WorktreeInfo> {
    // Find repo root
    const repoRoot = await this.findRepoRoot(process.cwd());
    if (!repoRoot) {
      throw new Error('Not inside a Git repository');
    }

    // Get all worktrees
    const worktrees = await this.getWorktrees(repoRoot);

    // Search for matching branch name
    const matches = worktrees.filter(w =>
      w.branchName.includes(name) || w.path.includes(name)
    );

    if (matches.length === 0) {
      throw new Error(`No worktree found with name: ${name}`);
    }

    if (matches.length > 1) {
      const branchNames = matches.map(w => w.branchName).join(', ');
      throw new Error(
        `Multiple worktrees match "${name}": ${branchNames}. Please be more specific.`
      );
    }

    return matches[0];
  }

  /**
   * Auto-detect worktree from current directory
   */
  private async autoDetect(): Promise<WorktreeInfo> {
    const cwd = process.cwd();

    // Check if current directory is a worktree
    const isWorktree = await this.isWorktree(cwd);

    if (!isWorktree) {
      // Check if we're inside a worktree directory
      const repoRoot = await this.findRepoRoot(cwd);
      if (!repoRoot) {
        throw new Error('Not inside a Git repository or worktree');
      }

      // If repo root is current directory, it's the main repo
      if (repoRoot === cwd) {
        throw new Error('Current directory is the main repository, not a worktree');
      }

      // We're inside a worktree, resolve it
      return this.resolveByPath(repoRoot);
    }

    // Current directory is a worktree
    return this.resolveByPath(cwd);
  }

  /**
   * Find repository root by walking up directory tree
   *
   * @param startDir - Starting directory
   * @returns Repository root or null if not found
   */
  private async findRepoRoot(startDir: string): Promise<string | null> {
    let currentDir = startDir;

    while (currentDir !== path.dirname(currentDir)) {
      const gitPath = path.join(currentDir, '.git');

      if (existsSync(gitPath)) {
        return currentDir;
      }

      currentDir = path.dirname(currentDir);
    }

    return null;
  }

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
  private parseWorktreeList(output: string): WorktreeInfo[] {
    const worktrees: WorktreeInfo[] = [];
    const lines = output.split('\n').map(l => l.trim()).filter(l => l !== '');

    let current: Partial<WorktreeInfo> = {};

    for (const line of lines) {
      if (line.startsWith('worktree ')) {
        // Start of new worktree entry
        if (current.path) {
          // Save previous entry
          worktrees.push(this.completeWorktreeInfo(current));
        }

        current = {
          path: line.substring('worktree '.length),
          isLocked: false,
          isPrunable: false
        };
      } else if (line.startsWith('HEAD ')) {
        current.commitHash = line.substring('HEAD '.length);
      } else if (line.startsWith('branch ')) {
        const branchRef = line.substring('branch '.length);
        // Convert refs/heads/branch-name to branch-name
        current.branchName = branchRef.replace('refs/heads/', '');
      } else if (line.startsWith('bare')) {
        // Bare repository (main repo)
        current.isMainRepo = true;
      } else if (line.startsWith('locked')) {
        current.isLocked = true;
      } else if (line.startsWith('prunable')) {
        current.isPrunable = true;
      }
    }

    // Save last entry
    if (current.path) {
      worktrees.push(this.completeWorktreeInfo(current));
    }

    return worktrees;
  }

  /**
   * Complete partial worktree info with defaults
   */
  private completeWorktreeInfo(partial: Partial<WorktreeInfo>): WorktreeInfo {
    return {
      path: partial.path || '',
      branchName: partial.branchName || 'HEAD',
      isMainRepo: partial.isMainRepo || false,
      commitHash: partial.commitHash || '',
      remoteUrl: partial.remoteUrl,
      isLocked: partial.isLocked || false,
      isPrunable: partial.isPrunable || false
    };
  }
}
