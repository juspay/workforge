# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

WorkForge v3.0 is a TypeScript CLI tool for managing Git worktrees with intelligent environment variable synchronization, automatic backup management, and comprehensive audit logging. The tool provides five commands: `create`, `close`, `sync-env`, `list`, and `cleanup`.

**Binary aliases**: `workforge` and `wf`

## Development Commands

```bash
# Run the test suite (builds first — command tests drive the built CLI)
pnpm test

# Watch mode
pnpm run test:watch

# A single file, or a single test by name
npx vitest run test/env-parser.test.ts
npx vitest run test/create.test.ts -t "forks from the remote tip"

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
│   ├── BranchResolver.ts       # Remote-aware branch resolution
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
├── utils/             # Utility functions
│   ├── errors.ts      # Error handling
│   └── strings.ts     # String transformations
├── types/
│   └── index.ts       # TypeScript interfaces
└── index.ts           # CLI router (yargs)

test/
├── helpers/
│   └── fixtures.ts    # Isolated bare remote + clone, CLI runner
├── env-parser.test.ts # Parser fidelity and sync safety (unit)
├── create.test.ts     # create command (drives the built CLI)
└── close.test.ts      # close, BranchCleaner, BackupManager, ProjectIdentifier
```

---

## Testing

`pnpm test` builds, then runs Vitest. 41 tests, ~16s.

**How the fixtures work.** `makeRepo()` builds a bare repository standing in for
the remote, a `seed` checkout used to push "someone else's" commits, and the
`local` clone under test. `advanceRemote: true` pushes an extra commit so the
clone's local branch starts out **stale** — that gap is what most of the
create-side regressions were about. `.env` is gitignored in the fixture, matching
real projects; without that it registers as an uncommitted change and blocks
`close`.

Command tests spawn the built CLI (`dist/index.js`) rather than importing it,
because the commands call `process.exit`. Unit tests import from `src` directly.

**Serial by design.** `fileParallelism: false` — fixtures share `~/.workforge`
state (backups, audit logs, project metadata), so parallel files would race.

**These tests are regression guards, not coverage.** Every one of them maps to a
defect that shipped. Before trusting a change here, confirm the relevant test
still fails when the fix is reverted — the suite has been mutation-checked
against the `#`-comment, protected-branch, and remote-tip fixes.

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
- `parseFile(filePath)` - Same, plus the trivia after the last variable
- `parseContent(content)` - Parse from a string (used by the round-trip guard)
- `stringify(variables, trailingTrivia?)` - Convert variable map to .env format

**Supported Features:**
- Single-line variables: `KEY=value`
- Multi-line values with quotes: `KEY="value\nline2"`
- Comments: `# comment` or `// comment`
- Inline comments: `KEY=value # comment`, requiring whitespace before the marker
- Single and double quotes
- Escape sequences: `\n`, `\t`, `\\`, `\"`
- CRLF and bare-CR line endings, normalised on read
- Invalid line recovery (skips malformed lines, warns on duplicate keys)

**Fidelity — why rewriting a file is safe:**

Each variable keeps its exact original text in `raw`, plus the comment and blank
lines above it in `leadingTrivia`. `stringify` re-emits `raw` verbatim, so a
variable nobody changed is byte-identical after a rewrite; only added or
modified variables are serialised from their fields. Trivia after the last
variable is carried on `ParsedEnvFile.trailingTrivia` and must be passed back to
`stringify` — `parse()` alone returns a Map and cannot carry it.

Three consequences this design exists to prevent, all of which used to corrupt
untouched variables on every sync:
- `KEY=sk_live_abc#def` — `#` without preceding whitespace is part of the value, not a comment
- `KEY="C:\\Users\\name"` — escapes decode in one left-to-right pass; sequential regex replacements rescanned their own output and turned `\name` into a newline
- Standalone comments and blank lines are preserved rather than dropped

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

### 4b. BranchResolver (src/core/BranchResolver.ts)

Treats the remote as the source of truth for branches; the local branch is a
possibly-stale cache. Used by `create` and by `SafetyChecker`.

**Key Methods:**
- `getRemoteName()` - Prefers `origin`, else the first remote, else `null`
- `fetch(remote)` - `git fetch <remote> --prune`; never throws, reports `{ ok, error }`
- `refreshRemoteHead(remote)` - Re-reads and caches `<remote>/HEAD` (`git fetch` never updates it, so a renamed default branch would otherwise stick forever)
- `detectPrimaryBranch(remote)` - Five-rung ladder, see below
- `resolveStartPoint(base, remote)` - What to actually branch from
- `listLocalBranches()` / `listRemoteBranches(remote)` - For error messages
- `describeCommit(revision)` - Short SHA, for reporting

**Primary branch ladder** (falls through on every failure):
1. `refs/remotes/<remote>/HEAD`
2. `git ls-remote --symref <remote> HEAD`, then cached
3. `main`, `master`, `release`, `develop`, `trunk`, `beta`, `dev`, `stable` against `refs/remotes/<remote>/*`
4. The same candidates against `refs/heads/*`
5. The currently checked-out branch

**Start point resolution:**
| Condition | Start point | `source` |
|---|---|---|
| `refs/remotes/<remote>/<base>` exists | `<remote>/<base>` | `remote` |
| only `refs/heads/<base>` exists | `<base>` (warns: may be stale) | `local` |
| resolves as a tag or commit | as given | `committish` |
| nothing matches | `null` → actionable error | `missing` |

**Why:** `git fetch` advances only `refs/remotes/*`. Branching from a local
branch name forks from wherever that branch was last left — commonly many
commits behind the remote, because worktree users rarely check out or pull the
primary branch in the main clone.

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
2. Load target .env (`parseFile`, keeping trivia)
3. Merge variables based on decision — added variables are appended after
   everything already in the target, never inserted at the source file's line number
4. Render the new content
5. **Round-trip guard**: re-parse that content and assert every variable the user
   did *not* select is still present and unchanged. Any drift throws, so the
   target file is left untouched rather than silently corrupted
6. Write updated .env
7. Return sync result with stats

The guard exists because `.env` is normally gitignored: a bad write is often
unrecoverable, so a loud failure beats a silent one.

---

### 7. BackupManager (src/core/BackupManager.ts)

Manages automatic backups with rotation.

**Key Methods:**
- `createBackup(filePath)` - Create timestamped backup
- `listBackups()` - List all backups for project
- `restore(backupId)` - Restore from backup
- `deleteBackup(backupId)` - Delete specific backup
- `cleanupOldBackups()` - Auto-cleanup old backups

**Backup Format:** `.env.backup.YYYY-MM-DD_HH-mm-ss`, with a `-N` suffix when
two backups land in the same second. Written with `COPYFILE_EXCL` so a backup
can never silently overwrite an earlier snapshot.

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
2. **Unpushed Commits**: Detects commits not pushed to remote. Indeterminate results (the remote-tracking ref is missing even after a targeted fetch) are reported as *unpushed*, never as clean
3. **Merge Status**: Checks the branch against `<remote>/<primary>`, where the primary branch comes from `BranchResolver` — not a hardcoded `main`/`master`, and not the local branch, which is normally stale in a worktree workflow
4. **Detached HEAD**: Detects detached HEAD state
5. **Merge/Rebase in Progress**: Detects ongoing merge or rebase

Refs are refreshed with a best-effort `git fetch` before any of the remote
comparisons run.

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

**Durability.** The history file is a read-modify-write shared by every
invocation against the same project, so `addToHistory` takes a `mkdir`-based
lock (atomic on all platforms, reclaimed after 10s if a holder dies) and writes
through a temp file plus `rename`. An unparseable history is moved aside as
`sync-history.json.corrupt-<timestamp>` rather than overwritten — it may be the
only record of months of operations. The human-readable log is rebuilt the same
way; it used to be deleted and re-appended entry by entry, so an interrupt
truncated it permanently.

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
   - Auto-convert name to kebab-case using toKebabCase()
   - Log conversion if name changed
2. Discover repository (via `git worktree list`, so it works from worktrees too)
3. Sync with remote — `git fetch <remote> --prune`, then refresh `<remote>/HEAD`.
   Runs *before* branch detection and preflight so both read fresh refs.
   Best effort: a missing or unreachable remote warns and continues.
4. Resolve base branch (see BranchResolver) — explicit `-b` > auto-detected
   primary > `preferences.defaultBaseBranch`; resolves to `<remote>/<base>`
   when the base exists on the remote
5. Detect repository type (public vs internal)
6. Calculate paths and branch names
   - With Jira ticket: branch `type/TICKET-name`, folder `type/TICKET-name`
   - Without ticket: branch `type/name`, folder `type/name`
7. Run preflight checks (branch collisions checked against fresh remote refs)
8. Show existing worktrees (configurable)
9. Confirm creation
10. Create Git worktree — `git worktree add -b <branch> --no-track <path> <startPoint>`
11. Copy environment files ┐
12. Install dependencies   ├ each isolated: a failure is recorded as a warning
13. Update project metadata┘ and the remaining steps still run

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
2. Run safety checks (fetches first; merge status is judged against `<remote>/<primary>`)
3. Check environment differences. If the worktree has a `.env` and the main repo
   does not, seed an empty one so the values are offered for sync instead of
   being destroyed with the worktree — the placeholder is removed again if
   nothing is synced
4. Show diff visualization
5. Interactive variable selection
6. Create backup — **a backup failure aborts the close**; the sync overwrites
   main's `.env` in place and `.env` is normally gitignored
7. Apply sync (guarded: unselected variables must survive unchanged)
8. Remove worktree
9. Delete branch (optional) — refuses the repository's primary branch, plus
   `main`/`master`, and only force-deletes when `--force` is given
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
3. Calculate relative paths from current directory
4. Sort by specified criteria
5. Format output (table, JSON, or simple)

**Options:**
- `--json`: JSON format
- `--simple`: Simple one-line format
- `--sort`: Sort by name, path, or age

**Output Formats:**
- **Table**: Formatted table with columns
- **JSON**: Machine-readable array
- **Simple**: One line per worktree

**Output Features:**
- **Relative Paths**: Shows paths relative to current directory (e.g., `../feat/my-feature`)
- **Copy-Paste Ready**: Can directly use `cd <path>` from output
- **JSON Format**: Includes both absolute and relative paths

**Sorting:** `--sort age` uses each worktree's HEAD commit time
(`WorktreeInfo.commitTimestamp`, populated by `WorktreeResolver`). It previously
compared commit *hashes*, which carry no chronological information.

**Status Indicators:**
- **MAIN**: Main repository — detected by position (git always lists the main
  worktree first), not by the porcelain `bare` line, which only appears for
  bare repositories
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

### String Utilities

The `src/utils/strings.ts` module provides string transformation functions:

- `toKebabCase(input: string): string` - Convert any string to kebab-case format
  - Handles spaces, underscores, special characters
  - Idempotent (already kebab-case strings pass through unchanged)
  - Used for branch name normalization in create command

**Example:**
```typescript
import { toKebabCase } from '../utils/strings.js';

const branchName = toKebabCase('My Feature Name');
// Result: 'my-feature-name'
```

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
