# WorkForge Configuration Guide

WorkForge v3.0 uses a centralized configuration system stored at `~/.workforge/config.json`. This guide explains all available configuration options and how to customize WorkForge for your workflow.

---

## Configuration File Location

```
~/.workforge/config.json
```

The configuration file is created automatically on first use with sensible defaults. You can edit it manually or use the configuration commands (coming in future versions).

---

## Complete Configuration Schema

```json
{
  "version": "3.0.0",
  "preferences": {
    "defaultBaseBranch": "main",
    "autoDetectBaseBranch": true,
    "autoDeleteBranch": false,
    "skipConfirmations": false,
    "packageManager": "auto",
    "showExistingWorktrees": true
  },
  "backup": {
    "enabled": true,
    "maxBackupsPerProject": 10,
    "autoCleanup": true
  },
  "sync": {
    "createBackupBeforeSync": true,
    "defaultSyncDirection": "ask"
  },
  "audit": {
    "enabled": true,
    "includeVariableValues": true,
    "retentionDays": 90
  },
  "display": {
    "colorEnabled": true,
    "verboseOutput": false,
    "showProgressIndicators": true
  }
}
```

---

## Configuration Sections

### 1. Preferences

Controls general WorkForge behavior.

#### `defaultBaseBranch`
- **Type:** `string`
- **Default:** `"main"`
- **Description:** Base branch used when `autoDetectBaseBranch` is `false`. When auto-detection is on (the default), this is only a last-resort fallback for repositories where no primary branch can be determined at all.

**Example:**
```json
"defaultBaseBranch": "develop"
```

#### `autoDetectBaseBranch`
- **Type:** `boolean`
- **Default:** `true`
- **Description:** Detect the repository's primary branch from the remote when `-b/--base` is not passed. Set to `false` to always use `defaultBaseBranch` instead. An explicit `-b/--base` always wins over both.

**Example:**
```json
"autoDetectBaseBranch": false
```

#### `autoDeleteBranch`
- **Type:** `boolean`
- **Default:** `false`
- **Description:** Automatically delete branch when closing a worktree

**Example:**
```json
"autoDeleteBranch": true
```

⚠️ **Warning:** When enabled, branches will be deleted automatically after closing worktrees. Use with caution!

#### `skipConfirmations`
- **Type:** `boolean`
- **Default:** `false`
- **Description:** Skip all confirmation prompts (equivalent to always using `--yes`)

**Example:**
```json
"skipConfirmations": true
```

⚠️ **Warning:** This disables safety prompts. Use only in automated environments.

#### `packageManager`
- **Type:** `"auto" | "npm" | "pnpm" | "yarn"`
- **Default:** `"auto"`
- **Description:** Package manager to use for installing dependencies

**Options:**
- `"auto"`: Auto-detect from lock files
- `"npm"`: Always use npm
- `"pnpm"`: Always use pnpm
- `"yarn"`: Always use yarn

**Example:**
```json
"packageManager": "pnpm"
```

#### `showExistingWorktrees`
- **Type:** `boolean`
- **Default:** `true`
- **Description:** Show existing worktrees when creating a new one

**Example:**
```json
"showExistingWorktrees": false
```

---

### 2. Backup

Controls backup creation and retention.

#### `enabled`
- **Type:** `boolean`
- **Default:** `true`
- **Description:** Enable/disable backup system entirely

**Example:**
```json
"enabled": false
```

⚠️ **Warning:** Disabling backups means no recovery option if sync goes wrong.

#### `maxBackupsPerProject`
- **Type:** `number`
- **Default:** `10`
- **Description:** Maximum number of backups to keep per project

**Example:**
```json
"maxBackupsPerProject": 5
```

**Behavior:** When the limit is reached, oldest backups are automatically deleted.

#### `autoCleanup`
- **Type:** `boolean`
- **Default:** `true`
- **Description:** Automatically delete old backups when limit is exceeded

**Example:**
```json
"autoCleanup": false
```

**Note:** If disabled, backups will accumulate indefinitely.

---

### 3. Sync

Controls environment variable synchronization behavior.

#### `createBackupBeforeSync`
- **Type:** `boolean`
- **Default:** `true`
- **Description:** Create backup before syncing .env files

**Example:**
```json
"createBackupBeforeSync": false
```

⚠️ **Recommended:** Keep this enabled for safety.

#### `defaultSyncDirection`
- **Type:** `"ask" | "to-main" | "to-worktree"`
- **Default:** `"ask"`
- **Description:** Default direction for bidirectional sync

**Options:**
- `"ask"`: Always prompt user to choose direction
- `"to-main"`: Default to syncing worktree → main
- `"to-worktree"`: Default to syncing main → worktree

**Example:**
```json
"defaultSyncDirection": "to-main"
```

---

### 4. Audit

Controls audit logging and history tracking.

#### `enabled`
- **Type:** `boolean`
- **Default:** `true`
- **Description:** Enable/disable audit logging

**Example:**
```json
"enabled": false
```

**Location:** Audit logs are stored at `~/.workforge/projects/<project-id>/`

#### `includeVariableValues`
- **Type:** `boolean`
- **Default:** `true`
- **Description:** Include actual variable values in audit logs

**Example:**
```json
"includeVariableValues": false
```

**Security Note:** Disable if your .env contains sensitive data and you want minimal audit logs.

#### `retentionDays`
- **Type:** `number`
- **Default:** `90`
- **Description:** Number of days to retain audit logs

**Example:**
```json
"retentionDays": 30
```

**Behavior:** Logs older than this will be automatically cleaned up.

---

### 5. Display

Controls visual output and user interface.

#### `colorEnabled`
- **Type:** `boolean`
- **Default:** `true`
- **Description:** Enable colored terminal output

**Example:**
```json
"colorEnabled": false
```

**Use Case:** Disable for CI/CD environments or terminals without color support.

#### `verboseOutput`
- **Type:** `boolean`
- **Default:** `false`
- **Description:** Show detailed debug information

**Example:**
```json
"verboseOutput": true
```

**Use Case:** Enable for troubleshooting or understanding internal operations.

#### `showProgressIndicators`
- **Type:** `boolean`
- **Default:** `true`
- **Description:** Show animated progress spinners

**Example:**
```json
"showProgressIndicators": false
```

**Use Case:** Disable for CI/CD or when output is logged to files.

---

## Configuration Examples

### Example 1: CI/CD Environment

```json
{
  "version": "3.0.0",
  "preferences": {
    "skipConfirmations": true,
    "showExistingWorktrees": false
  },
  "backup": {
    "enabled": false
  },
  "display": {
    "colorEnabled": false,
    "verboseOutput": true,
    "showProgressIndicators": false
  }
}
```

### Example 2: Conservative/Safe Setup

```json
{
  "version": "3.0.0",
  "preferences": {
    "autoDeleteBranch": false,
    "skipConfirmations": false
  },
  "backup": {
    "enabled": true,
    "maxBackupsPerProject": 20,
    "autoCleanup": true
  },
  "sync": {
    "createBackupBeforeSync": true
  },
  "audit": {
    "enabled": true,
    "includeVariableValues": true,
    "retentionDays": 180
  }
}
```

### Example 3: Fast/Minimal Setup

```json
{
  "version": "3.0.0",
  "preferences": {
    "autoDeleteBranch": true,
    "skipConfirmations": true,
    "showExistingWorktrees": false
  },
  "backup": {
    "enabled": true,
    "maxBackupsPerProject": 3
  },
  "audit": {
    "enabled": true,
    "includeVariableValues": false,
    "retentionDays": 30
  }
}
```

---

## File Locations

### Configuration
```
~/.workforge/config.json
```

### Project Metadata
```
~/.workforge/projects/<project-id>/.meta.json
~/.workforge/projects/<project-id>/audit.log
~/.workforge/projects/<project-id>/sync-history.json
```

### Backups
```
~/.workforge/backups/<project-id>/.env.backup.YYYY-MM-DD_HH-mm-ss
```

---

## Project ID Generation

Projects are identified by an 8-character SHA-256 hash of their Git remote URL:

```
Remote URL: git@github.com:user/repo.git
Project ID: a1b2c3d4
```

This ensures:
- Unique identification across all repositories
- Consistent ID regardless of local path
- Separation of metadata and backups per project

---

## Configuration Best Practices

### 1. Keep Backups Enabled
Always keep `backup.enabled: true` for safety. Backups have saved countless developers from accidental data loss.

### 2. Adjust Retention Based on Team Size
- **Solo developers:** 10 backups, 90 days retention
- **Small teams:** 15 backups, 120 days retention
- **Large teams:** 20 backups, 180 days retention

### 3. Security Considerations
If your .env files contain sensitive secrets:
```json
"audit": {
  "includeVariableValues": false
}
```

### 4. CI/CD Integration
For automated environments:
```json
"preferences": {
  "skipConfirmations": true
},
"display": {
  "colorEnabled": false,
  "showProgressIndicators": false
}
```

---

## Troubleshooting Configuration

### Configuration Not Loading
1. Check file exists: `ls -la ~/.workforge/config.json`
2. Check JSON syntax: `cat ~/.workforge/config.json | python -m json.tool`
3. Check permissions: `chmod 644 ~/.workforge/config.json`

### Reset to Defaults
Delete the configuration file and it will be recreated:
```bash
rm ~/.workforge/config.json
workforge create -t test -n config-test
```

### Validate Configuration
The configuration is validated on every command. Invalid values will show an error message.

---

## See Also

- [Sync Operations Guide](./sync-operations.md)
- [Advanced Usage](./advanced-usage.md)
- [Troubleshooting](./troubleshooting.md)
