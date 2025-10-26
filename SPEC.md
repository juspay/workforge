# WorkForge v3.0 - Complete Technical Specification

**Version:** 3.0.0
**Last Updated:** 2025-10-26
**Status:** In Development

---

## Table of Contents

1. [Project Overview](#1-project-overview)
2. [Complete File Structure](#2-complete-file-structure)
3. [TypeScript Interfaces & Types](#3-typescript-interfaces--types)
4. [Command Specifications](#4-command-specifications)
5. [Core Module Specifications](#5-core-module-specifications)
6. [Configuration System](#6-configuration-system)
7. [Audit Logging System](#7-audit-logging-system)
8. [Backup Management System](#8-backup-management-system)
9. [UI/Display Systems](#9-uidisplay-systems)
10. [Workflows & Algorithms](#10-workflows--algorithms)
11. [Error Handling Strategy](#11-error-handling-strategy)
12. [Testing Requirements](#12-testing-requirements)
13. [Documentation Requirements](#13-documentation-requirements)
14. [Implementation Phases](#14-implementation-phases)
15. [Edge Cases & Security](#15-edge-cases--security)
16. [Migration from v2.0](#16-migration-from-v20)

---

## 1. Project Overview

### 1.1 Project Summary
WorkForge is a CLI tool for managing Git worktrees with intelligent environment variable synchronization, comprehensive audit logging, and automatic dependency management. Version 3.0 adds worktree closing, environment sync, configuration management, and audit trails.

### 1.2 Key Features

**v2.0 Features (Existing):**
- Automatic worktree creation with organized folder structure
- Smart repository detection (main repo and existing worktrees)
- Jira integration for internal Bitbucket repositories
- Package manager auto-detection (npm, pnpm, yarn)
- Auto dependency installation
- Environment file copying (.env)
- Default branch detection
- Pre-flight validation checks

**v3.0 Features (New):**
- Worktree closing with safety checks
- Intelligent .env synchronization with diff display
- Side-by-side environment variable comparison
- Audit logging (human and machine-readable)
- Backup management with auto-cleanup
- Configuration system
- Worktree listing and management
- Cleanup utilities
- Standalone environment sync between any two worktrees

### 1.3 Technical Stack
- **Language:** TypeScript 5.0+
- **Runtime:** Node.js 16.0+
- **Build Tool:** tsc (TypeScript Compiler)
- **Dependencies:**
  - yargs: CLI argument parsing
  - chalk: Terminal colors
  - inquirer: Interactive prompts
  - crypto: Hashing (built-in)
  - fs/path: File operations (built-in)
  - child_process: Git commands (built-in)

### 1.4 Target Platforms
- macOS (primary)
- Linux
- Windows (with Git Bash or WSL)

---

## 2. Complete File Structure

### 2.1 Source Code Structure

```
git-worktree-creator/
├── src/
│   ├── index.ts                       # Main entry point, CLI router
│   │
│   ├── commands/
│   │   ├── create.ts                  # Workspace creation (refactored)
│   │   ├── close.ts                   # Close worktree command
│   │   ├── sync-env.ts                # Sync environment command
│   │   ├── list.ts                    # List worktrees command
│   │   └── cleanup.ts                 # Cleanup backups/logs command
│   │
│   ├── core/
│   │   ├── WorktreeResolver.ts        # Worktree discovery & resolution
│   │   ├── SafetyChecker.ts           # Pre-close safety validation
│   │   ├── EnvFileParser.ts           # .env file parsing
│   │   ├── EnvDiffer.ts               # Environment diff generation
│   │   ├── EnvSyncer.ts               # Environment sync execution
│   │   ├── WorktreeRemover.ts         # Worktree removal logic
│   │   ├── BranchCleaner.ts           # Branch cleanup logic
│   │   ├── ConfigManager.ts           # Configuration management
│   │   ├── AuditLogger.ts             # Audit trail logging
│   │   ├── BackupManager.ts           # Backup creation & cleanup
│   │   └── ProjectIdentifier.ts      # Project ID generation
│   │
│   ├── ui/
│   │   ├── DiffDisplay.ts             # Side-by-side diff rendering
│   │   ├── SyncPrompt.ts              # Interactive sync prompts
│   │   ├── ListDisplay.ts             # Worktree list formatting
│   │   └── Logger.ts                  # Colored console output
│   │
│   └── types/
│       └── index.ts                   # All TypeScript interfaces
│
├── dist/                              # Compiled JavaScript output
│
├── node_modules/                      # Dependencies
│
├── package.json                       # Project metadata & scripts
├── package-lock.json                  # Dependency lock file
├── tsconfig.json                      # TypeScript configuration
│
├── README.md                          # Project overview
├── INSTALLATION_GUIDE.md              # Installation instructions
├── CLAUDE.md                          # AI assistant guidance
├── SPEC.md                            # This document
│
└── docs/
    ├── configuration.md               # Config file reference
    ├── advanced-usage.md              # Advanced features
    ├── sync-operations.md             # Environment sync guide
    └── troubleshooting.md             # Common issues
```

### 2.2 User Data Structure

```
~/.workforge/
├── config.json                        # Global configuration
│
├── projects/
│   ├── a1b2c3d4/                      # Project ID (SHA-256 hash)
│   │   ├── .meta.json                 # Project metadata
│   │   ├── audit.log                  # Human-readable audit log
│   │   └── sync-history.json          # Machine-readable history
│   │
│   ├── e5f6g7h8/                      # Another project
│   │   ├── .meta.json
│   │   ├── audit.log
│   │   └── sync-history.json
│   │
│   └── ...
│
└── backups/
    ├── a1b2c3d4/                      # Project ID matches
    │   ├── .env.backup.2025-10-26T14-30-45
    │   ├── .env.backup.2025-10-26T15-00-12
    │   └── ... (up to 10 backups per project)
    │
    ├── e5f6g7h8/
    │   └── .env.backup.2025-10-27T09-15-33
    │
    └── ...
```

---

## 3. TypeScript Interfaces & Types

### 3.1 Core Types

```typescript
// src/types/index.ts

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
  hasUncommittedChanges: boolean;
  uncommittedFiles: string[];

  hasUnpushedCommits: boolean;
  commitsAhead: number;
  commitsBehind: number;

  isBranchMerged: boolean;
  mergedInto: string[];      // Branches this is merged into

  isRemoteBranch: boolean;
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
  lineNumber: number;        // Line number in original file
  comment?: string;          // Inline comment if present
  hasQuotes: boolean;        // Whether value was quoted
  quoteType?: 'single' | 'double';
}

/**
 * Environment file diff result
 */
export interface EnvDiff {
  added: EnvVariable[];      // In target, not in source
  removed: EnvVariable[];    // In source, not in target
  modified: EnvModification[];
  unchanged: EnvVariable[];
}

/**
 * Modified environment variable
 */
export interface EnvModification {
  key: string;
  sourceValue: string;
  targetValue: string;
  sourceLineNumber: number;
  targetLineNumber: number;
}

/**
 * User's sync decision
 */
export interface SyncDecision {
  syncAdded: string[];       // Keys of added vars to sync
  syncModified: string[];    // Keys of modified vars to sync
  syncRemoved: string[];     // Keys of removed vars to sync (delete)
  skipAll: boolean;          // User chose to skip sync entirely
}

/**
 * Sync operation result
 */
export interface SyncResult {
  backupPath?: string;
  addedCount: number;
  modifiedCount: number;
  removedCount: number;
  errors: string[];
  success: boolean;
}

/**
 * Source and target for sync operation
 */
export interface SyncTargets {
  source: {
    path: string;            // Directory path
    envPath: string;         // Full path to .env file
    type: 'main-repo' | 'worktree';
    branchName?: string;
  };
  target: {
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
  source: {
    path: string;
    branch?: string;
    commit?: string;
  };
  target: {
    path: string;
    branch?: string;
    commit?: string;
  };
  user: string;              // System username
  changes?: {
    added: Array<{key: string; value: string}>;
    modified: Array<{key: string; oldValue: string; newValue: string}>;
    removed: Array<{key: string; value: string}>;
  };
  backup?: {
    path: string;
    size: number;
  };
  status: 'success' | 'failure' | 'partial';
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
  name: string;              // Filename
  path: string;              // Absolute path
  size: number;              // File size in bytes
  created: Date;             // Creation timestamp
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
  deleteBranch?: boolean;
  keepBranch?: boolean;
  noSync: boolean;
  yes: boolean;
  dryRun: boolean;
}

/**
 * Command options for sync-env
 */
export interface SyncEnvOptions {
  from?: string;
  to?: string;
  fromName?: string;
  toName?: string;
  between?: string[];
  yes: boolean;
  dryRun: boolean;
  noBackup: boolean;
}

/**
 * Command options for list
 */
export interface ListOptions {
  all: boolean;
  format: 'table' | 'json' | 'simple';
  sort: 'name' | 'date' | 'branch' | 'type';
}

/**
 * Command options for cleanup
 */
export interface CleanupOptions {
  project?: string;
  olderThan?: number;       // Days
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
```

---

## 4. Command Specifications

### 4.1 Create Command (Enhanced)

**File:** `src/commands/create.ts`

#### 4.1.1 Command Signature
```bash
workforge create --type <type> --name <name> [options]
workforge <type> <name> [options]  # Shorthand

Options:
  -t, --type <type>       Branch type (feat, fix, doc, etc.) [required]
  -n, --name <name>       Branch name in kebab-case [required]
  -b, --base <branch>     Base branch to checkout from [default: auto-detect]
  -j, --ticket <id>       Jira ticket ID (format: BZ-12345)
  -y, --yes               Skip confirmations
  --no-install            Skip dependency installation
  --no-env-copy           Skip environment file copying
```

#### 4.1.2 Workflow
1. Load configuration (ConfigManager)
2. Validate inputs (type: letters only, name: kebab-case, ticket: format)
3. Discover repository (walk up directory tree, handle worktrees)
4. Detect default branch (symbolic-ref, common branches, current)
5. Detect repository type (check remote URL for bitbucket.juspay.net)
6. If internal repo and no ticket: prompt for Jira ticket ID
7. Calculate paths (../type/name structure, branch name)
8. **[NEW]** Show existing worktrees if config.showExistingWorktrees
9. Run pre-flight checks (Git binary, branch exists, path exists)
10. Confirm creation (unless --yes)
11. Create worktree (fetch, git worktree add -B)
12. Copy environment files (.env only)
13. Detect package manager (lock files)
14. Install dependencies
15. **[NEW]** Create project metadata if first worktree
16. **[NEW]** Log creation operation to audit
17. Show success summary

#### 4.1.3 Existing Worktree Display
```
📋 Existing worktrees (3):
  • feat/user-auth (3 days ago) - Clean
  • fix/memory-leak (2 hours ago) - Modified, 2 commits ahead
  • doc/api-guide (5 days ago) - Unmerged

Creating new worktree...
```

#### 4.1.4 Integration Points
- Uses ConfigManager for defaults
- Uses ProjectIdentifier to create/update metadata
- Uses AuditLogger to log creation
- Uses Logger for colored output

---

### 4.2 Close Command (New)

**File:** `src/commands/close.ts`

#### 4.2.1 Command Signature
```bash
workforge close [path]              # Close worktree by path
workforge close --name <name>       # Close by worktree name
workforge close                     # Auto-detect current worktree

Options:
  -n, --name <name>       Close worktree by name
  -f, --force             Force close with uncommitted changes
  -d, --delete-branch     Delete branch after removing worktree
  -k, --keep-branch       Keep branch after removing worktree
  --no-sync               Skip environment variable sync
  -y, --yes               Skip all confirmations
  --dry-run               Preview actions without executing
```

#### 4.2.2 Workflow
1. Load configuration
2. **Discover worktree:**
   - Pattern 1: Explicit path provided
   - Pattern 2: --name flag provided (search git worktree list)
   - Pattern 3: No args (auto-detect from current directory)
3. **Safety checks:**
   - Check for uncommitted changes (git status --porcelain)
   - Check for unpushed commits (git rev-list @{u}..HEAD)
   - Check if branch is merged (git branch --merged)
   - Check if branch exists on remote
   - Check for detached HEAD
   - Check for merge/rebase in progress
4. **Display warnings:**
   - Show uncommitted files with status
   - Show commit count ahead/behind
   - Show merge status
   - Show remote status
5. **Confirm or force:**
   - If --force: skip confirmation
   - Else: prompt user with safety info
6. **Environment sync** (unless --no-sync):
   - Parse .env from worktree and main repo
   - Generate diff (added, modified, removed)
   - Display side-by-side diff
   - Interactive line-by-line selection
   - Create backup of main repo .env
   - Apply sync decisions
7. **Remove worktree:**
   - Execute git worktree remove [--force]
8. **Branch cleanup:**
   - Determine action: delete, keep, or prompt
   - If merged: safe delete (git branch -d)
   - If not merged: force delete with confirmation (git branch -D)
   - Handle remote branch warning
9. **Audit logging:**
   - Log operation with all details
   - Include sync changes, backup path, status
10. **Show summary:**
    - Worktree removed
    - Branch deleted/kept
    - Environment synced (counts)
    - Backup location

#### 4.2.3 Safety Warning Example
```
⚠️  Warning: Uncommitted changes detected

Modified files (3):
  • src/index.ts (modified)
  • src/utils.ts (modified)
  • new-file.ts (untracked)

⚠️  Warning: 2 unpushed commits

⚠️  Warning: Branch 'feat/user-auth' is NOT merged into 'main'

❓ Force close anyway? This may LOSE uncommitted work! [y/N]:
```

#### 4.2.4 Environment Sync Display
```
┌─────────────────────────────────────────────────────────────────┐
│ Environment Variable Changes (.env)                              │
├─────────────────────────────────────────────────────────────────┤
│                                                                   │
│ ADDED (3 variables)                                               │
│ ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ │
│   NEW_API_KEY=sk_live_abc123def456                                │
│   DEBUG_MODE=true                                                 │
│   FEATURE_FLAG_X=enabled                                          │
│                                                                   │
│ MODIFIED (2 variables)                                            │
│ ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ │
│                                                                   │
│   DATABASE_URL                                                    │
│   ┌─ Main Repo ──────────────┬─ Worktree ────────────────┐      │
│   │ postgres://localhost/old │ postgres://localhost/new  │      │
│   └──────────────────────────┴───────────────────────────┘      │
│                                                                   │
│   API_ENDPOINT                                                    │
│   ┌─ Main Repo ──────────────┬─ Worktree ────────────────┐      │
│   │ https://api.old.com      │ https://api.new.com       │      │
│   └──────────────────────────┴───────────────────────────┘      │
│                                                                   │
│ REMOVED (1 variable)                                              │
│ ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ │
│   OLD_FEATURE_FLAG=true                                           │
│                                                                   │
└─────────────────────────────────────────────────────────────────┘

❓ Sync ADDED variables to main repo? [all/none/select]:
```

#### 4.2.5 Interactive Selection Example
```
❓ Sync ADDED variables to main repo? [all/none/select]: select
  [✓] NEW_API_KEY=sk_live_abc123def456
  [✓] DEBUG_MODE=true
  [ ] FEATURE_FLAG_X=enabled

❓ Sync MODIFIED variables to main repo? [all/none/select]: select

  DATABASE_URL:
    Main:     postgres://localhost/old
    Worktree: postgres://localhost/new
  ❓ Use worktree value? [Y/n]: y

  API_ENDPOINT:
    Main:     https://api.old.com
    Worktree: https://api.new.com
  ❓ Use worktree value? [Y/n]: n

❓ Remove DELETED variables from main repo? [all/none/select]: none
```

#### 4.2.6 Close Summary
```
┌─────────────────────────────────────────────────────────────┐
│ Worktree Close Summary                                       │
├─────────────────────────────────────────────────────────────┤
│ ✅ Worktree removed: ../feat/user-auth                       │
│ ✅ Branch deleted: feat/user-auth                            │
│ ✅ Environment synced:                                       │
│    • 2 variables added                                       │
│    • 1 variable modified                                     │
│    • 0 variables removed                                     │
│ 📁 Backup saved:                                             │
│    ~/.workforge/backups/a1b2c3d4/.env.backup.2025-10-26...  │
└─────────────────────────────────────────────────────────────┘
```

---

### 4.3 Sync-Env Command (New)

**File:** `src/commands/sync-env.ts`

#### 4.3.1 Command Signature
```bash
# Source to target patterns
workforge sync-env --from <path> --to <path>
workforge sync-env --from-name <name> --to-name <name>
workforge sync-env --to <path>              # From main to worktree
workforge sync-env --from <path>            # From worktree to main

# Bidirectional
workforge sync-env --between <path1> <path2>

Options:
  --from <path>           Source path
  --to <path>             Target path
  --from-name <name>      Source worktree name
  --to-name <name>        Target worktree name
  --between <p1> <p2>     Compare and choose direction
  -y, --yes               Auto-accept all changes
  --dry-run               Preview without executing
  --no-backup             Skip backup creation
```

#### 4.3.2 Workflow
1. Load configuration
2. **Resolve source and target:**
   - If --from and --to: use both
   - If only --from: from=worktree, to=main
   - If only --to: from=main, to=worktree
   - If --between: parse both, offer bidirectional choice
   - Support both path and name formats
3. **Validate .env files exist** in both locations
4. **Parse .env files** using EnvFileParser
5. **Generate diff** using EnvDiffer
6. **Display diff** using DiffDisplay (side-by-side)
7. **Get user decision:**
   - If --yes: sync all
   - If --between: ask direction first, then sync
   - Else: interactive line-by-line selection
8. **Create backup** (unless --no-backup)
9. **Perform sync** using EnvSyncer
10. **Audit logging** with all details
11. **Show summary** with counts and backup path

#### 4.3.3 Bidirectional Sync Display
```
┌─────────────────────────────────────────────────────────────┐
│ Comparing: feat/user-auth ↔ feat/payment                    │
├─────────────────────────────────────────────────────────────┤
│                                                               │
│ Variables only in feat/user-auth (3):                         │
│   NEW_AUTH_KEY=xyz                                            │
│   AUTH_TIMEOUT=5000                                           │
│   JWT_SECRET=secret123                                        │
│                                                               │
│ Variables only in feat/payment (2):                           │
│   PAYMENT_API_KEY=abc                                         │
│   STRIPE_KEY=sk_test_123                                      │
│                                                               │
│ Different values (1):                                         │
│   API_ENDPOINT:                                               │
│     feat/user-auth:  https://api.auth.com                     │
│     feat/payment:    https://api.payment.com                  │
│                                                               │
└─────────────────────────────────────────────────────────────┘

❓ Sync direction:
  1) feat/user-auth → feat/payment
  2) feat/payment → feat/user-auth
  3) Select variables individually
  4) Cancel
Choice [1-4]:
```

---

### 4.4 List Command (New)

**File:** `src/commands/list.ts`

#### 4.4.1 Command Signature
```bash
workforge list                  # Current repo worktrees
workforge list --all            # All repos' worktrees

Options:
  -a, --all                Show worktrees from all repos
  --format <type>          Output format: table, json, simple
  --sort <field>           Sort by: name, date, branch, type
```

#### 4.4.2 Workflow
1. Load configuration
2. **Determine scope:**
   - If --all: get all projects from ~/.workforge/projects
   - Else: find current repo and get its worktrees
3. **Get worktree list:**
   - Execute git worktree list --porcelain
   - Parse output into WorktreeInfo objects
4. **Enrich with metadata:**
   - Get branch status (clean, modified, ahead, behind)
   - Get age (time since last commit)
   - Get merge status
5. **Sort** based on --sort option
6. **Display** based on --format option

#### 4.4.3 Table Format Display
```
📋 Worktrees for my-repo (5 total)

┌──────────┬─────────────────────────┬──────────────┬─────────────┬────────────┐
│ Type     │ Name                    │ Branch       │ Age         │ Status     │
├──────────┼─────────────────────────┼──────────────┼─────────────┼────────────┤
│ feat     │ user-authentication     │ feat/user... │ 3 days ago  │ Clean      │
│ feat     │ payment-integration     │ feat/paym... │ 1 day ago   │ Modified   │
│ fix      │ memory-leak             │ fix/memor... │ 2 hours ago │ Ahead (2)  │
│ doc      │ api-guide               │ doc/api-g... │ 5 days ago  │ Unmerged   │
│ refactor │ code-cleanup            │ refactor/... │ 1 week ago  │ Modified   │
└──────────┴─────────────────────────┴──────────────┴─────────────┴────────────┘

Main repository: /Users/user/projects/my-repo
```

#### 4.4.4 JSON Format Display
```json
{
  "repository": "/Users/user/projects/my-repo",
  "projectId": "a1b2c3d4",
  "worktrees": [
    {
      "type": "feat",
      "name": "user-authentication",
      "path": "/Users/user/projects/feat/user-authentication",
      "branch": "feat/user-authentication",
      "age": "3 days",
      "status": "clean",
      "commit": "abc123f"
    }
  ]
}
```

---

### 4.5 Cleanup Command (New)

**File:** `src/commands/cleanup.ts`

#### 4.5.1 Command Signature
```bash
workforge cleanup backups              # Clean old backups
workforge cleanup logs                 # Clean old audit logs
workforge cleanup all                  # Clean both

Options:
  --project <name>         Clean specific project only
  --older-than <days>      Clean items older than N days
  --dry-run                Preview without deleting
  -y, --yes                Skip confirmation
```

#### 4.5.2 Workflow
1. Load configuration
2. **Determine scope:**
   - If --project: find specific project
   - Else: all projects in ~/.workforge/projects
3. **Find items to clean:**
   - For backups: list all .env.backup.* files
   - For logs: parse sync-history.json by date
   - Apply --older-than filter if specified
4. **Show preview:**
   - List what will be deleted
   - Show total size to be freed
5. **Confirm** (unless --yes or --dry-run)
6. **Perform cleanup** (unless --dry-run):
   - Delete files
   - Update sync-history.json
7. **Show summary:**
   - Files deleted count
   - Space freed

#### 4.5.3 Cleanup Preview
```
🧹 Cleanup Preview

Backups to delete (12):
  Project: my-repo (a1b2c3d4)
    • .env.backup.2025-10-01T10-00-00 (2.1 KB) - 25 days old
    • .env.backup.2025-10-05T14-30-00 (2.0 KB) - 21 days old
    • ... (10 more)

  Project: another-repo (e5f6g7h8)
    • ... (no old backups)

Total size to free: 24.3 KB

❓ Proceed with cleanup? [y/N]:
```

---

## 5. Core Module Specifications

### 5.1 WorktreeResolver

**File:** `src/core/WorktreeResolver.ts`

#### Purpose
Discover and resolve worktree information from various input patterns.

#### Methods

```typescript
class WorktreeResolver {
  /**
   * Resolve worktree from path, name, or auto-detect
   */
  async resolve(path?: string, name?: string): Promise<WorktreeInfo>

  /**
   * Get all worktrees for a repository
   */
  async getWorktrees(repoRoot: string): Promise<WorktreeInfo[]>

  /**
   * Find worktree by branch name
   */
  async findByBranchName(branchName: string): Promise<WorktreeInfo | null>

  /**
   * Check if current directory is a worktree
   */
  async isWorktree(directory: string): Promise<boolean>

  /**
   * Get main repository path from worktree
   */
  async getMainRepo(worktreePath: string): Promise<string>
}
```

#### Algorithm: resolve()

1. **Pattern 1: Explicit path**
   - If `path` provided: validate it exists
   - Check if it's a worktree or main repo
   - Parse git worktree list to get details

2. **Pattern 2: Name-based lookup**
   - If `name` provided: get current repo root
   - Execute git worktree list --porcelain
   - Search for branch name containing the name
   - Return matching worktree

3. **Pattern 3: Auto-detect**
   - Get current working directory
   - Check if it's a worktree (has .git file)
   - If yes: read .git file to get gitdir
   - Parse worktree info from git worktree list

4. **Parse git worktree list --porcelain:**
   ```
   worktree /path/to/main
   HEAD abc123def456
   branch refs/heads/main

   worktree /path/to/worktree
   HEAD def456abc123
   branch refs/heads/feat/user-auth
   ```

#### Error Handling
- Path doesn't exist: throw "Worktree not found at path"
- Name not found: throw "No worktree found with name"
- Not in a Git repo: throw "Not inside a Git repository"
- Multiple matches: throw "Multiple worktrees match, be more specific"

---

### 5.2 SafetyChecker

**File:** `src/core/SafetyChecker.ts`

#### Purpose
Perform comprehensive safety checks before closing a worktree.

#### Methods

```typescript
class SafetyChecker {
  /**
   * Run all safety checks on a worktree
   */
  async check(worktree: WorktreeInfo): Promise<SafetyCheckResult>

  /**
   * Check for uncommitted changes
   */
  private async checkUncommittedChanges(path: string): Promise<{
    hasChanges: boolean;
    files: string[];
  }>

  /**
   * Check for unpushed commits
   */
  private async checkUnpushedCommits(path: string): Promise<{
    hasUnpushed: boolean;
    ahead: number;
    behind: number;
  }>

  /**
   * Check if branch is merged
   */
  private async checkBranchMerged(
    repoRoot: string,
    branchName: string
  ): Promise<{
    isMerged: boolean;
    mergedInto: string[];
  }>

  /**
   * Check if branch exists on remote
   */
  private async checkRemoteBranch(
    repoRoot: string,
    branchName: string
  ): Promise<{
    exists: boolean;
    remoteName?: string;
  }>
}
```

#### Algorithm: check()

1. **Uncommitted changes:**
   ```bash
   git -C <worktree-path> status --porcelain
   ```
   - Parse output: each line is a file
   - Extract status (M, A, D, ??) and filename

2. **Unpushed commits:**
   ```bash
   git -C <worktree-path> rev-list --count @{u}..HEAD    # ahead
   git -C <worktree-path> rev-list --count HEAD..@{u}    # behind
   ```

3. **Branch merged:**
   ```bash
   git -C <repo-root> branch --merged | grep <branch-name>
   ```
   - If found in output: merged
   - Check against main, master, develop

4. **Remote branch:**
   ```bash
   git -C <repo-root> branch -r | grep <branch-name>
   ```

5. **Git state:**
   - Detached HEAD: check .git/HEAD file
   - Merge in progress: check .git/MERGE_HEAD exists
   - Rebase in progress: check .git/rebase-merge exists

---

### 5.3 EnvFileParser

**File:** `src/core/EnvFileParser.ts`

#### Purpose
Parse .env files into structured format, handling all edge cases.

#### Methods

```typescript
class EnvFileParser {
  /**
   * Parse .env file into map of variables
   */
  parse(filePath: string): Map<string, EnvVariable>

  /**
   * Convert variable map back to .env format
   */
  stringify(vars: Map<string, EnvVariable>): string

  /**
   * Parse a single line
   */
  private parseLine(line: string, lineNumber: number): EnvVariable | null
}
```

#### Parsing Rules

1. **Comments:**
   - Lines starting with `#` or `//` are comments
   - Inline comments: `KEY=value # comment`

2. **Empty lines:**
   - Skip blank lines

3. **KEY=VALUE pairs:**
   - Split on first `=`
   - Trim whitespace from key
   - Handle quoted values:
     - Single quotes: `KEY='value'`
     - Double quotes: `KEY="value"`
     - No quotes: `KEY=value`

4. **Multi-line values:**
   - If value has opening quote but no closing: continue to next line
   - Example:
     ```
     KEY="line1
     line2
     line3"
     ```

5. **Special characters:**
   - Preserve escape sequences in quoted values
   - Handle spaces in values

6. **Invalid lines:**
   - Log warning
   - Skip line
   - Continue parsing

#### Algorithm: parse()

```typescript
parse(filePath: string): Map<string, EnvVariable> {
  const content = readFileSync(filePath, 'utf8');
  const lines = content.split('\n');
  const variables = new Map<string, EnvVariable>();

  let currentLine = 0;
  let multilineBuffer: string | null = null;
  let multilineStart = 0;

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];

    // Handle multiline continuation
    if (multilineBuffer !== null) {
      multilineBuffer += '\n' + line;
      if (this.isMultilineComplete(multilineBuffer)) {
        const variable = this.parseLine(multilineBuffer, multilineStart);
        if (variable) variables.set(variable.key, variable);
        multilineBuffer = null;
      }
      continue;
    }

    // Skip comments and empty lines
    if (this.isComment(line) || line.trim() === '') {
      continue;
    }

    // Check if line starts multiline value
    if (this.startsMultiline(line)) {
      multilineBuffer = line;
      multilineStart = i + 1;
      continue;
    }

    // Parse single line
    const variable = this.parseLine(line, i + 1);
    if (variable) {
      variables.set(variable.key, variable);
    }
  }

  return variables;
}
```

---

### 5.4 EnvDiffer

**File:** `src/core/EnvDiffer.ts`

#### Purpose
Compare two sets of environment variables and generate diff.

#### Methods

```typescript
class EnvDiffer {
  /**
   * Compare two .env files and generate diff
   */
  compare(
    sourcePath: string,
    targetPath: string
  ): EnvDiff

  /**
   * Compare two parsed variable maps
   */
  compareVariables(
    source: Map<string, EnvVariable>,
    target: Map<string, EnvVariable>
  ): EnvDiff
}
```

#### Algorithm: compare()

```typescript
compareVariables(source, target): EnvDiff {
  const added: EnvVariable[] = [];
  const removed: EnvVariable[] = [];
  const modified: EnvModification[] = [];
  const unchanged: EnvVariable[] = [];

  // Find added and modified
  for (const [key, targetVar] of target) {
    if (!source.has(key)) {
      added.push(targetVar);
    } else {
      const sourceVar = source.get(key)!;
      if (sourceVar.value !== targetVar.value) {
        modified.push({
          key,
          sourceValue: sourceVar.value,
          targetValue: targetVar.value,
          sourceLineNumber: sourceVar.lineNumber,
          targetLineNumber: targetVar.lineNumber
        });
      } else {
        unchanged.push(targetVar);
      }
    }
  }

  // Find removed
  for (const [key, sourceVar] of source) {
    if (!target.has(key)) {
      removed.push(sourceVar);
    }
  }

  return { added, removed, modified, unchanged };
}
```

---

### 5.5 EnvSyncer

**File:** `src/core/EnvSyncer.ts`

#### Purpose
Apply sync decisions to update target .env file.

#### Methods

```typescript
class EnvSyncer {
  /**
   * Sync environment variables based on decision
   */
  async sync(
    sourcePath: string,
    targetPath: string,
    decision: SyncDecision
  ): Promise<SyncResult>

  /**
   * Merge variables preserving comments and formatting
   */
  private mergeVariables(
    targetVars: Map<string, EnvVariable>,
    sourceVars: Map<string, EnvVariable>,
    decision: SyncDecision
  ): Map<string, EnvVariable>
}
```

#### Algorithm: sync()

1. **Parse both files**
2. **Create backup** of target
3. **Apply sync decision:**
   - For each key in `decision.syncAdded`: add to target
   - For each key in `decision.syncModified`: update in target
   - For each key in `decision.syncRemoved`: remove from target
4. **Preserve formatting:**
   - Keep comments above variables
   - Keep inline comments
   - Maintain empty lines between sections
5. **Write updated file**
6. **Return result** with counts

---

## 6. Configuration System

### 6.1 ConfigManager

**File:** `src/core/ConfigManager.ts`

#### Default Configuration

```typescript
const DEFAULT_CONFIG: Config = {
  version: '3.0.0',
  preferences: {
    defaultBaseBranch: 'main',
    autoDeleteBranch: false,
    skipConfirmations: false,
    packageManager: 'auto',
    showExistingWorktrees: true
  },
  backup: {
    enabled: true,
    maxBackupsPerProject: 10,
    autoCleanup: true
  },
  sync: {
    createBackupBeforeSync: true,
    defaultSyncDirection: 'ask'
  },
  audit: {
    enabled: true,
    includeVariableValues: true,
    retentionDays: 90
  },
  display: {
    colorEnabled: true,
    verboseOutput: false,
    showProgressIndicators: true
  }
};
```

#### Methods

```typescript
class ConfigManager {
  private configPath: string;

  constructor() {
    this.configPath = path.join(
      os.homedir(),
      '.workforge',
      'config.json'
    );
  }

  /**
   * Load configuration with defaults
   */
  load(): Config {
    if (!existsSync(this.configPath)) {
      return DEFAULT_CONFIG;
    }

    const userConfig = JSON.parse(readFileSync(this.configPath, 'utf8'));
    return this.merge(DEFAULT_CONFIG, userConfig);
  }

  /**
   * Save configuration
   */
  save(config: Config): void {
    mkdirSync(path.dirname(this.configPath), { recursive: true});
    writeFileSync(this.configPath, JSON.stringify(config, null, 2));
  }

  /**
   * Get nested config value
   */
  get(key: string): any {
    const config = this.load();
    return this.getNestedValue(config, key);
  }

  /**
   * Set nested config value
   */
  set(key: string, value: any): void {
    const config = this.load();
    this.setNestedValue(config, key, value);
    this.save(config);
  }

  /**
   * Deep merge two config objects
   */
  private merge(defaults: Config, user: Partial<Config>): Config {
    // Deep merge implementation
  }

  /**
   * Get value from nested path (e.g., 'backup.maxBackupsPerProject')
   */
  private getNestedValue(obj: any, path: string): any {
    return path.split('.').reduce((current, key) => current?.[key], obj);
  }

  /**
   * Set value at nested path
   */
  private setNestedValue(obj: any, path: string, value: any): void {
    const keys = path.split('.');
    const lastKey = keys.pop()!;
    const target = keys.reduce((current, key) => {
      if (!current[key]) current[key] = {};
      return current[key];
    }, obj);
    target[lastKey] = value;
  }
}
```

### 6.2 Configuration Access

Commands should access config via ConfigManager:

```typescript
const configManager = new ConfigManager();
const config = configManager.load();

// Use config values
const defaultBranch = config.preferences.defaultBaseBranch;
const maxBackups = config.backup.maxBackupsPerProject;
```

---

## 7. Audit Logging System

### 7.1 AuditLogger

**File:** `src/core/AuditLogger.ts`

#### Methods

```typescript
class AuditLogger {
  private projectId: string;
  private projectDir: string;
  private config: Config;

  constructor(repoRoot: string) {
    this.projectId = ProjectIdentifier.generateId(repoRoot);
    this.projectDir = ProjectIdentifier.getProjectDir(repoRoot);
    this.config = new ConfigManager().load();
  }

  /**
   * Log an operation
   */
  async log(operation: AuditOperation): Promise<void> {
    if (!this.config.audit.enabled) return;

    // Update project metadata
    ProjectIdentifier.updateMetadata(operation.source.path);

    // Append to human-readable log
    await this.appendToLog(operation);

    // Add to machine-readable history
    await this.addToHistory(operation);

    // Auto-cleanup old logs
    await this.cleanupOldLogs();
  }

  /**
   * Format and append to audit.log
   */
  private async appendToLog(op: AuditOperation): Promise<void> {
    const logPath = path.join(this.projectDir, 'audit.log');
    const entry = this.formatLogEntry(op);

    mkdirSync(this.projectDir, { recursive: true });
    appendFileSync(logPath, entry + '\n\n');
  }

  /**
   * Format operation for human-readable log
   */
  private formatLogEntry(op: AuditOperation): string {
    const lines: string[] = [];

    lines.push(`[${op.timestamp}] ${op.operation.toUpperCase()} ${op.source.branch} → ${op.target.branch}`);
    lines.push(`  Operation: ${op.operation}`);
    lines.push(`  Source: ${op.source.path}`);
    lines.push(`  Target: ${op.target.path}`);

    if (op.source.branch && op.target.branch) {
      lines.push(`  Branch: ${op.source.branch} → ${op.target.branch}`);
    }

    if (op.source.commit && op.target.commit) {
      lines.push(`  Commit: ${op.source.commit} → ${op.target.commit}`);
    }

    lines.push(`  User: ${op.user}`);

    if (op.changes) {
      lines.push(`  Changes:`);

      for (const add of op.changes.added) {
        const value = this.config.audit.includeVariableValues
          ? `=${add.value}`
          : '';
        lines.push(`    + ${add.key}${value}`);
      }

      for (const mod of op.changes.modified) {
        const values = this.config.audit.includeVariableValues
          ? `: ${mod.oldValue} → ${mod.newValue}`
          : '';
        lines.push(`    ~ ${mod.key}${values}`);
      }

      for (const rem of op.changes.removed) {
        const value = this.config.audit.includeVariableValues
          ? `=${rem.value}`
          : '';
        lines.push(`    - ${rem.key}${value}`);
      }
    }

    if (op.backup) {
      lines.push(`  Backup: ${op.backup.path}`);
    }

    lines.push(`  Status: ${op.status.toUpperCase()}`);

    if (op.error) {
      lines.push(`  Error: ${op.error}`);
    }

    return lines.join('\n');
  }

  /**
   * Add to sync-history.json
   */
  private async addToHistory(op: AuditOperation): Promise<void> {
    const historyPath = path.join(this.projectDir, 'sync-history.json');

    let history = { version: '3.0.0', operations: [] as any[] };
    if (existsSync(historyPath)) {
      history = JSON.parse(readFileSync(historyPath, 'utf8'));
    }

    history.operations.push({
      id: crypto.randomUUID(),
      ...op
    });

    mkdirSync(this.projectDir, { recursive: true });
    writeFileSync(historyPath, JSON.stringify(history, null, 2));
  }

  /**
   * Clean up logs older than retentionDays
   */
  private async cleanupOldLogs(): Promise<void> {
    if (this.config.audit.retentionDays === 0) return;

    const historyPath = path.join(this.projectDir, 'sync-history.json');
    if (!existsSync(historyPath)) return;

    const history = JSON.parse(readFileSync(historyPath, 'utf8'));
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - this.config.audit.retentionDays);

    history.operations = history.operations.filter((op: AuditOperation) => {
      const opDate = new Date(op.timestamp);
      return opDate >= cutoffDate;
    });

    writeFileSync(historyPath, JSON.stringify(history, null, 2));
  }
}
```

---

## 8. Backup Management System

### 8.1 BackupManager

**File:** `src/core/BackupManager.ts`

#### Methods

```typescript
class BackupManager {
  private projectId: string;
  private backupDir: string;
  private config: Config;

  constructor(repoRoot: string) {
    this.projectId = ProjectIdentifier.generateId(repoRoot);
    this.backupDir = path.join(
      os.homedir(),
      '.workforge',
      'backups',
      this.projectId
    );
    this.config = new ConfigManager().load();
  }

  /**
   * Create a backup of .env file
   */
  async createBackup(envPath: string): Promise<string> {
    if (!this.config.backup.enabled) {
      throw new Error('Backups are disabled in configuration');
    }

    mkdirSync(this.backupDir, { recursive: true });

    const timestamp = new Date()
      .toISOString()
      .replace(/[:.]/g, '-')
      .replace('Z', '');
    const backupName = `.env.backup.${timestamp}`;
    const backupPath = path.join(this.backupDir, backupName);

    copyFileSync(envPath, backupPath);

    // Auto-cleanup if enabled
    if (this.config.backup.autoCleanup) {
      await this.cleanupOldBackups();
    }

    return backupPath;
  }

  /**
   * Clean up old backups, keep last N
   */
  async cleanupOldBackups(): Promise<void> {
    const maxBackups = this.config.backup.maxBackupsPerProject;

    if (!existsSync(this.backupDir)) return;

    const backups = readdirSync(this.backupDir)
      .filter(f => f.startsWith('.env.backup.'))
      .map(f => ({
        name: f,
        path: path.join(this.backupDir, f),
        stat: statSync(path.join(this.backupDir, f))
      }))
      .sort((a, b) => b.stat.mtimeMs - a.stat.mtimeMs); // Newest first

    // Delete backups beyond maxBackups
    for (let i = maxBackups; i < backups.length; i++) {
      unlinkSync(backups[i].path);
    }
  }

  /**
   * List all backups for this project
   */
  listBackups(): BackupInfo[] {
    if (!existsSync(this.backupDir)) return [];

    return readdirSync(this.backupDir)
      .filter(f => f.startsWith('.env.backup.'))
      .map(f => {
        const filePath = path.join(this.backupDir, f);
        const stat = statSync(filePath);
        return {
          name: f,
          path: filePath,
          size: stat.size,
          created: stat.mtime
        };
      })
      .sort((a, b) => b.created.getTime() - a.created.getTime());
  }

  /**
   * Restore a specific backup
   */
  async restore(backupPath: string, targetPath: string): Promise<void> {
    if (!existsSync(backupPath)) {
      throw new Error(`Backup not found: ${backupPath}`);
    }

    // Create backup of current file before restoring
    if (existsSync(targetPath)) {
      const tempBackup = await this.createBackup(targetPath);
      console.log(`Created safety backup: ${tempBackup}`);
    }

    copyFileSync(backupPath, targetPath);
  }

  /**
   * Delete a specific backup
   */
  async deleteBackup(backupPath: string): Promise<void> {
    if (!existsSync(backupPath)) {
      throw new Error(`Backup not found: ${backupPath}`);
    }

    unlinkSync(backupPath);
  }
}
```

---

## 9. UI/Display Systems

### 9.1 DiffDisplay

**File:** `src/ui/DiffDisplay.ts`

#### Purpose
Render beautiful side-by-side environment variable diffs.

#### Methods

```typescript
class DiffDisplay {
  /**
   * Display diff in side-by-side format
   */
  show(diff: EnvDiff, targets: SyncTargets): void {
    this.printHeader(targets);

    if (diff.added.length > 0) {
      this.printAdded(diff.added);
    }

    if (diff.modified.length > 0) {
      this.printModified(diff.modified);
    }

    if (diff.removed.length > 0) {
      this.printRemoved(diff.removed);
    }

    if (diff.unchanged.length > 0) {
      this.printUnchangedSummary(diff.unchanged.length);
    }

    this.printFooter();
  }

  private printHeader(targets: SyncTargets): void {
    console.log(chalk.bold('\n┌─────────────────────────────────────────────────────────────────┐'));
    console.log(chalk.bold('│ Environment Variable Changes (.env)                              │'));
    console.log(chalk.bold('├─────────────────────────────────────────────────────────────────┤'));
    console.log(chalk.gray(`  Source: ${targets.source.path}`));
    console.log(chalk.gray(`  Target: ${targets.target.path}`));
    console.log(chalk.bold('└─────────────────────────────────────────────────────────────────┘'));
  }

  private printAdded(added: EnvVariable[]): void {
    console.log(chalk.green(`\nADDED (${added.length} variables)`));
    console.log(chalk.gray('━'.repeat(65)));

    for (const variable of added) {
      console.log(chalk.green(`  + ${variable.key}=${variable.value}`));
    }
  }

  private printModified(modified: EnvModification[]): void {
    console.log(chalk.yellow(`\nMODIFIED (${modified.length} variables)`));
    console.log(chalk.gray('━'.repeat(65)));

    for (const mod of modified) {
      console.log(chalk.yellow(`\n  ${mod.key}`));

      const sourceLabel = chalk.gray('Source:');
      const targetLabel = chalk.gray('Target:');

      const maxValueLength = 40;
      const sourceValue = this.truncate(mod.sourceValue, maxValueLength);
      const targetValue = this.truncate(mod.targetValue, maxValueLength);

      console.log(`  ┌─ ${sourceLabel} ${'─'.repeat(15)}┬─ ${targetLabel} ${'─'.repeat(15)}┐`);
      console.log(`  │ ${this.pad(sourceValue, 25)} │ ${this.pad(targetValue, 25)} │`);
      console.log(`  └${'─'.repeat(26)}┴${'─'.repeat(26)}┘`);
    }
  }

  private printRemoved(removed: EnvVariable[]): void {
    console.log(chalk.red(`\nREMOVED (${removed.length} variables)`));
    console.log(chalk.gray('━'.repeat(65)));

    for (const variable of removed) {
      console.log(chalk.red(`  - ${variable.key}=${variable.value}`));
    }
  }

  private printUnchangedSummary(count: number): void {
    console.log(chalk.gray(`\n${count} variables unchanged`));
  }

  private printFooter(): void {
    console.log('');
  }

  private truncate(str: string, maxLength: number): string {
    if (str.length <= maxLength) return str;
    return str.substring(0, maxLength - 3) + '...';
  }

  private pad(str: string, length: number): string {
    return str + ' '.repeat(Math.max(0, length - str.length));
  }
}
```

---

### 9.2 SyncPrompt

**File:** `src/ui/SyncPrompt.ts`

#### Purpose
Interactive prompts for selecting which variables to sync.

#### Methods

```typescript
class SyncPrompt {
  /**
   * Prompt user for sync decisions
   */
  async prompt(diff: EnvDiff, autoYes: boolean = false): Promise<SyncDecision> {
    if (autoYes) {
      return this.autoAcceptAll(diff);
    }

    const decision: SyncDecision = {
      syncAdded: [],
      syncModified: [],
      syncRemoved: [],
      skipAll: false
    };

    // Prompt for added variables
    if (diff.added.length > 0) {
      decision.syncAdded = await this.promptAdded(diff.added);
    }

    // Prompt for modified variables
    if (diff.modified.length > 0) {
      decision.syncModified = await this.promptModified(diff.modified);
    }

    // Prompt for removed variables
    if (diff.removed.length > 0) {
      decision.syncRemoved = await this.promptRemoved(diff.removed);
    }

    return decision;
  }

  private async promptAdded(added: EnvVariable[]): Promise<string[]> {
    const { choice } = await inquirer.prompt([
      {
        type: 'list',
        name: 'choice',
        message: `Sync ADDED variables to target? (${added.length} total)`,
        choices: [
          { name: 'All - sync all added variables', value: 'all' },
          { name: 'None - skip all added variables', value: 'none' },
          { name: 'Select - choose which to sync', value: 'select' }
        ]
      }
    ]);

    if (choice === 'all') {
      return added.map(v => v.key);
    }

    if (choice === 'none') {
      return [];
    }

    // Select individual variables
    const { selected } = await inquirer.prompt([
      {
        type: 'checkbox',
        name: 'selected',
        message: 'Select variables to sync:',
        choices: added.map(v => ({
          name: `${v.key}=${v.value}`,
          value: v.key,
          checked: true
        }))
      }
    ]);

    return selected;
  }

  private async promptModified(modified: EnvModification[]): Promise<string[]> {
    const { choice } = await inquirer.prompt([
      {
        type: 'list',
        name: 'choice',
        message: `Sync MODIFIED variables to target? (${modified.length} total)`,
        choices: [
          { name: 'All - sync all modifications', value: 'all' },
          { name: 'None - keep target values', value: 'none' },
          { name: 'Select - choose which to sync', value: 'select' }
        ]
      }
    ]);

    if (choice === 'all') {
      return modified.map(m => m.key);
    }

    if (choice === 'none') {
      return [];
    }

    // Select individual modifications
    const selected: string[] = [];

    for (const mod of modified) {
      console.log(chalk.yellow(`\n${mod.key}:`));
      console.log(chalk.gray(`  Source: ${mod.sourceValue}`));
      console.log(chalk.gray(`  Target: ${mod.targetValue}`));

      const { useSource } = await inquirer.prompt([
        {
          type: 'confirm',
          name: 'useSource',
          message: 'Use source value?',
          default: true
        }
      ]);

      if (useSource) {
        selected.push(mod.key);
      }
    }

    return selected;
  }

  private async promptRemoved(removed: EnvVariable[]): Promise<string[]> {
    const { choice } = await inquirer.prompt([
      {
        type: 'list',
        name: 'choice',
        message: `Remove DELETED variables from target? (${removed.length} total)`,
        choices: [
          { name: 'All - remove all from target', value: 'all' },
          { name: 'None - keep in target', value: 'none' },
          { name: 'Select - choose which to remove', value: 'select' }
        ]
      }
    ]);

    if (choice === 'all') {
      return removed.map(v => v.key);
    }

    if (choice === 'none') {
      return [];
    }

    // Select individual variables to remove
    const { selected } = await inquirer.prompt([
      {
        type: 'checkbox',
        name: 'selected',
        message: 'Select variables to remove from target:',
        choices: removed.map(v => ({
          name: `${v.key}=${v.value}`,
          value: v.key,
          checked: false
        }))
      }
    ]);

    return selected;
  }

  private autoAcceptAll(diff: EnvDiff): SyncDecision {
    return {
      syncAdded: diff.added.map(v => v.key),
      syncModified: diff.modified.map(m => m.key),
      syncRemoved: diff.removed.map(v => v.key),
      skipAll: false
    };
  }
}
```

---

## 10. Workflows & Algorithms

### 10.1 Close Worktree Workflow (Complete)

```
START
  │
  ├─ Load Configuration
  │
  ├─ Discover Worktree
  │   ├─ Pattern 1: Explicit path provided?
  │   │   └─ Validate path exists
  │   ├─ Pattern 2: --name flag provided?
  │   │   └─ Search git worktree list
  │   └─ Pattern 3: Auto-detect
  │       └─ Check current directory
  │
  ├─ Safety Checks
  │   ├─ git status --porcelain (uncommitted changes)
  │   ├─ git rev-list @{u}..HEAD (unpushed commits)
  │   ├─ git branch --merged (merge status)
  │   ├─ git branch -r (remote branch)
  │   └─ Check for detached HEAD, merge/rebase in progress
  │
  ├─ Display Warnings
  │   ├─ List uncommitted files
  │   ├─ Show commit counts ahead/behind
  │   ├─ Show merge status
  │   └─ Show remote branch info
  │
  ├─ Confirm or Force?
  │   ├─ If --force: continue
  │   └─ Else: prompt user
  │       └─ If declined: EXIT
  │
  ├─ Environment Sync (unless --no-sync)
  │   ├─ Parse .env from worktree (EnvFileParser)
  │   ├─ Parse .env from main repo (EnvFileParser)
  │   ├─ Generate diff (EnvDiffer)
  │   │   ├─ Added variables
  │   │   ├─ Modified variables
  │   │   └─ Removed variables
  │   ├─ Display side-by-side diff (DiffDisplay)
  │   ├─ Interactive selection (SyncPrompt)
  │   │   ├─ Prompt for added: all/none/select
  │   │   ├─ Prompt for modified: all/none/select
  │   │   └─ Prompt for removed: all/none/select
  │   ├─ Create backup (BackupManager)
  │   │   ├─ Generate timestamp
  │   │   ├─ Copy .env to backup dir
  │   │   └─ Auto-cleanup old backups (keep last 10)
  │   └─ Apply sync (EnvSyncer)
  │       ├─ Add selected variables
  │       ├─ Update modified variables
  │       ├─ Remove selected variables
  │       └─ Write updated .env
  │
  ├─ Remove Worktree
  │   ├─ git worktree remove <path>
  │   └─ If --force: git worktree remove --force <path>
  │
  ├─ Branch Cleanup
  │   ├─ Determine action:
  │   │   ├─ If --delete-branch: delete
  │   │   ├─ If --keep-branch: keep
  │   │   └─ Else: prompt based on merge status
  │   ├─ If delete:
  │   │   ├─ If merged: git branch -d <branch>
  │   │   └─ If not merged: confirm → git branch -D <branch>
  │   └─ If remote branch: warn user
  │
  ├─ Audit Logging
  │   ├─ Update project metadata
  │   ├─ Append to audit.log (human-readable)
  │   ├─ Add to sync-history.json (machine-readable)
  │   └─ Auto-cleanup old logs (based on retentionDays)
  │
  ├─ Show Summary
  │   ├─ Worktree removed: path
  │   ├─ Branch: deleted/kept
  │   ├─ Environment synced: counts
  │   └─ Backup saved: path
  │
END
```

### 10.2 Sync-Env Workflow (Complete)

```
START
  │
  ├─ Load Configuration
  │
  ├─ Resolve Source and Target
  │   ├─ Pattern 1: --from and --to provided
  │   ├─ Pattern 2: Only --from (to=main repo)
  │   ├─ Pattern 3: Only --to (from=main repo)
  │   └─ Pattern 4: --between (bidirectional)
  │       └─ Parse both paths, offer direction choice
  │
  ├─ Validate .env Files
  │   ├─ Check source .env exists
  │   ├─ Check target .env exists
  │   └─ If missing: error
  │
  ├─ Parse .env Files
  │   ├─ Parse source (EnvFileParser)
  │   └─ Parse target (EnvFileParser)
  │
  ├─ Generate Diff
  │   └─ Compare variables (EnvDiffer)
  │
  ├─ Display Diff
  │   └─ Side-by-side comparison (DiffDisplay)
  │
  ├─ Get User Decision
  │   ├─ If --yes: auto-accept all
  │   ├─ If --between: ask direction first
  │   └─ Else: interactive selection (SyncPrompt)
  │
  ├─ Create Backup (unless --no-backup)
  │   └─ BackupManager.createBackup(target)
  │
  ├─ Perform Sync
  │   └─ EnvSyncer.sync(source, target, decision)
  │
  ├─ Audit Logging
  │   └─ AuditLogger.log(operation)
  │
  ├─ Show Summary
  │   ├─ Variables added: count
  │   ├─ Variables modified: count
  │   ├─ Variables removed: count
  │   └─ Backup saved: path
  │
END
```

---

## 11. Error Handling Strategy

### 11.1 Error Categories

1. **User Input Errors:**
   - Invalid command syntax
   - Invalid option values
   - Missing required arguments
   - Invalid file paths

2. **Git Errors:**
   - Not in a Git repository
   - Git command failures
   - Branch conflicts
   - Worktree locked

3. **File System Errors:**
   - File not found
   - Permission denied
   - Disk full
   - File already exists

4. **Parsing Errors:**
   - Malformed .env file
   - Invalid variable syntax
   - Encoding issues

5. **Configuration Errors:**
   - Invalid config JSON
   - Missing config values
   - Type mismatches

### 11.2 Error Handling Patterns

```typescript
// Graceful error handling with user-friendly messages
try {
  // Operation
} catch (error) {
  if (error instanceof GitError) {
    console.error(chalk.red('✗ Git error:'), error.message);
    console.log(chalk.gray('Hint:'), error.hint);
  } else if (error instanceof FileSystemError) {
    console.error(chalk.red('✗ File system error:'), error.message);
  } else {
    console.error(chalk.red('✗ Unexpected error:'), error);
  }
  process.exit(1);
}
```

### 11.3 Custom Error Classes

```typescript
class GitError extends Error {
  constructor(message: string, public hint?: string) {
    super(message);
    this.name = 'GitError';
  }
}

class FileSystemError extends Error {
  constructor(message: string, public path?: string) {
    super(message);
    this.name = 'FileSystemError';
  }
}

class ParseError extends Error {
  constructor(message: string, public line?: number) {
    super(message);
    this.name = 'ParseError';
  }
}
```

---

## 12. Testing Requirements

### 12.1 Unit Tests

```typescript
// EnvFileParser.test.ts
describe('EnvFileParser', () => {
  test('parses simple KEY=VALUE', () => {});
  test('parses quoted values', () => {});
  test('parses multiline values', () => {});
  test('handles comments', () => {});
  test('handles inline comments', () => {});
  test('handles malformed lines', () => {});
});

// EnvDiffer.test.ts
describe('EnvDiffer', () => {
  test('detects added variables', () => {});
  test('detects removed variables', () => {});
  test('detects modified variables', () => {});
  test('handles empty files', () => {});
});

// WorktreeResolver.test.ts
describe('WorktreeResolver', () => {
  test('resolves by explicit path', () => {});
  test('resolves by name', () => {});
  test('auto-detects from current directory', () => {});
  test('handles main repository', () => {});
  test('throws when not in repo', () => {});
});
```

### 12.2 Integration Tests

```typescript
// close.integration.test.ts
describe('Close Command Integration', () => {
  test('closes worktree with clean state', () => {});
  test('closes worktree with uncommitted changes (force)', () => {});
  test('syncs environment variables', () => {});
  test('deletes merged branch', () => {});
  test('keeps unmerged branch with confirmation', () => {});
});

// sync-env.integration.test.ts
describe('Sync-Env Command Integration', () => {
  test('syncs from worktree to main', () => {});
  test('syncs from main to worktree', () => {});
  test('syncs between two worktrees', () => {});
  test('creates backup before sync', () => {});
});
```

---

## 13. Documentation Requirements

### 13.1 README.md Updates

Add sections for:
- New v3.0 features
- Command reference (brief, link to docs)
- Configuration overview (link to docs/configuration.md)
- Examples of close and sync-env

### 13.2 docs/configuration.md

Complete reference of:
- Config file location
- All configuration options
- Default values
- Examples

### 13.3 docs/sync-operations.md

Guide covering:
- How environment sync works
- Close command with sync
- Sync-env command patterns
- Diff display explanation
- Conflict resolution strategies
- Backup and recovery

### 13.4 docs/advanced-usage.md

Topics:
- List command usage
- Cleanup operations
- Multiple worktree management
- Batch operations
- CI/CD integration

### 13.5 docs/troubleshooting.md

Common issues:
- Sync conflicts
- Permission errors
- Git state issues
- Configuration problems
- Debug mode

### 13.6 CLAUDE.md Updates

Add:
- New architecture (commands, core, ui)
- Configuration system
- Audit logging system
- Backup system
- Key algorithms (env parsing, diffing, syncing)

---

## 14. Implementation Phases

(See main plan above - phases 1-9)

---

## 15. Edge Cases & Security

### 15.1 Edge Cases to Handle

1. **Empty .env files:** Handle gracefully, show message
2. **Binary .env files:** Detect and abort with error
3. **Very large .env files:** Parse in chunks, show progress
4. **Concurrent modifications:** Detect via checksum, re-diff
5. **Locked files:** Retry with timeout
6. **Multiple worktrees same branch:** Warn and require explicit path
7. **Detached HEAD:** Warn but allow with confirmation
8. **Merge/rebase in progress:** Block close, show clear message
9. **No internet (remote checks):** Continue with warning
10. **Remote renamed:** Detect and show old/new names

### 15.2 Security Considerations

1. **Variable values in audit logs:**
   - Config option: `audit.includeVariableValues`
   - Default: true (user aware of logging)
   - Sensitive values (API keys, passwords) are logged
   - User should secure ~/.workforge directory (chmod 700)

2. **Backup file permissions:**
   - Create with restrictive permissions (0600)
   - Warn if .env contains obvious secrets

3. **Config file security:**
   - Validate JSON to prevent injection
   - Sanitize file paths

4. **Command injection:**
   - Use execFileSync/spawnSync with array args
   - Never use shell: true
   - Validate all user inputs

---

## 16. Migration from v2.0

### 16.1 Backwards Compatibility

All v2.0 commands continue to work:
```bash
workforge --type feat --name user-auth   # Still works
workforge -t fix -n bug-123              # Still works
```

### 16.2 New Features (Opt-in)

New commands don't affect existing workflows:
- `close` - New command
- `sync-env` - New command
- `list` - New command
- `cleanup` - New command

### 16.3 First Run Experience

On first run of v3.0:
1. Create ~/.workforge directory
2. Create default config.json
3. Show welcome message explaining new features
4. Migrate any existing worktrees to new audit system (optional)

---

## End of Specification

**Document Status:** Complete - Ready for Implementation
**Next Steps:** Create detailed TODO list and begin Phase 1

