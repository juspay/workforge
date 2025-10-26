/**
 * WorkForge v3.0 - TypeScript Type Definitions
 *
 * This file contains all TypeScript interfaces and types used throughout the application.
 */
/**
 * Workspace configuration for create command
 */
export interface WorkspaceConfig {
    type: string;
    name: string;
    base: string;
    yes: boolean;
    ticketId?: string;
}
/**
 * Path configuration for worktree
 */
export interface PathConfig {
    repoRoot: string;
    workspaceParent: string;
    workspacePath: string;
    branchName: string;
}
/**
 * Information about a worktree
 */
export interface WorktreeInfo {
    path: string;
    branchName: string;
    isMainRepo: boolean;
    commitHash: string;
    remoteUrl?: string;
    isLocked: boolean;
    isPrunable: boolean;
}
/**
 * Safety check results before closing worktree
 */
export interface SafetyCheckResult {
    canClose: boolean;
    warnings: string[];
    hasUncommittedChanges: boolean;
    uncommittedFiles?: string[];
    hasUnpushedCommits: boolean;
    commitsAhead?: number;
    commitsBehind?: number;
    isMerged: boolean;
    mergedInto?: string[];
    hasRemoteBranch: boolean;
    remoteName?: string;
    isDetachedHead: boolean;
    isMergeInProgress: boolean;
    isRebaseInProgress: boolean;
}
/**
 * Parsed environment variable
 */
export interface EnvVariable {
    key: string;
    value: string;
    lineNumber?: number;
    comment?: string;
    hasQuotes?: boolean;
    quoteType?: 'single' | 'double';
}
/**
 * Environment file diff result
 */
export interface EnvDiff {
    added: EnvVariable[];
    removed: EnvVariable[];
    modified: EnvModification[];
    unchanged: EnvVariable[];
    targets?: SyncTargets;
}
/**
 * Modified environment variable
 */
export interface EnvModification {
    key: string;
    oldValue: string;
    newValue: string;
    oldLineNumber?: number;
    newLineNumber?: number;
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
    addedKeys: Set<string>;
    modifiedKeys: Set<string>;
    removedKeys: Set<string>;
    syncAll: boolean;
    cancel?: boolean;
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
    addedKeys?: string[];
    modifiedKeys?: string[];
    removedKeys?: string[];
    errors: string[];
    error?: string;
}
/**
 * Source and target for sync operation
 */
export interface SyncTargets {
    sourcePath: string;
    targetPath: string;
    sourceLabel: string;
    targetLabel: string;
    source?: {
        path: string;
        envPath: string;
        type: 'main-repo' | 'worktree';
        branchName?: string;
    };
    target?: {
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
    id?: string;
    timestamp: string;
    operation: 'create' | 'close' | 'sync';
    source: string;
    target: string;
    user?: string;
    changesApplied: {
        added: number;
        modified: number;
        removed: number;
    };
    variableDetails?: {
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
    projectId: string;
    remoteUrl: string;
    repoPath: string;
    repoName: string;
    createdAt: string;
    lastAccessed: string;
}
/**
 * Backup information
 */
export interface BackupInfo {
    fileName: string;
    filePath: string;
    size: number;
    createdAt: Date;
    timestamp: Date;
    ageInDays: number;
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
    skipSync: boolean;
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
    json: boolean;
    simple: boolean;
    sortBy?: 'name' | 'path' | 'age';
}
/**
 * Command options for cleanup
 */
export interface CleanupOptions {
    olderThan?: number;
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
//# sourceMappingURL=index.d.ts.map