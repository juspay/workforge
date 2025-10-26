import { ConfigManager } from './ConfigManager.js';
import { AuditOperation, SyncResult } from '../types/index.js';
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
export declare class AuditLogger {
    private configManager;
    private auditEnabled;
    private includeValues;
    private retentionDays;
    constructor(configManager?: ConfigManager);
    /**
     * Load audit configuration
     */
    private loadConfig;
    /**
     * Log an audit operation
     *
     * @param operation - Audit operation details
     * @param repoRoot - Repository root path
     */
    log(operation: AuditOperation, repoRoot: string): void;
    /**
     * Append operation to human-readable log file
     */
    private appendToLog;
    /**
     * Format operation as human-readable log entry
     */
    private formatLogEntry;
    /**
     * Add operation to JSON history
     */
    private addToHistory;
    /**
     * Cleanup old logs based on retention days
     */
    private cleanupOldLogs;
    /**
     * Rebuild human-readable log from JSON history
     */
    private rebuildHumanLog;
    /**
     * Get audit history for a project
     *
     * @param repoRoot - Repository root
     * @returns Array of audit operations
     */
    getHistory(repoRoot: string): AuditOperation[];
    /**
     * Get recent audit operations
     *
     * @param repoRoot - Repository root
     * @param limit - Maximum number of operations to return
     * @returns Array of recent audit operations
     */
    getRecentHistory(repoRoot: string, limit?: number): AuditOperation[];
    /**
     * Get audit statistics for a project
     *
     * @param repoRoot - Repository root
     * @returns Statistics object
     */
    getStatistics(repoRoot: string): {
        totalOperations: number;
        successfulOperations: number;
        failedOperations: number;
        totalAdded: number;
        totalModified: number;
        totalRemoved: number;
        lastOperation: Date | null;
    };
    /**
     * Clear all audit logs for a project
     *
     * @param repoRoot - Repository root
     */
    clearHistory(repoRoot: string): void;
    /**
     * Create audit operation from sync result
     *
     * @param result - Sync result
     * @param source - Source label
     * @param target - Target label
     * @param backupCreated - Whether backup was created
     * @returns Audit operation
     */
    createAuditOperation(result: SyncResult, source: string, target: string, backupCreated: boolean): AuditOperation;
}
//# sourceMappingURL=AuditLogger.d.ts.map