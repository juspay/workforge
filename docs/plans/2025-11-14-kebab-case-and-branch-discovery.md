# Kebab-Case Auto-Conversion and Enhanced Branch Discovery Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Add automatic kebab-case conversion for branch names and improve discoverability of the `--base` option by showing available branches.

**Architecture:** Create reusable string utility module for kebab-case conversion. Integrate into existing create command validation flow. Enhance branch detection to collect and display all available branches with helpful tips.

**Tech Stack:** TypeScript, Node.js, yargs (CLI), chalk (colors), git (subprocess)

---

## Task 1: Create String Utility Module

**Files:**
- Create: `src/utils/strings.ts`

**Step 1: Create the strings utility file**

Create `src/utils/strings.ts` with the following content:

```typescript
/**
 * String utility functions
 */

/**
 * Convert any string to kebab-case format
 *
 * Handles:
 * - Multiple spaces
 * - Underscores
 * - Special characters
 * - Mixed case
 * - Already kebab-case strings (idempotent)
 *
 * @param input - String to convert
 * @returns Kebab-case string
 *
 * @example
 * toKebabCase('Switch Merchants should match Mobile app')
 * // Returns: 'switch-merchants-should-match-mobile-app'
 *
 * toKebabCase('my_feature_name')
 * // Returns: 'my-feature-name'
 *
 * toKebabCase('Fix: Bug #123')
 * // Returns: 'fix-bug-123'
 */
export function toKebabCase(input: string): string {
  return input
    .trim()                              // Remove leading/trailing whitespace
    .toLowerCase()                       // Convert to lowercase
    .replace(/[\s_]+/g, '-')            // Replace spaces and underscores with hyphens
    .replace(/[^a-z0-9\-]/g, '')        // Remove all non-alphanumeric except hyphens
    .replace(/-+/g, '-')                // Collapse multiple hyphens to single
    .replace(/^-+|-+$/g, '');           // Remove leading/trailing hyphens
}
```

**Step 2: Verify TypeScript compilation**

Run: `pnpm run build`
Expected: No errors, `dist/utils/strings.js` created

**Step 3: Commit**

```bash
git add src/utils/strings.ts
git commit -m "feat(utils): add toKebabCase string utility function"
```

---

## Task 2: Integrate Auto-Conversion into Create Command

**Files:**
- Modify: `src/commands/create.ts:1-10` (imports)
- Modify: `src/commands/create.ts:64-81` (validateInputs method)

**Step 1: Add import for string utility**

At the top of `src/commands/create.ts`, add the import after line 9:

```typescript
import { toError } from '../utils/errors.js';
import { toKebabCase } from '../utils/strings.js';  // ADD THIS LINE
```

**Step 2: Modify validateInputs method**

Replace the current `validateInputs()` method (lines 64-81) with:

```typescript
private validateInputs(): void {
  this.log('info', 'Validating inputs...');

  // Validate type - must be letters only, convert to lowercase
  if (!/^[a-zA-Z]+$/.test(this.config.type)) {
    throw new Error(`Invalid type "${this.config.type}". Must contain only letters.`);
  }

  // Normalize type to lowercase
  this.config.type = this.config.type.toLowerCase();

  // Auto-convert name to kebab-case
  const originalName = this.config.name;
  this.config.name = toKebabCase(this.config.name);

  // Inform user if conversion happened
  if (originalName !== this.config.name) {
    this.log('info', `Converted name to kebab-case: ${this.config.name}`);
  }

  // Safety check: ensure conversion produced valid result
  if (!this.config.name || this.config.name.length === 0) {
    throw new Error(`Invalid name: "${originalName}" cannot be converted to valid kebab-case format.`);
  }

  // Additional safety: validate final format
  if (!/^[a-z0-9\-]+$/.test(this.config.name)) {
    throw new Error(`Invalid name: "${originalName}" produced invalid characters after conversion.`);
  }

  this.log('success', '✅ Input validation passed');
}
```

**Step 3: Test the conversion manually**

Run: `pnpm run dev -- create -t feat -n "My Test Feature" --yes`
Expected: Should show "Converted name to kebab-case: my-test-feature" and proceed

Run: `pnpm run dev -- create -t feat -n already-kebab --yes`
Expected: Should NOT show conversion message (already valid)

**Step 4: Commit**

```bash
git add src/commands/create.ts
git commit -m "feat(create): add automatic kebab-case conversion for branch names"
```

---

## Task 3: Add Helper Method to List All Branches

**Files:**
- Modify: `src/commands/create.ts` (add new method after `getWorktreeStatus`)

**Step 1: Add listAllBranches helper method**

Add this method after the `getWorktreeStatus` method (after line 282):

```typescript
/**
 * Get list of all local branches in repository
 * @returns Array of branch names, or empty array if error
 */
private listAllBranches(): string[] {
  if (!this.paths?.repoRoot) {
    return [];
  }

  try {
    const result = spawnSync('git', ['branch', '--format=%(refname:short)'], {
      cwd: this.paths.repoRoot,
      encoding: 'utf8',
      stdio: 'pipe'
    });

    if (result.stdout) {
      return result.stdout
        .trim()
        .split('\n')
        .map(b => b.trim())
        .filter(b => b.length > 0);
    }
  } catch {
    // Ignore errors, return empty array
  }

  return [];
}
```

**Step 2: Verify TypeScript compilation**

Run: `pnpm run build`
Expected: No errors

**Step 3: Commit**

```bash
git add src/commands/create.ts
git commit -m "feat(create): add helper method to list all git branches"
```

---

## Task 4: Enhance Branch Detection with Available Branches

**Files:**
- Modify: `src/commands/create.ts:122-187` (detectDefaultBranch method)

**Step 1: Replace detectDefaultBranch method**

Replace the entire `detectDefaultBranch()` method (lines 122-187) with:

```typescript
private async detectDefaultBranch(): Promise<void> {
  if (!this.paths?.repoRoot) {
    throw new Error('Repository root not found');
  }

  // If user didn't specify a base branch, try to detect the default
  const globalConfig = this.configManager.load();
  if (this.config.base === globalConfig.preferences.defaultBaseBranch) {
    this.log('info', 'Detecting default branch...');

    try {
      // Try to get the default branch from remote
      const result = spawnSync('git', ['symbolic-ref', 'refs/remotes/origin/HEAD'], {
        cwd: this.paths.repoRoot,
        stdio: 'pipe',
        encoding: 'utf8'
      });

      if (result.stdout && result.stdout.trim()) {
        const defaultBranch = result.stdout.trim().replace('refs/remotes/origin/', '');
        this.config.base = defaultBranch;
        this.log('success', `✅ Detected default branch: ${defaultBranch}`);
        return;
      }
    } catch (error) {
      // Ignore error and try next method
    }

    // Fallback: check if main exists, otherwise try common alternatives
    this.log('info', 'Scanning for available branches...');
    const commonBranches = ['main', 'master', 'develop', 'beta'];
    const foundBranches: string[] = [];

    for (const branch of commonBranches) {
      try {
        const result = spawnSync('git', ['show-ref', '--verify', `refs/heads/${branch}`], {
          cwd: this.paths.repoRoot,
          stdio: 'pipe'
        });

        if (result.status === 0) {
          foundBranches.push(branch);
        }
      } catch (error) {
        // Continue to next branch
      }
    }

    if (foundBranches.length > 0) {
      this.config.base = foundBranches[0];
      this.log('success', `✅ Using base branch: ${this.config.base}`);

      if (foundBranches.length > 1) {
        this.log('info', `💡 Other available branches: ${foundBranches.slice(1).join(', ')}`);
        this.log('info', `   Use --base <branch> to choose a different base`);
      }
      return;
    }

    // If no common branch found, get current branch
    try {
      const result = spawnSync('git', ['branch', '--show-current'], {
        cwd: this.paths.repoRoot,
        stdio: 'pipe',
        encoding: 'utf8'
      });

      if (result.stdout && result.stdout.trim()) {
        this.config.base = result.stdout.trim();
        this.log('success', `✅ Using current branch as base: ${this.config.base}`);
        return;
      }
    } catch (error) {
      // Continue with default
    }
  }
}
```

**Step 2: Verify TypeScript compilation**

Run: `pnpm run build`
Expected: No errors

**Step 3: Test branch detection**

Run: `pnpm run dev -- create -t feat -n test --yes`
Expected: Should show "Scanning for available branches..." and list found branches

**Step 4: Commit**

```bash
git add src/commands/create.ts
git commit -m "feat(create): enhance branch detection to show available branches"
```

---

## Task 5: Improve Base Branch Validation with Better Errors

**Files:**
- Modify: `src/commands/create.ts:348-402` (runPreflightChecks method)

**Step 1: Add base branch validation**

In the `runPreflightChecks()` method, add base branch validation after the Git binary check (after line 356). Insert this code:

```typescript
// Validate base branch exists
this.log('info', 'Validating base branch...');
try {
  const result = spawnSync('git', ['show-ref', '--verify', `refs/heads/${this.config.base}`], {
    cwd: this.paths.repoRoot,
    stdio: 'pipe'
  });

  if (result.status !== 0) {
    const available = this.listAllBranches();
    throw new Error(
      `Base branch "${this.config.base}" not found.\n` +
      `  Available branches: ${available.join(', ')}\n` +
      `  Use --base <branch> to specify a different base.`
    );
  }

  this.log('success', `✅ Base branch "${this.config.base}" exists`);
} catch (error) {
  if (error instanceof Error && error.message.includes('not found')) {
    throw error;
  }
  // Other errors are non-fatal, continue
}
```

**Step 2: Verify TypeScript compilation**

Run: `pnpm run build`
Expected: No errors

**Step 3: Test invalid base branch**

Run: `pnpm run dev -- create -t feat -n test --base nonexistent --yes`
Expected: Should show error with available branches listed

**Step 4: Commit**

```bash
git add src/commands/create.ts
git commit -m "feat(create): add base branch validation with helpful error messages"
```

---

## Task 6: Update CLI Help Text and Examples

**Files:**
- Modify: `src/index.ts:64-89` (create command definition)

**Step 1: Update --base option description**

Replace the `--base` option definition (around line 64-68) with:

```typescript
.option('base', {
  alias: 'b',
  type: 'string',
  description: 'Base branch to checkout from (auto-detects main/master/develop/beta if not specified)',
  default: 'main'
})
```

**Step 2: Add more examples**

Replace the examples section (around line 87-89) with:

```typescript
.example('$0 create -t feat -n auth', 'Create feat/auth worktree')
.example('$0 create -t fix -n bug -b develop', 'Create from develop branch')
.example('$0 create -t feat -n api -b beta --yes', 'Create from beta branch')
.example('$0 create -t feat -n api -j BZ-123', 'Create with Jira ticket')
.example('$0 create -t fix -n "Bug Fix Name" --yes', 'Name auto-converted to kebab-case');
```

**Step 3: Verify TypeScript compilation**

Run: `pnpm run build`
Expected: No errors

**Step 4: Test help text**

Run: `pnpm run dev -- create --help`
Expected: Should show updated description and all examples

**Step 5: Commit**

```bash
git add src/index.ts
git commit -m "docs(cli): improve help text for --base option and add conversion examples"
```

---

## Task 7: Manual End-to-End Testing

**Files:**
- None (testing only)

**Step 1: Test auto-conversion with spaces**

Run: `pnpm run dev -- create -t feat -n "My New Feature" --yes`

Expected output:
```
ℹ Validating inputs...
ℹ Converted name to kebab-case: my-new-feature
✅ Input validation passed
...
```

Clean up: `git worktree remove ../feat/my-new-feature && git branch -D feat/my-new-feature`

**Step 2: Test auto-conversion with special characters**

Run: `pnpm run dev -- create -t fix -n "Bug #123: Fix Error" --yes`

Expected output:
```
ℹ Converted name to kebab-case: bug-123-fix-error
```

Clean up: `git worktree remove ../fix/bug-123-fix-error && git branch -D fix/bug-123-fix-error`

**Step 3: Test already kebab-case (no conversion)**

Run: `pnpm run dev -- create -t feat -n already-kebab-case --yes`

Expected: Should NOT show conversion message

Clean up: `git worktree remove ../feat/already-kebab-case && git branch -D feat/already-kebab-case`

**Step 4: Test custom base branch**

Run: `pnpm run dev -- create -t feat -n test --base release --yes`

Expected: Should use release as base branch

Clean up: `git worktree remove ../feat/test && git branch -D feat/test`

**Step 5: Test invalid base branch**

Run: `pnpm run dev -- create -t feat -n test --base nonexistent --yes`

Expected:
```
✗ Base branch "nonexistent" not found.
  Available branches: main, release
  Use --base <branch> to specify a different base.
```

**Step 6: Test branch discovery feedback**

Run: `pnpm run dev -- create -t feat -n test --yes`

Expected:
```
ℹ Scanning for available branches...
✅ Using base branch: release (or main)
💡 Other available branches: ...
   Use --base <branch> to choose a different base
```

Clean up: `git worktree remove ../feat/test && git branch -D feat/test`

**Step 7: Document test results**

No commit needed - this is verification only.

---

## Task 8: Update CLAUDE.md Documentation

**Files:**
- Modify: `CLAUDE.md`

**Step 1: Add string utility to architecture section**

In the "Directory Structure" section, add under `src/utils/`:

```markdown
├── utils/             # Utility functions
│   ├── errors.ts      # Error handling
│   └── strings.ts     # String transformations (NEW)
```

**Step 2: Document the new utility in the "Common Customization Points" section**

Add a new subsection:

```markdown
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
```

**Step 3: Update create command documentation**

In the "Create Command" section, add to the workflow after step 1:

```markdown
1. Validate inputs (type, name, ticket ID)
   - Auto-convert name to kebab-case using toKebabCase()
   - Log conversion if name changed
2. Discover repository (works from worktrees too)
```

**Step 4: Commit**

```bash
git add CLAUDE.md
git commit -m "docs: document string utility and auto-conversion feature"
```

---

## Task 9: Build and Verify Final Package

**Files:**
- None (build verification)

**Step 1: Clean build**

Run: `rm -rf dist && pnpm run build`
Expected: Clean build with no errors

**Step 2: Verify all files compiled**

Run: `ls dist/utils/`
Expected: Should show `errors.js`, `errors.d.ts`, `strings.js`, `strings.d.ts`

**Step 3: Test built version**

Run: `node dist/index.js create -t feat -n "Test Feature" --help`
Expected: Help text shows with updated examples

**Step 4: Final commit**

```bash
git add -A
git commit -m "chore: rebuild with all new features" --allow-empty
```

---

## Task 10: Create Summary Commit

**Files:**
- None (git operations)

**Step 1: Review all commits**

Run: `git log --oneline -10`
Expected: Should show all commits from this implementation

**Step 2: Check git status**

Run: `git status`
Expected: Should be clean (nothing to commit)

**Step 3: Tag the release (optional)**

If this is ready for release:

```bash
git tag -a v3.1.0 -m "feat: add kebab-case auto-conversion and enhanced branch discovery"
```

---

## Implementation Complete

**Verification Checklist:**

- ✅ String utility module created with toKebabCase()
- ✅ Auto-conversion integrated into create command
- ✅ Conversion messages shown to user
- ✅ Branch detection enhanced to show alternatives
- ✅ Invalid base branch shows helpful error with available branches
- ✅ CLI help text updated with better examples
- ✅ All manual tests pass
- ✅ Documentation updated
- ✅ Clean build verified

**New User Experience:**

```bash
$ workforge create --type fix --name "Switch Merchants should match Mobile app" --ticket BZ-45945 --yes

ℹ Validating inputs...
ℹ Converted name to kebab-case: switch-merchants-should-match-mobile-app
✅ Input validation passed
ℹ Discovering Git repository root...
✅ Found repository root at: /path/to/repo
ℹ Detecting default branch...
ℹ Scanning for available branches...
✅ Using base branch: main
💡 Other available branches: beta, develop
   Use --base <branch> to choose a different base
...
```

**Files Modified:**
- `src/utils/strings.ts` (NEW)
- `src/commands/create.ts` (MODIFIED)
- `src/index.ts` (MODIFIED)
- `CLAUDE.md` (MODIFIED)

**Total Commits:** ~10
