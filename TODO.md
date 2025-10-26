# WorkForge v3.0 - Implementation TODO List

**Project:** WorkForge v3.0 - Worktree Close & Environment Sync
**Status:** In Progress - Phase 1
**Started:** 2025-10-26
**Last Updated:** 2025-10-26

---

## Phase 1: Foundation & Refactoring (3-4 days) - IN PROGRESS

### 1.1 Project Structure Setup ✅ COMPLETED
- [x] Create new directory structure
  - [x] Create `src/commands/` directory
  - [x] Create `src/core/` directory
  - [x] Create `src/ui/` directory
  - [x] Create `src/types/` directory
  - [x] Create `docs/` directory

### 1.2 TypeScript Types & Interfaces ✅ COMPLETED
- [x] Create `src/types/index.ts`
  - [x] Define `WorkspaceConfig` interface
  - [x] Define `PathConfig` interface
  - [x] Define `WorktreeInfo` interface
  - [x] Define `SafetyCheckResult` interface
  - [x] Define `EnvVariable` interface
  - [x] Define `EnvDiff` interface
  - [x] Define `EnvModification` interface
  - [x] Define `SyncDecision` interface
  - [x] Define `SyncResult` interface
  - [x] Define `SyncTargets` interface
  - [x] Define `AuditOperation` interface
  - [x] Define `ProjectMetadata` interface
  - [x] Define `BackupInfo` interface
  - [x] Define `Config` interface
  - [x] Define all command option interfaces
  - [x] Define `PackageManagerInfo` interface

### 1.3 Configuration System ✅ COMPLETED
- [x] Implement `src/core/ConfigManager.ts`
  - [x] Define default configuration constant
  - [x] Implement `load()` method
  - [x] Implement `save()` method
  - [x] Implement `get(key)` method
  - [x] Implement `set(key, value)` method
  - [x] Implement `merge()` private method
  - [x] Implement `getNestedValue()` private method
  - [x] Implement `setNestedValue()` private method
  - [ ] Write unit tests for ConfigManager (deferred)

### 1.4 Project Identifier ✅ COMPLETED
- [x] Implement `src/core/ProjectIdentifier.ts`
  - [x] Implement `generateId()` static method (SHA-256 hash)
  - [x] Implement `getRemoteUrl()` private static method
  - [x] Implement `getProjectDir()` static method
  - [x] Implement `getBackupDir()` static method
  - [x] Implement `updateMetadata()` static method
  - [x] Implement `getMetadata()` static method
  - [x] Implement `getAllProjectDirs()` static method
  - [x] Implement `getAllProjects()` static method
  - [ ] Write unit tests for ProjectIdentifier (deferred)

### 1.5 Refactor Existing Create Command - PENDING
- [ ] Create `src/commands/create.ts`
  - [ ] Move `WorkspaceCreator` class from index.ts
  - [ ] Rename to `CreateCommand`
  - [ ] Integrate ConfigManager for defaults
  - [ ] Integrate ProjectIdentifier for metadata
  - [ ] Add logic to show existing worktrees
  - [ ] Export `CreateCommand` class

### 1.6 Environment File Parser ✅ COMPLETED
- [x] Implement `src/core/EnvFileParser.ts`
  - [x] Implement `parse(filePath)` method
  - [x] Implement `parseLine()` private method
  - [x] Handle comments (# and //)
  - [x] Handle empty lines
  - [x] Handle quoted values (single and double)
  - [x] Handle multi-line values
  - [x] Handle inline comments
  - [x] Handle escape sequences
  - [x] Implement `stringify(vars)` method
  - [x] Implement all parsing helper methods
  - [ ] Write comprehensive unit tests (deferred)

### 1.7 Worktree Resolver ✅ COMPLETED
- [x] Implement `src/core/WorktreeResolver.ts`
  - [x] Implement `resolve(path, name)` method
    - [x] Pattern 1: Explicit path resolution
    - [x] Pattern 2: Name-based lookup
    - [x] Pattern 3: Auto-detect from current directory
  - [x] Implement `getWorktrees(repoRoot)` method
  - [x] Implement `findByBranchName(name)` method
  - [x] Implement `isWorktree(directory)` method
  - [x] Implement `getMainRepo(worktreePath)` method
  - [x] Parse `git worktree list --porcelain` output
  - [x] Implement all helper methods
  - [ ] Write unit tests (deferred)

### 1.8 Logger Enhancement - PENDING
- [ ] Update `src/ui/Logger.ts`
  - [ ] Integrate with config.display.colorEnabled
  - [ ] Integrate with config.display.verboseOutput
  - [ ] Add progress indicator support
  - [ ] Export Logger utility

---

## Phase 2: Environment Diff & Display (2-3 days)

### 2.1 Environment Differ
- [ ] Implement `src/core/EnvDiffer.ts`
  - [ ] Implement `compare(sourcePath, targetPath)` method
  - [ ] Implement `compareVariables(source, target)` method
  - [ ] Detect added variables
  - [ ] Detect removed variables
  - [ ] Detect modified variables
  - [ ] Track unchanged variables
  - [ ] Write unit tests for all cases

### 2.2 Diff Display
- [ ] Implement `src/ui/DiffDisplay.ts`
  - [ ] Implement `show(diff, targets)` method
  - [ ] Implement `printHeader()` private method
  - [ ] Implement `printAdded()` private method
  - [ ] Implement `printModified()` private method (side-by-side)
  - [ ] Implement `printRemoved()` private method
  - [ ] Implement `printUnchangedSummary()` private method
  - [ ] Implement `printFooter()` private method
  - [ ] Implement `truncate()` utility
  - [ ] Implement `pad()` utility
  - [ ] Test visual output manually

### 2.3 Sync Prompt
- [ ] Implement `src/ui/SyncPrompt.ts`
  - [ ] Implement `prompt(diff, autoYes)` method
  - [ ] Implement `promptAdded()` private method
  - [ ] Implement `promptModified()` private method
  - [ ] Implement `promptRemoved()` private method
  - [ ] Implement `autoAcceptAll()` private method
  - [ ] Test all interactive flows manually

### 2.4 Backup Manager
- [ ] Implement `src/core/BackupManager.ts`
  - [ ] Implement `createBackup(envPath)` method
  - [ ] Generate timestamp for backup filename
  - [ ] Create ~/.workforge/backups/<project-id>/ structure
  - [ ] Implement `cleanupOldBackups()` private method
  - [ ] Implement `listBackups()` method
  - [ ] Implement `restore(backupPath, targetPath)` method
  - [ ] Implement `deleteBackup(backupPath)` method
  - [ ] Write unit tests

---

## Phase 3: Audit Logging System (2 days)

### 3.1 Audit Logger
- [ ] Implement `src/core/AuditLogger.ts`
  - [ ] Implement `log(operation)` method
  - [ ] Implement `appendToLog()` private method (human-readable)
  - [ ] Implement `formatLogEntry()` private method
  - [ ] Implement `addToHistory()` private method (JSON)
  - [ ] Implement `cleanupOldLogs()` private method
  - [ ] Create ~/.workforge/projects/<project-id>/ structure
  - [ ] Create .meta.json file
  - [ ] Write unit tests

### 3.2 Audit Log Testing
- [ ] Test human-readable log format
- [ ] Test JSON history format
- [ ] Test metadata creation
- [ ] Test log cleanup based on retentionDays
- [ ] Test with includeVariableValues = true/false

---

## Phase 4: Close Command (3-4 days)

### 4.1 Safety Checker
- [ ] Implement `src/core/SafetyChecker.ts`
  - [ ] Implement `check(worktree)` method
  - [ ] Implement `checkUncommittedChanges()` private method
  - [ ] Implement `checkUnpushedCommits()` private method
  - [ ] Implement `checkBranchMerged()` private method
  - [ ] Implement `checkRemoteBranch()` private method
  - [ ] Check for detached HEAD
  - [ ] Check for merge in progress
  - [ ] Check for rebase in progress
  - [ ] Write unit tests

### 4.2 Environment Syncer
- [ ] Implement `src/core/EnvSyncer.ts`
  - [ ] Implement `sync(source, target, decision)` method
  - [ ] Implement `mergeVariables()` private method
  - [ ] Apply added variables
  - [ ] Apply modified variables
  - [ ] Apply removed variables
  - [ ] Preserve comments and formatting
  - [ ] Handle errors gracefully
  - [ ] Write unit tests

### 4.3 Worktree Remover
- [ ] Implement `src/core/WorktreeRemover.ts`
  - [ ] Implement `remove(worktree, force)` method
  - [ ] Execute `git worktree remove`
  - [ ] Handle locked worktrees
  - [ ] Handle missing directories
  - [ ] Handle permission errors
  - [ ] Write unit tests

### 4.4 Branch Cleaner
- [ ] Implement `src/core/BranchCleaner.ts`
  - [ ] Implement `cleanup(branch, safety, choice)` method
  - [ ] Safe delete (git branch -d)
  - [ ] Force delete (git branch -D)
  - [ ] Handle remote branch warnings
  - [ ] Prompt user based on merge status
  - [ ] Write unit tests

### 4.5 Close Command Implementation
- [ ] Implement `src/commands/close.ts`
  - [ ] Parse command-line arguments
  - [ ] Implement main `run()` method
  - [ ] Discover worktree (all 3 patterns)
  - [ ] Run safety checks
  - [ ] Display warnings
  - [ ] Prompt for confirmation
  - [ ] Execute environment sync
  - [ ] Remove worktree
  - [ ] Cleanup branch
  - [ ] Log operation to audit
  - [ ] Show summary
  - [ ] Handle --dry-run mode
  - [ ] Write integration tests

---

## Phase 5: Sync-Env Command (2-3 days)

### 5.1 Sync Target Resolver
- [ ] Implement `src/core/SyncTargetResolver.ts`
  - [ ] Implement `resolve(options)` method
  - [ ] Pattern 1: --from and --to
  - [ ] Pattern 2: Only --from (to=main)
  - [ ] Pattern 3: Only --to (from=main)
  - [ ] Pattern 4: --between (bidirectional)
  - [ ] Validate .env files exist
  - [ ] Write unit tests

### 5.2 Sync-Env Command Implementation
- [ ] Implement `src/commands/sync-env.ts`
  - [ ] Parse command-line arguments
  - [ ] Implement main `run()` method
  - [ ] Resolve source and target
  - [ ] Parse .env files
  - [ ] Generate diff
  - [ ] Display diff
  - [ ] Get user decision
  - [ ] Create backup
  - [ ] Perform sync
  - [ ] Log operation
  - [ ] Show summary
  - [ ] Handle --dry-run mode
  - [ ] Write integration tests

### 5.3 Bidirectional Sync
- [ ] Implement bidirectional comparison display
- [ ] Implement direction selection prompt
- [ ] Test worktree-to-worktree sync
- [ ] Test main-to-worktree sync
- [ ] Test worktree-to-main sync

---

## Phase 6: List & Cleanup Commands (2 days)

### 6.1 List Display
- [ ] Implement `src/ui/ListDisplay.ts`
  - [ ] Implement `show(worktrees, format)` method
  - [ ] Implement table format display
  - [ ] Implement JSON format display
  - [ ] Implement simple format display
  - [ ] Add sorting functionality
  - [ ] Test visual output

### 6.2 List Command
- [ ] Implement `src/commands/list.ts`
  - [ ] Parse command-line arguments
  - [ ] Implement main `run()` method
  - [ ] Get worktrees for current repo
  - [ ] Get worktrees for all repos (--all)
  - [ ] Enrich with metadata (status, age)
  - [ ] Sort based on option
  - [ ] Display in selected format
  - [ ] Write tests

### 6.3 Cleanup Command
- [ ] Implement `src/commands/cleanup.ts`
  - [ ] Parse command-line arguments
  - [ ] Implement main `run()` method
  - [ ] Find backups to clean
  - [ ] Find logs to clean
  - [ ] Apply --older-than filter
  - [ ] Show preview
  - [ ] Prompt for confirmation
  - [ ] Perform cleanup
  - [ ] Show summary
  - [ ] Handle --dry-run mode
  - [ ] Write tests

---

## Phase 7: Enhanced Create Command (1-2 days)

### 7.1 Integrate New Features
- [ ] Update create command to use ConfigManager
- [ ] Add existing worktrees display
- [ ] Integrate AuditLogger for creation tracking
- [ ] Update project metadata on create
- [ ] Test all integration points

---

## Phase 8: CLI Router & Main Entry Point (1 day)

### 8.1 Update Main Entry Point
- [ ] Update `src/index.ts`
  - [ ] Import all command classes
  - [ ] Set up yargs with subcommands
  - [ ] Add `create` subcommand
  - [ ] Add `close` subcommand
  - [ ] Add `sync-env` subcommand
  - [ ] Add `list` subcommand
  - [ ] Add `cleanup` subcommand
  - [ ] Route to appropriate command handler
  - [ ] Add global error handling
  - [ ] Test all commands via CLI

### 8.2 Help Text & Examples
- [ ] Add comprehensive help for each command
- [ ] Add usage examples
- [ ] Add option descriptions
- [ ] Test --help output

---

## Phase 9: Documentation (2-3 days)

### 9.1 Create Documentation Files
- [ ] Create `docs/configuration.md`
  - [ ] Config file location
  - [ ] All configuration options with descriptions
  - [ ] Default values
  - [ ] Examples
- [ ] Create `docs/sync-operations.md`
  - [ ] How sync works
  - [ ] Close command with sync
  - [ ] Sync-env patterns
  - [ ] Diff display explanation
  - [ ] Conflict resolution
  - [ ] Backup and recovery
- [ ] Create `docs/advanced-usage.md`
  - [ ] List command usage
  - [ ] Cleanup operations
  - [ ] Multiple worktree management
  - [ ] CI/CD integration
- [ ] Create `docs/troubleshooting.md`
  - [ ] Common issues
  - [ ] Debugging
  - [ ] Manual recovery
  - [ ] FAQ

### 9.2 Update Existing Documentation
- [ ] Update `README.md`
  - [ ] Add v3.0 features section
  - [ ] Add new commands overview
  - [ ] Add configuration overview
  - [ ] Link to new docs
  - [ ] Update examples
- [ ] Update `INSTALLATION_GUIDE.md`
  - [ ] Update version references
  - [ ] Add new features notes
- [ ] Update `CLAUDE.md`
  - [ ] Add new architecture description
  - [ ] Add configuration system
  - [ ] Add audit logging system
  - [ ] Add backup system
  - [ ] Add key algorithms
  - [ ] Update file structure

### 9.3 Cross-Link Documentation
- [ ] Add links from README to docs/
- [ ] Add links from docs/ back to README
- [ ] Add inter-doc links where relevant
- [ ] Verify all links work

---

## Phase 10: Testing & Polish (2-3 days)

### 10.1 Integration Tests
- [ ] Test complete close workflow
- [ ] Test complete sync-env workflow
- [ ] Test list command with multiple repos
- [ ] Test cleanup command
- [ ] Test enhanced create command
- [ ] Test all command combinations
- [ ] Test error scenarios

### 10.2 Edge Case Testing
- [ ] Test empty .env files
- [ ] Test malformed .env files
- [ ] Test very large .env files
- [ ] Test concurrent modifications
- [ ] Test locked files
- [ ] Test detached HEAD
- [ ] Test merge/rebase in progress
- [ ] Test multiple worktrees same branch
- [ ] Test remote renamed
- [ ] Test no internet connection

### 10.3 Security Testing
- [ ] Test with sensitive values in .env
- [ ] Test backup file permissions
- [ ] Test config file validation
- [ ] Test command injection prevention
- [ ] Verify audit log security

### 10.4 Cross-Platform Testing
- [ ] Test on macOS
- [ ] Test on Linux
- [ ] Test on Windows (Git Bash/WSL)
- [ ] Fix platform-specific issues

### 10.5 Performance Testing
- [ ] Test with large worktree lists
- [ ] Test with large .env files
- [ ] Test with many backups
- [ ] Test with large audit logs
- [ ] Optimize slow operations

### 10.6 Error Messages
- [ ] Review all error messages
- [ ] Ensure messages are clear and helpful
- [ ] Add hints where appropriate
- [ ] Test all error paths

### 10.7 User Experience
- [ ] Review all prompts for clarity
- [ ] Test color output
- [ ] Test non-color output
- [ ] Verify progress indicators
- [ ] Test verbose mode
- [ ] Polish summary displays

---

## Phase 11: Release Preparation (1 day)

### 11.1 Version Updates
- [ ] Update version in package.json to 3.0.0
- [ ] Update version in all documentation
- [ ] Update CHANGELOG

### 11.2 Build & Package
- [ ] Run `npm run build`
- [ ] Test built dist/ files
- [ ] Verify package.json bin entries
- [ ] Test global installation

### 11.3 Final Checks
- [ ] Run all tests
- [ ] Verify all features work
- [ ] Check for console warnings
- [ ] Review all TODO comments in code
- [ ] Clean up debug code

---

## Completion Checklist

- [ ] All features implemented
- [ ] All tests passing
- [ ] Documentation complete
- [ ] Cross-platform tested
- [ ] Security reviewed
- [ ] Performance acceptable
- [ ] README updated
- [ ] CLAUDE.md updated
- [ ] SPEC.md updated
- [ ] Version bumped to 3.0.0

---

## Notes

- Update this file as tasks are completed
- Mark completed tasks with [x]
- Add new tasks as discovered
- Reference SPEC.md for detailed implementation guidance

