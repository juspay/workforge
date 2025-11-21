# Jira Ticket Naming, Relative Paths, and Table Fix Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Add Jira ticket to branch/folder names, show relative paths in list output, and fix table formatting with ANSI color codes.

**Architecture:** Three independent improvements: (1) Modify branch naming logic in create command, (2) Add relative path calculation in list display, (3) Fix table row padding to handle ANSI codes using string-width library.

**Tech Stack:** TypeScript, Node.js, chalk (colors), string-width (ANSI-aware width calculation), path (relative path resolution)

---

## Parallelization Strategy

**Tasks 1-5 can run in PARALLEL** (independent changes to different files)
**Tasks 6-10 must run SEQUENTIALLY** (depend on previous tasks)

---

## Task 1: Fix Table Formatting with ANSI Color Code Handling

**Files:**
- Modify: `src/ui/Logger.ts:1` (add import)
- Modify: `src/ui/Logger.ts:174-182` (fix tableRow method)

**Step 1: Add string-width import**

At the top of `src/ui/Logger.ts` (after existing imports, around line 1):

```typescript
import stringWidth from 'string-width';
```

**Step 2: Replace tableRow method**

Replace the entire `tableRow` method (lines 174-182):

```typescript
/**
 * Table row (aligned columns)
 */
tableRow(columns: string[], widths: number[]): void {
  let row = '';
  for (let i = 0; i < columns.length; i++) {
    const column = columns[i] || '';
    const width = widths[i] || 20;

    // Calculate visual width (ignoring ANSI codes)
    const visualWidth = stringWidth(column);
    const padding = Math.max(0, width - visualWidth);

    row += column + ' '.repeat(padding) + '  ';
  }
  console.log(row.trimEnd());
}
```

**Step 3: Verify TypeScript compilation**

```bash
pnpm run build
```

Expected: No errors, clean compilation

**Step 4: Manual test table output**

```bash
pnpm run dev -- list
```

Expected: Table columns properly aligned even with colored text

**Step 5: Commit**

```bash
git add src/ui/Logger.ts
git commit -m "fix(ui): correct table formatting to handle ANSI color codes"
```

---

## Task 2: Update Branch and Folder Naming with Jira Ticket

**Files:**
- Modify: `src/commands/create.ts:377-402` (calculatePaths method)

**Step 1: Replace calculatePaths method**

Replace lines 377-402 in `src/commands/create.ts`:

```typescript
private calculatePaths(): void {
  if (!this.paths?.repoRoot) {
    throw new Error('Repository root not found');
  }

  const workspaceParent = path.join(this.paths.repoRoot, '..', this.config.type);

  // Folder name includes ticket ID if present
  const folderName = this.config.ticketId
    ? `${this.config.ticketId}-${this.config.name}`
    : this.config.name;

  const workspacePath = path.join(workspaceParent, folderName);

  // Branch name always uses type/ prefix, with ticket ID after type
  const branchName = this.config.ticketId
    ? `${this.config.type}/${this.config.ticketId}-${this.config.name}`
    : `${this.config.type}/${this.config.name}`;

  this.paths = {
    repoRoot: this.paths.repoRoot,
    workspaceParent,
    workspacePath,
    branchName
  };

  this.log('info', `Calculated paths:
  Repository Root: ${this.paths.repoRoot}
  Workspace Parent: ${this.paths.workspaceParent}
  Workspace Path: ${this.paths.workspacePath}
  Branch Name: ${this.paths.branchName}`);
}
```

**Step 2: Verify TypeScript compilation**

```bash
pnpm run build
```

Expected: No errors, clean compilation

**Step 3: Manual test WITHOUT ticket**

```bash
pnpm run dev -- create -t feat -n test-without-ticket --yes
```

Expected output:
```
✅ Branch Name: feat/test-without-ticket
✅ Workspace Path: ../feat/test-without-ticket
```

**Step 4: Cleanup test worktree**

```bash
git worktree remove ../feat/test-without-ticket
git branch -d feat/test-without-ticket
```

**Step 5: Manual test WITH ticket**

```bash
pnpm run dev -- create -t feat -n test-with-ticket -j BZ-9999 --yes
```

Expected output:
```
✅ Branch Name: feat/BZ-9999-test-with-ticket
✅ Workspace Path: ../feat/BZ-9999-test-with-ticket
```

**Step 6: Cleanup test worktree**

```bash
git worktree remove ../feat/BZ-9999-test-with-ticket
git branch -d feat/BZ-9999-test-with-ticket
```

**Step 7: Commit**

```bash
git add src/commands/create.ts
git commit -m "feat(create): include Jira ticket ID in branch and folder names"
```

---

## Task 3: Add Relative Paths to List Display

**Files:**
- Modify: `src/ui/ListDisplay.ts:1` (add import)
- Modify: `src/ui/ListDisplay.ts:77` (table format)
- Modify: `src/ui/ListDisplay.ts:96-104` (JSON format)
- Modify: `src/ui/ListDisplay.ts:120,122` (simple format)
- Modify: `src/ui/ListDisplay.ts:233+` (add utility method)

**Step 1: Add path import**

At the top of `src/ui/ListDisplay.ts` (around line 1, after existing imports):

```typescript
import path from 'path';
```

**Step 2: Add utility method after truncate method**

Add this method after the `truncate` method (around line 260):

```typescript
/**
 * Get relative path from current directory
 */
private getRelativePath(absolutePath: string): string {
  return path.relative(process.cwd(), absolutePath);
}
```

**Step 3: Update table format method**

In `showTable` method, replace line 77:

```typescript
// Before
const pathDisplay = this.truncatePath(worktree.path, 40);

// After
const relativePath = this.getRelativePath(worktree.path);
const pathDisplay = this.truncatePath(relativePath, 40);
```

**Step 4: Update simple format method**

In `showSimple` method, replace lines 120 and 122:

```typescript
// Before (line 120)
this.logger.info(chalk.cyan('(main)') + ` - ${worktree.path}`);

// After
const relativePath = this.getRelativePath(worktree.path);
this.logger.info(chalk.cyan('(main)') + ` - ${relativePath}`);
```

```typescript
// Before (line 122)
this.logger.info(chalk.cyan(worktree.branchName) + ` - ${worktree.path}`);

// After
const relativePath = this.getRelativePath(worktree.path);
this.logger.info(chalk.cyan(worktree.branchName) + ` - ${relativePath}`);
```

**Step 5: Update JSON format method**

In `showJSON` method, replace lines 96-104:

```typescript
// Before
const output = worktrees.map(w => ({
  branchName: w.branchName,
  path: w.path,
  commitHash: w.commitHash,
  isMainRepo: w.isMainRepo,
  isLocked: w.isLocked,
  isPrunable: w.isPrunable,
  remoteUrl: w.remoteUrl
}));

// After
const output = worktrees.map(w => ({
  branchName: w.branchName,
  path: w.path,
  relativePath: this.getRelativePath(w.path),
  commitHash: w.commitHash,
  isMainRepo: w.isMainRepo,
  isLocked: w.isLocked,
  isPrunable: w.isPrunable,
  remoteUrl: w.remoteUrl
}));
```

**Step 6: Verify TypeScript compilation**

```bash
pnpm run build
```

Expected: No errors, clean compilation

**Step 7: Manual test table format**

```bash
pnpm run dev -- list
```

Expected: Relative paths shown (e.g., `.`, `../feat/branch-name`)

**Step 8: Manual test JSON format**

```bash
pnpm run dev -- list --json
```

Expected: JSON includes both `path` and `relativePath` fields

**Step 9: Manual test simple format**

```bash
pnpm run dev -- list --simple
```

Expected: Relative paths shown in simple one-line format

**Step 10: Commit**

```bash
git add src/ui/ListDisplay.ts
git commit -m "feat(list): show relative paths from current directory"
```

---

## Task 4: Update CLI Examples with Jira Ticket Format

**Files:**
- Modify: `src/index.ts:90` (add new example)

**Step 1: Add new example for Jira ticket**

In `src/index.ts`, after line 90, add a new example:

```typescript
.example('$0 create -t feat -n auth', 'Create feat/auth worktree')
.example('$0 create -t fix -n bug -b develop', 'Create from develop branch')
.example('$0 create -t feat -n api -b beta --yes', 'Create from beta branch')
.example('$0 create -t feat -n api -j BZ-123', 'Create with Jira ticket')
.example('$0 create -t fix -n "Bug Fix Name" --yes', 'Name auto-converted to kebab-case')
.example('$0 create -t feat -n auth -j BZ-456', 'Create feat/BZ-456-auth worktree');  // NEW
```

**Step 2: Verify help text**

```bash
pnpm run dev -- create --help
```

Expected: New example shown in help text

**Step 3: Commit**

```bash
git add src/index.ts
git commit -m "docs(cli): add example for Jira ticket in branch name"
```

---

## Task 5: Update CLAUDE.md Documentation

**Files:**
- Modify: `CLAUDE.md:386-388` (update create command workflow)
- Modify: `CLAUDE.md:50+` (update examples section if exists)

**Step 1: Update Create Command Workflow section**

Find the "Create Command" section in CLAUDE.md (around line 396) and update the workflow description:

```markdown
**Workflow:**
1. Validate inputs (type, name, ticket ID)
   - Auto-convert name to kebab-case using toKebabCase()
   - Log conversion if name changed
2. Discover repository (works from worktrees too)
3. Detect default branch
4. Detect repository type (public vs internal)
5. Calculate paths and branch names
   - With Jira ticket: branch `type/TICKET-name`, folder `type/TICKET-name`
   - Without ticket: branch `type/name`, folder `type/name`
6. Run preflight checks
...
```

**Step 2: Add List Command updates section**

Find the "List Command" section in CLAUDE.md (around line 456) and add note about relative paths:

```markdown
### 4. List Command (src/commands/list.ts)

Lists all worktrees with status indicators.

**Workflow:**
1. Parse git worktree list --porcelain
2. Extract worktree information
3. Calculate relative paths from current directory
4. Sort by specified criteria
5. Format output (table, JSON, or simple)
...

**Output Features:**
- **Relative Paths**: Shows paths relative to current directory (e.g., `../feat/my-feature`)
- **Copy-Paste Ready**: Can directly use `cd <path>` from output
- **JSON Format**: Includes both absolute and relative paths
```

**Step 3: Commit**

```bash
git add CLAUDE.md
git commit -m "docs: document Jira ticket naming and relative paths features"
```

---

## Task 6: Integration Testing (SEQUENTIAL - Run after Tasks 1-5)

**Files:**
- None (manual testing only)

**Step 1: Clean build**

```bash
rm -rf dist && pnpm run build
```

Expected: Clean compilation, no errors

**Step 2: Test complete workflow with Jira ticket**

```bash
pnpm run dev -- create -t feat -n integration-test -j BZ-8888 --yes
```

Expected:
- Branch created: `feat/BZ-8888-integration-test`
- Folder created: `../feat/BZ-8888-integration-test`
- No errors

**Step 3: Test list command shows relative path**

```bash
cd ../feat/BZ-8888-integration-test
pnpm run dev -- list
```

Expected:
- Current worktree shown with relative path
- Main repo shown as `.` or `../../git-worktree-creator`
- Table properly aligned

**Step 4: Test list JSON format**

```bash
pnpm run dev -- list --json
```

Expected:
- JSON includes `relativePath` field
- Both `path` (absolute) and `relativePath` present

**Step 5: Return to main repo and cleanup**

```bash
cd ../../git-worktree-creator
git worktree remove ../feat/BZ-8888-integration-test
git branch -d feat/BZ-8888-integration-test
```

**Step 6: Test without Jira ticket (ensure backwards compatibility)**

```bash
pnpm run dev -- create -t feat -n no-ticket-test --yes
```

Expected:
- Branch created: `feat/no-ticket-test`
- Folder created: `../feat/no-ticket-test`
- No errors

**Step 7: Verify list output**

```bash
pnpm run dev -- list
```

Expected:
- All worktrees shown with relative paths
- Table aligned properly
- No errors

**Step 8: Cleanup**

```bash
git worktree remove ../feat/no-ticket-test
git branch -d feat/no-ticket-test
```

**Step 9: Document test results**

No commit needed - testing phase complete.

---

## Task 7: Build and Package Verification (SEQUENTIAL)

**Files:**
- None (verification only)

**Step 1: Clean build**

```bash
rm -rf dist && pnpm run build
```

Expected: No TypeScript errors, clean compilation

**Step 2: Verify compiled files exist**

```bash
ls -la dist/commands/create.js
ls -la dist/ui/ListDisplay.js
ls -la dist/ui/Logger.js
```

Expected: All files present with recent timestamps

**Step 3: Test built version**

```bash
node dist/index.js create --help
```

Expected: Help text shows new example with Jira ticket

**Step 4: Test built version list command**

```bash
node dist/index.js list
```

Expected: Works correctly, shows relative paths

**Step 5: Verify package.json dependencies**

```bash
cat package.json | grep string-width
```

Expected: string-width already in dependencies (via inquirer)

No commit needed - verification complete.

---

## Task 8: Update Version (SEQUENTIAL)

**Files:**
- Modify: `package.json:2` (version field)

**Step 1: Update version in package.json**

Change version from `1.0.0` to `1.2.0`:

```json
{
  "name": "workforge",
  "version": "1.2.0",
  ...
}
```

Reason for 1.2.0:
- 1.1.0 was the kebab-case and branch discovery release
- 1.2.0 adds new features (Jira ticket naming, relative paths, table fix)

**Step 2: Commit version bump**

```bash
git add package.json
git commit -m "chore: bump version to 1.2.0"
```

---

## Task 9: Create Release Tag (SEQUENTIAL)

**Files:**
- None (git tag only)

**Step 1: Create annotated release tag**

```bash
git tag -a v1.2.0 -m "feat: Jira ticket naming, relative paths, and table formatting

- Include Jira ticket ID in branch and folder names (feat/TICKET-name)
- Show relative paths in list output for copy-paste convenience
- Fix table alignment to properly handle ANSI color codes"
```

**Step 2: Verify tag created**

```bash
git tag -l -n1 v1.2.0
```

Expected: Tag shown with first line of message

**Step 3: Show tag details**

```bash
git show v1.2.0 --no-patch
```

Expected: Full tag information displayed

---

## Task 10: Summary and Documentation (SEQUENTIAL)

**Step 1: Show git log**

```bash
git log --oneline -10
```

Expected: All commits from this implementation visible

**Step 2: Show files changed**

```bash
git diff v1.1.0..v1.2.0 --stat
```

Expected: Summary of all changed files

**Step 3: Final status check**

```bash
git status
```

Expected: Clean working tree

**Step 4: Document completion**

Report to user:
- Total commits created
- Files modified
- Version bumped (1.0.0 → 1.2.0)
- Tag created (v1.2.0)
- All tests passed

---

## Summary

**Total Tasks:** 10
**Parallel Tasks:** 1-5 (can run simultaneously)
**Sequential Tasks:** 6-10 (must run in order)

**Files Modified:**
- `src/ui/Logger.ts` - Fix table formatting
- `src/commands/create.ts` - Update branch/folder naming
- `src/ui/ListDisplay.ts` - Add relative paths
- `src/index.ts` - Update CLI examples
- `CLAUDE.md` - Update documentation
- `package.json` - Version bump

**Estimated Time:**
- Parallel tasks (1-5): ~15 minutes (if run in parallel, ~3 minutes wall time)
- Sequential tasks (6-10): ~10 minutes
- Total: ~25 minutes (or ~13 minutes with full parallelization)

**Testing Coverage:**
- Unit: Each feature tested individually
- Integration: Full workflow tested end-to-end
- Build: Compilation and package verified
- Manual: All output formats tested
