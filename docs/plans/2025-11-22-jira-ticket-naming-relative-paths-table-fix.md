# Design: Jira Ticket Naming, Relative Paths, and Table Formatting Fix

**Date:** 2025-11-22
**Status:** Approved
**Version:** 1.0

## Overview

Three improvements to WorkForge:
1. Include Jira ticket ID in branch names and folder paths
2. Show relative paths in list output for copy-paste convenience
3. Fix table formatting to properly handle ANSI color codes

## 1. Jira Ticket in Branch and Folder Names

### Current Behavior

**With ticket** (BZ-1234):
- Branch: `BZ-1234-feat-feature-name`
- Folder: `../feat/feature-name` (no ticket)

**Without ticket**:
- Branch: `feat/feature-name`
- Folder: `../feat/feature-name`

### Problems

- Inconsistent branch naming format (with ticket uses dashes, without uses slash)
- Folder path doesn't include ticket ID
- Hard to identify ticket-related work from folder structure

### New Design

**With ticket** (BZ-1234):
- Branch: `feat/BZ-1234-feature-name`
- Folder: `../feat/BZ-1234-feature-name`

**Without ticket**:
- Branch: `feat/feature-name`
- Folder: `../feat/feature-name`

### Implementation

**File:** `src/commands/create.ts`
**Method:** `calculatePaths()` (lines 377-402)

**Changes:**
```typescript
// Current (lines 386-388)
const branchName = this.config.ticketId
  ? `${this.config.ticketId}-${this.config.type}-${this.config.name}`
  : `${this.config.type}/${this.config.name}`;

// New
const folderName = this.config.ticketId
  ? `${this.config.ticketId}-${this.config.name}`
  : this.config.name;

const workspacePath = path.join(workspaceParent, folderName);

const branchName = this.config.ticketId
  ? `${this.config.type}/${this.config.ticketId}-${this.config.name}`
  : `${this.config.type}/${this.config.name}`;
```

### Benefits

- ✅ Consistent format (always uses type/ prefix)
- ✅ Ticket ID prominent in both branch and folder
- ✅ Easy to identify ticket-related work
- ✅ Git branch hierarchy maintained

---

## 2. Relative Paths in List Output

### Current Behavior

**List output shows absolute paths:**
```
Branch                Path
feat/my-feature      /Users/name/Developer/temp/git-worktree-creator/../feat/my-feature
```

**Problems:**
- Not copy-paste ready for `cd` commands
- Very long paths clutter output
- Not context-aware

### New Design

**Show relative paths from current directory:**
```
Branch                Path
feat/my-feature      ../feat/my-feature
```

**Copy-paste ready:**
```bash
cd ../feat/my-feature
```

### Implementation

**File:** `src/ui/ListDisplay.ts`

**Add utility method:**
```typescript
import path from 'path';

private getRelativePath(absolutePath: string): string {
  return path.relative(process.cwd(), absolutePath);
}
```

**Update display methods:**

1. **Table format** (line 77):
```typescript
// Before
const pathDisplay = this.truncatePath(worktree.path, 40);

// After
const relativePath = this.getRelativePath(worktree.path);
const pathDisplay = this.truncatePath(relativePath, 40);
```

2. **Simple format** (lines 120, 122):
```typescript
// Before
this.logger.info(chalk.cyan('(main)') + ` - ${worktree.path}`);
this.logger.info(chalk.cyan(worktree.branchName) + ` - ${worktree.path}`);

// After
const relativePath = this.getRelativePath(worktree.path);
this.logger.info(chalk.cyan('(main)') + ` - ${relativePath}`);
this.logger.info(chalk.cyan(worktree.branchName) + ` - ${relativePath}`);
```

3. **JSON format** (line 96-104):
```typescript
// Add relativePath field
const output = worktrees.map(w => ({
  branchName: w.branchName,
  path: w.path,
  relativePath: this.getRelativePath(w.path),  // NEW
  commitHash: w.commitHash,
  isMainRepo: w.isMainRepo,
  isLocked: w.isLocked,
  isPrunable: w.isPrunable,
  remoteUrl: w.remoteUrl
}));
```

### Benefits

- ✅ Copy-paste ready for `cd` commands
- ✅ Cleaner, shorter paths
- ✅ Context-aware (relative to current directory)
- ✅ JSON includes both absolute and relative paths

---

## 3. Fix Table Formatting (ANSI Color Code Handling)

### Current Problem

**File:** `src/ui/Logger.ts` (lines 174-182)

```typescript
tableRow(columns: string[], widths: number[]): void {
  let row = '';
  for (let i = 0; i < columns.length; i++) {
    const column = columns[i] || '';
    const width = widths[i] || 20;
    row += column.padEnd(width, ' ') + '  ';  // ← BROKEN
  }
  console.log(row.trimEnd());
}
```

**Issue:** `padEnd()` counts ANSI escape codes as visible characters, causing misalignment.

**Example:**
```
Branch                   Path                    Status
feat/my-feature     ../feat/my-feature   ACTIVE    ← Misaligned
```

### Solution

Use `string-width` library (already available via `inquirer` dependency) to calculate visual width:

```typescript
import stringWidth from 'string-width';

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

### Benefits

- ✅ Properly aligned columns with colored text
- ✅ Uses existing dependency (no new packages)
- ✅ Works with all chalk colors and styles
- ✅ Minimal code change

---

## Files Modified

| File | Changes | Lines Affected |
|------|---------|----------------|
| `src/commands/create.ts` | Branch and folder naming logic | 382-388 |
| `src/ui/ListDisplay.ts` | Add relative path calculation | 1, 77, 96-104, 120, 122, 233+ |
| `src/ui/Logger.ts` | Fix table formatting with string-width | 1, 174-182 |

## Testing Plan

1. **Branch naming test** - Create worktree with ticket ID
2. **Folder naming test** - Verify folder includes ticket ID
3. **List output test** - Verify relative paths shown
4. **Table alignment test** - Verify columns align with colors
5. **JSON output test** - Verify both paths included
6. **Compilation test** - TypeScript builds without errors
7. **Integration test** - Full workflow with all features

## Version Impact

**Type:** Minor version bump (1.0.0 → 1.1.0)
**Reason:** New features (ticket naming format change, relative paths in output)

---

## Examples

### Create with Jira Ticket

**Command:**
```bash
workforge create -t feat -n auth-refactor -j BZ-1234 --yes
```

**Output:**
```
✅ Branch Name: feat/BZ-1234-auth-refactor
✅ Workspace Path: ../feat/BZ-1234-auth-refactor
```

### List with Relative Paths

**Command:**
```bash
workforge list
```

**Output:**
```
📋 Worktrees

Branch                      Path                         Commit      Status
─────────────────────────────────────────────────────────────────────────────
(main)                      .                            261a2cc     MAIN
feat/BZ-1234-auth-refactor  ../feat/BZ-1234-auth-refactor abc1234     ACTIVE
doc/readme-update           ../doc/readme-update         06f39fc     ACTIVE
```

Copy-paste ready:
```bash
cd ../feat/BZ-1234-auth-refactor
```
