import * as path from 'path';
import { existsSync } from 'fs';
import inquirer from 'inquirer';
import chalk from 'chalk';
import { WorktreeResolver } from '../core/WorktreeResolver.js';
import { SafetyChecker } from '../core/SafetyChecker.js';
import { EnvDiffer } from '../core/EnvDiffer.js';
import { EnvSyncer } from '../core/EnvSyncer.js';
import { BackupManager } from '../core/BackupManager.js';
import { WorktreeRemover } from '../core/WorktreeRemover.js';
import { BranchCleaner } from '../core/BranchCleaner.js';
import { AuditLogger } from '../core/AuditLogger.js';
import { ConfigManager } from '../core/ConfigManager.js';
import { Logger } from '../ui/Logger.js';
import { DiffDisplay } from '../ui/DiffDisplay.js';
import { SyncPrompt } from '../ui/SyncPrompt.js';
import { CloseOptions, SafetyCheckResult } from '../types/index.js';

/**
 * Close Command
 *
 * Closes a worktree with intelligent environment variable synchronization:
 * 1. Discover worktree (path, name, or auto-detect)
 * 2. Run safety checks
 * 3. Display warnings
 * 4. Prompt for confirmation
 * 5. Sync environment variables
 * 6. Remove worktree
 * 7. Cleanup branch
 * 8. Log operation
 * 9. Show summary
 */
export class CloseCommand {
  private options: CloseOptions;
  private configManager: ConfigManager;
  private logger: Logger;

  // Core components
  private worktreeResolver: WorktreeResolver;
  private safetyChecker: SafetyChecker;
  private envDiffer: EnvDiffer;
  private envSyncer: EnvSyncer;
  private backupManager: BackupManager;
  private worktreeRemover: WorktreeRemover;
  private branchCleaner: BranchCleaner;
  private auditLogger: AuditLogger;

  // UI components
  private diffDisplay: DiffDisplay;
  private syncPrompt: SyncPrompt;

  constructor(options: CloseOptions) {
    this.options = options;
    this.configManager = new ConfigManager();
    this.logger = new Logger(this.configManager);

    // Initialize core components
    this.worktreeResolver = new WorktreeResolver();
    this.safetyChecker = new SafetyChecker();
    this.envDiffer = new EnvDiffer();
    this.envSyncer = new EnvSyncer();
    this.backupManager = new BackupManager(this.configManager);
    this.worktreeRemover = new WorktreeRemover();
    this.branchCleaner = new BranchCleaner();
    this.auditLogger = new AuditLogger(this.configManager);

    // Initialize UI components
    this.diffDisplay = new DiffDisplay(this.logger);
    this.syncPrompt = new SyncPrompt(this.logger);
  }

  /**
   * Main execution method
   */
  async run(): Promise<void> {
    try {
      this.logger.header('🔒 Close Worktree');

      // Step 1: Discover worktree
      const progress = this.logger.startProgress('Discovering worktree...');
      const worktree = await this.worktreeResolver.resolve(this.options.path, this.options.name);
      progress?.succeed(`Found worktree: ${chalk.cyan(worktree.branchName)}`);

      this.logger.newline();
      this.logger.keyValue('Path', worktree.path);
      this.logger.keyValue('Branch', worktree.branchName);
      this.logger.newline();

      // Check if it's the main repository
      if (worktree.isMainRepo) {
        this.logger.error('Cannot close the main repository. Only worktrees can be closed.');
        process.exit(1);
      }

      // Step 2: Run safety checks
      this.logger.step(1, 5, 'Running safety checks...');
      const safetyResult = await this.safetyChecker.check(worktree);

      // Display safety check results
      this.displaySafetyResults(safetyResult);

      // Check if we can proceed
      if (!safetyResult.canClose && !this.options.force) {
        this.logger.error('\\nCannot close worktree due to blocking issues.');
        this.logger.info('Fix the issues above or use --force to override.');
        process.exit(1);
      }

      // Step 3: Environment sync (if .env files exist)
      const mainRepo = await this.worktreeResolver.getMainRepo(worktree.path);
      const worktreeEnvPath = path.join(worktree.path, '.env');
      const mainEnvPath = path.join(mainRepo, '.env');

      let syncPerformed = false;
      let backupCreated = false;

      if (existsSync(worktreeEnvPath) && existsSync(mainEnvPath) && !this.options.skipSync) {
        this.logger.newline();
        this.logger.step(2, 5, 'Checking environment variable changes...');

        // Generate diff (worktree → main: sync new env vars back to main on close)
        const diff = this.envDiffer.compare(worktreeEnvPath, mainEnvPath, {
          sourceLabel: `Worktree (${worktree.branchName})`,
          targetLabel: `Main (${path.basename(mainRepo)})`,
          sourcePath: worktreeEnvPath,
          targetPath: mainEnvPath
        });

        const summary = this.envDiffer.getSummary(diff);

        if (summary.hasChanges) {
          // Display diff
          if (!this.options.yes) {
            this.diffDisplay.show(diff);
          } else {
            this.diffDisplay.showSummary(diff);
          }

          // Prompt for sync decision
          const decision = await this.syncPrompt.prompt(diff, this.options.yes);

          const totalSelected =
            decision.addedKeys.size + decision.modifiedKeys.size + decision.removedKeys.size;

          if (totalSelected > 0) {
            // Confirm sync (unless --yes)
            let confirmed = this.options.yes;

            if (!confirmed) {
              confirmed = await this.syncPrompt.confirmSync(decision);
            }

            if (confirmed && !this.options.dryRun) {
              // Create backup if enabled
              const config = this.configManager.load();
              if (config.sync.createBackupBeforeSync) {
                this.logger.info('Creating backup...');
                try {
                  this.backupManager.createBackup(mainEnvPath, mainRepo);
                  backupCreated = true;
                  this.logger.success('Backup created');
                } catch (error) {
                  this.logger.warning(`Backup failed: ${error}`);
                }
              }

              // Perform sync
              const syncProgress = this.logger.startProgress('Syncing environment variables...');
              const syncResult = await this.envSyncer.sync(worktreeEnvPath, mainEnvPath, diff, decision);

              if (syncResult.success) {
                syncProgress?.succeed('Environment variables synced successfully');
                syncPerformed = true;

                // Log audit
                const auditOp = this.auditLogger.createAuditOperation(
                  syncResult,
                  `Worktree: ${worktree.branchName}`,
                  `Main: ${path.basename(mainRepo)}`,
                  backupCreated
                );
                this.auditLogger.log(auditOp, mainRepo);
              } else {
                syncProgress?.fail(`Sync failed: ${syncResult.error}`);
                this.logger.error('Environment sync failed. Aborting worktree closure.');
                process.exit(1);
              }
            } else if (!confirmed) {
              this.logger.warning('Sync cancelled. Continuing with worktree closure...');
            }
          } else {
            this.logger.info('No variables selected for sync.');
          }
        } else {
          this.logger.success('No environment variable changes detected.');
        }
      } else if (this.options.skipSync) {
        this.logger.verbose('Skipping environment sync (--skip-sync)');
      } else {
        this.logger.verbose('No .env files found for sync');
      }

      // Step 4: Confirm closure (unless --yes or --dry-run)
      if (!this.options.yes && !this.options.dryRun) {
        this.logger.newline();
        const { confirmClose } = await inquirer.prompt([
          {
            type: 'confirm',
            name: 'confirmClose',
            message: `Close worktree ${chalk.cyan(worktree.branchName)}?`,
            default: true
          }
        ]);

        if (!confirmClose) {
          this.logger.warning('Worktree closure cancelled by user.');
          process.exit(0);
        }
      }

      // Dry run mode - exit here
      if (this.options.dryRun) {
        this.logger.newline();
        this.logger.box('Dry run mode - no changes were made', 'info');
        this.logger.info('The following actions would be performed:');
        this.logger.listItem('Remove worktree');
        if (this.options.deleteBranch) {
          this.logger.listItem('Delete branch');
        }
        return;
      }

      // Step 5: Remove worktree
      this.logger.newline();
      this.logger.step(3, 5, 'Removing worktree...');
      const removeResult = await this.worktreeRemover.remove(worktree, this.options.force);

      if (!removeResult.success) {
        this.logger.error(removeResult.message);
        process.exit(1);
      }

      this.logger.success(removeResult.message);

      // Step 6: Delete branch (if requested or configured)
      const config = this.configManager.load();
      const shouldDeleteBranch =
        this.options.deleteBranch || (config.preferences.autoDeleteBranch && !worktree.isMainRepo);

      if (shouldDeleteBranch && worktree.branchName && worktree.branchName !== 'HEAD') {
        this.logger.newline();
        this.logger.step(4, 5, 'Deleting branch...');

        const cleanupResult = await this.branchCleaner.cleanup(
          worktree.branchName,
          mainRepo,
          safetyResult,
          this.options.force
        );

        if (cleanupResult.success) {
          this.logger.success(cleanupResult.message);

          // Show warnings
          if (cleanupResult.warnings && cleanupResult.warnings.length > 0) {
            for (const warning of cleanupResult.warnings) {
              this.logger.warning(warning);
            }
          }
        } else {
          this.logger.warning(cleanupResult.message);
        }
      }

      // Step 7: Summary
      this.logger.newline();
      this.logger.step(5, 5, 'Complete!');
      this.logger.newline();

      this.displaySummary(worktree.branchName, syncPerformed, backupCreated, shouldDeleteBranch);

    } catch (error) {
      this.logger.error(`Error: ${error instanceof Error ? error.message : String(error)}`);
      process.exit(1);
    }
  }

  /**
   * Display safety check results
   */
  private displaySafetyResults(result: SafetyCheckResult): void {
    const blockingCount = this.safetyChecker.getBlockingIssueCount(result);
    const warningCount = this.safetyChecker.getWarningIssueCount(result);

    if (blockingCount === 0 && warningCount === 0) {
      this.logger.success('All safety checks passed');
      return;
    }

    this.logger.newline();
    this.logger.subheader('Safety Check Results:');
    this.logger.newline();

    if (result.warnings.length > 0) {
      for (const warning of result.warnings) {
        if (
          warning.includes('uncommitted') ||
          warning.includes('Merge') ||
          warning.includes('Rebase')
        ) {
          this.logger.error(`⛔ ${warning}`);
        } else {
          this.logger.warning(`⚠️  ${warning}`);
        }
      }
    }

    this.logger.newline();

    if (blockingCount > 0) {
      this.logger.bold(chalk.red(`${blockingCount} blocking issue(s) found`));
    }

    if (warningCount > 0) {
      this.logger.dim(`${warningCount} warning(s)`);
    }
  }

  /**
   * Display summary
   */
  private displaySummary(
    branchName: string,
    syncPerformed: boolean,
    backupCreated: boolean,
    branchDeleted: boolean
  ): void {
    this.logger.subheader('Summary:');
    this.logger.listItem(chalk.green(`Worktree closed: ${branchName}`));

    if (syncPerformed) {
      this.logger.listItem(chalk.green('Environment variables synced'));
    }

    if (backupCreated) {
      this.logger.listItem(chalk.green('Backup created'));
    }

    if (branchDeleted) {
      this.logger.listItem(chalk.green(`Branch deleted: ${branchName}`));
    }

    this.logger.newline();
    this.logger.success('Worktree closed successfully!');
  }
}
