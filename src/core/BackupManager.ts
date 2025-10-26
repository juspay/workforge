import { existsSync, readFileSync, writeFileSync, mkdirSync, readdirSync, statSync, unlinkSync, copyFileSync } from 'fs';
import * as path from 'path';
import { ProjectIdentifier } from './ProjectIdentifier.js';
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
export class BackupManager {
  private configManager: ConfigManager;
  private maxBackups!: number;
  private backupEnabled!: boolean;

  constructor(configManager?: ConfigManager) {
    this.configManager = configManager || new ConfigManager();
    this.loadConfig();
  }

  /**
   * Load backup configuration
   */
  private loadConfig(): void {
    try {
      const config = this.configManager.load();
      this.maxBackups = config.backup.maxBackupsPerProject;
      this.backupEnabled = config.backup.enabled;
    } catch {
      // Fallback to defaults
      this.maxBackups = 10;
      this.backupEnabled = true;
    }
  }

  /**
   * Create backup of an environment file
   *
   * @param envPath - Path to .env file to backup
   * @param repoRoot - Repository root (for project ID)
   * @returns Path to created backup file
   * @throws Error if backup fails
   */
  createBackup(envPath: string, repoRoot: string): string {
    if (!this.backupEnabled) {
      throw new Error('Backups are disabled in configuration');
    }

    if (!existsSync(envPath)) {
      throw new Error(`Environment file not found: ${envPath}`);
    }

    // Generate project ID
    const projectId = ProjectIdentifier.generateId(repoRoot);

    // Get backup directory
    const backupDir = ProjectIdentifier.getBackupDir(repoRoot);

    // Create backup directory if it doesn't exist
    if (!existsSync(backupDir)) {
      mkdirSync(backupDir, { recursive: true });
    }

    // Generate timestamp-based backup filename
    const timestamp = this.generateTimestamp();
    const backupFileName = `.env.backup.${timestamp}`;
    const backupPath = path.join(backupDir, backupFileName);

    // Copy file to backup location
    try {
      copyFileSync(envPath, backupPath);
    } catch (error) {
      throw new Error(`Failed to create backup: ${error}`);
    }

    // Cleanup old backups if needed
    if (this.configManager.load().backup.autoCleanup) {
      this.cleanupOldBackups(backupDir);
    }

    return backupPath;
  }

  /**
   * List all backups for a project
   *
   * @param repoRoot - Repository root
   * @returns Array of backup information
   */
  listBackups(repoRoot: string): BackupInfo[] {
    const backupDir = ProjectIdentifier.getBackupDir(repoRoot);

    if (!existsSync(backupDir)) {
      return [];
    }

    const files = readdirSync(backupDir);
    const backups: BackupInfo[] = [];

    for (const file of files) {
      if (file.startsWith('.env.backup.')) {
        const filePath = path.join(backupDir, file);
        const stats = statSync(filePath);

        // Extract timestamp from filename
        const timestampMatch = file.match(/\.env\.backup\.(.+)$/);
        const timestamp = timestampMatch ? timestampMatch[1] : '';

        backups.push({
          fileName: file,
          filePath,
          createdAt: stats.mtime,
          size: stats.size,
          timestamp: stats.mtime,
          ageInDays: Math.floor((Date.now() - stats.mtime.getTime()) / (1000 * 60 * 60 * 24))
        });
      }
    }

    // Sort by creation time (newest first)
    backups.sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());

    return backups;
  }

  /**
   * Restore a backup to a target location
   *
   * @param backupPath - Path to backup file
   * @param targetPath - Target path to restore to
   * @throws Error if restore fails
   */
  restore(backupPath: string, targetPath: string): void {
    if (!existsSync(backupPath)) {
      throw new Error(`Backup file not found: ${backupPath}`);
    }

    try {
      copyFileSync(backupPath, targetPath);
    } catch (error) {
      throw new Error(`Failed to restore backup: ${error}`);
    }
  }

  /**
   * Delete a specific backup
   *
   * @param backupPath - Path to backup file to delete
   * @throws Error if deletion fails
   */
  deleteBackup(backupPath: string): void {
    if (!existsSync(backupPath)) {
      throw new Error(`Backup file not found: ${backupPath}`);
    }

    try {
      unlinkSync(backupPath);
    } catch (error) {
      throw new Error(`Failed to delete backup: ${error}`);
    }
  }

  /**
   * Cleanup old backups, keeping only the most recent N backups
   *
   * @param backupDir - Backup directory path
   */
  private cleanupOldBackups(backupDir: string): void {
    if (!existsSync(backupDir)) {
      return;
    }

    const files = readdirSync(backupDir);
    const backupFiles: { name: string; path: string; mtime: Date }[] = [];

    // Collect all backup files with their modification times
    for (const file of files) {
      if (file.startsWith('.env.backup.')) {
        const filePath = path.join(backupDir, file);
        const stats = statSync(filePath);

        backupFiles.push({
          name: file,
          path: filePath,
          mtime: stats.mtime
        });
      }
    }

    // Sort by modification time (newest first)
    backupFiles.sort((a, b) => b.mtime.getTime() - a.mtime.getTime());

    // Delete backups beyond the limit
    if (backupFiles.length > this.maxBackups) {
      const toDelete = backupFiles.slice(this.maxBackups);

      for (const backup of toDelete) {
        try {
          unlinkSync(backup.path);
        } catch (error) {
          console.warn(`Warning: Failed to delete old backup ${backup.name}: ${error}`);
        }
      }
    }
  }

  /**
   * Generate timestamp for backup filename
   *
   * Format: YYYY-MM-DD_HH-mm-ss
   *
   * @returns Timestamp string
   */
  private generateTimestamp(): string {
    const now = new Date();

    const year = now.getFullYear();
    const month = String(now.getMonth() + 1).padStart(2, '0');
    const day = String(now.getDate()).padStart(2, '0');
    const hours = String(now.getHours()).padStart(2, '0');
    const minutes = String(now.getMinutes()).padStart(2, '0');
    const seconds = String(now.getSeconds()).padStart(2, '0');

    return `${year}-${month}-${day}_${hours}-${minutes}-${seconds}`;
  }

  /**
   * Get the most recent backup for a project
   *
   * @param repoRoot - Repository root
   * @returns Most recent backup info or null if none exist
   */
  getMostRecentBackup(repoRoot: string): BackupInfo | null {
    const backups = this.listBackups(repoRoot);

    if (backups.length === 0) {
      return null;
    }

    return backups[0]; // Already sorted by creation time (newest first)
  }

  /**
   * Get total size of all backups for a project
   *
   * @param repoRoot - Repository root
   * @returns Total size in bytes
   */
  getTotalBackupSize(repoRoot: string): number {
    const backups = this.listBackups(repoRoot);
    return backups.reduce((total, backup) => total + backup.size, 0);
  }

  /**
   * Delete all backups for a project
   *
   * @param repoRoot - Repository root
   * @returns Number of backups deleted
   */
  deleteAllBackups(repoRoot: string): number {
    const backups = this.listBackups(repoRoot);
    let deletedCount = 0;

    for (const backup of backups) {
      try {
        unlinkSync(backup.filePath);
        deletedCount++;
      } catch (error) {
        console.warn(`Warning: Failed to delete backup ${backup.fileName}: ${error}`);
      }
    }

    return deletedCount;
  }

  /**
   * Delete backups older than a specific date
   *
   * @param repoRoot - Repository root
   * @param olderThan - Date threshold
   * @returns Number of backups deleted
   */
  deleteBackupsOlderThan(repoRoot: string, olderThan: Date): number {
    const backups = this.listBackups(repoRoot);
    let deletedCount = 0;

    for (const backup of backups) {
      if (backup.createdAt < olderThan) {
        try {
          unlinkSync(backup.filePath);
          deletedCount++;
        } catch (error) {
          console.warn(`Warning: Failed to delete backup ${backup.fileName}: ${error}`);
        }
      }
    }

    return deletedCount;
  }

  /**
   * Check if backups exist for a project
   *
   * @param repoRoot - Repository root
   * @returns True if backups exist
   */
  hasBackups(repoRoot: string): boolean {
    const backups = this.listBackups(repoRoot);
    return backups.length > 0;
  }

  /**
   * Get backup count for a project
   *
   * @param repoRoot - Repository root
   * @returns Number of backups
   */
  getBackupCount(repoRoot: string): number {
    const backups = this.listBackups(repoRoot);
    return backups.length;
  }

  /**
   * Format backup size for display
   *
   * @param bytes - Size in bytes
   * @returns Formatted string (e.g., "1.5 KB", "2.3 MB")
   */
  formatSize(bytes: number): string {
    if (bytes < 1024) {
      return `${bytes} B`;
    } else if (bytes < 1024 * 1024) {
      return `${(bytes / 1024).toFixed(1)} KB`;
    } else {
      return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
    }
  }

  /**
   * Format backup age for display
   *
   * @param createdAt - Backup creation date
   * @returns Formatted string (e.g., "2 hours ago", "3 days ago")
   */
  formatAge(createdAt: Date): string {
    const now = new Date();
    const diffMs = now.getTime() - createdAt.getTime();
    const diffMinutes = Math.floor(diffMs / (1000 * 60));
    const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
    const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

    if (diffMinutes < 60) {
      return `${diffMinutes} minute${diffMinutes === 1 ? '' : 's'} ago`;
    } else if (diffHours < 24) {
      return `${diffHours} hour${diffHours === 1 ? '' : 's'} ago`;
    } else {
      return `${diffDays} day${diffDays === 1 ? '' : 's'} ago`;
    }
  }
}
