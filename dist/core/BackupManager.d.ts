import { ConfigManager } from './ConfigManager.js';
import { BackupInfo } from '../types/index.js';
/**
 * Backup Manager
 *
 * Manages environment file backups with automatic cleanup:
 * - Creates timestamped backups in ~/.workforge/backups/<project-id>/
 * - Maintains configurable maximum number of backups (default: 10)
 * - Auto-cleanup of old backups when limit exceeded
 * - Support for listing, restoring, and deleting backups
 */
export declare class BackupManager {
    private configManager;
    private maxBackups;
    private backupEnabled;
    constructor(configManager?: ConfigManager);
    /**
     * Load backup configuration
     */
    private loadConfig;
    /**
     * Create backup of an environment file
     *
     * @param envPath - Path to .env file to backup
     * @param repoRoot - Repository root (for project ID)
     * @returns Path to created backup file
     * @throws Error if backup fails
     */
    createBackup(envPath: string, repoRoot: string): string;
    /**
     * List all backups for a project
     *
     * @param repoRoot - Repository root
     * @returns Array of backup information
     */
    listBackups(repoRoot: string): BackupInfo[];
    /**
     * Restore a backup to a target location
     *
     * @param backupPath - Path to backup file
     * @param targetPath - Target path to restore to
     * @throws Error if restore fails
     */
    restore(backupPath: string, targetPath: string): void;
    /**
     * Delete a specific backup
     *
     * @param backupPath - Path to backup file to delete
     * @throws Error if deletion fails
     */
    deleteBackup(backupPath: string): void;
    /**
     * Cleanup old backups, keeping only the most recent N backups
     *
     * @param backupDir - Backup directory path
     */
    private cleanupOldBackups;
    /**
     * Generate timestamp for backup filename
     *
     * Format: YYYY-MM-DD_HH-mm-ss
     *
     * @returns Timestamp string
     */
    private generateTimestamp;
    /**
     * Get the most recent backup for a project
     *
     * @param repoRoot - Repository root
     * @returns Most recent backup info or null if none exist
     */
    getMostRecentBackup(repoRoot: string): BackupInfo | null;
    /**
     * Get total size of all backups for a project
     *
     * @param repoRoot - Repository root
     * @returns Total size in bytes
     */
    getTotalBackupSize(repoRoot: string): number;
    /**
     * Delete all backups for a project
     *
     * @param repoRoot - Repository root
     * @returns Number of backups deleted
     */
    deleteAllBackups(repoRoot: string): number;
    /**
     * Delete backups older than a specific date
     *
     * @param repoRoot - Repository root
     * @param olderThan - Date threshold
     * @returns Number of backups deleted
     */
    deleteBackupsOlderThan(repoRoot: string, olderThan: Date): number;
    /**
     * Check if backups exist for a project
     *
     * @param repoRoot - Repository root
     * @returns True if backups exist
     */
    hasBackups(repoRoot: string): boolean;
    /**
     * Get backup count for a project
     *
     * @param repoRoot - Repository root
     * @returns Number of backups
     */
    getBackupCount(repoRoot: string): number;
    /**
     * Format backup size for display
     *
     * @param bytes - Size in bytes
     * @returns Formatted string (e.g., "1.5 KB", "2.3 MB")
     */
    formatSize(bytes: number): string;
    /**
     * Format backup age for display
     *
     * @param createdAt - Backup creation date
     * @returns Formatted string (e.g., "2 hours ago", "3 days ago")
     */
    formatAge(createdAt: Date): string;
}
//# sourceMappingURL=BackupManager.d.ts.map