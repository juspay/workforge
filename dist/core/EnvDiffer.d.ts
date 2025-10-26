import { EnvVariable, EnvDiff, SyncTargets } from '../types/index.js';
/**
 * Environment Differ
 *
 * Compares environment variables between two .env files and generates
 * a structured diff showing:
 * - Added variables (in target, not in source)
 * - Removed variables (in source, not in target)
 * - Modified variables (in both, different values)
 * - Unchanged variables (in both, same values)
 */
export declare class EnvDiffer {
    private parser;
    constructor();
    /**
     * Compare two .env files and generate diff
     *
     * @param sourcePath - Path to source .env file
     * @param targetPath - Path to target .env file
     * @param targets - Sync targets information (for context)
     * @returns EnvDiff object with all changes
     * @throws Error if files don't exist or can't be parsed
     */
    compare(sourcePath: string, targetPath: string, targets: SyncTargets): EnvDiff;
    /**
     * Compare two sets of variables
     *
     * @param sourceVars - Variables from source
     * @param targetVars - Variables from target
     * @param targets - Sync targets information
     * @returns EnvDiff object
     */
    compareVariables(sourceVars: Map<string, EnvVariable>, targetVars: Map<string, EnvVariable>, targets: SyncTargets): EnvDiff;
    /**
     * Check if two variables are equal
     *
     * Variables are considered equal if:
     * - They have the same key (already guaranteed by caller)
     * - They have the same value
     *
     * Note: Comments, quotes, and line numbers are NOT considered for equality.
     * Only the actual variable value matters.
     *
     * @param var1 - First variable
     * @param var2 - Second variable
     * @returns True if variables are equal
     */
    private areVariablesEqual;
    /**
     * Get summary statistics for a diff
     *
     * @param diff - EnvDiff object
     * @returns Summary object with counts
     */
    getSummary(diff: EnvDiff): {
        addedCount: number;
        removedCount: number;
        modifiedCount: number;
        unchangedCount: number;
        totalChanges: number;
        hasChanges: boolean;
    };
    /**
     * Check if diff is empty (no changes)
     *
     * @param diff - EnvDiff object
     * @returns True if no changes
     */
    isEmpty(diff: EnvDiff): boolean;
    /**
     * Filter diff to only include specified keys
     *
     * Useful for interactive selection where user chooses which variables to sync
     *
     * @param diff - Original diff
     * @param selectedKeys - Set of keys to include
     * @returns Filtered diff
     */
    filterDiff(diff: EnvDiff, selectedKeys: Set<string>): EnvDiff;
    /**
     * Merge multiple diffs into one
     *
     * Useful when syncing between multiple worktrees
     *
     * @param diffs - Array of diffs to merge
     * @returns Merged diff
     */
    mergeDiffs(diffs: EnvDiff[]): EnvDiff | null;
    /**
     * Invert a diff (swap source and target)
     *
     * Useful for bidirectional sync where user can choose direction
     *
     * @param diff - Original diff
     * @returns Inverted diff
     */
    invertDiff(diff: EnvDiff): EnvDiff;
    /**
     * Get all variable keys from a diff
     *
     * @param diff - EnvDiff object
     * @returns Set of all keys
     */
    getAllKeys(diff: EnvDiff): Set<string>;
    /**
     * Get only changed variable keys from a diff
     *
     * @param diff - EnvDiff object
     * @returns Set of changed keys
     */
    getChangedKeys(diff: EnvDiff): Set<string>;
}
//# sourceMappingURL=EnvDiffer.d.ts.map