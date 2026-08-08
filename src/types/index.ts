/**
 * WorkForge v3.0 - TypeScript Type Definitions
 *
 * This file contains all TypeScript type definitions used throughout the application.
 * Following DRY principles - all types centralized here with no duplicates.
 */

// ============================================================================
// COMMAND CONFIGURATION TYPES
// ============================================================================

/**
 * Workspace configuration for create command
 */
export type WorkspaceConfig = {
  type: string;              // Branch type (feat, fix, doc, etc.)
  name: string;              // Branch name (kebab-case)
  base?: string;             // Base branch; undefined means "auto-detect"
  yes: boolean;              // Skip confirmations
  ticketId?: string;         // Optional Jira ticket ID
};

/**
 * Outcome of primary-branch auto-detection
 */
export type PrimaryBranchDetection = {
  branch: string;            // Detected primary branch name
  source: string;            // How it was determined (for logging)
};

/**
 * Where a new branch should fork from
 */
export type BranchStartPoint = {
  base: string;              // Base branch name, unqualified
  startPoint: string | null; // Git revision to branch from; null when unresolvable
  source: 'remote' | 'local' | 'committish' | 'missing';
  isStale: boolean;          // True when falling back to a local ref despite a remote
};

/**
 * Path configuration for worktree
 */
export type PathConfig = {
  repoRoot: string;          // Absolute path to main repository
  workspaceParent: string;   // Parent directory (e.g., ../feat)
  workspacePath: string;     // Full worktree path
  branchName: string;        // Git branch name
};

/**
 * Command options for close
 */
export type CloseOptions = {
  path?: string;
  name?: string;
  force: boolean;
  deleteBranch: boolean;
  skipSync: boolean;         // Skip environment sync
  yes: boolean;
  dryRun: boolean;
};

/**
 * Command options for sync-env
 */
export type SyncEnvOptions = {
  from?: string;
  to?: string;
  between?: string;
  yes: boolean;
  dryRun: boolean;
};

/**
 * Command options for list
 */
export type ListOptions = {
  all: boolean;
  json: boolean;             // Output as JSON
  simple: boolean;           // Simple one-line format
  sortBy?: 'name' | 'path' | 'age';
};

/**
 * Command options for cleanup
 */
export type CleanupOptions = {
  olderThan?: number;        // Days
  dryRun: boolean;
  yes: boolean;
};

// ============================================================================
// WORKTREE & REPOSITORY TYPES
// ============================================================================

/**
 * Information about a worktree
 */
export type WorktreeInfo = {
  path: string;              // Absolute path to worktree
  branchName: string;        // Associated branch name
  isMainRepo: boolean;       // True if this is the main repository
  commitHash: string;        // Current HEAD commit SHA
  commitTimestamp?: number;  // HEAD commit time, Unix seconds (for age sorting)
  remoteUrl?: string;        // Git remote origin URL
  isLocked: boolean;         // Whether worktree is locked
  isPrunable: boolean;       // Whether worktree can be pruned
};

/**
 * Safety check results before closing worktree
 */
export type SafetyCheckResult = {
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
};

/**
 * Project metadata
 */
export type ProjectMetadata = {
  projectId: string;         // SHA-256 hash of remote URL
  remoteUrl: string;         // Git remote origin URL
  repoPath: string;          // Absolute path to repository
  repoName: string;          // Repository directory name
  createdAt: string;         // ISO 8601 timestamp
  lastAccessed: string;      // ISO 8601 timestamp
};

// ============================================================================
// ENVIRONMENT VARIABLE TYPES
// ============================================================================

/**
 * Parsed environment variable
 */
export type EnvVariable = {
  key: string;               // Variable name
  value: string;             // Variable value
  lineNumber?: number;       // Line number in original file
  comment?: string;          // Inline comment if present
  hasQuotes?: boolean;       // Whether value was quoted
  quoteType?: 'single' | 'double';
  raw?: string;              // Exact original text; re-emitted verbatim when untouched
  leadingTrivia?: string[];  // Comment/blank lines immediately above this variable
};

/**
 * A parsed .env file, including the trivia that follows the last variable
 */
export type ParsedEnvFile = {
  variables: Map<string, EnvVariable>;
  trailingTrivia: string[];  // Comment/blank lines after the final variable
};

/**
 * Modified environment variable
 */
export type EnvModification = {
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
};

/**
 * Environment file diff result
 */
export type EnvDiff = {
  added: EnvVariable[];      // Variables to add
  removed: EnvVariable[];    // Variables to remove
  modified: EnvModification[];
  unchanged: EnvVariable[];
  targets?: SyncTargets;     // Associated sync targets
};

// ============================================================================
// SYNC OPERATION TYPES
// ============================================================================

/**
 * User's sync decision
 */
export type SyncDecision = {
  addedKeys: Set<string>;    // Keys of added vars to sync
  modifiedKeys: Set<string>; // Keys of modified vars to sync
  removedKeys: Set<string>;  // Keys of removed vars to sync (delete)
  syncAll: boolean;          // User chose to sync all
  cancel?: boolean;          // User chose to cancel (optional, defaults to false)
};

/**
 * Sync operation result
 */
export type SyncResult = {
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
};

/**
 * Source and target for sync operation
 */
export type SyncTargets = {
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
};

// ============================================================================
// BACKUP & AUDIT TYPES
// ============================================================================

/**
 * Backup information
 */
export type BackupInfo = {
  fileName: string;          // Filename
  filePath: string;          // Absolute path
  size: number;              // File size in bytes
  createdAt: Date;           // Creation timestamp
  timestamp: Date;           // Alias for createdAt
  ageInDays: number;         // Age in days
};

/**
 * Audit log operation record
 */
export type AuditOperation = {
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
};

// ============================================================================
// CONFIGURATION TYPES
// ============================================================================

/**
 * Global configuration
 */
export type Config = {
  version: string;
  preferences: {
    defaultBaseBranch: string;
    autoDetectBaseBranch: boolean;
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
};

/**
 * Generic config value type for dynamic access
 */
export type ConfigValue =
  | string
  | number
  | boolean
  | ConfigObject
  | ConfigArray;

export type ConfigObject = {
  [key: string]: ConfigValue;
};

export type ConfigArray = ConfigValue[];

/**
 * Generic config path - allows any nested path
 */
export type ConfigPath = string;

/**
 * Package manager detection result
 */
export type PackageManagerInfo = {
  manager: 'npm' | 'pnpm' | 'yarn';
  command: string;
  args: string[];
  lockFile: string;
};

// ============================================================================
// NEW CONSOLIDATED TYPES (DRY - No Duplicates)
// ============================================================================

/**
 * Standard operation result (consolidated from 6 duplicate patterns)
 * Replaces all inline { success, message } and { success, message, warnings } types
 */
export type OperationResult = {
  success: boolean;
  message: string;
  warnings?: string[];       // Optional - consolidates both patterns
};

/**
 * Validation result (consolidated from 2 patterns)
 * Replaces all inline { valid, error } types
 */
export type ValidationResult = {
  valid: boolean;
  errors?: string[];         // Plural - handles both single and multiple errors
};

/**
 * Resolved path information for sync operations
 */
export type ResolvedPath = {
  label: string;
  envPath: string;
  repoPath: string;
};

/**
 * Worktree removal strategy
 */
export type RemovalStrategy = {
  strategy: 'remove' | 'prune' | 'force-remove';
  reason: string;
};

/**
 * Environment diff summary
 */
export type DiffSummary = {
  addedCount: number;
  removedCount: number;
  modifiedCount: number;
  unchangedCount: number;
  totalChanges: number;
  hasChanges: boolean;
};

/**
 * Dry run result for sync preview
 */
export type DryRunResult = {
  wouldAdd: string[];
  wouldModify: string[];
  wouldRemove: string[];
};

/**
 * Audit statistics
 */
export type AuditStatistics = {
  totalOperations: number;
  successfulOperations: number;
  failedOperations: number;
  totalAdded: number;
  totalModified: number;
  totalRemoved: number;
  lastOperation: Date | null;
};

/**
 * Branch deletion recommendation
 */
export type BranchDeletionRecommendation = {
  shouldDelete: boolean;
  requiresForce: boolean;
  message: string;
};

/**
 * Related branches information
 */
export type RelatedBranches = {
  local: boolean;
  remote: string[];
};

/**
 * Parsed value from .env file (internal parsing type)
 */
export type ParsedValue = {
  value: string;
  hasQuotes: boolean;
  quoteType?: 'single' | 'double';
  comment?: string;
};

/**
 * Multiline start detection result (internal parsing type)
 */
export type MultilineStart = {
  key: string;
} | null;

/**
 * Package.json structure
 */
export type PackageJson = {
  name: string;
  version: string;
  [key: string]: ConfigValue;
};

// ============================================================================
// ERROR HANDLING TYPES
// ============================================================================

/**
 * Normalized error structure for safe error handling
 * Use with toError() utility to safely handle any thrown value
 */
export type ErrorLike = {
  message: string;
  stack?: string;
  name?: string;
};
