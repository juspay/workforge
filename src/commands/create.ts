import { execFileSync, spawnSync } from 'child_process';
import { existsSync, copyFileSync, mkdirSync, readFileSync } from 'fs';
import * as path from 'path';
import chalk from 'chalk';
import { WorkspaceConfig, PathConfig, WorktreeInfo, ErrorLike } from '../types/index.js';
import { ConfigManager } from '../core/ConfigManager.js';
import { ProjectIdentifier } from '../core/ProjectIdentifier.js';
import { WorktreeResolver } from '../core/WorktreeResolver.js';
import { toError } from '../utils/errors.js';
import { toKebabCase } from '../utils/strings.js';

/**
 * Create Command
 *
 * Handles workspace (worktree) creation with automatic environment setup,
 * dependency installation, and project metadata tracking.
 */
export class CreateCommand {
  private config: WorkspaceConfig;
  private paths: PathConfig | null = null;
  private configManager: ConfigManager;
  private worktreeResolver: WorktreeResolver;

  constructor(config: WorkspaceConfig) {
    this.config = config;
    this.configManager = new ConfigManager();
    this.worktreeResolver = new WorktreeResolver();

    // Apply defaults from configuration
    const globalConfig = this.configManager.load();
    if (this.config.base === 'main' && globalConfig.preferences.defaultBaseBranch !== 'main') {
      this.config.base = globalConfig.preferences.defaultBaseBranch;
    }
  }

  public async run(): Promise<void> {
    try {
      this.log('info', '🚀 Starting Git workspace creation...');

      await this.validateInputs();
      await this.discoverRepository();
      await this.detectDefaultBranch();
      await this.detectRepositoryType();
      await this.showExistingWorktrees();
      await this.calculatePaths();
      await this.runPreflightChecks();

      if (!this.config.yes) {
        await this.confirmCreation();
      }

      await this.createWorkspace();
      await this.copyEnvironmentFiles();
      await this.installDependencies();
      await this.updateProjectMetadata();

      this.logSuccess();
      process.exit(0);
    } catch (error) {
      this.handleError(toError(error));
      process.exit(1);
    }
  }

  private validateInputs(): void {
    this.log('info', 'Validating inputs...');

    // Validate type - must be letters only, convert to lowercase
    if (!/^[a-zA-Z]+$/.test(this.config.type)) {
      throw new Error(`Invalid type "${this.config.type}". Must contain only letters.`);
    }

    // Normalize type to lowercase
    this.config.type = this.config.type.toLowerCase();

    // Auto-convert name to kebab-case
    const originalName = this.config.name;
    this.config.name = toKebabCase(this.config.name);

    // Inform user if conversion happened
    if (originalName !== this.config.name) {
      this.log('info', `Converted name to kebab-case: ${this.config.name}`);
    }

    // Safety check: ensure conversion produced valid result
    if (!this.config.name || this.config.name.length === 0) {
      throw new Error(`Invalid name: "${originalName}" cannot be converted to valid kebab-case format.`);
    }

    // Additional safety: validate final format
    if (!/^[a-z0-9\-]+$/.test(this.config.name)) {
      throw new Error(`Invalid name: "${originalName}" produced invalid characters after conversion.`);
    }

    this.log('success', '✅ Input validation passed');
  }

  private discoverRepository(): void {
    this.log('info', 'Discovering Git repository root...');

    let currentDir = process.cwd();

    while (currentDir !== path.dirname(currentDir)) {
      const gitPath = path.join(currentDir, '.git');

      if (existsSync(gitPath)) {
        // Check if it's a worktree or main repo
        const isWorktree = existsSync(gitPath) && !existsSync(path.join(gitPath, 'objects'));

        if (isWorktree) {
          // Read .git file to find main repo
          const gitFile = readFileSync(gitPath, 'utf8').trim();
          const match = gitFile.match(/^gitdir: (.+)$/);
          if (match) {
            const gitDir = path.resolve(currentDir, match[1]);
            const mainRepoPath = path.dirname(path.dirname(gitDir));
            if (existsSync(mainRepoPath)) {
              this.paths = { ...this.paths, repoRoot: mainRepoPath } as PathConfig;
              this.log('success', `✅ Found main repository at: ${mainRepoPath}`);
              return;
            }
          }
        } else {
          // This is the main repository
          this.paths = { ...this.paths, repoRoot: currentDir } as PathConfig;
          this.log('success', `✅ Found repository root at: ${currentDir}`);
          return;
        }
      }

      currentDir = path.dirname(currentDir);
    }

    throw new Error('Not inside a Git repository. Please run this command from within a Git repository.');
  }

  private async detectDefaultBranch(): Promise<void> {
    if (!this.paths?.repoRoot) {
      throw new Error('Repository root not found');
    }

    // If user didn't specify a base branch, try to detect the default
    const globalConfig = this.configManager.load();
    if (this.config.base === globalConfig.preferences.defaultBaseBranch) {
      this.log('info', 'Detecting default branch...');

      try {
        // Try to get the default branch from remote
        const result = spawnSync('git', ['symbolic-ref', 'refs/remotes/origin/HEAD'], {
          cwd: this.paths.repoRoot,
          stdio: 'pipe',
          encoding: 'utf8'
        });

        if (result.stdout && result.stdout.trim()) {
          const defaultBranch = result.stdout.trim().replace('refs/remotes/origin/', '');
          this.config.base = defaultBranch;
          this.log('success', `✅ Detected default branch: ${defaultBranch}`);
          return;
        }
      } catch (error) {
        // Ignore error and try next method
      }

      // Fallback: check if main exists, otherwise try common alternatives
      this.log('info', 'Scanning for available branches...');
      const commonBranches = ['main', 'master', 'develop', 'beta'];
      const foundBranches: string[] = [];

      for (const branch of commonBranches) {
        try {
          const result = spawnSync('git', ['show-ref', '--verify', `refs/heads/${branch}`], {
            cwd: this.paths.repoRoot,
            stdio: 'pipe'
          });

          if (result.status === 0) {
            foundBranches.push(branch);
          }
        } catch (error) {
          // Continue to next branch
        }
      }

      if (foundBranches.length > 0) {
        this.config.base = foundBranches[0];
        this.log('success', `✅ Using base branch: ${this.config.base}`);

        if (foundBranches.length > 1) {
          this.log('info', `💡 Other available branches: ${foundBranches.slice(1).join(', ')}`);
          this.log('info', `   Use --base <branch> to choose a different base`);
        }
        return;
      }

      // If no common branch found, get current branch
      try {
        const result = spawnSync('git', ['branch', '--show-current'], {
          cwd: this.paths.repoRoot,
          stdio: 'pipe',
          encoding: 'utf8'
        });

        if (result.stdout && result.stdout.trim()) {
          this.config.base = result.stdout.trim();
          this.log('success', `✅ Using current branch as base: ${this.config.base}`);
          return;
        }
      } catch (error) {
        // Continue with default
      }
    }
  }

  private async detectRepositoryType(): Promise<void> {
    if (!this.paths?.repoRoot) {
      throw new Error('Repository root not found');
    }

    this.log('info', 'Detecting repository type...');

    try {
      // Get remote URL
      const result = spawnSync('git', ['remote', 'get-url', 'origin'], {
        cwd: this.paths.repoRoot,
        stdio: 'pipe',
        encoding: 'utf8'
      });

      if (result.stdout && result.stdout.trim()) {
        const remoteUrl = result.stdout.trim();

        if (remoteUrl.includes('bitbucket.juspay.net')) {
          this.log('success', '✅ Detected internal Bitbucket repository');
          await this.promptForTicketId();
        } else {
          this.log('success', '✅ Detected public repository');
        }
      }
    } catch (error) {
      this.log('info', 'Could not detect repository type, continuing...');
    }
  }

  private async showExistingWorktrees(): Promise<void> {
    if (!this.paths?.repoRoot) {
      return;
    }

    const globalConfig = this.configManager.load();
    if (!globalConfig.preferences.showExistingWorktrees) {
      return;
    }

    try {
      const worktrees = await this.worktreeResolver.getWorktrees(this.paths.repoRoot);

      // Filter out main repo and show only worktrees
      const actualWorktrees = worktrees.filter(w => !w.isMainRepo);

      if (actualWorktrees.length > 0) {
        console.log(chalk.blue('\n📋 Existing worktrees:'));

        for (const wt of actualWorktrees) {
          const age = this.getRelativeTime(wt.path);
          const status = this.getWorktreeStatus(wt);
          console.log(chalk.gray(`  • ${wt.branchName} ${chalk.dim(`(${age})`)} - ${status}`));
        }

        console.log(''); // Empty line
      }
    } catch (error) {
      // Silently ignore errors in showing worktrees
    }
  }

  private getRelativeTime(worktreePath: string): string {
    try {
      const result = spawnSync('git', ['log', '-1', '--format=%cr'], {
        cwd: worktreePath,
        encoding: 'utf8',
        stdio: 'pipe'
      });

      return result.stdout?.trim() || 'unknown';
    } catch {
      return 'unknown';
    }
  }

  private getWorktreeStatus(worktree: WorktreeInfo): string {
    try {
      const result = spawnSync('git', ['status', '--porcelain'], {
        cwd: worktree.path,
        encoding: 'utf8',
        stdio: 'pipe'
      });

      if (!result.stdout || result.stdout.trim() === '') {
        return chalk.green('Clean');
      }

      const lines = result.stdout.trim().split('\n');
      return chalk.yellow(`Modified (${lines.length} files)`);
    } catch {
      return chalk.gray('Unknown');
    }
  }

  /**
   * Get list of all local branches in repository
   * @returns Array of branch names, or empty array if error
   */
  private listAllBranches(): string[] {
    if (!this.paths?.repoRoot) {
      return [];
    }

    try {
      const result = spawnSync('git', ['branch', '--format=%(refname:short)'], {
        cwd: this.paths.repoRoot,
        encoding: 'utf8',
        stdio: 'pipe'
      });

      if (result.stdout) {
        return result.stdout
          .trim()
          .split('\n')
          .map(b => b.trim())
          .filter(b => b.length > 0);
      }
    } catch {
      // Ignore errors, return empty array
    }

    return [];
  }

  private async promptForTicketId(): Promise<void> {
    // If ticket ID already provided via command line, use it
    if (this.config.ticketId) {
      this.log('success', `✅ Using ticket ID: ${this.config.ticketId}`);
      return;
    }

    if (this.config.yes) {
      // In non-interactive mode, skip ticket prompt
      return;
    }

    const inquirer = await import('inquirer');

    const { ticketId } = await inquirer.default.prompt([
      {
        type: 'input',
        name: 'ticketId',
        message: 'Enter Jira ticket ID (optional, format: BZ-12345):',
        validate: (input: string) => {
          if (!input.trim()) {
            return true; // Empty is valid (optional)
          }
          if (!/^[A-Z]+-\d+$/.test(input.trim())) {
            return 'Invalid format. Please use format like BZ-12345';
          }
          return true;
        }
      }
    ]);

    if (ticketId && ticketId.trim()) {
      this.config.ticketId = ticketId.trim();
      this.log('success', `✅ Using ticket ID: ${this.config.ticketId}`);
    }
  }

  private calculatePaths(): void {
    if (!this.paths?.repoRoot) {
      throw new Error('Repository root not found');
    }

    const workspaceParent = path.join(this.paths.repoRoot, '..', this.config.type);
    const workspacePath = path.join(workspaceParent, this.config.name);

    // Create branch name based on ticket ID presence
    const branchName = this.config.ticketId
      ? `${this.config.ticketId}-${this.config.type}-${this.config.name}`
      : `${this.config.type}/${this.config.name}`;

    this.paths = {
      repoRoot: this.paths.repoRoot,
      workspaceParent,
      workspacePath,
      branchName
    };

    this.log('info', `Calculated paths:
  Repository Root: ${this.paths.repoRoot}
  Workspace Parent: ${this.paths.workspaceParent}
  Workspace Path: ${this.paths.workspacePath}
  Branch Name: ${this.paths.branchName}`);
  }

  private async runPreflightChecks(): Promise<void> {
    this.log('info', 'Running pre-flight checks...');

    // Check Git binary
    try {
      execFileSync('git', ['--version'], { stdio: 'pipe' });
    } catch (error) {
      throw new Error('Git binary not found in PATH');
    }

    if (!this.paths) {
      throw new Error('Paths not calculated');
    }

    // Check if branch already exists
    try {
      const result = spawnSync('git', ['branch', '--list', this.paths.branchName], {
        cwd: this.paths.repoRoot,
        stdio: 'pipe',
        encoding: 'utf8'
      });

      if (result.stdout && result.stdout.trim()) {
        throw new Error(`Branch "${this.paths.branchName}" already exists locally`);
      }
    } catch (error) {
      if (error instanceof Error && error.message.includes('already exists')) {
        throw error;
      }
    }

    // Check if remote branch exists
    try {
      const result = spawnSync('git', ['branch', '--list', '--remotes', `*/${this.paths.branchName}`], {
        cwd: this.paths.repoRoot,
        stdio: 'pipe',
        encoding: 'utf8'
      });

      if (result.stdout && result.stdout.trim()) {
        throw new Error(`Branch "${this.paths.branchName}" already exists on remote`);
      }
    } catch (error) {
      if (error instanceof Error && error.message.includes('already exists')) {
        throw error;
      }
    }

    // Check if workspace path already exists
    if (existsSync(this.paths.workspacePath)) {
      throw new Error(`Workspace path already exists: ${this.paths.workspacePath}`);
    }

    this.log('success', '✅ Pre-flight checks passed');
  }

  private async confirmCreation(): Promise<void> {
    if (!this.paths) {
      throw new Error('Paths not calculated');
    }

    const inquirer = await import('inquirer');

    this.log('info', `About to create:
  Branch: ${this.paths.branchName}
  Workspace: ${this.paths.workspacePath}
  Base: ${this.config.base}`);

    const { confirm } = await inquirer.default.prompt([
      {
        type: 'confirm',
        name: 'confirm',
        message: 'Proceed with workspace creation?',
        default: true
      }
    ]);

    if (!confirm) {
      this.log('info', 'Operation cancelled by user');
      process.exit(0);
    }
  }

  private async createWorkspace(): Promise<void> {
    if (!this.paths) {
      throw new Error('Paths not calculated');
    }

    this.log('info', 'Creating Git workspace...');

    // Ensure parent directory exists
    mkdirSync(this.paths.workspaceParent, { recursive: true });

    // Fetch latest changes
    try {
      execFileSync('git', ['fetch', '--prune'], {
        cwd: this.paths.repoRoot,
        stdio: 'pipe'
      });
    } catch (error) {
      this.log('warn', 'Warning: Failed to fetch latest changes');
    }

    // Create worktree with new branch
    try {
      execFileSync('git', [
        'worktree',
        'add',
        '-B',
        this.paths.branchName,
        this.paths.workspacePath,
        this.config.base
      ], {
        cwd: this.paths.repoRoot,
        stdio: 'inherit'
      });
    } catch (error) {
      throw new Error(`Failed to create workspace: ${error}`);
    }

    this.log('success', '✅ Workspace created successfully');
  }

  private async copyEnvironmentFiles(): Promise<void> {
    if (!this.paths) {
      throw new Error('Paths not calculated');
    }

    this.log('info', 'Copying environment files...');

    // In v3.0, only copy .env file
    const envFiles = ['.env'];
    let copiedCount = 0;

    for (const filename of envFiles) {
      const sourcePath = path.join(this.paths.repoRoot, filename);
      const targetPath = path.join(this.paths.workspacePath, filename);

      if (existsSync(sourcePath)) {
        if (!existsSync(targetPath)) {
          try {
            copyFileSync(sourcePath, targetPath);
            this.log('success', `✅ Copied ${filename}`);
            copiedCount++;
          } catch (error) {
            this.log('warn', `⚠️  Failed to copy ${filename}: ${error}`);
          }
        } else {
          this.log('info', `ℹ️  ${filename} already exists in workspace, skipping`);
        }
      }
    }

    if (copiedCount === 0) {
      this.log('info', 'No environment files found to copy');
    }
  }

  private detectPackageManager(): { manager: string; command: string; args: string[] } {
    if (!this.paths) {
      throw new Error('Paths not calculated');
    }

    const globalConfig = this.configManager.load();

    // Check if user has preference
    if (globalConfig.preferences.packageManager !== 'auto') {
      const manager = globalConfig.preferences.packageManager;
      return { manager, command: manager, args: ['install'] };
    }

    // Check for lock files to determine package manager
    const pnpmLock = path.join(this.paths.repoRoot, 'pnpm-lock.yaml');
    const yarnLock = path.join(this.paths.repoRoot, 'yarn.lock');
    const packageLock = path.join(this.paths.repoRoot, 'package-lock.json');

    if (existsSync(pnpmLock)) {
      return { manager: 'pnpm', command: 'pnpm', args: ['install'] };
    } else if (existsSync(yarnLock)) {
      return { manager: 'yarn', command: 'yarn', args: ['install'] };
    } else if (existsSync(packageLock)) {
      return { manager: 'npm', command: 'npm', args: ['install'] };
    } else {
      // Default to pnpm if no lock file found
      return { manager: 'pnpm', command: 'pnpm', args: ['install'] };
    }
  }

  private async installDependencies(): Promise<void> {
    if (!this.paths) {
      throw new Error('Paths not calculated');
    }

    this.log('info', 'Installing dependencies...');

    // Check if package.json exists in the workspace
    const packageJsonPath = path.join(this.paths.workspacePath, 'package.json');
    if (!existsSync(packageJsonPath)) {
      this.log('info', 'No package.json found, skipping dependency installation');
      return;
    }

    // Detect package manager
    const { manager, command, args } = this.detectPackageManager();
    this.log('info', `Detected package manager: ${manager}`);

    try {
      // Run the appropriate install command in the workspace directory
      execFileSync(command, args, {
        cwd: this.paths.workspacePath,
        stdio: 'inherit'
      });

      this.log('success', `✅ Dependencies installed successfully using ${manager}`);
    } catch (error) {
      this.log('warn', `⚠️  Failed to install dependencies with ${manager}: ${error}`);
      this.log('info', `You can manually run "${command} ${args.join(' ')}" in the workspace directory`);
    }
  }

  private async updateProjectMetadata(): Promise<void> {
    if (!this.paths?.repoRoot) {
      return;
    }

    try {
      ProjectIdentifier.updateMetadata(this.paths.repoRoot);
    } catch (error) {
      // Silently ignore metadata update errors
    }
  }

  private logSuccess(): void {
    if (!this.paths) return;

    this.log('success', `
🎉 Workspace created successfully!

📁 Workspace Path: ${this.paths.workspacePath}
🌿 Branch Name: ${this.paths.branchName}
🎯 Base Branch: ${this.config.base}

Next steps:
  cd ${this.paths.workspacePath}
  # Start working on your feature/fix!
`);
  }

  private log(level: 'info' | 'success' | 'warn' | 'error', message: string): void {
    const prefix = {
      info: chalk.blue('ℹ'),
      success: chalk.green('✓'),
      warn: chalk.yellow('⚠'),
      error: chalk.red('✗')
    }[level];

    console.log(`${prefix} ${message}`);
  }

  private handleError(error: ErrorLike): void {
    const message = error.message;
    this.log('error', `Failed to create workspace: ${message}`);
  }
}
