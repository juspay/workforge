# Auto Kebab-Case Conversion and Enhanced Branch Discovery

**Date:** 2025-11-14
**Status:** Approved
**Version:** 1.0

## Overview

This design adds two usability improvements to WorkForge:

1. **Auto kebab-case conversion**: Accept any string format for branch names and auto-convert to kebab-case
2. **Enhanced branch discovery**: Improve discoverability of the `--base` option and show available branches

## Problem Statement

### Current Limitations

**Problem 1: Strict name validation**
```bash
# Current behavior - FAILS
$ workforge create --type fix --name 'Switch Merchants should match Mobile app' --ticket BZ-45945

✗ Invalid name "Switch Merchants should match Mobile app".
  Must be kebab-case (lowercase letters, numbers, and hyphens only).
```

Users must manually convert names to kebab-case, which is:
- Time-consuming
- Error-prone
- Unnecessary friction

**Problem 2: Hidden base branch option**
```bash
# Users don't know they can do this:
$ workforge create --type fix --name bug --base beta --yes
```

The `--base` option exists but is not discoverable:
- No indication of which branches are available
- No feedback about auto-detection
- No hints about the option when auto-detection succeeds

### User Requirements

1. Accept natural language strings and auto-convert: `'Switch Merchants should match Mobile app'` → `'switch-merchants-should-match-mobile-app'`
2. Make it obvious that the `--base` option exists and show available branches
3. Maintain backward compatibility (kebab-case input should still work)

## Design

### Architecture

```
┌─────────────────────────────────────────────────────────────┐
│ src/utils/strings.ts (NEW)                                  │
│                                                              │
│  • toKebabCase(input: string): string                       │
│    - Normalize whitespace, delimiters, special chars        │
│    - Convert to lowercase                                   │
│    - Return kebab-case string                               │
└─────────────────────────────────────────────────────────────┘
                              ▲
                              │
                              │ imports
                              │
┌─────────────────────────────────────────────────────────────┐
│ src/commands/create.ts (MODIFIED)                           │
│                                                              │
│  validateInputs():                                          │
│    1. Auto-convert name using toKebabCase()                 │
│    2. Log conversion if name changed                        │
│    3. Validate result (safety check)                        │
│                                                              │
│  detectDefaultBranch():                                     │
│    1. Try remote symbolic-ref (unchanged)                   │
│    2. Scan common branches, collect all found               │
│    3. Log selected branch + alternatives                    │
│    4. Show helpful tip about --base option                  │
│                                                              │
│  runPreflightChecks():                                      │
│    - Enhanced error for invalid --base                      │
│    - Show available branches in error message               │
└─────────────────────────────────────────────────────────────┘
                              ▲
                              │
                              │ enhanced help
                              │
┌─────────────────────────────────────────────────────────────┐
│ src/index.ts (MODIFIED)                                     │
│                                                              │
│  • Updated --base description                               │
│  • Added more examples showing --base usage                 │
│  • Added example showing auto-conversion                    │
└─────────────────────────────────────────────────────────────┘
```

### Component Design

#### 1. String Utility Module

**File:** `src/utils/strings.ts`

**Function signature:**
```typescript
export function toKebabCase(input: string): string
```

**Algorithm:**
1. Trim leading/trailing whitespace
2. Convert entire string to lowercase
3. Replace spaces and underscores with hyphens
4. Remove all characters except: a-z, 0-9, hyphens
5. Collapse multiple consecutive hyphens to single hyphen
6. Remove leading and trailing hyphens
7. Return normalized string

**Implementation approach:**
```typescript
export function toKebabCase(input: string): string {
  return input
    .trim()
    .toLowerCase()
    .replace(/[\s_]+/g, '-')           // spaces/underscores → hyphens
    .replace(/[^a-z0-9\-]/g, '')       // remove special chars
    .replace(/-+/g, '-')               // collapse consecutive hyphens
    .replace(/^-+|-+$/g, '');          // trim hyphens
}
```

**Test cases:**
| Input | Output | Notes |
|-------|--------|-------|
| `'Switch Merchants should match Mobile app'` | `'switch-merchants-should-match-mobile-app'` | Standard conversion |
| `'my_feature_name'` | `'my-feature-name'` | Underscore to hyphen |
| `'Fix: Bug #123'` | `'fix-bug-123'` | Special chars removed |
| `'already-kebab-case'` | `'already-kebab-case'` | Idempotent |
| `'  spaced  '` | `'spaced'` | Trim whitespace |
| `''` | `''` | Empty string |
| `'!!!invalid!!!'` | `'invalid'` | Only special chars stripped |

#### 2. Create Command Integration

**File:** `src/commands/create.ts`

**Modified method:** `validateInputs()`

**Changes:**
1. Import utility:
   ```typescript
   import { toKebabCase } from '../utils/strings.js';
   ```

2. Apply conversion before validation (insert after line 72):
   ```typescript
   // Auto-convert name to kebab-case
   const originalName = this.config.name;
   this.config.name = toKebabCase(this.config.name);

   if (originalName !== this.config.name) {
     this.log('info', `Converted name to kebab-case: ${this.config.name}`);
   }
   ```

3. Replace validation error with safety check (lines 76-78):
   ```typescript
   // Safety check: ensure conversion produced valid result
   if (!/^[a-z0-9\-]+$/.test(this.config.name)) {
     throw new Error(`Unable to convert "${originalName}" to valid kebab-case format.`);
   }

   // Additional safety: ensure not empty
   if (!this.config.name || this.config.name.length === 0) {
     throw new Error(`Invalid name: Result is empty after conversion.`);
   }
   ```

**Modified method:** `detectDefaultBranch()`

**Changes:**

Insert after line 150 (inside the common branches loop):
```typescript
this.log('info', 'Scanning for available branches...');
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
```

**New helper method:** `listAllBranches()`

Add to CreateCommand class:
```typescript
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
    // Ignore errors
  }

  return [];
}
```

**Modified method:** `runPreflightChecks()`

Enhance base branch validation (add after line 401):
```typescript
// Validate base branch exists
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
} catch (error) {
  if (error instanceof Error && error.message.includes('not found')) {
    throw error;
  }
  // Other errors are non-fatal
}
```

#### 3. CLI Help Improvements

**File:** `src/index.ts`

**Changes:**

1. Update `--base` option description (line 64-68):
   ```typescript
   .option('base', {
     alias: 'b',
     type: 'string',
     description: 'Base branch to checkout from (auto-detects main/master/develop/beta if not specified)',
     default: 'main'
   })
   ```

2. Add more examples (line 87-89):
   ```typescript
   .example('$0 create -t feat -n auth', 'Create feat/auth worktree')
   .example('$0 create -t fix -n bug -b develop', 'Create from develop branch')
   .example('$0 create -t feat -n api -b beta --yes', 'Create from beta branch')
   .example('$0 create -t feat -n api -j BZ-123', 'Create with Jira ticket')
   .example('$0 create -t fix -n "Bug Fix Name" --yes', 'Name auto-converted to kebab-case')
   ```

## User Experience

### Before

```bash
$ workforge create --type fix --name 'Switch Merchants should match Mobile app' --ticket BZ-45945 --yes

✗ Invalid name "Switch Merchants should match Mobile app".
  Must be kebab-case (lowercase letters, numbers, and hyphens only).

# User must manually convert:
$ workforge create --type fix --name switch-merchants-should-match-mobile-app --ticket BZ-45945 --yes
```

### After

```bash
$ workforge create --type fix --name 'Switch Merchants should match Mobile app' --ticket BZ-45945 --yes

ℹ Validating inputs...
ℹ Converted name to kebab-case: switch-merchants-should-match-mobile-app
✅ Input validation passed
ℹ Discovering Git repository root...
✅ Found repository root at: /Users/sachinsharma/Developer/temp/git-worktree-creator
ℹ Detecting default branch...
ℹ Scanning for available branches...
✅ Using base branch: main
💡 Other available branches: beta, develop
   Use --base <branch> to choose a different base
...
```

### Using Custom Base Branch

```bash
$ workforge create --type fix --name bug-fix --base beta --yes

ℹ Validating inputs...
✅ Input validation passed
ℹ Discovering Git repository root...
✅ Found repository root at: /Users/sachinsharma/Developer/temp/git-worktree-creator
✅ Using base branch: beta
...
```

### Invalid Base Branch

```bash
$ workforge create --type fix --name bug-fix --base nonexistent --yes

ℹ Validating inputs...
✅ Input validation passed
...
ℹ Running pre-flight checks...
✗ Base branch "nonexistent" not found.
  Available branches: main, beta, develop, feat/test
  Use --base <branch> to specify a different base.
```

## Implementation Details

### Type Definitions

No new types needed. Existing types in `src/types/index.ts` are sufficient.

### Error Handling

**Empty name after conversion:**
```typescript
if (!this.config.name || this.config.name.length === 0) {
  throw new Error(`Invalid name: Result is empty after conversion.`);
}
```

**Invalid characters remaining:**
```typescript
if (!/^[a-z0-9\-]+$/.test(this.config.name)) {
  throw new Error(`Unable to convert "${originalName}" to valid kebab-case format.`);
}
```

**Invalid base branch:**
```typescript
throw new Error(
  `Base branch "${this.config.base}" not found.\n` +
  `  Available branches: ${available.join(', ')}\n` +
  `  Use --base <branch> to specify a different base.`
);
```

### Configuration Integration

The existing `defaultBaseBranch` configuration (ConfigManager.ts:284) is already supported and will continue to work:

```json
{
  "preferences": {
    "defaultBaseBranch": "beta"
  }
}
```

This takes precedence over auto-detection when set.

## Testing Strategy

### Manual Testing

**Test 1: Auto-conversion**
```bash
workforge create -t feat -n "My New Feature" --yes
# Expected: Converts to my-new-feature
```

**Test 2: Special characters**
```bash
workforge create -t fix -n "Bug #123: Fix Error" --yes
# Expected: Converts to bug-123-fix-error
```

**Test 3: Already kebab-case**
```bash
workforge create -t feat -n already-kebab --yes
# Expected: No conversion message, proceeds normally
```

**Test 4: Custom base branch**
```bash
workforge create -t feat -n test --base beta --yes
# Expected: Uses beta as base
```

**Test 5: Invalid base branch**
```bash
workforge create -t feat -n test --base invalid --yes
# Expected: Error with available branches listed
```

**Test 6: Branch discovery feedback**
```bash
workforge create -t feat -n test --yes
# Expected: Shows detected branches and tip about --base
```

### Edge Cases

- Empty string name: Should error
- Only special characters: Should error or convert to empty and error
- Very long names: Should work (no length limit)
- Unicode characters: Will be stripped, may result in empty or partial name
- Mixed delimiters: Should normalize to hyphens

## Backward Compatibility

✅ **Fully backward compatible**

- Existing kebab-case names work without change
- Existing `--base` flag behavior unchanged
- No breaking changes to API or CLI
- Additional logging is informational only
- Configuration options remain the same

## Dependencies

No new external dependencies required.

## Risks and Mitigations

| Risk | Mitigation |
|------|------------|
| Users unaware of auto-conversion | Log conversion message clearly |
| Conversion produces unexpected results | Show original and converted names |
| Base branch errors are confusing | List available branches in error message |
| Too much logging for experienced users | Keep messages concise and informative |
| Unicode/emoji in names | Strip non-ASCII chars, validate result |

## Future Enhancements

1. **Smart branch suggestions**: When base branch is invalid, suggest closest match (fuzzy search)
2. **Configuration for verbosity**: Add config flag to disable branch discovery tips
3. **Custom conversion rules**: Allow users to define custom string transformations
4. **Branch templates**: Support branch name templates like `{ticket}-{type}-{name}`

## Implementation Checklist

- [ ] Create `src/utils/strings.ts` with `toKebabCase()` function
- [ ] Add unit tests for string utility (if test suite exists)
- [ ] Modify `validateInputs()` in create.ts to use auto-conversion
- [ ] Modify `detectDefaultBranch()` to log available branches
- [ ] Add `listAllBranches()` helper method
- [ ] Enhance `runPreflightChecks()` with better error messages
- [ ] Update CLI help text in index.ts
- [ ] Add examples showing new features
- [ ] Manual testing of all scenarios
- [ ] Update user documentation

## Documentation Updates

**Files to update:**
- `README.md`: Add examples of auto-conversion and --base usage
- `docs/configuration.md`: Document defaultBaseBranch config option more prominently
- `CLAUDE.md`: Update with new utility module

**Example additions:**

README.md:
```markdown
### Flexible Branch Naming

WorkForge automatically converts branch names to kebab-case:

\`\`\`bash
# All of these work:
workforge create -t feat -n "My New Feature"
workforge create -t fix -n "Bug Fix Name"
workforge create -t feat -n my_feature_name

# All produce: my-new-feature, bug-fix-name, my-feature-name
\`\`\`

### Custom Base Branch

Start your worktree from any branch:

\`\`\`bash
# Start from beta branch
workforge create -t feat -n new-feature --base beta

# Start from develop
workforge create -t fix -n bug-fix --base develop
\`\`\`

WorkForge will show you available branches and suggest the --base option.
```

## Acceptance Criteria

- ✅ User can pass any string format for branch name
- ✅ Name is automatically converted to kebab-case
- ✅ Conversion is logged to user
- ✅ Already kebab-case names work without conversion message
- ✅ Invalid conversions (empty result) show clear error
- ✅ Branch detection shows available branches
- ✅ Tip about --base option is shown when multiple branches detected
- ✅ Invalid --base shows available branches in error
- ✅ CLI help text includes --base examples
- ✅ Backward compatibility maintained
- ✅ No breaking changes to existing workflows

## Summary

This design adds two key usability improvements:

1. **Auto kebab-case conversion** removes friction from branch creation by accepting natural language strings
2. **Enhanced branch discovery** makes the --base option discoverable and helps users understand their branching options

Both features maintain backward compatibility and enhance the user experience without adding complexity or breaking existing workflows.
