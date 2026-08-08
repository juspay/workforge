import {
  existsSync,
  readFileSync,
  writeFileSync,
  appendFileSync,
  mkdirSync,
  unlinkSync,
  renameSync,
  rmdirSync
} from 'fs';
import * as path from 'path';
import { ProjectIdentifier } from './ProjectIdentifier.js';
import { ConfigManager } from './ConfigManager.js';
import { AuditOperation, SyncResult, AuditStatistics } from '../types/index.js';

/**
 * Audit Logger
 *
 * Dual-format audit logging system:
 * 1. Human-readable log: ~/.workforge/projects/<project-id>/audit.log
 * 2. Machine-readable JSON: ~/.workforge/projects/<project-id>/sync-history.json
 *
 * Features:
 * - Configurable variable value inclusion
 * - Auto-cleanup based on retention days
 * - Project metadata tracking
 */
export class AuditLogger {
  private configManager: ConfigManager;
  private auditEnabled!: boolean;
  private includeValues!: boolean;
  private retentionDays!: number;

  constructor(configManager?: ConfigManager) {
    this.configManager = configManager || new ConfigManager();
    this.loadConfig();
  }

  /**
   * Load audit configuration
   */
  private loadConfig(): void {
    try {
      const config = this.configManager.load();
      this.auditEnabled = config.audit.enabled;
      this.includeValues = config.audit.includeVariableValues;
      this.retentionDays = config.audit.retentionDays;
    } catch {
      // Fallback to defaults
      this.auditEnabled = true;
      this.includeValues = true;
      this.retentionDays = 90;
    }
  }

  /**
   * Log an audit operation
   *
   * @param operation - Audit operation details
   * @param repoRoot - Repository root path
   */
  log(operation: AuditOperation, repoRoot: string): void {
    if (!this.auditEnabled) {
      return;
    }

    // Get project directory
    const projectDir = ProjectIdentifier.getProjectDir(repoRoot);

    // Create project directory if it doesn't exist
    if (!existsSync(projectDir)) {
      mkdirSync(projectDir, { recursive: true });
    }

    // Update project metadata
    ProjectIdentifier.updateMetadata(repoRoot);

    // Append to human-readable log
    this.appendToLog(operation, projectDir);

    // Add to JSON history
    this.addToHistory(operation, projectDir);

    // Cleanup old logs if needed
    this.cleanupOldLogs(projectDir);
  }

  /**
   * Append operation to human-readable log file
   */
  private appendToLog(operation: AuditOperation, projectDir: string): void {
    const logPath = path.join(projectDir, 'audit.log');
    const logEntry = this.formatLogEntry(operation);

    try {
      appendFileSync(logPath, logEntry + '\n', 'utf8');
    } catch (error) {
      console.warn(`Warning: Failed to write to audit log: ${error}`);
    }
  }

  /**
   * Format operation as human-readable log entry
   */
  private formatLogEntry(operation: AuditOperation): string {
    const timestamp = new Date(operation.timestamp).toISOString();
    const separator = '─'.repeat(80);

    let entry = `\n${separator}\n`;
    entry += `[${timestamp}] ${operation.operation.toUpperCase()}\n`;
    entry += `${separator}\n\n`;

    // Source and target
    entry += `Source: ${operation.source}\n`;
    entry += `Target: ${operation.target}\n\n`;

    // Changes
    entry += `Changes:\n`;
    entry += `  Added:    ${operation.changesApplied.added} variable(s)\n`;
    entry += `  Modified: ${operation.changesApplied.modified} variable(s)\n`;
    entry += `  Removed:  ${operation.changesApplied.removed} variable(s)\n\n`;

    // Details (if values included in config)
    if (this.includeValues && operation.variableDetails) {
      entry += `Details:\n`;

      if (operation.variableDetails.added.length > 0) {
        entry += `\n  Added Variables:\n`;
        for (const key of operation.variableDetails.added) {
          entry += `    + ${key}\n`;
        }
      }

      if (operation.variableDetails.modified.length > 0) {
        entry += `\n  Modified Variables:\n`;
        for (const key of operation.variableDetails.modified) {
          entry += `    ~ ${key}\n`;
        }
      }

      if (operation.variableDetails.removed.length > 0) {
        entry += `\n  Removed Variables:\n`;
        for (const key of operation.variableDetails.removed) {
          entry += `    - ${key}\n`;
        }
      }

      entry += '\n';
    }

    // Success/failure
    entry += `Status: ${operation.success ? 'SUCCESS' : 'FAILED'}\n`;

    if (operation.error) {
      entry += `Error: ${operation.error}\n`;
    }

    if (operation.backupCreated) {
      entry += `Backup: Created\n`;
    }

    return entry;
  }

  /**
   * Add operation to JSON history
   */
  private addToHistory(operation: AuditOperation, projectDir: string): void {
    const historyPath = path.join(projectDir, 'sync-history.json');

    // The read-modify-write below is not atomic on its own: two concurrent
    // `close`/`sync-env` runs against the same project share this file and
    // would drop one another's entries.
    const lock = this.acquireLock(projectDir);

    try {
      // Read existing history
      let history: AuditOperation[] = [];

      if (existsSync(historyPath)) {
        try {
          const content = readFileSync(historyPath, 'utf8');
          history = JSON.parse(content);
        } catch (error) {
          // Never discard an unreadable history silently — it may be the only
          // record of months of operations. Set it aside before starting over.
          const salvaged = this.preserveCorruptFile(historyPath);
          console.warn(
            `Warning: Failed to parse sync history, starting a new file: ${error}` +
              (salvaged ? `\n  Previous contents kept at: ${salvaged}` : '')
          );
          history = [];
        }
      }

      if (!Array.isArray(history)) {
        const salvaged = this.preserveCorruptFile(historyPath);
        console.warn(
          'Warning: Sync history was not an array, starting a new file' +
            (salvaged ? `\n  Previous contents kept at: ${salvaged}` : '')
        );
        history = [];
      }

      // Add new operation
      history.push(operation);

      // Write updated history
      try {
        this.writeAtomically(historyPath, JSON.stringify(history, null, 2));
      } catch (error) {
        console.warn(`Warning: Failed to write sync history: ${error}`);
      }
    } finally {
      this.releaseLock(lock);
    }
  }

  /**
   * Move an unparseable file aside instead of overwriting it
   *
   * @param filePath - File that could not be read
   * @returns Path it was preserved at, or null
   */
  private preserveCorruptFile(filePath: string): string | null {
    const target = `${filePath}.corrupt-${new Date().toISOString().replace(/[:.]/g, '-')}`;

    try {
      renameSync(filePath, target);
      return target;
    } catch {
      return null;
    }
  }

  /**
   * Write via a temporary file and rename, so a reader never observes a
   * half-written file and an interrupted write cannot truncate the original.
   *
   * @param filePath - Destination path
   * @param content - Content to write
   */
  private writeAtomically(filePath: string, content: string): void {
    const temp = `${filePath}.tmp-${process.pid}`;

    writeFileSync(temp, content, 'utf8');

    try {
      renameSync(temp, filePath);
    } catch (error) {
      try {
        unlinkSync(temp);
      } catch {
        // Nothing more to do.
      }
      throw error;
    }
  }

  /**
   * Take a cross-process lock for a project directory.
   *
   * `mkdir` is atomic on every platform we target, so the directory doubles as
   * the lock. A stale lock left by a killed process is reclaimed after a
   * timeout rather than deadlocking the CLI.
   *
   * @param projectDir - Directory to lock
   * @returns Lock path if acquired, or null if it had to proceed without one
   */
  private acquireLock(projectDir: string): string | null {
    const lockPath = path.join(projectDir, '.history.lock');
    const staleAfterMs = 10_000;
    const deadline = Date.now() + staleAfterMs;

    for (;;) {
      try {
        mkdirSync(lockPath);
        return lockPath;
      } catch {
        if (Date.now() >= deadline) {
          // Assume the holder died; reclaim rather than block forever.
          try {
            rmdirSync(lockPath);
            continue;
          } catch {
            return null;
          }
        }

        // Busy-wait briefly. The critical section is a few milliseconds of
        // file I/O, so this resolves quickly in practice.
        const until = Date.now() + 20;
        while (Date.now() < until) {
          /* spin */
        }
      }
    }
  }

  /**
   * Release a lock taken by acquireLock
   *
   * @param lockPath - Lock path, or null when none was held
   */
  private releaseLock(lockPath: string | null): void {
    if (!lockPath) {
      return;
    }

    try {
      rmdirSync(lockPath);
    } catch {
      // Already gone.
    }
  }

  /**
   * Cleanup old logs based on retention days
   */
  private cleanupOldLogs(projectDir: string): void {
    const historyPath = path.join(projectDir, 'sync-history.json');

    if (!existsSync(historyPath)) {
      return;
    }

    try {
      const content = readFileSync(historyPath, 'utf8');
      const history: AuditOperation[] = JSON.parse(content);

      // Calculate cutoff date
      const cutoffDate = new Date();
      cutoffDate.setDate(cutoffDate.getDate() - this.retentionDays);

      // Filter out old entries
      const filtered = history.filter(operation => {
        const opDate = new Date(operation.timestamp);
        return opDate >= cutoffDate;
      });

      // Write back if entries were removed
      if (filtered.length < history.length) {
        writeFileSync(historyPath, JSON.stringify(filtered, null, 2), 'utf8');

        // Also cleanup human-readable log
        // (We'll rebuild it from filtered history)
        this.rebuildHumanLog(filtered, projectDir);
      }
    } catch (error) {
      console.warn(`Warning: Failed to cleanup old logs: ${error}`);
    }
  }

  /**
   * Rebuild human-readable log from JSON history
   */
  private rebuildHumanLog(history: AuditOperation[], projectDir: string): void {
    const logPath = path.join(projectDir, 'audit.log');

    // Build the replacement first and swap it in. Deleting the log and then
    // appending entry by entry left a window where an interrupt would truncate
    // the audit trail permanently.
    try {
      const content = history.map(operation => this.formatLogEntry(operation) + '\n').join('');
      this.writeAtomically(logPath, content);
    } catch (error) {
      console.warn(`Warning: Failed to rebuild audit log: ${error}`);
    }
  }

  /**
   * Get audit history for a project
   *
   * @param repoRoot - Repository root
   * @returns Array of audit operations
   */
  getHistory(repoRoot: string): AuditOperation[] {
    const projectDir = ProjectIdentifier.getProjectDir(repoRoot);
    const historyPath = path.join(projectDir, 'sync-history.json');

    if (!existsSync(historyPath)) {
      return [];
    }

    try {
      const content = readFileSync(historyPath, 'utf8');
      return JSON.parse(content);
    } catch (error) {
      console.warn(`Warning: Failed to read sync history: ${error}`);
      return [];
    }
  }

  /**
   * Get recent audit operations
   *
   * @param repoRoot - Repository root
   * @param limit - Maximum number of operations to return
   * @returns Array of recent audit operations
   */
  getRecentHistory(repoRoot: string, limit: number = 10): AuditOperation[] {
    const history = this.getHistory(repoRoot);

    // Sort by timestamp (newest first)
    history.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());

    return history.slice(0, limit);
  }

  /**
   * Get audit statistics for a project
   *
   * @param repoRoot - Repository root
   * @returns Statistics object
   */
  getStatistics(repoRoot: string): AuditStatistics {
    const history = this.getHistory(repoRoot);

    const stats = {
      totalOperations: history.length,
      successfulOperations: 0,
      failedOperations: 0,
      totalAdded: 0,
      totalModified: 0,
      totalRemoved: 0,
      lastOperation: null as Date | null
    };

    for (const operation of history) {
      if (operation.success) {
        stats.successfulOperations++;
      } else {
        stats.failedOperations++;
      }

      stats.totalAdded += operation.changesApplied.added;
      stats.totalModified += operation.changesApplied.modified;
      stats.totalRemoved += operation.changesApplied.removed;
    }

    if (history.length > 0) {
      // Find most recent operation
      const sorted = history.sort(
        (a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()
      );
      stats.lastOperation = new Date(sorted[0].timestamp);
    }

    return stats;
  }

  /**
   * Clear all audit logs for a project
   *
   * @param repoRoot - Repository root
   */
  clearHistory(repoRoot: string): void {
    const projectDir = ProjectIdentifier.getProjectDir(repoRoot);
    const logPath = path.join(projectDir, 'audit.log');
    const historyPath = path.join(projectDir, 'sync-history.json');

    try {
      if (existsSync(logPath)) {
        unlinkSync(logPath);
      }

      if (existsSync(historyPath)) {
        unlinkSync(historyPath);
      }
    } catch (error) {
      console.warn(`Warning: Failed to clear audit history: ${error}`);
    }
  }

  /**
   * Create audit operation from sync result
   *
   * @param result - Sync result
   * @param source - Source label
   * @param target - Target label
   * @param backupCreated - Whether backup was created
   * @returns Audit operation
   */
  createAuditOperation(
    result: SyncResult,
    source: string,
    target: string,
    backupCreated: boolean
  ): AuditOperation {
    return {
      timestamp: new Date().toISOString(),
      operation: 'sync',
      source,
      target,
      changesApplied: {
        added: result.addedCount,
        modified: result.modifiedCount,
        removed: result.removedCount
      },
      variableDetails: this.includeValues
        ? {
            added: Array.from(result.addedKeys || []),
            modified: Array.from(result.modifiedKeys || []),
            removed: Array.from(result.removedKeys || [])
          }
        : undefined,
      success: result.success,
      error: result.error,
      backupCreated
    };
  }
}
