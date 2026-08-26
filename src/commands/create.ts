import { execFileSync, spawnSync } from 'child_process';
import { existsSync, copyFileSync, mkdirSync, readFileSync } from 'fs';
import * as path from 'path';
import chalk from 'chalk';
import { WorkspaceConfig, PathConfig, WorktreeInfo, ErrorLike, BranchStartPoint } from '../types/index.js';
import { ConfigManager } from '../core/ConfigManager.js';
import { ProjectIdentifier } from '../core/ProjectIdentifier.js';
import { WorktreeResolver } from '../core/WorktreeResolver.js';
import { BranchResolver } from '../core/BranchResolver.js';
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

  /** True when the user passed --base explicitly; suppresses auto-detection. */
  private readonly baseWasExplicit: boolean;

  private branchResolver: BranchResolver | null = null;
  private remote: string | null = null;
  private startPoint: BranchStartPoint | null = null;

  /** Non-fatal problems collected during the run, surfaced in the summary. */
  private warnings: string[] = [];

  constructor(config: WorkspaceConfig) {
    this.config = config;
    this.configManager = new ConfigManager();
    this.worktreeResolver = new WorktreeResolver();
    this.baseWasExplicit = typeof config.base === 'string' && config.base.length > 0;
  }

  public async run(): Promise<void> {
    try {
      this.log('info', '🚀 Starting Git workspace creation...');

      await this.validateInputs();
      await this.discoverRepository();
      await this.syncWithRemote();
      await this.resolveBaseBranch();
      await this.detectRepositoryType();
      await this.showExistingWorktrees();
      await this.calculatePaths();
      await this.runPreflightChecks();

      if (!this.config.yes) {
        await this.confirmCreation();
      }

      await this.createWorkspace();

      // Post-creation steps are independent: the worktree already exists, so a
      // failure in any one of them must not abandon the rest.
      await this.runIndependently('Copy environment files', () => this.copyEnvironmentFiles());
      await this.runIndependently('Install dependencies', () => this.installDependencies());
      await this.runIndependently('Update project metadata', () => this.updateProjectMetadata());

      this.logSuccess();

      if (this.config.switchTo) {
        this.switchToWorkspace();
      }

      process.exit(0);
    } catch (error) {
      this.handleError(toError(error));
      process.exit(1);
    }
  }

  /**
   * Run a post-creation step, recording rather than propagating its failure.
   */
  private async runIndependently(label: string, step: () => Promise<void>): Promise<void> {
    try {
      await step();
    } catch (error) {
      const message = toError(error).message;
      this.warnings.push(`${label} failed: ${message}`);
      this.log('warn', `⚠️  ${label} failed: ${message}`);
      this.log('info', '   Continuing with the remaining steps...');
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

    // `git worktree list` always reports the main worktree first, so it answers
    // "which directory is the main repository" correctly whether we are run
    // from the main repo, from a linked worktree, or from a nested subdirectory.
    const listed = spawnSync('git', ['worktree', 'list', '--porcelain'], {
      cwd: process.cwd(),
      stdio: 'pipe',
      encoding: 'utf8'
    });

    if (listed.status === 0 && listed.stdout) {
      const match = listed.stdout.match(/^worktree (.+)$/m);
      if (match) {
        const mainRepoPath = path.resolve(match[1].trim());
        if (existsSync(mainRepoPath)) {
          const isCurrent = path.resolve(process.cwd()) === mainRepoPath;
          this.paths = { ...this.paths, repoRoot: mainRepoPath } as PathConfig;
          this.log(
            'success',
            isCurrent
              ? `✅ Found repository root at: ${mainRepoPath}`
              : `✅ Found main repository at: ${mainRepoPath}`
          );
          return;
        }
      }
    }

    // Fallback for git versions or states where `worktree list` is unavailable.
    let currentDir = process.cwd();

    while (currentDir !== path.dirname(currentDir)) {
      const gitPath = path.join(currentDir, '.git');

      if (existsSync(gitPath)) {
        // Check if it's a worktree or main repo
        const isWorktree = !existsSync(path.join(gitPath, 'objects'));

        if (isWorktree) {
          // Read .git file to find main repo. It contains
          // `gitdir: <main>/.git/worktrees/<name>`, so the main repository is
          // three levels up: <name> -> worktrees -> .git -> <main>
          const gitFile = readFileSync(gitPath, 'utf8').trim();
          const match = gitFile.match(/^gitdir: (.+)$/);
          if (match) {
            const gitDir = path.resolve(currentDir, match[1]);
            const mainRepoPath = path.dirname(path.dirname(path.dirname(gitDir)));
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

  /**
   * Refresh remote-tracking refs before anything reads them.
   *
   * This runs *before* base-branch detection and pre-flight checks so every
   * later decision is made against the current state of the remote rather than
   * whatever the local clone last saw.
   */
  private syncWithRemote(): void {
    if (!this.paths?.repoRoot) {
      throw new Error('Repository root not found');
    }

    this.branchResolver = new BranchResolver(this.paths.repoRoot);
    this.remote = this.branchResolver.getRemoteName();

    if (!this.remote) {
      this.log('warn', '⚠️  No Git remote configured — falling back to local branches');
      this.warnings.push('No Git remote configured; the worktree was based on a local branch');
      return;
    }

    this.log('info', `Fetching latest refs from "${this.remote}"...`);
    const result = this.branchResolver.fetch(this.remote);

    if (result.ok) {
      this.log('success', `✅ Fetched latest refs from "${this.remote}"`);
      // `fetch` never updates <remote>/HEAD, so a repository cloned before the
      // remote renamed its default branch would keep resolving to the retired
      // one. Refresh it now, while the network is known to be reachable.
      this.branchResolver.refreshRemoteHead(this.remote);
      return;
    }

    this.log('warn', `⚠️  Failed to fetch from "${this.remote}": ${result.error}`);
    this.log('info', '   Continuing with the refs already available locally (they may be stale)');
    this.warnings.push(`Could not fetch from "${this.remote}"; remote refs may be stale`);
  }

  /**
   * Determine which branch to fork from, and which revision that branch is at.
   *
   * Precedence:
   *   1. --base passed explicitly
   *   2. auto-detected primary branch (unless disabled in config)
   *   3. preferences.defaultBaseBranch
   */
  private resolveBaseBranch(): void {
    if (!this.paths?.repoRoot || !this.branchResolver) {
      throw new Error('Repository root not found');
    }

    const globalConfig = this.configManager.load();

    if (this.baseWasExplicit) {
      this.log('info', `Using base branch from --base: ${this.config.base}`);
    } else if (globalConfig.preferences.autoDetectBaseBranch) {
      this.log('info', 'Detecting primary branch...');
      const detected = this.branchResolver.detectPrimaryBranch(this.remote);

      if (detected) {
        this.config.base = detected.branch;
        this.log('success', `✅ Detected primary branch: ${detected.branch} (via ${detected.source})`);
      } else {
        this.config.base = globalConfig.preferences.defaultBaseBranch;
        this.log('warn', `⚠️  Could not detect primary branch, using configured default: ${this.config.base}`);
      }
    } else {
      this.config.base = globalConfig.preferences.defaultBaseBranch;
      this.log('info', `Auto-detection disabled, using configured default: ${this.config.base}`);
    }

    const base = this.config.base;
    if (!base) {
      throw new Error('Could not determine a base branch. Use --base <branch> to specify one.');
    }

    this.startPoint = this.branchResolver.resolveStartPoint(base, this.remote);
    this.config.base = this.startPoint.base;

    if (this.startPoint.source === 'missing') {
      throw new Error(this.formatMissingBaseError(this.startPoint.base));
    }

    if (this.startPoint.source === 'local' && this.startPoint.isStale) {
      this.log('warn', `⚠️  "${base}" has no counterpart on "${this.remote}" — branching from the local branch`);
      this.warnings.push(`Base "${base}" only exists locally; the worktree may not reflect the remote`);
    }

    if (this.startPoint.source === 'committish') {
      this.log('info', `Base "${base}" is not a branch — treating it as a commit-ish`);
    }

    const startPoint = this.startPoint.startPoint;
    const commit = startPoint ? this.branchResolver.describeCommit(startPoint) : null;
    this.log(
      'success',
      `✅ Branching from ${startPoint}${commit ? ` (${commit})` : ''}`
    );
  }

  /**
   * Build an actionable error listing every branch the user could have meant.
   */
  private formatMissingBaseError(base: string): string {
    const local = this.branchResolver?.listLocalBranches() ?? [];
    const remoteBranches =
      this.remote && this.branchResolver ? this.branchResolver.listRemoteBranches(this.remote) : [];

    const lines = [`Base branch "${base}" not found locally or on the remote.`];

    if (remoteBranches.length > 0) {
      lines.push(`  Remote branches (${this.remote}): ${remoteBranches.join(', ')}`);
    }
    if (local.length > 0) {
      lines.push(`  Local branches: ${local.join(', ')}`);
    }
    lines.push('  Use --base <branch> to specify a different base.');

    return lines.join('\n');
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

    // Folder name includes ticket ID if present
    const folderName = this.config.ticketId
      ? `${this.config.ticketId}-${this.config.name}`
      : this.config.name;

    const workspacePath = path.join(workspaceParent, folderName);

    // Branch name always uses type/ prefix, with ticket ID after type
    const branchName = this.config.ticketId
      ? `${this.config.type}/${this.config.ticketId}-${this.config.name}`
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

    if (!this.branchResolver || !this.startPoint?.startPoint) {
      throw new Error('Base branch not resolved');
    }

    // The base branch was already resolved against the remote in
    // resolveBaseBranch(); re-verify the start point still points at a commit.
    this.log('info', 'Validating base branch...');
    if (!this.branchResolver.describeCommit(this.startPoint.startPoint)) {
      throw new Error(this.formatMissingBaseError(this.startPoint.base));
    }
    this.log('success', `✅ Base "${this.startPoint.startPoint}" is valid`);

    // Check if branch already exists locally
    if (this.branchResolver.localBranchExists(this.paths.branchName)) {
      throw new Error(
        `Branch "${this.paths.branchName}" already exists locally.\n` +
        `  Check it out directly, or choose a different --name.`
      );
    }

    // Check if branch already exists on the remote (refs are fresh: we fetched
    // before pre-flight, so this reflects the remote's current state)
    if (this.remote && this.branchResolver.remoteBranchExists(this.remote, this.paths.branchName)) {
      throw new Error(
        `Branch "${this.paths.branchName}" already exists on "${this.remote}".\n` +
        `  Run: git worktree add ${this.paths.workspacePath} ${this.paths.branchName}\n` +
        `  Or choose a different --name.`
      );
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
  Base: ${this.config.base}
  Forking from: ${this.startPoint?.startPoint}`);

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

    const startPoint = this.startPoint?.startPoint;
    if (!startPoint) {
      throw new Error('Base branch not resolved');
    }

    this.log('info', 'Creating Git workspace...');

    // Ensure parent directory exists
    mkdirSync(this.paths.workspaceParent, { recursive: true });

    // Branch from the resolved start point. When the base exists on the remote
    // this is `<remote>/<base>`, so the worktree starts at the remote tip
    // instead of a possibly-stale local branch.
    //
    // --no-track: the new branch is a feature branch, not a continuation of the
    // base, so it must not inherit `<remote>/<base>` as its upstream.
    try {
      execFileSync('git', [
        'worktree',
        'add',
        '-b',
        this.paths.branchName,
        '--no-track',
        this.paths.workspacePath,
        startPoint
      ], {
        cwd: this.paths.repoRoot,
        stdio: 'inherit'
      });
    } catch (error) {
      throw new Error(`Failed to create workspace: ${toError(error).message}`);
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
      return;
    }

    await this.runRepoSetupScript(manager, command, packageJsonPath);
  }

  /**
   * Runs the repo's own `setup` script when package.json declares one.
   *
   * Installing dependencies is not always enough to make a fresh worktree
   * runnable. Some repos require a one-time bootstrap afterwards, and a worktree
   * that skipped it fails in ways that do not name the missing step: in
   * juspay/lighthouse the Playwright mock suite aborts with
   * `Cannot find package '$models'`, which reads as a broken module alias rather
   * than an incomplete setup. Reproduced on a fresh worktree — 2 errors and 0
   * tests before running it, 0 errors and the suite running after — with the
   * synced .env byte-identical either way, so the env sync is not what closes
   * the gap.
   *
   * Deliberately conventional rather than configurable: `setup` is the name the
   * ecosystem already uses, and a repo without that script is unaffected.
   * Failures warn and continue, exactly like the install step above — a
   * bootstrap that does not apply to this checkout should not fail workspace
   * creation. Skippable with WORKFORGE_SKIP_SETUP=1 for a repo whose `setup`
   * is interactive or does something you do not want on every worktree.
   */
  private async runRepoSetupScript(
    manager: string,
    command: string,
    packageJsonPath: string
  ): Promise<void> {
    if (!this.paths) {
      return;
    }

    if (process.env.WORKFORGE_SKIP_SETUP === '1') {
      this.log('info', 'WORKFORGE_SKIP_SETUP=1 — skipping the repo setup script');
      return;
    }

    let hasSetupScript = false;
    try {
      const manifest = JSON.parse(readFileSync(packageJsonPath, 'utf8')) as {
        scripts?: Record<string, string>;
      };
      hasSetupScript = typeof manifest.scripts?.setup === 'string';
    } catch {
      // an unreadable/!JSON manifest is the install step's problem, not ours
      return;
    }

    if (!hasSetupScript) {
      return;
    }

    this.log('info', `Running the repo's setup script (${manager} run setup)...`);
    try {
      execFileSync(command, ['run', 'setup'], {
        cwd: this.paths.workspacePath,
        stdio: 'inherit'
      });
      this.log('success', '✅ Repo setup script completed');
    } catch (error) {
      this.log('warn', `⚠️  Repo setup script failed: ${error}`);
      this.log(
        'info',
        `The workspace is still usable — run "${command} run setup" yourself if something is missing.`
      );
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

  /**
   * Opens an interactive shell inside the new worktree.
   *
   * This is a SUBSHELL, and the distinction matters enough to say twice: a
   * process cannot change its parent shell's working directory, so no CLI flag
   * can genuinely `cd` you anywhere. What this does is spawn $SHELL with its cwd
   * set to the new worktree and hand over the terminal; `exit` unwinds back to
   * wherever you invoked workforge from. Someone expecting a real cd will read
   * that unwind as the feature failing, so the banner below says so plainly.
   *
   * The alternative — printing a path for a shell function to consume, e.g.
   *   wf() { cd "$(workforge create "$@" --print-path)"; }
   * — is the only way to move the parent shell, and it requires the user to
   * install that function. This flag is for the common case where a subshell is
   * good enough.
   *
   * Skipped without a TTY: in CI or a piped invocation an interactive shell has
   * nothing to read from and would hang the run rather than fail it.
   */
  private switchToWorkspace(): void {
    if (!this.paths) {
      return;
    }

    if (!process.stdin.isTTY || !process.stdout.isTTY) {
      this.log('info', '--switch ignored: not an interactive terminal.');
      this.log('info', `  cd ${this.paths.workspacePath}`);
      return;
    }

    const shell =
      process.platform === 'win32'
        ? process.env.ComSpec || 'cmd.exe'
        : process.env.SHELL || '/bin/sh';

    console.log(
      chalk.cyan(
        `\n↪ Opening a subshell in ${this.paths.workspacePath}\n` +
          `  Type 'exit' to return to ${process.cwd()}\n`
      )
    );

    try {
      const result = spawnSync(shell, [], {
        cwd: this.paths.workspacePath,
        stdio: 'inherit',
        env: {
          ...process.env,
          // Lets a prompt or rc file notice it is inside a workforge subshell —
          // useful for showing the worktree name without guessing from the path.
          WORKFORGE_WORKSPACE: this.paths.workspacePath,
          WORKFORGE_BRANCH: this.paths.branchName
        }
      });

      if (result.error) {
        throw result.error;
      }
    } catch (error) {
      this.log('warn', `⚠️  Could not open a shell in the workspace: ${toError(error).message}`);
      this.log('info', `  cd ${this.paths.workspacePath}`);
    }
  }

  private logSuccess(): void {
    if (!this.paths) return;

    const startPoint = this.startPoint?.startPoint ?? this.config.base;
    const commit = this.startPoint?.startPoint
      ? this.branchResolver?.describeCommit(this.startPoint.startPoint)
      : null;

    this.log('success', `
🎉 Workspace created successfully!

📁 Workspace Path: ${this.paths.workspacePath}
🌿 Branch Name: ${this.paths.branchName}
🎯 Base Branch: ${this.config.base}
📌 Forked From: ${startPoint}${commit ? ` (${commit})` : ''}

Next steps:
  cd ${this.paths.workspacePath}
  # Start working on your feature/fix!${
    this.config.switchTo ? '' : '\n  # (or pass --switch next time to land there directly)'
  }
`);

    if (this.warnings.length > 0) {
      console.log(chalk.yellow(`⚠️  Completed with ${this.warnings.length} warning(s):`));
      for (const warning of this.warnings) {
        console.log(chalk.yellow(`   • ${warning}`));
      }
      console.log('');
    }
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
