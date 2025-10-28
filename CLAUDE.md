# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

WorkForge v3.0 is a TypeScript CLI tool for managing Git worktrees with intelligent environment variable synchronization, automatic backup management, and comprehensive audit logging. The tool provides five commands: `create`, `close`, `sync-env`, `list`, and `cleanup`.

**Binary aliases**: `workforge` and `wf`

## Development Commands

```bash
# Build TypeScript to JavaScript
pnpm run build

# Run in development mode (without building)
pnpm run dev

# Build before publishing
pnpm run prepublishOnly

# Test a specific command
pnpm run dev -- create -t feat -n test-feature
pnpm run dev -- sync-env --dry-run
pnpm run dev -- list --json
```

---

## Architecture

### v3.0 - Modular Design

WorkForge v3.0 uses a **modular architecture** with separation of concerns across commands, core components, UI components, and types.

### Directory Structure

```
src/
├── commands/          # CLI command implementations
│   ├── create.ts      # Create worktree command
│   ├── close.ts       # Close worktree with sync
│   ├── sync-env.ts    # Standalone env sync
│   ├── list.ts        # List worktrees
│   └── cleanup.ts     # Cleanup backups
├── core/              # Core business logic
│   ├── ConfigManager.ts        # Global configuration
│   ├── ProjectIdentifier.ts   # Project ID generation
│   ├── EnvFileParser.ts        # .env parsing
│   ├── WorktreeResolver.ts     # Worktree discovery
│   ├── EnvDiffer.ts            # Environment diff
│   ├── EnvSyncer.ts            # Environment sync
│   ├── BackupManager.ts        # Backup management
│   ├── SafetyChecker.ts        # Pre-close checks
│   ├── WorktreeRemover.ts      # Worktree removal
│   ├── BranchCleaner.ts        # Branch deletion
│   ├── AuditLogger.ts          # Audit logging
│   └── SyncTargetResolver.ts  # Sync target resolution
├── ui/                # User interface components
│   ├── Logger.ts      # Logging and progress
│   ├── DiffDisplay.ts # Diff visualization
│   ├── SyncPrompt.ts  # Interactive prompts
│   └── ListDisplay.ts # List formatting
├── types/
│   └── index.ts       # TypeScript interfaces
└── index.ts           # CLI router (yargs)
```

---

## Core Components

### 1. ConfigManager (src/core/ConfigManager.ts)

Manages global configuration at `~/.workforge/config.json`.

**Key Methods:**
- `load()` - Load configuration from file
- `save(config)` - Save configuration to file
- `get(key)` - Get configuration value (dot notation supported)
- `set(key, value)` - Set configuration value
- `reset()` - Reset to defaults

**Features:**
- Deep merge for user overrides
- Nested key access via dot notation
- Default values for all settings
- Type-safe interface

**Configuration Sections:**
- `preferences` - General settings (base branch, confirmations, package manager)
- `backup` - Backup settings (enabled, retention, auto-cleanup)
- `sync` - Sync settings (backup before sync, default direction)
- `audit` - Audit settings (enabled, include values, retention)
- `display` - Display settings (colors, verbose, progress indicators)

---

### 2. ProjectIdentifier (src/core/ProjectIdentifier.ts)

Generates unique project IDs from Git remote URLs.

**Key Method:**
- `generateId()` - SHA-256 hash (8 chars) of Git remote URL
- `getProjectDir()` - Returns `~/.workforge/projects/<project-id>/`
- `getBackupDir()` - Returns `~/.workforge/backups/<project-id>/`
- `updateMetadata()` - Updates project metadata

**Project ID Generation:**
```
Remote URL: git@github.com:user/repo.git
SHA-256: abc123def456789...
Project ID: abc123de (first 8 chars)
```

**Metadata Location:** `~/.workforge/projects/<project-id>/.meta.json`

**Metadata Contents:**
- Repository name
- Remote URL
- Created timestamp
- Last accessed timestamp

---

### 3. EnvFileParser (src/core/EnvFileParser.ts)

Comprehensive .env file parser with advanced features.

**Key Methods:**
- `parse(filePath)` - Parse .env file to variable map
- `stringify(variables)` - Convert variable map to .env format

**Supported Features:**
- Single-line variables: `KEY=value`
- Multi-line values with quotes: `KEY="value\nline2"`
- Comments: `# comment` or `// comment`
- Inline comments: `KEY=value # comment`
- Single and double quotes
- Escape sequences: `\n`, `\t`, `\\`, `\"`
- Invalid line recovery (skips malformed lines)

**Example:**
```env
# Database configuration
DATABASE_URL="postgres://localhost:5432/
  database_name?
  sslmode=require"

API_KEY=sk_test_abc123  # Production key
```

---

### 4. WorktreeResolver (src/core/WorktreeResolver.ts)

Discovers worktrees using three-pattern resolution.

**Key Method:**
- `resolve(inputPath?, name?)` - Resolve worktree with auto-detection

**Three-Pattern Resolution:**
1. **Explicit Path**: Use provided path directly
2. **Name-Based Search**: Search all worktrees for matching branch name
3. **Auto-Detection**: Detect current directory as worktree

**Example:**
```typescript
// Pattern 1: Explicit path
const wt = resolver.resolve('/path/to/worktree');

// Pattern 2: Name-based
const wt = resolver.resolve(undefined, 'feat-auth');

// Pattern 3: Auto-detect
const wt = resolver.resolve(); // From current directory
```

**Worktree Information:**
- Branch name
- Worktree path
- Main repository path
- Commit hash
- Is main repo flag
- Is locked flag

---

### 5. EnvDiffer (src/core/EnvDiffer.ts)

Compares .env files and generates structured diffs.

**Key Methods:**
- `compare(sourcePath, targetPath, targets)` - Generate diff
- `compareVariables(source, target)` - Compare variable maps
- `filterDiff(diff, decision)` - Filter diff by decision
- `invertDiff(diff)` - Invert source/target for bidirectional sync

**Diff Structure:**
```typescript
{
  added: [{ key: 'NEW_VAR', value: 'value' }],
  removed: [{ key: 'OLD_VAR', value: 'value' }],
  modified: [{
    key: 'CHANGED_VAR',
    oldValue: 'old',
    newValue: 'new'
  }],
  unchanged: [{ key: 'SAME_VAR', value: 'value' }]
}
```

---

### 6. EnvSyncer (src/core/EnvSyncer.ts)

Applies sync decisions to .env files.

**Key Methods:**
- `sync(sourcePath, targetPath, diff, decision)` - Apply sync
- `mergeVariables(target, diff, decision)` - Merge variables
- `dryRun(sourcePath, targetPath, diff, decision)` - Preview sync
- `validateDecision(diff, decision)` - Validate sync decision

**Sync Process:**
1. Validate decision matches diff
2. Load target .env
3. Merge variables based on decision
4. Write updated .env
5. Return sync result with stats

---

### 7. BackupManager (src/core/BackupManager.ts)

Manages automatic backups with rotation.

**Key Methods:**
- `createBackup(filePath)` - Create timestamped backup
- `listBackups()` - List all backups for project
- `restore(backupId)` - Restore from backup
- `deleteBackup(backupId)` - Delete specific backup
- `cleanupOldBackups()` - Auto-cleanup old backups

**Backup Format:** `.env.backup.YYYY-MM-DD_HH-mm-ss`

**Backup Location:** `~/.workforge/backups/<project-id>/`

**Auto-Cleanup:**
- Maintains last N backups (default: 10)
- FIFO queue (oldest deleted first)
- Configurable via `maxBackupsPerProject`

---

### 8. SafetyChecker (src/core/SafetyChecker.ts)

Validates worktree state before closing.

**Key Method:**
- `check(worktree)` - Run all safety checks

**Safety Checks:**
1. **Uncommitted Changes**: Detects modified, staged, or untracked files
2. **Unpushed Commits**: Detects commits not pushed to remote
3. **Merge Status**: Checks if branch is merged into main
4. **Detached HEAD**: Detects detached HEAD state
5. **Merge/Rebase in Progress**: Detects ongoing merge or rebase

**Check Result:**
```typescript
{
  canProceed: boolean,
  blockingIssues: string[],    // Must fix before closing
  warnings: string[],           // Can ignore with --force
  recommendations: string[]     // Suggestions
}
```

---

### 9. AuditLogger (src/core/AuditLogger.ts)

Logs all sync operations in dual formats.

**Key Methods:**
- `log(operation, syncResult)` - Log sync operation
- `getHistory()` - Get sync history
- `getStatistics()` - Get usage statistics

**Log Formats:**

**Human-Readable:** `~/.workforge/projects/<project-id>/audit.log`
```
────────────────────────────────────────
[2025-10-26T14:30:15.123Z] SYNC
────────────────────────────────────────

Source: Worktree (feat-auth)
Target: Main (project)

Changes:
  Added:    2 variable(s)
  Modified: 1 variable(s)
  Removed:  0 variable(s)

Details:
  Added Variables:
    + API_KEY
    + DEBUG_MODE

  Modified Variables:
    ~ DATABASE_URL

Status: SUCCESS
Backup: Created
```

**JSON:** `~/.workforge/projects/<project-id>/sync-history.json`
```json
[
  {
    "timestamp": "2025-10-26T14:30:15.123Z",
    "operation": "sync",
    "source": "Worktree (feat-auth)",
    "target": "Main (project)",
    "changesApplied": {
      "added": 2,
      "modified": 1,
      "removed": 0
    },
    "variableDetails": {
      "added": ["API_KEY", "DEBUG_MODE"],
      "modified": ["DATABASE_URL"],
      "removed": []
    },
    "success": true,
    "backupCreated": true
  }
]
```

---

### 10. SyncTargetResolver (src/core/SyncTargetResolver.ts)

Resolves source and target for sync operations.

**Key Methods:**
- `resolve(options)` - Resolve sync targets from options
- `validate(targets)` - Validate sync targets
- `swap(targets)` - Swap source and target (for bidirectional)

**Four Sync Patterns:**

1. **Explicit Source and Target**: `--from <source> --to <target>`
   ```bash
   workforge sync-env --from feat-auth --to main
   ```

2. **From Worktree to Main**: `--from <source>`
   ```bash
   workforge sync-env --from feat-auth
   # Target defaults to main
   ```

3. **From Main to Worktree**: `--to <target>`
   ```bash
   workforge sync-env --to feat-auth
   # Source defaults to main
   ```

4. **Bidirectional Sync**: `--between <worktree>`
   ```bash
   workforge sync-env --between feat-auth
   # Shows diff both ways, user chooses direction
   ```

5. **Auto-Detect**: No arguments
   ```bash
   # Run from inside worktree
   cd /path/to/worktree
   workforge sync-env
   # Auto-detects: main → current worktree
   ```

---

## Command Implementations

### 1. Create Command (src/commands/create.ts)

Creates new Git worktrees with environment setup.

**Workflow:**
1. Validate inputs (type, name, ticket ID)
2. Discover repository (works from worktrees too)
3. Detect default branch
4. Detect repository type (public vs internal)
5. Calculate paths and branch names
6. Run preflight checks
7. Show existing worktrees (configurable)
8. Confirm creation
9. Create Git worktree
10. Copy environment files
11. Install dependencies (auto-detect package manager)
12. Update project metadata

**Options:**
- `-t, --type`: Branch type (required)
- `-n, --name`: Branch name (required)
- `-b, --base`: Base branch (default: auto-detect)
- `-j, --ticket`: Jira ticket ID (internal repos)
- `-y, --yes`: Skip confirmations

---

### 2. Close Command (src/commands/close.ts)

Closes worktrees with intelligent environment sync.

**Workflow:**
1. Discover worktree (path, name, or auto-detect)
2. Run safety checks
3. Check environment differences
4. Show diff visualization
5. Interactive variable selection
6. Create backup
7. Apply sync
8. Remove worktree
9. Delete branch (optional)
10. Log audit trail

**Options:**
- `path`: Worktree path (optional)
- `-n, --name`: Worktree name
- `-d, --delete-branch`: Delete branch
- `-s, --skip-sync`: Skip env sync
- `-f, --force`: Force close
- `-y, --yes`: Skip confirmations
- `--dry-run`: Preview only

**Safety Features:**
- Detects uncommitted changes
- Detects unpushed commits
- Checks merge status
- Validates worktree state
- Creates backup before sync

---

### 3. Sync-Env Command (src/commands/sync-env.ts)

Standalone environment variable synchronization.

**Workflow:**
1. Resolve sync targets (four patterns)
2. Handle bidirectional sync (if --between)
3. Generate environment diff
4. Display side-by-side diff
5. Interactive variable selection
6. Create backup
7. Apply sync
8. Log audit trail

**Options:**
- `--from`: Source path/name
- `--to`: Target path/name
- `--between`: Bidirectional sync
- `-y, --yes`: Auto-accept all
- `--dry-run`: Preview only

---

### 4. List Command (src/commands/list.ts)

Lists all worktrees with status indicators.

**Workflow:**
1. Parse git worktree list --porcelain
2. Extract worktree information
3. Sort by specified criteria
4. Format output (table, JSON, or simple)

**Options:**
- `--json`: JSON format
- `--simple`: Simple one-line format
- `--sort`: Sort by name, path, or age

**Output Formats:**
- **Table**: Formatted table with columns
- **JSON**: Machine-readable array
- **Simple**: One line per worktree

**Status Indicators:**
- **MAIN**: Main repository
- **ACTIVE**: Normal worktree
- **LOCKED**: Locked worktree
- **PRUNABLE**: Directory missing

---

### 5. Cleanup Command (src/commands/cleanup.ts)

Cleans up old backups and logs.

**Workflow:**
1. List all backups for project
2. Filter by age (if --older-than)
3. Show what will be deleted
4. Confirm deletion (unless --yes)
5. Delete backups
6. Show summary

**Options:**
- `--older-than`: Delete backups older than N days
- `-y, --yes`: Skip confirmation
- `--dry-run`: Preview only

---

## UI Components

### 1. Logger (src/ui/Logger.ts)

Centralized logging with progress indicators.

**Key Methods:**
- `info(message)` - Info message
- `success(message)` - Success message (green ✓)
- `warning(message)` - Warning message (yellow ⚠)
- `error(message)` - Error message (red ✗)
- `startProgress(message)` - Start animated spinner
- `stopProgress(message?)` - Stop spinner

**Features:**
- Color-coded output (configurable)
- Animated progress spinners (configurable)
- Section headers and dividers
- Verbose output mode

---

### 2. DiffDisplay (src/ui/DiffDisplay.ts)

Side-by-side diff visualization.

**Key Methods:**
- `show(diff, targets)` - Show complete diff
- `showSummary(diff)` - Show summary only
- `showTable(diff)` - Show table format
- `showNoChanges()` - Show "no changes" message

**Diff Sections:**
- **Added Variables** (green): Variables to add
- **Modified Variables** (yellow): Variables with different values
- **Removed Variables** (red): Variables to remove
- **Unchanged** (gray): Summary of identical variables

---

### 3. SyncPrompt (src/ui/SyncPrompt.ts)

Interactive variable selection prompts.

**Key Methods:**
- `prompt(diff, autoYes)` - Main prompt flow
- `promptAdded(added)` - Select added variables
- `promptModified(modified)` - Select modified variables
- `promptRemoved(removed)` - Select removed variables
- `promptDirection(diff)` - Choose sync direction (bidirectional)

**Features:**
- Checkbox-based selection (inquirer.js)
- "Sync all" option
- "Cancel sync" option
- Direction selection for bidirectional sync

---

## TypeScript Configuration

**Target:** ES2022
**Module:** ESNext with node resolution
**Strict Mode:** Enabled
**Output:** `dist/` with source maps and declarations

**Key tsconfig.json settings:**
```json
{
  "compilerOptions": {
    "target": "ES2022",
    "module": "ESNext",
    "moduleResolution": "node",
    "strict": true,
    "outDir": "./dist",
    "sourceMap": true,
    "declaration": true,
    "esModuleInterop": true
  }
}
```

---

## Error Handling

### Validation Strategy
All validation happens **before** any filesystem or Git operations:

1. **Input Validation**: Type, name, ticket format
2. **Repository Validation**: Git repo exists, Git binary available
3. **Branch Validation**: Branch doesn't exist locally or remotely
4. **Path Validation**: Workspace path doesn't exist
5. **Base Branch Validation**: Base branch exists

### Safety Checks (Before Close)
- Uncommitted changes
- Unpushed commits
- Merge status
- Detached HEAD state
- Merge/rebase in progress

### Backup System
- Automatic backup before every sync
- Backup rotation (keep last 10)
- Manual restore capability
- Audit trail for all operations

---

## Testing the Tool

```bash
# Test create command
pnpm run dev -- create -t feat -n test-feature --yes

# Test list command
pnpm run dev -- list --json

# Test sync-env command (dry run)
pnpm run dev -- sync-env --dry-run

# Test cleanup command (dry run)
pnpm run dev -- cleanup --older-than 30 --dry-run

# Clean up test worktree
git worktree remove ../feat/test-feature
git branch -d feat/test-feature
```

---

## Common Customization Points

### Adding New Commands

1. Create command file in `src/commands/`
2. Implement command class with `run()` method
3. Register in `src/index.ts` CLI router
4. Update types in `src/types/index.ts`

### Adding New Core Components

1. Create component in `src/core/`
2. Define interfaces in `src/types/index.ts`
3. Import and use in command implementations

### Extending Configuration

1. Update default config in `ConfigManager.ts`
2. Add types to `src/types/index.ts`
3. Document in `docs/configuration.md`

### Adding New Repository Types

Modify `detectRepositoryType()` in `create.ts` to check for different remote URL patterns.

### Adding New Package Managers

Extend `detectPackageManager()` in `create.ts` with new lock file checks.

---

## Documentation

### User Documentation
- [Configuration Guide](./docs/configuration.md)
- [Sync Operations](./docs/sync-operations.md)
- [Advanced Usage](./docs/advanced-usage.md)
- [Troubleshooting](./docs/troubleshooting.md)

### Technical Documentation
- [SPEC.md](./SPEC.md) - Complete technical specification
- [TODO.md](./TODO.md) - Development roadmap
- [PROGRESS.md](./PROGRESS.md) - Implementation progress
- [README.md](./README.md) - User guide

---

## Implementation Stats

- **23 major implementation files**
- **~5,700 lines of production TypeScript**
- **12 core components**
- **4 UI components**
- **5 commands**
- **Complete type safety with TypeScript 5.0+**
- **4 comprehensive documentation guides**

---

## Key Design Principles

1. **Modular Architecture**: Separation of concerns across commands, core, UI, types
2. **Type Safety**: Comprehensive TypeScript interfaces throughout
3. **Configuration-Driven**: Global settings with sensible defaults
4. **Safety First**: Validation before operations, backups before sync
5. **Audit Trail**: Complete logging of all operations
6. **User Experience**: Interactive prompts, clear output, progress indicators
7. **Flexibility**: Multiple sync patterns, configurable behavior
8. **Maintainability**: Well-documented code, clear separation of concerns
