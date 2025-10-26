import { EnvDiff, SyncDecision } from '../types/index.js';
import { Logger } from './Logger.js';
/**
 * Sync Prompt
 *
 * Interactive prompt for selecting which environment variables to sync.
 * Allows line-by-line selection of:
 * - Added variables
 * - Modified variables
 * - Removed variables
 */
export declare class SyncPrompt {
    private logger;
    constructor(logger?: Logger);
    /**
     * Prompt user to select which variables to sync
     *
     * @param diff - EnvDiff object with all changes
     * @param autoYes - If true, automatically accept all changes
     * @returns SyncDecision with user selections
     */
    prompt(diff: EnvDiff, autoYes?: boolean): Promise<SyncDecision>;
    /**
     * Prompt for added variables
     */
    private promptAdded;
    /**
     * Prompt for modified variables
     */
    private promptModified;
    /**
     * Prompt for removed variables
     */
    private promptRemoved;
    /**
     * Auto-accept all changes
     */
    private autoAcceptAll;
    /**
     * Format variable choice for display
     */
    private formatVariableChoice;
    /**
     * Format modified variable choice for display
     */
    private formatModifiedChoice;
    /**
     * Confirm sync operation before proceeding
     */
    confirmSync(decision: SyncDecision): Promise<boolean>;
    /**
     * Ask if user wants to create backup before sync
     */
    askForBackup(): Promise<boolean>;
    /**
     * Prompt for sync direction in bidirectional sync
     */
    promptDirection(sourceLabel: string, targetLabel: string): Promise<'source-to-target' | 'target-to-source' | 'cancel'>;
    /**
     * Truncate long values for display
     */
    private truncate;
    /**
     * Display sync decision summary
     */
    showDecisionSummary(decision: SyncDecision): void;
}
//# sourceMappingURL=SyncPrompt.d.ts.map