import { writeFileSync } from 'fs';
import { EnvFileParser } from './EnvFileParser.js';
import { EnvDiff, SyncDecision, SyncResult, EnvVariable } from '../types/index.js';

/**
 * Environment Syncer
 *
 * Applies sync decisions to environment files:
 * - Adds new variables
 * - Updates modified variables
 * - Removes deleted variables
 * - Preserves comments and formatting where possible
 */
export class EnvSyncer {
  private parser: EnvFileParser;

  constructor() {
    this.parser = new EnvFileParser();
  }

  /**
   * Sync environment variables from source to target based on user decision
   *
   * @param sourcePath - Path to source .env file
   * @param targetPath - Path to target .env file
   * @param diff - Environment diff
   * @param decision - User sync decision
   * @returns Sync result with counts and status
   */
  async sync(
    sourcePath: string,
    targetPath: string,
    diff: EnvDiff,
    decision: SyncDecision
  ): Promise<SyncResult> {
    const result: SyncResult = {
      success: false,
      backupCreated: false,
      addedCount: 0,
      modifiedCount: 0,
      removedCount: 0,
      addedKeys: [],
      modifiedKeys: [],
      removedKeys: [],
      errors: []
    };

    try {
      // Parse target file
      const targetVars = this.parser.parse(targetPath);

      // Apply changes based on decision
      const updatedVars = this.mergeVariables(targetVars, diff, decision);

      // Track what was actually applied (convert Sets to arrays)
      result.addedKeys = Array.from(decision.addedKeys);
      result.modifiedKeys = Array.from(decision.modifiedKeys);
      result.removedKeys = Array.from(decision.removedKeys);

      result.addedCount = decision.addedKeys.size;
      result.modifiedCount = decision.modifiedKeys.size;
      result.removedCount = decision.removedKeys.size;

      // Write updated variables back to target
      const content = this.parser.stringify(updatedVars);
      writeFileSync(targetPath, content, 'utf8');

      result.success = true;
    } catch (error) {
      result.success = false;
      result.error = error instanceof Error ? error.message : String(error);
    }

    return result;
  }

  /**
   * Merge variables based on sync decision
   *
   * @param targetVars - Current target variables
   * @param diff - Environment diff
   * @param decision - User sync decision
   * @returns Merged variable map
   */
  private mergeVariables(
    targetVars: Map<string, EnvVariable>,
    diff: EnvDiff,
    decision: SyncDecision
  ): Map<string, EnvVariable> {
    const merged = new Map(targetVars);

    // Apply added variables
    for (const variable of diff.added) {
      if (decision.addedKeys.has(variable.key)) {
        merged.set(variable.key, variable);
      }
    }

    // Apply modified variables
    for (const modification of diff.modified) {
      if (decision.modifiedKeys.has(modification.key)) {
        // Create updated variable preserving target's line number
        const existing = merged.get(modification.key);
        const lineNumber = existing ? existing.lineNumber : modification.newLineNumber;

        merged.set(modification.key, {
          key: modification.key,
          value: modification.newValue,
          lineNumber,
          comment: modification.newComment,
          hasQuotes: modification.newHasQuotes,
          quoteType: modification.newQuoteType
        });
      }
    }

    // Apply removed variables
    for (const variable of diff.removed) {
      if (decision.removedKeys.has(variable.key)) {
        merged.delete(variable.key);
      }
    }

    return merged;
  }

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
  } {
    const wouldAdd: string[] = [];
    const wouldModify: string[] = [];
    const wouldRemove: string[] = [];

    // Collect added variables
    for (const variable of diff.added) {
      if (decision.addedKeys.has(variable.key)) {
        wouldAdd.push(variable.key);
      }
    }

    // Collect modified variables
    for (const modification of diff.modified) {
      if (decision.modifiedKeys.has(modification.key)) {
        wouldModify.push(modification.key);
      }
    }

    // Collect removed variables
    for (const variable of diff.removed) {
      if (decision.removedKeys.has(variable.key)) {
        wouldRemove.push(variable.key);
      }
    }

    return {
      wouldAdd,
      wouldModify,
      wouldRemove
    };
  }

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
  } {
    const errors: string[] = [];

    // Validate added keys
    const addedKeys = new Set(diff.added.map(v => v.key));
    for (const key of decision.addedKeys) {
      if (!addedKeys.has(key)) {
        errors.push(`Added key "${key}" not found in diff`);
      }
    }

    // Validate modified keys
    const modifiedKeys = new Set(diff.modified.map(m => m.key));
    for (const key of decision.modifiedKeys) {
      if (!modifiedKeys.has(key)) {
        errors.push(`Modified key "${key}" not found in diff`);
      }
    }

    // Validate removed keys
    const removedKeys = new Set(diff.removed.map(v => v.key));
    for (const key of decision.removedKeys) {
      if (!removedKeys.has(key)) {
        errors.push(`Removed key "${key}" not found in diff`);
      }
    }

    return {
      valid: errors.length === 0,
      errors
    };
  }

  /**
   * Create a sync decision that includes all changes
   *
   * Useful for auto-yes mode
   *
   * @param diff - Environment diff
   * @returns Sync decision with all changes
   */
  createFullSyncDecision(diff: EnvDiff): SyncDecision {
    return {
      addedKeys: new Set(diff.added.map(v => v.key)),
      modifiedKeys: new Set(diff.modified.map(m => m.key)),
      removedKeys: new Set(diff.removed.map(v => v.key)),
      syncAll: true
    };
  }

  /**
   * Create an empty sync decision (no changes)
   *
   * @returns Empty sync decision
   */
  createEmptySyncDecision(): SyncDecision {
    return {
      addedKeys: new Set(),
      modifiedKeys: new Set(),
      removedKeys: new Set(),
      syncAll: false
    };
  }
}
