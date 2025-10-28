# Advanced Usage Guide

This guide covers advanced WorkForge features including worktree management, backup operations, CI/CD integration, and power-user workflows.

---

## Table of Contents

1. [List Command](#list-command)
2. [Cleanup Operations](#cleanup-operations)
3. [Multiple Worktree Management](#multiple-worktree-management)
4. [CI/CD Integration](#cicd-integration)
5. [Power User Workflows](#power-user-workflows)
6. [Scripting and Automation](#scripting-and-automation)

---

## List Command

The `list` command provides comprehensive visibility into all your worktrees.

### Basic Usage

```bash
# List all worktrees (table format)
workforge list

# List in JSON format
workforge list --json

# Simple one-line format
workforge list --simple
```

### Output Formats

#### Table Format (Default)

```bash
$ workforge list

📋 Worktrees
────────────────────────────────────────────────────────────

Branch                  | Path                              | Commit     | Status
------------------------|-----------------------------------|------------|--------
(main)                  | /Users/dev/project                | abc123def4 | MAIN
feat-auth              | /Users/dev/project/feat-auth      | def456ghi7 | ACTIVE
feat-users             | /Users/dev/project/feat-users     | ghi789jkl0 | ACTIVE
fix-memory-leak        | /Users/dev/project/fix-memory     | jkl012mno3 | LOCKED

────────────────────────────────────────────────────────────

Total: 4 worktrees
```

#### JSON Format

```bash
$ workforge list --json
```

```json
[
  {
    "branchName": "(main)",
    "path": "/Users/dev/project",
    "commitHash": "abc123def456",
    "isMainRepo": true,
    "isLocked": false,
    "isPrunable": false,
    "remoteUrl": "git@github.com:user/repo.git"
  },
  {
    "branchName": "feat-auth",
    "path": "/Users/dev/project/feat-auth",
    "commitHash": "def456ghi789",
    "isMainRepo": false,
    "isLocked": false,
    "isPrunable": false,
    "remoteUrl": "git@github.com:user/repo.git"
  }
]
```

#### Simple Format

```bash
$ workforge list --simple

(main) - /Users/dev/project
feat-auth - /Users/dev/project/feat-auth
feat-users - /Users/dev/project/feat-users
fix-memory-leak - /Users/dev/project/fix-memory
```

### Sorting

```bash
# Sort by branch name
workforge list --sort name

# Sort by path
workforge list --sort path

# Sort by age (most recent first)
workforge list --sort age
```

### Filtering

```bash
# List all worktrees across all repositories (coming soon)
workforge list --all
```

### Status Indicators

- **MAIN**: Main repository
- **ACTIVE**: Normal active worktree
- **LOCKED**: Worktree is locked (cannot be removed)
- **PRUNABLE**: Worktree directory is missing

---

## Cleanup Operations

The `cleanup` command helps manage old backups and logs.

### Basic Usage

```bash
# Clean up all backups (with confirmation)
workforge cleanup

# Skip confirmation
workforge cleanup --yes

# Preview what would be deleted
workforge cleanup --dry-run
```

### Age-Based Cleanup

```bash
# Delete backups older than 30 days
workforge cleanup --older-than 30

# Delete backups older than 7 days
workforge cleanup --older-than 7

# Preview deletion
workforge cleanup --older-than 30 --dry-run
```

### Example Session

```bash
$ workforge cleanup --older-than 30

🧹 Cleanup Backups and Logs

Project: my-awesome-app
Project ID: a1b2c3d4

Backups to Delete:

• .env.backup.2025-09-15_10-30-00 - 35 days ago (2.3 KB)
• .env.backup.2025-09-20_14-15-30 - 30 days ago (2.1 KB)
• .env.backup.2025-09-22_09-45-12 - 28 days ago (2.2 KB)
... and 5 more

Total to delete: 8
Will remain: 12

? Delete 8 backups? (y/N) y

Deleting backups...
✓ Deleted 8 backups

Summary:
• 8 backups deleted
• 12 backups remaining

✓ Cleanup complete!
```

### Cleanup Strategies

#### 1. Regular Maintenance

Keep last 30 days:
```bash
# Run weekly
workforge cleanup --older-than 30 --yes
```

#### 2. Aggressive Cleanup

Keep only last 7 days:
```bash
workforge cleanup --older-than 7
```

#### 3. Project Completion

Remove all backups after project ends:
```bash
# Review first
workforge cleanup --dry-run

# Then delete all
workforge cleanup --older-than 0
```

---

## Multiple Worktree Management

### Typical Multi-Worktree Setup

```
project/
├── .git/                    # Main repo
├── src/
├── package.json
├── .env                     # Main .env
└── worktrees/
    ├── feat-auth/           # Worktree 1
    ├── feat-users/          # Worktree 2
    ├── fix-memory/          # Worktree 3
    └── doc-api/             # Worktree 4
```

### Creating Multiple Worktrees

```bash
# Create multiple worktrees for parallel development
workforge create -t feat -n auth
workforge create -t feat -n users
workforge create -t fix -n memory-leak
workforge create -t doc -n api-guide
```

### Syncing Multiple Worktrees

```bash
# Update main .env
cd /path/to/main/repo
vim .env

# Sync to all worktrees
workforge sync-env --to feat-auth
workforge sync-env --to feat-users
workforge sync-env --to fix-memory
workforge sync-env --to doc-api
```

### Bulk Operations Script

```bash
#!/bin/bash
# sync-all-worktrees.sh

worktrees=("feat-auth" "feat-users" "fix-memory" "doc-api")

for wt in "${worktrees[@]}"; do
  echo "Syncing to $wt..."
  workforge sync-env --to "$wt" --yes
done
```

### Finding Stale Worktrees

```bash
# List all worktrees
workforge list --json | jq '.[] | select(.isMainRepo == false) | .branchName'

# Check each for activity
for branch in $(workforge list --json | jq -r '.[] | select(.isMainRepo == false) | .branchName'); do
  cd "$(workforge list --json | jq -r ".[] | select(.branchName == \"$branch\") | .path")"
  last_commit=$(git log -1 --format="%ar")
  echo "$branch: $last_commit"
done
```

### Closing Multiple Worktrees

```bash
#!/bin/bash
# close-old-worktrees.sh

# Close all worktrees older than 30 days
workforge list --json | jq -r '.[] | select(.isMainRepo == false) | .path' | while read path; do
  cd "$path"
  last_commit_days=$(git log -1 --format="%cr" | grep -oE '[0-9]+' | head -1)

  if [ "$last_commit_days" -gt 30 ]; then
    echo "Closing worktree at $path (inactive for $last_commit_days days)"
    workforge close "$path" --yes
  fi
done
```

---

## CI/CD Integration

### GitHub Actions

```yaml
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
        run: pnpm install -g workforge

      - name: Configure WorkForge for CI
        run: |
          mkdir -p ~/.workforge
          cat > ~/.workforge/config.json << EOF
          {
            "preferences": {
              "skipConfirmations": true
            },
            "backup": {
              "enabled": false
            },
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
          pnpm install
          pnpm run build

      - name: Cleanup
        if: always()
        run: workforge close -n build-ci-${{ github.run_number }} --yes --skip-sync
```

### GitLab CI

```yaml
stages:
  - build
  - test

variables:
  WORKFORGE_CONFIG: |
    {
      "preferences": { "skipConfirmations": true },
      "backup": { "enabled": false },
      "display": { "colorEnabled": false, "showProgressIndicators": false }
    }

build:
  stage: build
  script:
    - pnpm install -g workforge
    - mkdir -p ~/.workforge
    - echo "$WORKFORGE_CONFIG" > ~/.workforge/config.json
    - workforge create -t build -n ci-${CI_PIPELINE_ID} --yes
    - cd build-ci-${CI_PIPELINE_ID}
    - pnpm install
    - pnpm run build
  after_script:
    - workforge close -n build-ci-${CI_PIPELINE_ID} --yes --skip-sync || true
```

### Jenkins Pipeline

```groovy
pipeline {
    agent any

    environment {
        WORKFORGE_WORKTREE = "build-${BUILD_NUMBER}"
    }

    stages {
        stage('Setup') {
            steps {
                sh 'pnpm install -g workforge'
                sh '''
                    mkdir -p ~/.workforge
                    cat > ~/.workforge/config.json << EOF
                    {
                      "preferences": { "skipConfirmations": true },
                      "backup": { "enabled": false },
                      "display": { "colorEnabled": false, "showProgressIndicators": false }
                    }
                    EOF
                '''
            }
        }

        stage('Create Worktree') {
            steps {
                sh "workforge create -t build -n ${WORKFORGE_WORKTREE} --yes"
            }
        }

        stage('Build') {
            steps {
                dir("build-${WORKFORGE_WORKTREE}") {
                    sh 'pnpm install'
                    sh 'pnpm run build'
                }
            }
        }
    }

    post {
        always {
            sh "workforge close -n ${WORKFORGE_WORKTREE} --yes --skip-sync || true"
        }
    }
}
```

---

## Power User Workflows

### Workflow 1: Feature Development with Multiple Services

```bash
# Scenario: Developing a feature across frontend and backend

# Create worktrees
cd ~/projects/frontend
workforge create -t feat -n user-auth

cd ~/projects/backend
workforge create -t feat -n user-auth-api

# Sync shared env variables
cd ~/projects/frontend/feat-user-auth
workforge sync-env --from ~/projects/backend/feat-user-auth-api/.env

# Work on both...

# When done, sync back and close
workforge sync-env --from feat-user-auth --to main
workforge close --delete-branch

cd ~/projects/backend/feat-user-auth-api
workforge sync-env --from feat-user-auth-api --to main
workforge close --delete-branch
```

### Workflow 2: Hot Fix with Quick Turnaround

```bash
# Quick fix workflow
workforge create -t fix -n critical-bug --yes
cd fix-critical-bug

# Make fix...
git add .
git commit -m "fix: resolve critical bug"
git push

# Sync any env changes back
workforge sync-env --from fix-critical-bug --yes

# Close and delete branch
workforge close --delete-branch --yes
```

### Workflow 3: Long-Running Feature Branch

```bash
# Create feature worktree
workforge create -t feat -n new-dashboard

# Periodically sync main changes
cd feat-new-dashboard
git pull origin main
workforge sync-env  # Sync any new env vars from main

# Continue development...

# When ready to merge
workforge sync-env --from feat-new-dashboard --dry-run  # Preview
workforge sync-env --from feat-new-dashboard  # Sync to main

# Merge branch via PR...

# After merge, close worktree
workforge close --delete-branch
```

---

## Scripting and Automation

### Bash Helper Functions

Add to your `~/.bashrc` or `~/.zshrc`:

```bash
# Quick worktree creation
wf-feat() {
  workforge create -t feat -n "$1"
}

wf-fix() {
  workforge create -t fix -n "$1"
}

# Quick close with sync
wf-done() {
  workforge sync-env --from "$(basename $(pwd))" --yes
  cd ..
  workforge close --delete-branch --yes
}

# List worktrees with colors
wf-list() {
  workforge list | grep -E --color=always 'ACTIVE|LOCKED|PRUNABLE|$'
}

# Sync all worktrees
wf-sync-all() {
  for wt in $(workforge list --json | jq -r '.[] | select(.isMainRepo == false) | .branchName'); do
    echo "Syncing to $wt..."
    workforge sync-env --to "$wt" --yes
  done
}
```

### Python Automation Script

```python
#!/usr/bin/env python3
import subprocess
import json

def list_worktrees():
    """Get all worktrees as JSON"""
    result = subprocess.run(
        ['workforge', 'list', '--json'],
        capture_output=True,
        text=True
    )
    return json.loads(result.stdout)

def sync_to_worktree(worktree_name):
    """Sync env to specific worktree"""
    subprocess.run([
        'workforge', 'sync-env',
        '--to', worktree_name,
        '--yes'
    ])

def cleanup_old_worktrees(days=30):
    """Close worktrees inactive for more than specified days"""
    worktrees = list_worktrees()

    for wt in worktrees:
        if wt['isMainRepo']:
            continue

        # Check last commit age
        result = subprocess.run(
            ['git', 'log', '-1', '--format=%ct'],
            cwd=wt['path'],
            capture_output=True,
            text=True
        )

        last_commit_timestamp = int(result.stdout.strip())
        age_days = (time.time() - last_commit_timestamp) / 86400

        if age_days > days:
            print(f"Closing {wt['branchName']} (inactive for {age_days:.0f} days)")
            subprocess.run([
                'workforge', 'close',
                wt['path'],
                '--yes',
                '--skip-sync'
            ])

if __name__ == '__main__':
    # Sync all worktrees
    for wt in list_worktrees():
        if not wt['isMainRepo']:
            print(f"Syncing {wt['branchName']}...")
            sync_to_worktree(wt['branchName'])

    # Cleanup old worktrees
    cleanup_old_worktrees(days=30)
```

### Node.js Integration

```javascript
const { execSync } = require('child_process');

class WorkForge {
  static list() {
    const output = execSync('workforge list --json', { encoding: 'utf8' });
    return JSON.parse(output);
  }

  static create(type, name, options = {}) {
    const flags = options.yes ? '--yes' : '';
    execSync(`workforge create -t ${type} -n ${name} ${flags}`);
  }

  static sync(from, to, options = {}) {
    const flags = options.yes ? '--yes' : '';
    execSync(`workforge sync-env --from ${from} --to ${to} ${flags}`);
  }

  static close(name, options = {}) {
    const flags = [
      options.deleteBranch ? '--delete-branch' : '',
      options.yes ? '--yes' : ''
    ].filter(Boolean).join(' ');

    execSync(`workforge close -n ${name} ${flags}`);
  }
}

// Usage
const worktrees = WorkForge.list();
console.log(`Found ${worktrees.length} worktrees`);

WorkForge.create('feat', 'new-feature', { yes: true });
WorkForge.sync('feat-new-feature', 'main', { yes: true });
WorkForge.close('feat-new-feature', { deleteBranch: true, yes: true });
```

---

## Best Practices

### 1. Naming Conventions

Establish consistent naming:
```bash
# Good
workforge create -t feat -n user-authentication
workforge create -t fix -n memory-leak-in-parser
workforge create -t doc -n api-endpoints

# Avoid
workforge create -t feat -n stuff
workforge create -t fix -n bug
```

### 2. Regular Cleanup

Schedule regular cleanup:
```bash
# Weekly cron job
0 0 * * 0 workforge cleanup --older-than 30 --yes
```

### 3. Backup Before Major Changes

Always backup before risky operations:
```bash
# Manual backup
cp .env .env.backup.$(date +%Y%m%d)

# Then proceed
workforge sync-env --from experimental-feature
```

### 4. Use Dry Run

Preview changes before applying:
```bash
workforge close --dry-run
workforge sync-env --from feat-auth --dry-run
workforge cleanup --older-than 7 --dry-run
```

### 5. Document Worktree Purpose

Add README to worktrees:
```bash
cd feat-new-dashboard
echo "# New Dashboard Feature

Purpose: Redesign main dashboard with React
Started: 2025-10-26
Estimated completion: 2025-11-15
" > WORKTREE-README.md
```

---

## See Also

- [Configuration Guide](./configuration.md)
- [Sync Operations](./sync-operations.md)
- [Troubleshooting](./troubleshooting.md)
