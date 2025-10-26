# Environment Variable Sync Operations

WorkForge v3.0 introduces intelligent environment variable synchronization between worktrees and the main repository. This guide explains how the sync system works, how to use it effectively, and how to recover from issues.

---

## Table of Contents

1. [Overview](#overview)
2. [Close Command with Sync](#close-command-with-sync)
3. [Standalone Sync-Env Command](#standalone-sync-env-command)
4. [Diff Display](#diff-display)
5. [Interactive Selection](#interactive-selection)
6. [Backup and Recovery](#backup-and-recovery)
7. [Best Practices](#best-practices)

---

## Overview

### What is Environment Sync?

Environment sync automatically detects changes between `.env` files in different worktrees and offers to synchronize them. This ensures environment variables stay consistent across your development environments.

### When Does Sync Happen?

1. **Automatic**: When closing a worktree with `workforge close`
2. **Manual**: Using `workforge sync-env` command
3. **Bidirectional**: Using `workforge sync-env --between <worktree>`

### What Gets Synced?

**Only `.env` files are synced.** Other environment files (`.env.local`, `.env.example`, `.env.production`) are NOT synced.

---

## Close Command with Sync

The `close` command automatically checks for environment variable differences before closing a worktree.

### Basic Usage

```bash
# Close current worktree (auto-detects)
workforge close

# Close specific worktree by path
workforge close /path/to/worktree

# Close by branch name
workforge close -n feat-auth
```

### Workflow

```
1. Discover worktree → 2. Safety checks → 3. Env sync → 4. Remove worktree → 5. Delete branch (optional)
```

### Example Session

```bash
$ workforge close

🔒 Close Worktree

Found worktree: feat-auth
Path: /Users/dev/project/feat-auth
Branch: feat-auth

[1/5] Running safety checks...
✓ All safety checks passed

[2/5] Checking environment variable changes...

🔄 Environment Variable Diff
────────────────────────────────────────────────────────────

Source: Main (project)
Target: Worktree (feat-auth)

✚ Added Variables (2)
These variables will be added to the target:

+ API_KEY = "sk_test_abc123"
+ DEBUG_MODE = "true"

⟳ Modified Variables (1)
These variables have different values:

~ DATABASE_URL
    - postgres://localhost:5432/main
    + postgres://localhost:5432/feat_auth

Summary:
• 2 variables to be added
• 1 variable to be modified
• 15 variables unchanged

📝 Select Variables to Sync
Choose which environment variable changes to apply:

? How would you like to sync?
  ❯ Sync all changes
    Select variables individually
    Cancel sync

? Proceed with sync? (Y/n) y

Creating backup...
✓ Backup created

Syncing environment variables...
✓ Environment variables synced successfully

[3/5] Removing worktree...
✓ Worktree removed: /Users/dev/project/feat-auth

✓ Worktree closed successfully!
```

### Skip Sync

To close without syncing:

```bash
workforge close --skip-sync
```

### Dry Run

Preview what would happen without executing:

```bash
workforge close --dry-run
```

---

## Standalone Sync-Env Command

The `sync-env` command provides flexible environment variable synchronization without closing worktrees.

### Four Sync Patterns

#### Pattern 1: Explicit Source and Target

```bash
workforge sync-env --from feat-auth --to feat-users
```

Syncs `.env` from `feat-auth` worktree to `feat-users` worktree.

#### Pattern 2: From Worktree to Main

```bash
workforge sync-env --from feat-auth
```

Syncs `.env` from `feat-auth` worktree to main repository.

#### Pattern 3: From Main to Worktree

```bash
workforge sync-env --to feat-auth
```

Syncs `.env` from main repository to `feat-auth` worktree.

#### Pattern 4: Bidirectional Sync

```bash
workforge sync-env --between feat-auth
```

Shows differences in both directions and lets you choose which way to sync.

#### Pattern 5: Auto-Detect

```bash
# Run from inside a worktree
cd /path/to/worktree
workforge sync-env
```

Automatically syncs from main to current worktree.

### Full Example

```bash
$ workforge sync-env --from feat-auth --to main

🔄 Sync Environment Variables

Sync Configuration:
Source: Worktree (feat-auth)
Target: Main (project)

[1/4] Analyzing environment changes...

🔄 Environment Variable Diff
────────────────────────────────────────────────────────────

✚ Added Variables (1)
+ NEW_FEATURE_FLAG = "true"

⟳ Modified Variables (1)
~ LOG_LEVEL
    - info
    + debug

[2/4] Select variables to sync...

? Select variables to add:
  ❯ [x] NEW_FEATURE_FLAG

? Select variables to update:
  ❯ [x] LOG_LEVEL

[3/4] Creating backup...
✓ Backup created

[4/4] Syncing environment variables...
✓ Environment variables synced successfully

Summary:
• 1 variable added
• 1 variable modified
• Backup created

✓ Environment sync complete!
```

---

## Diff Display

WorkForge shows a clear, color-coded diff of environment variable changes.

### Diff Sections

#### Added Variables (Green)

Variables that exist in source but not in target:

```
✚ Added Variables (2)
+ API_KEY = "sk_test_abc123"
+ DEBUG_MODE = "true"
```

#### Modified Variables (Yellow)

Variables that exist in both but have different values:

```
⟳ Modified Variables (1)
~ DATABASE_URL
    - postgres://localhost:5432/main    (old)
    + postgres://localhost:5432/test    (new)
```

#### Removed Variables (Red)

Variables that exist in target but not in source:

```
✖ Removed Variables (1)
- OLD_API_KEY = "deprecated_key"
```

#### Unchanged Variables (Gray)

Summary of variables that are identical:

```
━ Unchanged: 15 variables
```

### Table Format

For a more compact view, diffs can also be shown in table format:

```
Status | Variable      | Old Value            | New Value
-------|---------------|----------------------|----------------------
+ ADD  | API_KEY       | (none)              | sk_test_abc123
~ MOD  | DATABASE_URL  | localhost:5432/main | localhost:5432/test
- DEL  | OLD_API_KEY   | deprecated_key      | (removed)
```

---

## Interactive Selection

WorkForge allows line-by-line selection of which variables to sync.

### Selection Modes

#### 1. Sync All

Accept all changes at once:

```
? How would you like to sync?
  ❯ Sync all changes
    Select variables individually
    Cancel sync
```

#### 2. Selective Sync

Choose individual variables:

```
? Select variables to add:
  ❯ [x] API_KEY = "sk_test_abc123"
    [x] DEBUG_MODE = "true"
    [ ] FEATURE_FLAG = "false"

? Select variables to update:
  ❯ [x] DATABASE_URL: localhost:5432/main → localhost:5432/test
    [ ] LOG_LEVEL: info → debug

? Select variables to remove:
  ❯ [ ] OLD_API_KEY = "deprecated_key"
    [ ] DEPRECATED_URL = "http://old.api.com"
```

**Note:** Use Space to toggle, Enter to confirm.

#### 3. Auto-Yes Mode

Skip all prompts and accept all changes:

```bash
workforge sync-env --from feat-auth --yes
```

### Confirmation Summary

Before applying changes, WorkForge shows a summary:

```
Sync Summary:
• 2 variables to add
• 1 variable to modify
• 0 variables to remove

? Proceed with sync? (Y/n)
```

---

## Backup and Recovery

WorkForge automatically creates backups before syncing (configurable).

### Automatic Backups

By default, backups are created before every sync:

```
Creating backup...
✓ Backup created
```

**Location:** `~/.workforge/backups/<project-id>/.env.backup.YYYY-MM-DD_HH-mm-ss`

### Backup Retention

- **Default:** Keep last 10 backups per project
- **Configurable:** Set `maxBackupsPerProject` in config
- **Auto-cleanup:** Old backups deleted automatically

### Manual Backup Recovery

To restore from a backup:

```bash
# List available backups
ls -la ~/.workforge/backups/<project-id>/

# Restore manually
cp ~/.workforge/backups/<project-id>/.env.backup.2025-10-26_14-30-00 /path/to/worktree/.env
```

### Disable Backups

To sync without creating backups:

**Option 1:** Configuration file
```json
{
  "sync": {
    "createBackupBeforeSync": false
  }
}
```

**Option 2:** Temporarily (not yet implemented)
```bash
workforge sync-env --no-backup
```

---

## Best Practices

### 1. Review Before Syncing

Always review the diff before accepting changes:
- Check for accidental secret exposure
- Verify database URLs are correct
- Ensure feature flags match your intent

### 2. Use Selective Sync

Don't blindly sync all variables. Review each one:
```
✓ Do: Select only the variables you need
✗ Don't: Always choose "Sync all"
```

### 3. Keep Backups Enabled

Backups have saved countless developers:
```json
{
  "sync": {
    "createBackupBeforeSync": true
  }
}
```

### 4. Use Dry Run for Large Changes

Preview changes without executing:
```bash
workforge sync-env --from feat-auth --dry-run
```

### 5. Sync Direction Matters

Think about which direction makes sense:
- **Main → Worktree:** Starting new feature, want latest config
- **Worktree → Main:** Finished feature, have new variables to share
- **Bidirectional:** Not sure, want to review both directions

### 6. Watch for Sensitive Data

Be careful with:
- API keys
- Database passwords
- OAuth secrets
- Private keys

Consider using `.env.example` for documentation instead.

### 7. Commit Patterns

**Do:**
```bash
# Update .env in main repo
git add .env
git commit -m "feat: add new API_KEY for auth service"
```

**Don't:**
```bash
# Don't commit actual secrets
git add .env
git commit -m "add production passwords"  # ❌
```

---

## Common Workflows

### Workflow 1: Starting a New Feature

```bash
# Create worktree
workforge create -t feat -n auth

# Sync latest env from main
cd feat-auth
workforge sync-env

# Work on feature...
# Add new env vars to .env

# When done, sync back to main
workforge sync-env --from feat-auth --to main

# Close worktree
workforge close
```

### Workflow 2: Updating All Worktrees

```bash
# Update .env in main repo
cd /path/to/main/repo
# Edit .env

# Sync to each worktree
workforge sync-env --to feat-auth
workforge sync-env --to feat-users
workforge sync-env --to fix-bug
```

### Workflow 3: Consolidating Changes

```bash
# Multiple worktrees have env changes
# Review and sync them to main

workforge sync-env --from feat-auth --dry-run
workforge sync-env --from feat-auth

workforge sync-env --from feat-users --dry-run
workforge sync-env --from feat-users
```

---

## Troubleshooting

### Sync Failed

If sync fails mid-operation:
1. Check the backup was created
2. Restore from backup if needed
3. Check file permissions
4. Review error message

### Conflicting Changes

When both files have changes:
```bash
# Use bidirectional sync to review
workforge sync-env --between feat-auth

# Choose direction carefully
# Or merge manually
```

### Lost Changes

If you accidentally synced the wrong way:
```bash
# Find the backup
ls -la ~/.workforge/backups/<project-id>/

# Restore from latest backup
cp ~/.workforge/backups/<project-id>/.env.backup.2025-10-26_14-30-00 .env
```

### No Changes Detected

If sync says "No changes" but you know there are:
1. Check you're syncing the right worktrees
2. Verify .env files exist in both locations
3. Check file permissions
4. Try `--verbose` flag (if available)

---

## Advanced Topics

### Audit Trail

Every sync operation is logged:

**Location:** `~/.workforge/projects/<project-id>/audit.log`

**Example:**
```
────────────────────────────────────────────────────────────
[2025-10-26T14:30:15.123Z] SYNC
────────────────────────────────────────────────────────────

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

### JSON History

Machine-readable history:

**Location:** `~/.workforge/projects/<project-id>/sync-history.json`

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

## See Also

- [Configuration Guide](./configuration.md)
- [Advanced Usage](./advanced-usage.md)
- [Troubleshooting](./troubleshooting.md)
