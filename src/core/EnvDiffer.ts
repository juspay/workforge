import { EnvFileParser } from './EnvFileParser.js';
import { EnvVariable, EnvDiff, EnvModification, SyncTargets } from '../types/index.js';
import { existsSync } from 'fs';

/**
 * Environment Differ
 *
 * Compares environment variables between two .env files and generates
 * a structured diff showing:
 * - Added variables (in source, not in target - will be added to target)
 * - Removed variables (in target, not in source - will be removed from target)
 * - Modified variables (in both, different values - target will be updated)
 * - Unchanged variables (in both, same values)
 */
export class EnvDiffer {
  private parser: EnvFileParser;

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
  compare(sourcePath: string, targetPath: string, targets: SyncTargets): EnvDiff {
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
  compareVariables(
    sourceVars: Map<string, EnvVariable>,
    targetVars: Map<string, EnvVariable>,
    targets: SyncTargets
  ): EnvDiff {
    const added: EnvVariable[] = [];
    const removed: EnvVariable[] = [];
    const modified: EnvModification[] = [];
    const unchanged: EnvVariable[] = [];

    const sourceKeys = new Set(sourceVars.keys());
    const targetKeys = new Set(targetVars.keys());

    // Find added variables (in source, not in target - will be added to target)
    for (const key of sourceKeys) {
      if (!targetKeys.has(key)) {
        const sourceVar = sourceVars.get(key)!;
        added.push(sourceVar);
      }
    }

    // Find removed variables (in target, not in source - will be removed from target)
    for (const key of targetKeys) {
      if (!sourceKeys.has(key)) {
        const targetVar = targetVars.get(key)!;
        removed.push(targetVar);
      }
    }

    // Find modified and unchanged variables (in both)
    for (const key of sourceKeys) {
      if (targetKeys.has(key)) {
        const sourceVar = sourceVars.get(key)!;
        const targetVar = targetVars.get(key)!;

        if (this.areVariablesEqual(sourceVar, targetVar)) {
          // Unchanged
          unchanged.push(sourceVar);
        } else {
          // Modified - show current target value as old, source value as new
          modified.push({
            key,
            oldValue: targetVar.value,  // Current value in target
            newValue: sourceVar.value,  // New value from source
            oldLineNumber: targetVar.lineNumber,
            newLineNumber: sourceVar.lineNumber,
            oldComment: targetVar.comment,
            newComment: sourceVar.comment,
            oldHasQuotes: targetVar.hasQuotes,
            newHasQuotes: sourceVar.hasQuotes,
            oldQuoteType: targetVar.quoteType,
            newQuoteType: sourceVar.quoteType
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
  private areVariablesEqual(var1: EnvVariable, var2: EnvVariable): boolean {
    return var1.value === var2.value;
  }

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
  } {
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
  isEmpty(diff: EnvDiff): boolean {
    return (
      diff.added.length === 0 &&
      diff.removed.length === 0 &&
      diff.modified.length === 0
    );
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
  filterDiff(diff: EnvDiff, selectedKeys: Set<string>): EnvDiff {
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
  mergeDiffs(diffs: EnvDiff[]): EnvDiff | null {
    if (diffs.length === 0) {
      return null;
    }

    if (diffs.length === 1) {
      return diffs[0];
    }

    const allAdded = new Map<string, EnvVariable>();
    const allRemoved = new Map<string, EnvVariable>();
    const allModified = new Map<string, EnvModification>();
    const allUnchanged = new Map<string, EnvVariable>();

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
  invertDiff(diff: EnvDiff): EnvDiff {
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
  getAllKeys(diff: EnvDiff): Set<string> {
    const keys = new Set<string>();

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
  getChangedKeys(diff: EnvDiff): Set<string> {
    const keys = new Set<string>();

    diff.added.forEach(v => keys.add(v.key));
    diff.removed.forEach(v => keys.add(v.key));
    diff.modified.forEach(m => keys.add(m.key));

    return keys;
  }
}
