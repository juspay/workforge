import { CloseOptions } from '../types/index.js';
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
export declare class CloseCommand {
    private options;
    private configManager;
    private logger;
    private worktreeResolver;
    private safetyChecker;
    private envDiffer;
    private envSyncer;
    private backupManager;
    private worktreeRemover;
    private branchCleaner;
    private auditLogger;
    private diffDisplay;
    private syncPrompt;
    constructor(options: CloseOptions);
    /**
     * Main execution method
     */
    run(): Promise<void>;
    /**
     * Display safety check results
     */
    private displaySafetyResults;
    /**
     * Display summary
     */
    private displaySummary;
}
//# sourceMappingURL=close.d.ts.map