import { EnvFileParser } from './EnvFileParser.js';
import { existsSync } from 'fs';
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
export class EnvDiffer {
    parser;
    constructor() {
        this.parser = new EnvFileParser();
    }
    /**
     * Compare two .env files and generate diff
     *
     * @param sourcePath - Path to source .env file
     * @param targetPath - Path to target .env file
     * @param targets - Sync targets information (for context)
     * @returns EnvDiff object with all changes
     * @throws Error if files don't exist or can't be parsed
     */
    compare(sourcePath, targetPath, targets) {
        // Validate files exist
        if (!existsSync(sourcePath)) {
            throw new Error(`Source .env file not found: ${sourcePath}`);
        }
        if (!existsSync(targetPath)) {
            throw new Error(`Target .env file not found: ${targetPath}`);
        }
        // Parse both files
        const sourceVars = this.parser.parse(sourcePath);
        const targetVars = this.parser.parse(targetPath);
        // Generate diff
        return this.compareVariables(sourceVars, targetVars, targets);
    }
    /**
     * Compare two sets of variables
     *
     * @param sourceVars - Variables from source
     * @param targetVars - Variables from target
     * @param targets - Sync targets information
     * @returns EnvDiff object
     */
    compareVariables(sourceVars, targetVars, targets) {
        const added = [];
        const removed = [];
        const modified = [];
        const unchanged = [];
        const sourceKeys = new Set(sourceVars.keys());
        const targetKeys = new Set(targetVars.keys());
        // Find added variables (in target, not in source)
        for (const key of targetKeys) {
            if (!sourceKeys.has(key)) {
                const targetVar = targetVars.get(key);
                added.push(targetVar);
            }
        }
        // Find removed variables (in source, not in target)
        for (const key of sourceKeys) {
            if (!targetKeys.has(key)) {
                const sourceVar = sourceVars.get(key);
                removed.push(sourceVar);
            }
        }
        // Find modified and unchanged variables (in both)
        for (const key of sourceKeys) {
            if (targetKeys.has(key)) {
                const sourceVar = sourceVars.get(key);
                const targetVar = targetVars.get(key);
                if (this.areVariablesEqual(sourceVar, targetVar)) {
                    // Unchanged
                    unchanged.push(sourceVar);
                }
                else {
                    // Modified
                    modified.push({
                        key,
                        oldValue: sourceVar.value,
                        newValue: targetVar.value,
                        oldLineNumber: sourceVar.lineNumber,
                        newLineNumber: targetVar.lineNumber,
                        oldComment: sourceVar.comment,
                        newComment: targetVar.comment,
                        oldHasQuotes: sourceVar.hasQuotes,
                        newHasQuotes: targetVar.hasQuotes,
                        oldQuoteType: sourceVar.quoteType,
                        newQuoteType: targetVar.quoteType
                    });
                }
            }
        }
        // Sort by key name for consistent display
        added.sort((a, b) => a.key.localeCompare(b.key));
        removed.sort((a, b) => a.key.localeCompare(b.key));
        modified.sort((a, b) => a.key.localeCompare(b.key));
        unchanged.sort((a, b) => a.key.localeCompare(b.key));
        return {
            added,
            removed,
            modified,
            unchanged,
            targets
        };
    }
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
    areVariablesEqual(var1, var2) {
        return var1.value === var2.value;
    }
    /**
     * Get summary statistics for a diff
     *
     * @param diff - EnvDiff object
     * @returns Summary object with counts
     */
    getSummary(diff) {
        const addedCount = diff.added.length;
        const removedCount = diff.removed.length;
        const modifiedCount = diff.modified.length;
        const unchangedCount = diff.unchanged.length;
        const totalChanges = addedCount + removedCount + modifiedCount;
        return {
            addedCount,
            removedCount,
            modifiedCount,
            unchangedCount,
            totalChanges,
            hasChanges: totalChanges > 0
        };
    }
    /**
     * Check if diff is empty (no changes)
     *
     * @param diff - EnvDiff object
     * @returns True if no changes
     */
    isEmpty(diff) {
        return (diff.added.length === 0 &&
            diff.removed.length === 0 &&
            diff.modified.length === 0);
    }
    /**
     * Filter diff to only include specified keys
     *
     * Useful for interactive selection where user chooses which variables to sync
     *
     * @param diff - Original diff
     * @param selectedKeys - Set of keys to include
     * @returns Filtered diff
     */
    filterDiff(diff, selectedKeys) {
        return {
            added: diff.added.filter(v => selectedKeys.has(v.key)),
            removed: diff.removed.filter(v => selectedKeys.has(v.key)),
            modified: diff.modified.filter(m => selectedKeys.has(m.key)),
            unchanged: diff.unchanged, // Keep all unchanged
            targets: diff.targets
        };
    }
    /**
     * Merge multiple diffs into one
     *
     * Useful when syncing between multiple worktrees
     *
     * @param diffs - Array of diffs to merge
     * @returns Merged diff
     */
    mergeDiffs(diffs) {
        if (diffs.length === 0) {
            return null;
        }
        if (diffs.length === 1) {
            return diffs[0];
        }
        const allAdded = new Map();
        const allRemoved = new Map();
        const allModified = new Map();
        const allUnchanged = new Map();
        for (const diff of diffs) {
            // Merge added
            for (const variable of diff.added) {
                if (!allAdded.has(variable.key)) {
                    allAdded.set(variable.key, variable);
                }
            }
            // Merge removed
            for (const variable of diff.removed) {
                if (!allRemoved.has(variable.key)) {
                    allRemoved.set(variable.key, variable);
                }
            }
            // Merge modified
            for (const modification of diff.modified) {
                if (!allModified.has(modification.key)) {
                    allModified.set(modification.key, modification);
                }
            }
            // Merge unchanged
            for (const variable of diff.unchanged) {
                if (!allUnchanged.has(variable.key)) {
                    allUnchanged.set(variable.key, variable);
                }
            }
        }
        // Use targets from first diff
        const targets = diffs[0].targets;
        return {
            added: Array.from(allAdded.values()).sort((a, b) => a.key.localeCompare(b.key)),
            removed: Array.from(allRemoved.values()).sort((a, b) => a.key.localeCompare(b.key)),
            modified: Array.from(allModified.values()).sort((a, b) => a.key.localeCompare(b.key)),
            unchanged: Array.from(allUnchanged.values()).sort((a, b) => a.key.localeCompare(b.key)),
            targets
        };
    }
    /**
     * Invert a diff (swap source and target)
     *
     * Useful for bidirectional sync where user can choose direction
     *
     * @param diff - Original diff
     * @returns Inverted diff
     */
    invertDiff(diff) {
        return {
            added: diff.removed, // What was removed becomes added
            removed: diff.added, // What was added becomes removed
            modified: diff.modified.map(m => ({
                key: m.key,
                oldValue: m.newValue, // Swap old and new
                newValue: m.oldValue,
                oldLineNumber: m.newLineNumber,
                newLineNumber: m.oldLineNumber,
                oldComment: m.newComment,
                newComment: m.oldComment,
                oldHasQuotes: m.newHasQuotes,
                newHasQuotes: m.oldHasQuotes,
                oldQuoteType: m.newQuoteType,
                newQuoteType: m.oldQuoteType
            })),
            unchanged: diff.unchanged,
            targets: diff.targets ? {
                sourceLabel: diff.targets.targetLabel, // Swap labels
                targetLabel: diff.targets.sourceLabel,
                sourcePath: diff.targets.targetPath,
                targetPath: diff.targets.sourcePath
            } : undefined
        };
    }
    /**
     * Get all variable keys from a diff
     *
     * @param diff - EnvDiff object
     * @returns Set of all keys
     */
    getAllKeys(diff) {
        const keys = new Set();
        diff.added.forEach(v => keys.add(v.key));
        diff.removed.forEach(v => keys.add(v.key));
        diff.modified.forEach(m => keys.add(m.key));
        diff.unchanged.forEach(v => keys.add(v.key));
        return keys;
    }
    /**
     * Get only changed variable keys from a diff
     *
     * @param diff - EnvDiff object
     * @returns Set of changed keys
     */
    getChangedKeys(diff) {
        const keys = new Set();
        diff.added.forEach(v => keys.add(v.key));
        diff.removed.forEach(v => keys.add(v.key));
        diff.modified.forEach(m => keys.add(m.key));
        return keys;
    }
}
//# sourceMappingURL=EnvDiffer.js.map