# Troubleshooting Guide

This guide helps you diagnose and resolve common issues with WorkForge v3.0.

---

## Table of Contents

1. [Worktree Issues](#worktree-issues)
2. [Environment Sync Problems](#environment-sync-problems)
3. [Configuration Errors](#configuration-errors)
4. [Git-Related Issues](#git-related-issues)
5. [Safety Check Failures](#safety-check-failures)
6. [Backup and Recovery](#backup-and-recovery)
7. [Permission Problems](#permission-problems)
8. [Performance Issues](#performance-issues)
9. [Common Error Messages](#common-error-messages)
10. [FAQ](#faq)

---

## Worktree Issues

### "Worktree not found"

**Problem:** WorkForge cannot find the worktree you're trying to operate on.

**Causes:**
- Worktree was deleted manually outside of WorkForge
- Incorrect path or name provided
- Not running from a Git repository

**Solutions:**

```bash
# List all worktrees to see what exists
workforge list

# Check Git's worktree list directly
git worktree list

# If worktree is missing, prune the entry
git worktree prune
```

**Prevention:** Always use `workforge close` instead of manually deleting worktree directories.

---

### "Cannot create worktree: path already exists"

**Problem:** Trying to create a worktree but the directory already exists.

**Causes:**
- Previous worktree wasn't properly removed
- Directory was created manually
- Leftover from crashed operation

**Solutions:**

```bash
# Option 1: Remove the directory manually
rm -rf /path/to/worktree

# Option 2: Use a different name
workforge create -t feat -n auth-v2

# Option 3: Clean up and retry
git worktree prune
workforge create -t feat -n auth
```

---

### "Multiple worktrees found with same name"

**Problem:** Multiple worktrees match the search criteria.

**Cause:** Worktrees created with similar branch names.

**Solution:**

```bash
# Use explicit path instead of name
workforge close /full/path/to/worktree

# Or list all worktrees and use the exact branch name
workforge list
workforge close -n feat/auth-feature-123
```

---

## Environment Sync Problems

### "No .env file found"

**Problem:** WorkForge cannot find .env files to sync.

**Causes:**
- .env doesn't exist in source or target
- Wrong working directory
- File permissions issue

**Solutions:**

```bash
# Check if .env exists
ls -la .env
ls -la /path/to/worktree/.env

# Create .env if needed
touch .env
touch /path/to/worktree/.env

# Verify you're in the right directory
pwd
```

**Note:** WorkForge only syncs .env files, not .env.local, .env.example, etc.

---

### "Sync shows no changes but files are different"

**Problem:** Sync reports no differences but .env files are visibly different.

**Causes:**
- Only comments or whitespace differ
- Variables are reordered but have same values
- File encoding issues

**Solutions:**

```bash
# Check the actual differences
diff .env /path/to/worktree/.env

# Try manual inspection
cat .env
cat /path/to/worktree/.env

# Force sync if needed (copy manually)
cp .env /path/to/worktree/.env
```

**Understanding:** WorkForge compares variable names and values, not file formatting.

---

### "Failed to parse .env file"

**Problem:** Environment file contains syntax errors.

**Causes:**
- Unclosed quotes
- Invalid escape sequences
- Malformed multi-line values

**Solutions:**

```bash
# Validate .env syntax manually
cat -A .env  # Show all characters including hidden ones

# Common fixes:
# 1. Ensure quotes are balanced
# 2. Multi-line values must use quotes
# 3. Escape special characters

# Example of correct multi-line:
DATABASE_URL="postgres://localhost:5432/
  database_name?
  sslmode=require"
```

**Prevention:** Use a linter or validation tool for .env files before syncing.

---

### "Sync completed but variables missing"

**Problem:** After sync, some variables don't appear in target.

**Cause:** You selected only specific variables during interactive sync.

**Solutions:**

```bash
# Review what was synced in audit log
cat ~/.workforge/projects/<project-id>/audit.log

# Redo sync and select "Sync all changes"
workforge sync-env --from feat-auth --to main

# Or force sync without prompts
workforge sync-env --from feat-auth --to main --yes
```

---

## Configuration Errors

### "Invalid configuration file"

**Problem:** WorkForge reports configuration is invalid.

**Causes:**
- JSON syntax error
- Invalid option value
- Typo in key name

**Solutions:**

```bash
# Validate JSON syntax
cat ~/.workforge/config.json | python -m json.tool

# Or use jq
cat ~/.workforge/config.json | jq .

# Reset to defaults
rm ~/.workforge/config.json
workforge create -t test -n config-test  # Recreates default config
```

---

### "Configuration not loading"

**Problem:** Changes to config.json don't take effect.

**Solutions:**

```bash
# 1. Check file exists
ls -la ~/.workforge/config.json

# 2. Check permissions
chmod 644 ~/.workforge/config.json

# 3. Verify JSON syntax
cat ~/.workforge/config.json | python -m json.tool

# 4. Check for BOM or encoding issues
file ~/.workforge/config.json
# Should be: ASCII text or UTF-8 Unicode text
```

---

## Git-Related Issues

### "fatal: not a git repository"

**Problem:** WorkForge can't find a Git repository.

**Cause:** Running WorkForge outside a Git repository.

**Solution:**

```bash
# Check if you're in a Git repo
git status

# If not, navigate to your project
cd /path/to/your/project

# Or initialize a new repo
git init
```

---

### "Branch already exists"

**Problem:** Cannot create worktree because branch name already exists.

**Solutions:**

```bash
# Option 1: Use a different name
workforge create -t feat -n auth-v2

# Option 2: Delete the existing branch (if safe)
git branch -d feat/auth
workforge create -t feat -n auth

# Option 3: Checkout existing branch in new worktree
git worktree add /path feat/auth
```

---

### "Cannot delete branch: not fully merged"

**Problem:** Branch deletion fails due to unmerged changes.

**Causes:**
- Branch has commits not in main/develop
- Branch was never merged via PR

**Solutions:**

```bash
# Check merge status
git branch --no-merged main

# Option 1: Merge the branch first
git checkout main
git merge feat/auth
workforge close -n feat-auth --delete-branch

# Option 2: Force delete (loses unmerged changes!)
workforge close -n feat-auth --delete-branch --force

# Option 3: Keep the branch
workforge close -n feat-auth  # Don't use --delete-branch
```

---

### "Detached HEAD state detected"

**Problem:** Worktree is in detached HEAD state.

**Cause:** Checked out a specific commit instead of a branch.

**Solutions:**

```bash
# Option 1: Create a new branch
cd /path/to/worktree
git switch -c feat/new-branch-name

# Option 2: Close with force
workforge close --force
```

---

## Safety Check Failures

### "Uncommitted changes detected"

**Problem:** Cannot close worktree due to uncommitted changes.

**Cause:** Modified files haven't been committed.

**Solutions:**

```bash
# Option 1: Commit the changes
cd /path/to/worktree
git add .
git commit -m "feat: save work in progress"
workforge close

# Option 2: Stash the changes
git stash push -m "WIP: saved before closing"
workforge close

# Option 3: Discard the changes
git reset --hard HEAD
workforge close

# Option 4: Force close (loses uncommitted changes!)
workforge close --force
```

---

### "Unpushed commits detected"

**Problem:** Worktree has commits not pushed to remote.

**Cause:** Local commits haven't been synchronized with remote.

**Solutions:**

```bash
# Option 1: Push the commits
cd /path/to/worktree
git push
workforge close

# Option 2: Review commits and decide
git log origin/feat-auth..HEAD  # See unpushed commits

# Option 3: Force close (commits remain in Git history)
workforge close --force
```

---

### "Merge in progress detected"

**Problem:** Cannot close because merge/rebase is ongoing.

**Cause:** Unfinished merge or rebase operation.

**Solutions:**

```bash
# Option 1: Complete the merge
cd /path/to/worktree
git status  # See merge status
# Resolve conflicts...
git add .
git commit
workforge close

# Option 2: Abort the merge
git merge --abort
# or
git rebase --abort
workforge close

# Option 3: Force close
workforge close --force
```

---

## Backup and Recovery

### "Cannot find backup file"

**Problem:** Trying to restore from backup but file doesn't exist.

**Solutions:**

```bash
# List all available backups
ls -la ~/.workforge/backups/<project-id>/

# Check project ID
workforge list --json | jq '.[0].remoteUrl'  # Get remote URL
# Calculate project ID (first 8 chars of SHA-256 of remote URL)

# If no backups exist, check if backups are enabled
cat ~/.workforge/config.json | jq '.backup.enabled'
```

---

### "Backup restoration failed"

**Problem:** Cannot restore .env from backup.

**Solutions:**

```bash
# Check backup file integrity
cat ~/.workforge/backups/<project-id>/.env.backup.2025-10-26_14-30-00

# Manual restoration
cp ~/.workforge/backups/<project-id>/.env.backup.2025-10-26_14-30-00 .env

# Check permissions
chmod 644 .env
```

---

### "Too many backups / disk space issues"

**Problem:** Backup directory is consuming too much space.

**Solutions:**

```bash
# Check backup size
du -sh ~/.workforge/backups/

# Clean up old backups
workforge cleanup --older-than 30

# Adjust retention in config
# Edit ~/.workforge/config.json
{
  "backup": {
    "maxBackupsPerProject": 5  // Reduce from 10
  }
}

# Delete all backups (with confirmation)
workforge cleanup --older-than 0
```

---

## Permission Problems

### "EACCES: permission denied"

**Problem:** Cannot read/write files due to permissions.

**Solutions:**

```bash
# Check permissions
ls -la ~/.workforge/
ls -la .env

# Fix WorkForge directory permissions
chmod 755 ~/.workforge/
chmod 644 ~/.workforge/config.json

# Fix .env permissions
chmod 644 .env

# If owned by different user
sudo chown $USER:$USER .env
```

---

### "Cannot create directory: permission denied"

**Problem:** Cannot create backup or project directories.

**Solutions:**

```bash
# Create directories manually with correct permissions
mkdir -p ~/.workforge/backups
mkdir -p ~/.workforge/projects
chmod 755 ~/.workforge/backups
chmod 755 ~/.workforge/projects

# Check parent directory permissions
ls -la ~/
chmod 755 ~/
```

---

## Performance Issues

### "Sync operation is very slow"

**Problem:** Environment sync takes a long time.

**Causes:**
- Very large .env files
- Slow disk I/O
- Many variables to compare

**Solutions:**

```bash
# Check .env file size
ls -lh .env

# For large files, consider splitting
# Use .env for essentials, .env.local for large configs

# Disable unnecessary features temporarily
{
  "audit": {
    "enabled": false  // Disable audit logging
  },
  "backup": {
    "enabled": false  // Disable backups
  }
}
```

---

### "List command slow with many worktrees"

**Problem:** `workforge list` takes a long time.

**Cause:** Many worktrees and expensive Git operations.

**Solutions:**

```bash
# Use simple format (faster)
workforge list --simple

# Use JSON format (no formatting overhead)
workforge list --json

# Clean up old worktrees
git worktree prune
```

---

## Common Error Messages

### `Error: WORKTREE_NOT_FOUND`

**Meaning:** The specified worktree doesn't exist.

**Fix:** Use `workforge list` to see available worktrees, or check `git worktree list`.

---

### `Error: INVALID_WORKTREE_PATH`

**Meaning:** The path provided doesn't point to a valid worktree.

**Fix:** Ensure you're providing the correct path. Use absolute paths for reliability.

---

### `Error: SYNC_TARGET_AMBIGUOUS`

**Meaning:** Cannot determine source/target for sync operation.

**Fix:** Provide explicit `--from` and/or `--to` options.

---

### `Error: BACKUP_FAILED`

**Meaning:** Cannot create backup before sync.

**Fix:** Check disk space and permissions. Temporarily disable backups with config if needed.

---

### `Error: AUDIT_LOG_WRITE_FAILED`

**Meaning:** Cannot write to audit log.

**Fix:** Check permissions on `~/.workforge/projects/<project-id>/`. Create directory if missing.

---

### `Error: UNSAFE_OPERATION_BLOCKED`

**Meaning:** Safety checks prevented the operation.

**Fix:** Review the specific safety issue reported. Use `--force` to override if absolutely necessary.

---

## FAQ

### Q: Can I sync files other than .env?

**A:** No. WorkForge v3.0 only syncs .env files by design. For other files, use Git's normal workflow.

---

### Q: Will closing a worktree delete my code?

**A:** No. Closing removes the worktree directory, but your commits remain in Git history. The branch is only deleted if you use `--delete-branch`.

---

### Q: Can I recover a deleted worktree?

**A:** If you didn't delete the branch, you can recreate the worktree:
```bash
git worktree add /path branch-name
```

If you deleted the branch with unmerged changes and used `--force`, the commits may be lost (check `git reflog`).

---

### Q: How do I disable backups?

**A:** Edit `~/.workforge/config.json`:
```json
{
  "backup": {
    "enabled": false
  }
}
```

⚠️ **Not recommended** - backups have saved many developers from mistakes.

---

### Q: Can I use WorkForge in CI/CD?

**A:** Yes! Configure it for automated environments:
```json
{
  "preferences": {
    "skipConfirmations": true
  },
  "display": {
    "colorEnabled": false,
    "showProgressIndicators": false
  }
}
```

See [Advanced Usage - CI/CD Integration](./advanced-usage.md#cicd-integration) for examples.

---

### Q: Why does sync show "no changes" when files are different?

**A:** WorkForge compares variable *values*, not file formatting. If the same variables exist with the same values (even in different order or with different comments), there are no changes to sync.

---

### Q: Can I sync between two worktrees (not main)?

**A:** Yes! Use explicit paths:
```bash
workforge sync-env --from /path/to/worktree1 --to /path/to/worktree2
```

---

### Q: What happens if sync is interrupted?

**A:** Sync operations are atomic. If interrupted:
1. Check if a backup was created
2. Restore from backup if needed
3. Retry the sync operation

---

### Q: How do I see what was synced in the past?

**A:** Check the audit logs:
```bash
# Human-readable log
cat ~/.workforge/projects/<project-id>/audit.log

# Machine-readable JSON
cat ~/.workforge/projects/<project-id>/sync-history.json | jq .
```

---

### Q: Can I customize the backup location?

**A:** Not currently. Backups are stored in `~/.workforge/backups/<project-id>/`. This may be configurable in a future version.

---

### Q: Why is my project ID different on another machine?

**A:** Project IDs are generated from the Git remote URL. If you use different remote URLs (e.g., HTTPS vs SSH), you'll get different IDs.

---

### Q: How do I enable verbose/debug output?

**A:** Set in configuration:
```json
{
  "display": {
    "verboseOutput": true
  }
}
```

Or wait for a future `--verbose` flag.

---

## Debug Mode

### Enabling Verbose Output

Edit `~/.workforge/config.json`:

```json
{
  "display": {
    "verboseOutput": true
  }
}
```

This shows detailed information about:
- File paths being checked
- Git commands being executed
- Configuration values being used
- Internal decision-making

### Checking Internal State

```bash
# View configuration
cat ~/.workforge/config.json | jq .

# View project metadata
cat ~/.workforge/projects/<project-id>/.meta.json | jq .

# View audit history
cat ~/.workforge/projects/<project-id>/sync-history.json | jq .

# View available backups
ls -la ~/.workforge/backups/<project-id>/
```

### Testing Without Consequences

Always use `--dry-run` when testing:

```bash
workforge close --dry-run
workforge sync-env --from feat-auth --dry-run
workforge cleanup --older-than 7 --dry-run
```

---

## Getting Help

If you encounter an issue not covered here:

1. **Check the documentation:**
   - [Configuration Guide](./configuration.md)
   - [Sync Operations](./sync-operations.md)
   - [Advanced Usage](./advanced-usage.md)

2. **Enable verbose output** and retry the operation

3. **Check audit logs** for clues about what went wrong

4. **Verify your setup:**
   ```bash
   git --version  # Git 2.35+ recommended
   node --version  # Node.js 18+ required
   workforge --version  # Check WorkForge version
   ```

5. **File an issue:** https://github.com/yourusername/workforge/issues
   - Include WorkForge version
   - Include error message
   - Include relevant configuration
   - Include steps to reproduce

---

## See Also

- [Configuration Guide](./configuration.md)
- [Sync Operations](./sync-operations.md)
- [Advanced Usage](./advanced-usage.md)
