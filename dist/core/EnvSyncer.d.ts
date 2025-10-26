import { EnvDiff, SyncDecision, SyncResult } from '../types/index.js';
/**
 * Environment Syncer
 *
 * Applies sync decisions to environment files:
 * - Adds new variables
 * - Updates modified variables
 * - Removes deleted variables
 * - Preserves comments and formatting where possible
 */
export declare class EnvSyncer {
    private parser;
    constructor();
    /**
     * Sync environment variables from source to target based on user decision
     *
     * @param sourcePath - Path to source .env file
     * @param targetPath - Path to target .env file
     * @param diff - Environment diff
     * @param decision - User sync decision
     * @returns Sync result with counts and status
     */
    sync(sourcePath: string, targetPath: string, diff: EnvDiff, decision: SyncDecision): Promise<SyncResult>;
    /**
     * Merge variables based on sync decision
     *
     * @param targetVars - Current target variables
     * @param diff - Environment diff
     * @param decision - User sync decision
     * @returns Merged variable map
     */
    private mergeVariables;
    /**
     * Dry run - show what would be synced without actually syncing
     *
     * @param diff - Environment diff
     * @param decision - User sync decision
     * @returns Summary of changes that would be applied
     */
    dryRun(diff: EnvDiff, decision: SyncDecision): {
        wouldAdd: string[];
        wouldModify: string[];
        wouldRemove: string[];
    };
    /**
     * Validate sync decision against diff
     *
     * Ensures that all keys in decision actually exist in the diff
     *
     * @param diff - Environment diff
     * @param decision - User sync decision
     * @returns Validation result with any errors
     */
    validateDecision(diff: EnvDiff, decision: SyncDecision): {
        valid: boolean;
        errors: string[];
    };
    /**
     * Create a sync decision that includes all changes
     *
     * Useful for auto-yes mode
     *
     * @param diff - Environment diff
     * @returns Sync decision with all changes
     */
    createFullSyncDecision(diff: EnvDiff): SyncDecision;
    /**
     * Create an empty sync decision (no changes)
     *
     * @returns Empty sync decision
     */
    createEmptySyncDecision(): SyncDecision;
}
//# sourceMappingURL=EnvSyncer.d.ts.map