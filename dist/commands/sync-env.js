import chalk from 'chalk';
import { SyncTargetResolver } from '../core/SyncTargetResolver.js';
import { EnvDiffer } from '../core/EnvDiffer.js';
import { EnvSyncer } from '../core/EnvSyncer.js';
import { BackupManager } from '../core/BackupManager.js';
import { AuditLogger } from '../core/AuditLogger.js';
import { ConfigManager } from '../core/ConfigManager.js';
import { WorktreeResolver } from '../core/WorktreeResolver.js';
import { Logger } from '../ui/Logger.js';
import { DiffDisplay } from '../ui/DiffDisplay.js';
import { SyncPrompt } from '../ui/SyncPrompt.js';
/**
 * Sync-Env Command
 *
 * Standalone command for syncing environment variables between:
 * - Worktree and main repository
 * - Two worktrees
 * - Bidirectional sync with direction selection
 *
 * Supports patterns:
 * 1. --from <source> --to <target>
 * 2. --from <source> (target = main)
 * 3. --to <target> (source = main)
 * 4. --between <worktree> (bidirectional, choose direction)
 * 5. Auto-detect from current directory
 */
export class SyncEnvCommand {
    options;
    configManager;
    logger;
    // Core components
    syncTargetResolver;
    worktreeResolver;
    envDiffer;
    envSyncer;
    backupManager;
    auditLogger;
    // UI components
    diffDisplay;
    syncPrompt;
    constructor(options) {
        this.options = options;
        this.configManager = new ConfigManager();
        this.logger = new Logger(this.configManager);
        // Initialize core components
        this.syncTargetResolver = new SyncTargetResolver();
        this.worktreeResolver = new WorktreeResolver();
        this.envDiffer = new EnvDiffer();
        this.envSyncer = new EnvSyncer();
        this.backupManager = new BackupManager(this.configManager);
        this.auditLogger = new AuditLogger(this.configManager);
        // Initialize UI components
        this.diffDisplay = new DiffDisplay(this.logger);
        this.syncPrompt = new SyncPrompt(this.logger);
    }
    /**
     * Main execution method
     */
    async run() {
        try {
            this.logger.header('🔄 Sync Environment Variables');
            this.logger.newline();
            // Step 1: Resolve sync targets
            const progress = this.logger.startProgress('Resolving sync targets...');
            let targets = await this.syncTargetResolver.resolve(this.options);
            progress?.succeed('Sync targets resolved');
            // Validate targets
            const validation = this.syncTargetResolver.validate(targets);
            if (!validation.valid) {
                this.logger.error(validation.error || 'Invalid sync targets');
                process.exit(1);
            }
            // Step 2: Handle bidirectional sync
            if (this.options.between && !this.options.yes) {
                const direction = await this.syncPrompt.promptDirection(targets.sourceLabel, targets.targetLabel);
                if (direction === 'cancel') {
                    this.logger.warning('Sync cancelled by user.');
                    process.exit(0);
                }
                if (direction === 'target-to-source') {
                    // Swap source and target
                    targets = this.syncTargetResolver.swap(targets);
                }
            }
            // Display sync targets
            this.logger.newline();
            this.logger.subheader('Sync Configuration:');
            this.logger.keyValue('Source', targets.sourceLabel);
            this.logger.keyValue('Target', targets.targetLabel);
            this.logger.newline();
            // Step 3: Generate diff
            this.logger.step(1, 4, 'Analyzing environment changes...');
            const diff = this.envDiffer.compare(targets.sourcePath, targets.targetPath, targets);
            const summary = this.envDiffer.getSummary(diff);
            if (!summary.hasChanges) {
                this.diffDisplay.showNoChanges();
                return;
            }
            // Step 4: Display diff
            if (!this.options.yes) {
                this.diffDisplay.show(diff);
            }
            else {
                this.diffDisplay.showSummary(diff);
            }
            // Step 5: Get sync decision
            this.logger.newline();
            this.logger.step(2, 4, 'Select variables to sync...');
            const decision = await this.syncPrompt.prompt(diff, this.options.yes);
            const totalSelected = decision.addedKeys.size + decision.modifiedKeys.size + decision.removedKeys.size;
            if (totalSelected === 0) {
                this.logger.warning('No variables selected for sync.');
                return;
            }
            // Step 6: Confirm sync (unless --yes)
            let confirmed = this.options.yes;
            if (!confirmed) {
                confirmed = await this.syncPrompt.confirmSync(decision);
            }
            if (!confirmed) {
                this.logger.warning('Sync cancelled by user.');
                return;
            }
            // Dry run mode - exit here
            if (this.options.dryRun) {
                this.logger.newline();
                this.logger.box('Dry run mode - no changes were made', 'info');
                const dryRunResult = this.envSyncer.dryRun(diff, decision);
                if (dryRunResult.wouldAdd.length > 0) {
                    this.logger.info(`Would add: ${dryRunResult.wouldAdd.join(', ')}`);
                }
                if (dryRunResult.wouldModify.length > 0) {
                    this.logger.info(`Would modify: ${dryRunResult.wouldModify.join(', ')}`);
                }
                if (dryRunResult.wouldRemove.length > 0) {
                    this.logger.info(`Would remove: ${dryRunResult.wouldRemove.join(', ')}`);
                }
                return;
            }
            // Step 7: Create backup (if enabled)
            this.logger.newline();
            this.logger.step(3, 4, 'Creating backup...');
            let backupCreated = false;
            const config = this.configManager.load();
            if (config.sync.createBackupBeforeSync) {
                try {
                    // Get repo root for backup
                    const targetWorktree = await this.worktreeResolver.resolve(undefined, undefined);
                    const repoRoot = await this.worktreeResolver.getMainRepo(targetWorktree.path);
                    this.backupManager.createBackup(targets.targetPath, repoRoot);
                    backupCreated = true;
                    this.logger.success('Backup created');
                }
                catch (error) {
                    this.logger.warning(`Backup failed: ${error}`);
                }
            }
            else {
                this.logger.verbose('Backup disabled in configuration');
            }
            // Step 8: Perform sync
            this.logger.newline();
            this.logger.step(4, 4, 'Syncing environment variables...');
            const syncProgress = this.logger.startProgress('Applying changes...');
            const syncResult = await this.envSyncer.sync(targets.sourcePath, targets.targetPath, diff, decision);
            if (!syncResult.success) {
                syncProgress?.fail(`Sync failed: ${syncResult.error}`);
                this.logger.error('Environment sync failed.');
                process.exit(1);
            }
            syncProgress?.succeed('Environment variables synced successfully');
            // Step 9: Log audit
            try {
                const targetWorktree = await this.worktreeResolver.resolve(undefined, undefined);
                const repoRoot = await this.worktreeResolver.getMainRepo(targetWorktree.path);
                const auditOp = this.auditLogger.createAuditOperation(syncResult, targets.sourceLabel, targets.targetLabel, backupCreated);
                this.auditLogger.log(auditOp, repoRoot);
            }
            catch (error) {
                this.logger.verbose(`Audit logging failed: ${error}`);
            }
            // Step 10: Summary
            this.logger.newline();
            this.displaySummary(syncResult, backupCreated);
        }
        catch (error) {
            this.logger.error(`Error: ${error instanceof Error ? error.message : String(error)}`);
            process.exit(1);
        }
    }
    /**
     * Display summary
     */
    displaySummary(syncResult, backupCreated) {
        this.logger.subheader('Summary:');
        if (syncResult.addedCount > 0) {
            this.logger.listItem(chalk.green(`${syncResult.addedCount} variable${syncResult.addedCount === 1 ? '' : 's'} added`));
        }
        if (syncResult.modifiedCount > 0) {
            this.logger.listItem(chalk.yellow(`${syncResult.modifiedCount} variable${syncResult.modifiedCount === 1 ? '' : 's'} modified`));
        }
        if (syncResult.removedCount > 0) {
            this.logger.listItem(chalk.red(`${syncResult.removedCount} variable${syncResult.removedCount === 1 ? '' : 's'} removed`));
        }
        if (backupCreated) {
            this.logger.listItem(chalk.green('Backup created'));
        }
        this.logger.newline();
        this.logger.success('Environment sync complete!');
    }
}
//# sourceMappingURL=sync-env.js.map