import { CleanupOptions } from '../types/index.js';
/**
 * Cleanup Command
 *
 * Cleans up old backups and audit logs:
 * - Delete backups older than N days
 * - Delete all backups for current project
 * - Preview before deletion (--dry-run)
 * - Auto-confirm with --yes
 */
export declare class CleanupCommand {
    private options;
    private configManager;
    private logger;
    private backupManager;
    private worktreeResolver;
    constructor(options: CleanupOptions);
    /**
     * Main execution method
     */
    run(): Promise<void>;
    /**
     * Show backup preview
     */
    private showBackupPreview;
    /**
     * Display summary
     */
    private displaySummary;
}
//# sourceMappingURL=cleanup.d.ts.map