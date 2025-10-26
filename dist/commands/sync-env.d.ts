import { SyncEnvOptions } from '../types/index.js';
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
export declare class SyncEnvCommand {
    private options;
    private configManager;
    private logger;
    private syncTargetResolver;
    private worktreeResolver;
    private envDiffer;
    private envSyncer;
    private backupManager;
    private auditLogger;
    private diffDisplay;
    private syncPrompt;
    constructor(options: SyncEnvOptions);
    /**
     * Main execution method
     */
    run(): Promise<void>;
    /**
     * Display summary
     */
    private displaySummary;
}
//# sourceMappingURL=sync-env.d.ts.map