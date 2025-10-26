import inquirer from 'inquirer';
import chalk from 'chalk';
import { BackupManager } from '../core/BackupManager.js';
import { ProjectIdentifier } from '../core/ProjectIdentifier.js';
import { WorktreeResolver } from '../core/WorktreeResolver.js';
import { ConfigManager } from '../core/ConfigManager.js';
import { Logger } from '../ui/Logger.js';
/**
 * Cleanup Command
 *
 * Cleans up old backups and audit logs:
 * - Delete backups older than N days
 * - Delete all backups for current project
 * - Preview before deletion (--dry-run)
 * - Auto-confirm with --yes
 */
export class CleanupCommand {
    options;
    configManager;
    logger;
    backupManager;
    worktreeResolver;
    constructor(options) {
        this.options = options;
        this.configManager = new ConfigManager();
        this.logger = new Logger(this.configManager);
        this.backupManager = new BackupManager(this.configManager);
        this.worktreeResolver = new WorktreeResolver();
    }
    /**
     * Main execution method
     */
    async run() {
        try {
            this.logger.header('🧹 Cleanup Backups and Logs');
            this.logger.newline();
            // Get current repository
            const currentWorktree = await this.worktreeResolver.resolve(undefined, undefined);
            const repoRoot = await this.worktreeResolver.getMainRepo(currentWorktree.path);
            // Get project info
            const projectId = ProjectIdentifier.generateId(repoRoot);
            const metadata = ProjectIdentifier.getMetadata(repoRoot);
            this.logger.keyValue('Project', metadata?.repoName || 'Unknown');
            this.logger.keyValue('Project ID', projectId);
            this.logger.newline();
            // Get backups
            const allBackups = this.backupManager.listBackups(repoRoot);
            if (allBackups.length === 0) {
                this.logger.info('No backups found for this project.');
                return;
            }
            // Filter backups based on --older-than
            let backupsToDelete = allBackups;
            if (this.options.olderThan) {
                const cutoffDate = new Date();
                cutoffDate.setDate(cutoffDate.getDate() - this.options.olderThan);
                backupsToDelete = allBackups.filter(backup => backup.createdAt < cutoffDate);
                if (backupsToDelete.length === 0) {
                    this.logger.info(`No backups older than ${this.options.olderThan} days found.`);
                    return;
                }
            }
            // Show preview
            this.showBackupPreview(backupsToDelete, allBackups.length);
            // Dry run mode - exit here
            if (this.options.dryRun) {
                this.logger.newline();
                this.logger.box('Dry run mode - no backups were deleted', 'info');
                return;
            }
            // Confirm deletion (unless --yes)
            if (!this.options.yes) {
                const { confirmed } = await inquirer.prompt([
                    {
                        type: 'confirm',
                        name: 'confirmed',
                        message: `Delete ${backupsToDelete.length} backup${backupsToDelete.length === 1 ? '' : 's'}?`,
                        default: false
                    }
                ]);
                if (!confirmed) {
                    this.logger.warning('Cleanup cancelled by user.');
                    return;
                }
            }
            // Perform deletion
            const progress = this.logger.startProgress('Deleting backups...');
            let deletedCount = 0;
            let failedCount = 0;
            for (const backup of backupsToDelete) {
                try {
                    this.backupManager.deleteBackup(backup.filePath);
                    deletedCount++;
                }
                catch (error) {
                    this.logger.verbose(`Failed to delete ${backup.fileName}: ${error}`);
                    failedCount++;
                }
            }
            progress?.succeed(`Deleted ${deletedCount} backup${deletedCount === 1 ? '' : 's'}`);
            if (failedCount > 0) {
                this.logger.warning(`Failed to delete ${failedCount} backup${failedCount === 1 ? '' : 's'}`);
            }
            // Show summary
            this.logger.newline();
            this.displaySummary(deletedCount, failedCount, allBackups.length - deletedCount);
        }
        catch (error) {
            this.logger.error(`Error: ${error instanceof Error ? error.message : String(error)}`);
            process.exit(1);
        }
    }
    /**
     * Show backup preview
     */
    showBackupPreview(backupsToDelete, totalBackups) {
        this.logger.subheader('Backups to Delete:');
        this.logger.newline();
        // Show first 10 backups
        const maxShow = 10;
        const toShow = backupsToDelete.slice(0, maxShow);
        for (const backup of toShow) {
            const age = this.backupManager.formatAge(backup.createdAt);
            const size = this.backupManager.formatSize(backup.size);
            this.logger.listItem(`${chalk.dim(backup.fileName)} - ${chalk.yellow(age)} (${size})`);
        }
        if (backupsToDelete.length > maxShow) {
            this.logger.dim(`... and ${backupsToDelete.length - maxShow} more`);
        }
        this.logger.newline();
        this.logger.keyValue('Total to delete', String(backupsToDelete.length));
        this.logger.keyValue('Will remain', String(totalBackups - backupsToDelete.length));
        this.logger.newline();
    }
    /**
     * Display summary
     */
    displaySummary(deletedCount, failedCount, remainingCount) {
        this.logger.subheader('Summary:');
        if (deletedCount > 0) {
            this.logger.listItem(chalk.green(`${deletedCount} backup${deletedCount === 1 ? '' : 's'} deleted`));
        }
        if (failedCount > 0) {
            this.logger.listItem(chalk.red(`${failedCount} backup${failedCount === 1 ? '' : 's'} failed to delete`));
        }
        this.logger.listItem(chalk.dim(`${remainingCount} backup${remainingCount === 1 ? '' : 's'} remaining`));
        this.logger.newline();
        this.logger.success('Cleanup complete!');
    }
}
//# sourceMappingURL=cleanup.js.map