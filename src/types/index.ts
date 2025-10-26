/**
 * WorkForge v3.0 - TypeScript Type Definitions
 *
 * This file contains all TypeScript interfaces and types used throughout the application.
 */

/**
 * Workspace configuration for create command
 */
export interface WorkspaceConfig {
  type: string;              // Branch type (feat, fix, doc, etc.)
  name: string;              // Branch name (kebab-case)
  base: string;              // Base branch to checkout from
  yes: boolean;              // Skip confirmations
  ticketId?: string;         // Optional Jira ticket ID
}

/**
 * Path configuration for worktree
 */
export interface PathConfig {
  repoRoot: string;          // Absolute path to main repository
  workspaceParent: string;   // Parent directory (e.g., ../feat)
  workspacePath: string;     // Full worktree path
  branchName: string;        // Git branch name
}

/**
 * Information about a worktree
 */
export interface WorktreeInfo {
  path: string;              // Absolute path to worktree
  branchName: string;        // Associated branch name
  isMainRepo: boolean;       // True if this is the main repository
  commitHash: string;        // Current HEAD commit SHA
  remoteUrl?: string;        // Git remote origin URL
  isLocked: boolean;         // Whether worktree is locked
  isPrunable: boolean;       // Whether worktree can be pruned
}

/**
 * Safety check results before closing worktree
 */
export interface SafetyCheckResult {
  canClose: boolean;         // Can we close the worktree?
  warnings: string[];        // Non-blocking warnings

  hasUncommittedChanges: boolean;
  uncommittedFiles?: string[];

  hasUnpushedCommits: boolean;
  commitsAhead?: number;
  commitsBehind?: number;

  isMerged: boolean;         // Is branch merged?
  mergedInto?: string[];     // Branches this is merged into

  hasRemoteBranch: boolean;  // Does remote branch exist?
  remoteName?: string;       // e.g., 'origin/feat/user-auth'

  isDetachedHead: boolean;
  isMergeInProgress: boolean;
  isRebaseInProgress: boolean;
}

/**
 * Parsed environment variable
 */
export interface EnvVariable {
  key: string;               // Variable name
  value: string;             // Variable value
  lineNumber?: number;       // Line number in original file
  comment?: string;          // Inline comment if present
  hasQuotes?: boolean;       // Whether value was quoted
  quoteType?: 'single' | 'double';
}

/**
 * Environment file diff result
 */
export interface EnvDiff {
  added: EnvVariable[];      // Variables to add
  removed: EnvVariable[];    // Variables to remove
  modified: EnvModification[];
  unchanged: EnvVariable[];
  targets?: SyncTargets;     // Associated sync targets
}

/**
 * Modified environment variable
 */
export interface EnvModification {
  key: string;
  oldValue: string;          // Value in source
  newValue: string;          // Value in target
  oldLineNumber?: number;    // Line number in source
  newLineNumber?: number;    // Line number in target
  oldComment?: string;
  newComment?: string;
  oldHasQuotes?: boolean;
  newHasQuotes?: boolean;
  oldQuoteType?: 'single' | 'double';
  newQuoteType?: 'single' | 'double';
}

/**
 * User's sync decision
 */
export interface SyncDecision {
  addedKeys: Set<string>;    // Keys of added vars to sync
  modifiedKeys: Set<string>; // Keys of modified vars to sync
  removedKeys: Set<string>;  // Keys of removed vars to sync (delete)
  syncAll: boolean;          // User chose to sync all
  cancel?: boolean;          // User chose to cancel (optional, defaults to false)
}

/**
 * Sync operation result
 */
export interface SyncResult {
  success: boolean;
  backupPath?: string;
  backupCreated: boolean;
  addedCount: number;
  modifiedCount: number;
  removedCount: number;
  addedKeys?: string[];      // Keys that were added
  modifiedKeys?: string[];   // Keys that were modified
  removedKeys?: string[];    // Keys that were removed
  errors: string[];
  error?: string;            // Single error message for compatibility
}

/**
 * Source and target for sync operation
 */
export interface SyncTargets {
  sourcePath: string;        // Full path to source .env
  targetPath: string;        // Full path to target .env
  sourceLabel: string;       // Display label (e.g., "Main (project)")
  targetLabel: string;       // Display label (e.g., "Worktree (feat-auth)")
  source?: {                 // Optional detailed source info
    path: string;            // Directory path
    envPath: string;         // Full path to .env file
    type: 'main-repo' | 'worktree';
    branchName?: string;
  };
  target?: {                 // Optional detailed target info
    path: string;
    envPath: string;
    type: 'main-repo' | 'worktree';
    branchName?: string;
  };
}

/**
 * Audit log operation record
 */
export interface AuditOperation {
  id?: string;               // UUID (added by logger)
  timestamp: string;         // ISO 8601 timestamp
  operation: 'create' | 'close' | 'sync';
  source: string;            // Display label
  target: string;            // Display label
  user?: string;             // System username
  changesApplied: {
    added: number;
    modified: number;
    removed: number;
  };
  variableDetails?: {        // Optional (depends on config)
    added: string[];
    modified: string[];
    removed: string[];
  };
  success: boolean;
  backupCreated: boolean;
  backup?: {
    path: string;
    size: number;
  };
  status?: 'success' | 'failure' | 'partial';
  error?: string;
}

/**
 * Project metadata
 */
export interface ProjectMetadata {
  projectId: string;         // SHA-256 hash of remote URL
  remoteUrl: string;         // Git remote origin URL
  repoPath: string;          // Absolute path to repository
  repoName: string;          // Repository directory name
  createdAt: string;         // ISO 8601 timestamp
  lastAccessed: string;      // ISO 8601 timestamp
}

/**
 * Backup information
 */
export interface BackupInfo {
  fileName: string;          // Filename
  filePath: string;          // Absolute path
  size: number;              // File size in bytes
  createdAt: Date;           // Creation timestamp
  timestamp: Date;           // Alias for createdAt
  ageInDays: number;         // Age in days
}

/**
 * Global configuration
 */
export interface Config {
  version: string;
  preferences: {
    defaultBaseBranch: string;
    autoDeleteBranch: boolean;
    skipConfirmations: boolean;
    packageManager: 'auto' | 'npm' | 'pnpm' | 'yarn';
    showExistingWorktrees: boolean;
  };
  backup: {
    enabled: boolean;
    maxBackupsPerProject: number;
    autoCleanup: boolean;
  };
  sync: {
    createBackupBeforeSync: boolean;
    defaultSyncDirection: 'ask' | 'to-main' | 'to-worktree';
  };
  audit: {
    enabled: boolean;
    includeVariableValues: boolean;
    retentionDays: number;
  };
  display: {
    colorEnabled: boolean;
    verboseOutput: boolean;
    showProgressIndicators: boolean;
  };
}

/**
 * Command options for close
 */
export interface CloseOptions {
  path?: string;
  name?: string;
  force: boolean;
  deleteBranch: boolean;
  skipSync: boolean;         // Skip environment sync
  yes: boolean;
  dryRun: boolean;
}

/**
 * Command options for sync-env
 */
export interface SyncEnvOptions {
  from?: string;
  to?: string;
  between?: string;
  yes: boolean;
  dryRun: boolean;
}

/**
 * Command options for list
 */
export interface ListOptions {
  all: boolean;
  json: boolean;             // Output as JSON
  simple: boolean;           // Simple one-line format
  sortBy?: 'name' | 'path' | 'age';
}

/**
 * Command options for cleanup
 */
export interface CleanupOptions {
  olderThan?: number;        // Days
  dryRun: boolean;
  yes: boolean;
}

/**
 * Package manager detection result
 */
export interface PackageManagerInfo {
  manager: 'npm' | 'pnpm' | 'yarn';
  command: string;
  args: string[];
  lockFile: string;
}
