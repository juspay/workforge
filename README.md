# WorkForge

A powerful CLI tool for managing Git worktrees with intelligent environment variable synchronization, automatic backup management, and comprehensive audit logging. Create, sync, and close worktrees with confidence.

## Features

### v3.0 - Intelligent Environment Sync & Worktree Management

- 🔄 **Environment Variable Synchronization**: Intelligent .env syncing between worktrees and main repo
- 📊 **Side-by-Side Diff Display**: Visual comparison of environment variables with color-coded changes
- 🎯 **Interactive Variable Selection**: Line-by-line selection of which variables to sync
- 💾 **Automatic Backup Management**: Auto-backup before sync with configurable retention (keep last 10)
- 📝 **Complete Audit Trail**: Dual-format logging (human-readable + JSON) with full history
- 🛡️ **Safety Checks Before Closure**: Detects uncommitted changes, unpushed commits, merge status
- 🔀 **Bidirectional Sync**: Sync from worktree to main, main to worktree, or choose direction interactively
- 🧹 **Cleanup Utilities**: Age-based backup cleanup with dry-run preview
- 📋 **Worktree Listing**: View all worktrees in table, JSON, or simple format
- ⚙️ **Centralized Configuration**: Global settings at `~/.workforge/config.json`

### v2.0 - Worktree Creation Features

- ✨ **Automatic Organization**: Creates `../type/name` folder structure
- 🔍 **Smart Repository Detection**: Works from any directory in a Git repo or worktree
- 🏢 **Internal Repository Support**: Special handling for internal Bitbucket repositories
- 🎫 **Jira Integration**: Optional Jira ticket ID support with smart branch naming
- 📦 **Package Manager Detection**: Automatically detects and uses npm, pnpm, or yarn
- 🚀 **Auto Dependency Installation**: Runs package manager install after worktree creation
- 🛡️ **Pre-flight Checks**: Validates branches, paths, and prevents conflicts
- 🌿 **Smart Branch Detection**: Auto-detects default branch (main, master, beta, etc.)
- 🎯 **Branch Management**: Creates properly named branches with flexible patterns
- 💬 **Interactive Confirmation**: Optional confirmation before creation
- 🌈 **Colored Output**: Beautiful terminal output with status indicators

## Installation

### Global NPM Package (Recommended)

```bash
# Install globally via npm
npm install -g workforge

# Use anywhere
workforge --type feat --name user-auth
# or
wf --type fix --name memory-leak
```

### Project-Specific Installation

```bash
# Install in your project
npm install --save-dev workforge

# Add to package.json scripts
{
  "scripts": {
    "worktree": "workforge"
  }
}

# Use via npm script
npm run worktree -- --type feat --name user-auth
```

## Quick Start

```bash
# Create a new worktree
workforge create -t feat -n user-auth

# List all worktrees
workforge list

# Sync environment variables
workforge sync-env

# Close a worktree (with automatic env sync)
workforge close

# Clean up old backups
workforge cleanup --older-than 30
```

## Commands

WorkForge v3.0 provides five powerful commands:

### 1. Create - Create New Worktrees

```bash
# Create a feature branch worktree
workforge create -t feat -n user-authentication

# Create a fix branch from develop
workforge create -t fix -n memory-leak -b develop

# Create with Jira ticket (internal repos)
workforge create -t feat -n api-integration -j BZ-12345

# Non-interactive creation
workforge create -t doc -n api-guide -y
```

**Options:**
- `-t, --type`: Branch type (feat, fix, doc, etc.) - **Required**
- `-n, --name`: Feature/branch name (kebab-case) - **Required**
- `-b, --base`: Base branch to checkout from (default: main)
- `-j, --ticket`: Jira ticket ID (format: BZ-12345)
- `-y, --yes`: Skip confirmations

### 2. Close - Close Worktrees with Intelligent Sync

```bash
# Close current worktree (auto-detects)
workforge close

# Close specific worktree by path
workforge close /path/to/worktree

# Close by branch name
workforge close -n feat-auth

# Close and delete branch
workforge close --delete-branch

# Skip environment sync
workforge close --skip-sync

# Force close (ignore safety checks)
workforge close --force
```

**Options:**
- `path`: Path to worktree (optional, auto-detects)
- `-n, --name`: Worktree name to close
- `-d, --delete-branch`: Delete the branch after closing
- `-s, --skip-sync`: Skip environment variable sync
- `-f, --force`: Force close even with uncommitted changes
- `-y, --yes`: Skip confirmations
- `--dry-run`: Preview changes without executing

**Features:**
- Automatic environment variable diff and sync
- Safety checks (uncommitted changes, unpushed commits, merge status)
- Interactive variable selection
- Automatic backup before sync
- Complete audit logging

### 3. Sync-Env - Sync Environment Variables

```bash
# Auto-detect: sync main to current worktree
workforge sync-env

# Sync from main to specific worktree
workforge sync-env --to feat-auth

# Sync from worktree to main
workforge sync-env --from feat-auth

# Sync between two worktrees
workforge sync-env --from feat-auth --to feat-users

# Bidirectional sync (choose direction interactively)
workforge sync-env --between feat-auth

# Auto-accept all changes
workforge sync-env --from feat-auth --yes

# Preview changes without executing
workforge sync-env --from feat-auth --dry-run
```

**Options:**
- `--from`: Source worktree path or name
- `--to`: Target worktree path or name
- `--between`: Bidirectional sync (choose direction interactively)
- `-y, --yes`: Auto-accept all changes
- `--dry-run`: Preview changes without executing

**Features:**
- Side-by-side diff visualization
- Line-by-line variable selection
- Automatic backup before sync
- Support for multi-line values and complex .env formats
- Complete audit trail

### 4. List - List All Worktrees

```bash
# List all worktrees (table format)
workforge list

# List in JSON format
workforge list --json

# Simple one-line format
workforge list --simple

# Sort by branch name
workforge list --sort name

# Sort by path
workforge list --sort path

# Sort by age (most recent first)
workforge list --sort age
```

**Options:**
- `--json`: Output in JSON format
- `--simple`: Simple one-line format
- `--sort`: Sort by name, path, or age

**Output includes:**
- Branch name
- Worktree path
- Commit hash
- Status (MAIN, ACTIVE, LOCKED, PRUNABLE)

### 5. Cleanup - Clean Up Old Backups

```bash
# Clean up all backups (with confirmation)
workforge cleanup

# Delete backups older than 30 days
workforge cleanup --older-than 30

# Preview what would be deleted
workforge cleanup --dry-run

# Skip confirmation
workforge cleanup --yes
```

**Options:**
- `--older-than`: Delete backups older than N days
- `-y, --yes`: Skip confirmation
- `--dry-run`: Preview what would be deleted

## Common Workflows

### Feature Development Workflow

```bash
# 1. Create worktree for new feature
workforge create -t feat -n user-dashboard

# 2. Work on feature, modify .env as needed
cd ../feat/user-dashboard
# ... make changes ...

# 3. List all worktrees to see status
workforge list

# 4. Sync .env changes back to main
workforge sync-env --from feat-user-dashboard

# 5. Close worktree when done
workforge close --delete-branch
```

### Hot Fix Workflow

```bash
# Quick fix workflow
workforge create -t fix -n critical-bug -y
cd ../fix/critical-bug

# Make fix, commit
git add .
git commit -m "fix: resolve critical bug"
git push

# Sync .env changes (if any) and close
workforge close --delete-branch --yes
```

### Multiple Worktree Management

```bash
# Create multiple worktrees
workforge create -t feat -n auth
workforge create -t feat -n users
workforge create -t fix -n memory-leak

# List all worktrees
workforge list

# Update .env in main repo
cd /path/to/main/repo
vim .env

# Sync to all worktrees
workforge sync-env --to feat-auth
workforge sync-env --to feat-users
workforge sync-env --to fix-memory-leak

# Close old worktrees
workforge cleanup --older-than 30
```

### CI/CD Integration

```yaml
# .github/workflows/worktree-build.yml
name: Worktree Build

on:
  push:
    branches: [ main, develop ]

jobs:
  build:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3

      - name: Install WorkForge
        run: npm install -g workforge

      - name: Configure WorkForge
        run: |
          mkdir -p ~/.workforge
          cat > ~/.workforge/config.json << EOF
          {
            "preferences": { "skipConfirmations": true },
            "backup": { "enabled": false },
            "display": {
              "colorEnabled": false,
              "showProgressIndicators": false
            }
          }
          EOF

      - name: Create worktree for build
        run: workforge create -t build -n ci-${{ github.run_number }} --yes

      - name: Build in worktree
        working-directory: ./build-ci-${{ github.run_number }}
        run: |
          npm install
          npm run build

      - name: Cleanup
        if: always()
        run: workforge close -n build-ci-${{ github.run_number }} --yes --skip-sync
```

## Configuration

WorkForge stores global configuration at `~/.workforge/config.json`.

### Configuration File Location

```
~/.workforge/config.json
```

### Example Configuration

```json
{
  "version": "3.0.0",
  "preferences": {
    "defaultBaseBranch": "main",
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

### Key Configuration Options

**Preferences:**
- `defaultBaseBranch`: Default base branch for new worktrees (default: `"main"`)
- `autoDeleteBranch`: Auto-delete branch when closing worktree (default: `false`)
- `skipConfirmations`: Skip all confirmation prompts (default: `false`)
- `packageManager`: Package manager to use: `auto`, `npm`, `pnpm`, or `yarn` (default: `"auto"`)

**Backup:**
- `enabled`: Enable automatic backups (default: `true`)
- `maxBackupsPerProject`: Maximum backups per project (default: `10`)
- `autoCleanup`: Auto-delete old backups (default: `true`)

**Sync:**
- `createBackupBeforeSync`: Create backup before syncing (default: `true`)
- `defaultSyncDirection`: Direction for bidirectional sync: `ask`, `to-main`, or `to-worktree` (default: `"ask"`)

**Audit:**
- `enabled`: Enable audit logging (default: `true`)
- `includeVariableValues`: Include values in audit logs (default: `true`)
- `retentionDays`: Days to retain audit logs (default: `90`)

**Display:**
- `colorEnabled`: Enable colored output (default: `true`)
- `verboseOutput`: Show detailed debug information (default: `false`)
- `showProgressIndicators`: Show animated progress spinners (default: `true`)

For more details, see [Configuration Guide](./docs/configuration.md).

### File Locations

```
~/.workforge/
├── config.json                          # Global configuration
├── projects/
│   └── <project-id>/
│       ├── .meta.json                   # Project metadata
│       ├── audit.log                    # Human-readable audit log
│       └── sync-history.json            # Machine-readable history
└── backups/
    └── <project-id>/
        └── .env.backup.YYYY-MM-DD_*     # Timestamped backups
```

## Repository Types & Branch Naming

### Public Repositories (GitHub, GitLab, etc.)
- **Branch Pattern**: `type/name`
- **Examples**: `feat/user-authentication`, `fix/memory-leak`

### Internal Repositories (bitbucket.juspay.net)
- **With Ticket**: `TICKET-type-name` (e.g., `BZ-12345-feat-user-auth`)
- **Without Ticket**: `type/name` (fallback to standard pattern)
- **Interactive Prompt**: Asks for optional Jira ticket ID
- **Validation**: Enforces ticket format (e.g., BZ-12345, ABC-123)

## Package Manager Detection

The tool automatically detects your project's package manager and runs the appropriate install command:

### Detection Logic
1. **pnpm-lock.yaml** found → Uses `pnpm install`
2. **yarn.lock** found → Uses `yarn install`
3. **package-lock.json** found → Uses `npm install`
4. **No lock file** → Defaults to `npm install`

### Automatic Installation
- Runs after worktree creation and environment file copying
- Executes in the new worktree directory (not original repo)
- Shows installation progress with package manager output
- Handles errors gracefully with helpful messages

## Folder Structure

The tool creates an organized folder structure while maintaining consistent naming:

```
your-repo/
├── .git/
├── src/
├── pnpm-lock.yaml    # Detected: uses pnpm
└── ...

../
├── feat/
│   ├── user-authentication/    # ← New worktree (BZ-12345-feat-user-authentication branch)
│   └── payment-integration/    # ← Another worktree
├── fix/
│   ├── memory-leak/
│   └── database-connection/
└── doc/
    └── api-guide/
```

**Note**: Folder structure remains `../type/name` regardless of ticket ID. Only branch names include ticket IDs.

## Default Branch Detection

The tool intelligently detects your repository's default branch:

1. **Remote Default**: Checks `git symbolic-ref refs/remotes/origin/HEAD`
2. **Common Branches**: Tries `main`, `master`, `develop`, `beta`
3. **Current Branch**: Falls back to current checked-out branch
4. **Override**: Use `-b` flag to specify manually

## Examples

### Feature Development (Public Repository)

```bash
# Standard feature development
workforge --type feat --name user-dashboard

# Output:
# ✓ Detected public repository
# ✓ Detected default branch: main
# ✓ Detected package manager: npm
# ✓ Worktree created: ../feat/user-dashboard
# ✓ Branch created: feat/user-dashboard
# ✓ Environment files copied
# ✓ Dependencies installed successfully using npm
```

### Jira Workflow (Internal Repository)

```bash
# Internal repository with Jira ticket
workforge --type feat --name bedrock-migration --ticket BZ-43210

# Output:
# ✓ Detected internal Bitbucket repository
# ✓ Using ticket ID: BZ-43210
# ✓ Detected default branch: beta
# ✓ Detected package manager: pnpm
# ✓ Worktree created: ../feat/bedrock-migration
# ✓ Branch created: BZ-43210-feat-bedrock-migration
# ✓ Environment files copied
# ✓ Dependencies installed successfully using pnpm

cd ../feat/bedrock-migration
# Start working on BZ-43210!
```

### Bug Fixes with Different Base Branches

```bash
# Quick fix from main
workforge -t hotfix -n security-patch -b main -y

# Fix from develop branch
workforge --type fix --name login-error --base develop

# Fix with Jira ticket from release branch
workforge -t fix -n critical-bug -j BZ-99999 -b release/v2.1
```

### Documentation and Other Types

```bash
# Documentation branch
workforge --type doc --name api-guide

# Testing branch
workforge -t test -n integration-tests

# Refactoring with ticket
workforge -t refactor -n code-cleanup -j BZ-11111
```

## Environment Files

The tool automatically copies common environment files from your repository root to the new worktree:

- `.env`
- `.env.example`
- `.env.local`
- `.env.development`

This ensures your new worktree has the same configuration as your main repository without manual copying.

## Validation Rules

### Branch Type
- Must contain only letters
- Automatically converted to lowercase
- Examples: `feat`, `fix`, `doc`, `hotfix`, `refactor`

### Branch Name
- Must be kebab-case
- Lowercase letters, numbers, and hyphens only
- Examples: `user-auth`, `api-v2`, `bug-123`, `payment-flow`

### Jira Ticket ID
- Format: `LETTERS-NUMBERS` (e.g., `BZ-12345`, `PROJ-456`)
- Case-sensitive prefix
- Optional for internal repositories
- Validates format before proceeding

### Pre-flight Checks
- ✅ Git repository detection
- ✅ Git binary availability
- ✅ Repository type detection (public vs internal)
- ✅ Default branch detection
- ✅ Package manager detection
- ✅ Branch name uniqueness (local and remote)
- ✅ Worktree path availability
- ✅ Base branch existence

## Advanced Usage

### CI/CD Integration

```yaml
# .github/workflows/feature-branch.yml
name: Create Feature Branch
on:
  workflow_dispatch:
    inputs:
      feature_name:
        description: 'Feature name (kebab-case)'
        required: true
      ticket_id:
        description: 'Jira ticket ID (optional)'
        required: false

jobs:
  create-branch:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      - name: Create worktree
        run: |
          TICKET_FLAG=""
          if [ -n "${{ github.event.inputs.ticket_id }}" ]; then
            TICKET_FLAG="--ticket ${{ github.event.inputs.ticket_id }}"
          fi
          npx workforge -t feat -n ${{ github.event.inputs.feature_name }} $TICKET_FLAG -y
```

### Team Workflows

```bash
# Standard team branch types
workforge -t feat -n new-feature     # New features
workforge -t fix -n bug-name         # Bug fixes
workforge -t hotfix -n urgent-fix    # Critical fixes
workforge -t doc -n documentation    # Documentation
workforge -t test -n test-suite      # Testing
workforge -t refactor -n cleanup     # Refactoring

# With Jira tickets (internal repos)
workforge -t feat -n user-onboarding -j BZ-12345
workforge -t fix -n performance-issue -j BZ-67890
```

### Multiple Package Managers

The tool automatically adapts to your project setup:

```bash
# npm project (package-lock.json exists)
workforge -t feat -n npm-feature
# → Runs: npm install

# yarn project (yarn.lock exists)
workforge -t feat -n yarn-feature
# → Runs: yarn install

# pnpm project (pnpm-lock.yaml exists)
workforge -t feat -n pnpm-feature
# → Runs: pnpm install
```

## Troubleshooting

### Common Issues

**"Not inside a Git repository"**
```bash
# Make sure you're in a Git repository
git status
# or navigate to your repository
cd /path/to/your/repo
```

**"Branch already exists"**
```bash
# Check existing branches
git branch -a
# Use a different name or clean up old branches
git branch -d BZ-12345-feat-old-branch
git branch -d feat/old-branch
```

**"Worktree path already exists"**
```bash
# Check existing worktrees
git worktree list
# Remove old worktree if no longer needed
git worktree remove ../feat/feature-name
```

**"Invalid ticket format"**
```bash
# Ensure ticket follows correct format
workforge -t feat -n my-feature -j BZ-12345  # ✅ Correct
workforge -t feat -n my-feature -j bz-12345  # ❌ Wrong case
workforge -t feat -n my-feature -j BZ12345   # ❌ Missing hyphen
```

**"Failed to install dependencies"**
```bash
# Check package manager is installed
npm --version
pnpm --version
yarn --version

# Install missing package manager
npm install -g pnpm
# or
npm install -g yarn

# Manual installation
cd ../feat/your-feature
npm install  # or pnpm install, yarn install
```

**Package manager detection issues**
```bash
# Force specific package manager by creating lock file
touch pnpm-lock.yaml   # Forces pnpm
touch yarn.lock        # Forces yarn
touch package-lock.json # Forces npm

# Or run manually after worktree creation
cd ../feat/your-feature
pnpm install  # Use your preferred package manager
```

### Debug Mode

For troubleshooting, you can manually check each step:

```bash
# 1. Verify you're in a Git repo
git rev-parse --show-toplevel

# 2. Check remote URL (for repository type detection)
git remote get-url origin

# 3. Check default branch
git symbolic-ref refs/remotes/origin/HEAD

# 4. Check current worktrees
git worktree list

# 5. Check existing branches
git branch -a | grep "feat/feature-name"
git branch -a | grep "BZ-12345"

# 6. Verify base branch exists
git show-ref --verify refs/heads/main

# 7. Check package manager files
ls -la | grep -E "(pnpm-lock|yarn.lock|package-lock)"
```

### Advanced Debugging

```bash
# Test repository type detection
git remote get-url origin | grep bitbucket.juspay.net

# Test package manager detection manually
if [ -f "pnpm-lock.yaml" ]; then echo "pnpm";
elif [ -f "yarn.lock" ]; then echo "yarn";
elif [ -f "package-lock.json" ]; then echo "npm";
else echo "npm (default)"; fi

# Test branch existence
git rev-parse --verify BZ-12345-feat-branch-name 2>/dev/null || echo "Branch doesn't exist"
```

## Migration from v1.0.0

If you're upgrading from the basic version, here's what's new:

### New Features
- **Jira Integration**: Add `-j TICKET-ID` for internal repositories
- **Package Manager Detection**: Automatic detection and installation
- **Smart Branch Detection**: No more hardcoded "main" branch
- **Repository Type Detection**: Different behavior for internal vs public repos

### Breaking Changes
- None! All existing commands work exactly the same
- New features are opt-in and backward compatible

### Recommended Updates
```bash
# Old command (still works)
workforge -t feat -n my-feature

# New enhanced command (internal repos)
workforge -t feat -n my-feature -j BZ-12345

# Let the tool auto-detect everything
workforge -t feat -n my-feature  # Will prompt for ticket if internal repo
```

## Contributing

1. Fork the repository
2. Create a feature branch: `workforge -t feat -n awesome-feature -j CONTRIB-123`
3. Make your changes
4. Add tests
5. Update documentation
6. Submit a pull request

## License

MIT License - see LICENSE file for details.

## Documentation

### Comprehensive Guides

- [Configuration Guide](./docs/configuration.md) - Complete configuration options and examples
- [Sync Operations](./docs/sync-operations.md) - Environment variable synchronization workflows
- [Advanced Usage](./docs/advanced-usage.md) - Power user workflows, CI/CD, scripting
- [Troubleshooting](./docs/troubleshooting.md) - Common issues and solutions

### Quick Links

- **Environment Sync**: See [Sync Operations Guide](./docs/sync-operations.md)
- **Safety Checks**: See [Troubleshooting - Safety Check Failures](./docs/troubleshooting.md#safety-check-failures)
- **Backup Recovery**: See [Troubleshooting - Backup and Recovery](./docs/troubleshooting.md#backup-and-recovery)
- **CI/CD Setup**: See [Advanced Usage - CI/CD Integration](./docs/advanced-usage.md#cicd-integration)

## Changelog

### v3.0.0 (Latest)

**Major Features:**
- 🔄 **Intelligent Environment Sync**: Close command with automatic .env diff and sync
- 📊 **Side-by-Side Diff Display**: Visual comparison of environment variables
- 🎯 **Interactive Variable Selection**: Line-by-line selection of which variables to sync
- 💾 **Automatic Backup Management**: Auto-backup before sync with configurable retention
- 📝 **Complete Audit Trail**: Dual-format logging (human-readable + JSON)
- 🛡️ **Safety Checks**: Pre-close validation (uncommitted changes, unpushed commits, merge status)
- 🔀 **Bidirectional Sync**: Sync in any direction with interactive prompts
- 🧹 **Cleanup Utilities**: Age-based backup cleanup with dry-run preview
- 📋 **Worktree Listing**: View all worktrees in multiple formats
- ⚙️ **Centralized Configuration**: Global settings at `~/.workforge/config.json`

**New Commands:**
- `workforge close` - Close worktrees with intelligent environment sync
- `workforge sync-env` - Standalone environment variable synchronization
- `workforge list` - List all worktrees with status indicators
- `workforge cleanup` - Clean up old backups and logs

**Core Components:**
- ConfigManager - Global configuration with deep merge
- ProjectIdentifier - SHA-256 project IDs from Git remote URL
- EnvFileParser - Comprehensive .env parsing (multi-line, comments, escape sequences)
- WorktreeResolver - Three-pattern resolution (path, name, auto-detect)
- EnvDiffer - Intelligent environment variable comparison
- EnvSyncer - Apply sync decisions with backup
- BackupManager - Auto-backup with rotation (keep last 10)
- SafetyChecker - Pre-close validation checks
- WorktreeRemover - Safe worktree removal
- BranchCleaner - Branch deletion with safety checks
- AuditLogger - Dual-format audit logging
- SyncTargetResolver - Four sync patterns (from/to/between/auto)

**Implementation Stats:**
- 23 major implementation files
- ~5,700 lines of production TypeScript
- 4 comprehensive documentation guides
- Complete type safety with TypeScript 5.0+

### v2.0.0
- 🎫 **Jira Integration**: Support for internal Bitbucket repositories with ticket IDs
- 📦 **Package Manager Detection**: Automatic npm/pnpm/yarn detection and installation
- 🌿 **Smart Branch Detection**: Auto-detects default branch (main, master, beta, etc.)
- 🏢 **Repository Type Detection**: Different handling for internal vs public repositories
- 🚀 **Auto Dependency Installation**: Runs package manager install after worktree creation
- ✨ **Enhanced Branch Naming**: Supports both `type/name` and `TICKET-type-name` patterns
- 🛡️ **Improved Validation**: Better error handling and pre-flight checks
- 💬 **Interactive Improvements**: Smart prompts based on repository type
- 🌈 **Better Logging**: More detailed status messages and progress indicators

### v1.0.0
- Initial release
- Basic workspace creation
- Environment file copying
- Pre-flight validation
- Interactive confirmation
- Colored terminal output