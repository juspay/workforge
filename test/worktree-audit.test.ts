import { describe, it, expect, afterAll } from 'vitest';
import { existsSync, readFileSync, writeFileSync, rmSync, mkdirSync, readdirSync } from 'fs';
import * as path from 'path';
import { WorktreeResolver } from '../src/core/WorktreeResolver.js';
import { WorktreeRemover } from '../src/core/WorktreeRemover.js';
import { AuditLogger } from '../src/core/AuditLogger.js';
import { ProjectIdentifier } from '../src/core/ProjectIdentifier.js';
import { ListDisplay } from '../src/ui/ListDisplay.js';
import { toSingleLine } from '../src/utils/strings.js';
import { WorktreeInfo, AuditOperation } from '../src/types/index.js';
import { makeRepo, cleanupFixtures, runCli, gitIn } from './helpers/fixtures.js';

afterAll(cleanupFixtures);

describe('WorktreeResolver: main repository detection', () => {
  it('marks the main worktree of an ordinary (non-bare) repository', async () => {
    const repo = makeRepo({ primary: 'release' });
    runCli(repo.local, ['create', '-t', 'feat', '-n', 'one', '-y']);

    const worktrees = await new WorktreeResolver().getWorktrees(repo.local);

    expect(worktrees.filter(w => w.isMainRepo)).toHaveLength(1);
    expect(worktrees.find(w => w.isMainRepo)?.path).toBe(repo.local);
    expect(worktrees.find(w => w.path.endsWith('feat/one'))?.isMainRepo).toBe(false);
  });

  it('records a real commit timestamp for age sorting', async () => {
    const repo = makeRepo({ primary: 'release' });

    const worktrees = await new WorktreeResolver().getWorktrees(repo.local);

    expect(worktrees[0].commitTimestamp).toBeTypeOf('number');
    expect(worktrees[0].commitTimestamp).toBeGreaterThan(0);
  });
});

describe('ListDisplay: --sort age', () => {
  it('orders by commit time, not by commit hash', () => {
    const base = {
      isMainRepo: false,
      isLocked: false,
      isPrunable: false
    };

    // Hashes are deliberately ordered opposite to the timestamps: a
    // hash-based sort would put "aaa" (oldest) first.
    const worktrees: WorktreeInfo[] = [
      { ...base, path: '/w/old', branchName: 'old', commitHash: 'fff111', commitTimestamp: 1000 },
      { ...base, path: '/w/new', branchName: 'new', commitHash: 'aaa999', commitTimestamp: 9000 },
      { ...base, path: '/w/mid', branchName: 'mid', commitHash: 'ccc555', commitTimestamp: 5000 }
    ];

    const display = new ListDisplay();
    const sort = Reflect.get(display, 'sortWorktrees') as (
      w: WorktreeInfo[],
      by: string
    ) => WorktreeInfo[];
    const sorted = sort.call(display, worktrees, 'age');

    expect(sorted.map(w => w.branchName)).toEqual(['new', 'mid', 'old']);
  });
});

describe('WorktreeRemover', () => {
  it('removes a locked worktree when --force is given', async () => {
    const repo = makeRepo({ primary: 'release' });
    runCli(repo.local, ['create', '-t', 'feat', '-n', 'locked', '-y']);

    const worktreePath = path.join(repo.root, 'feat/locked');
    gitIn(repo.local, ['worktree', 'lock', worktreePath, '--reason', 'testing']);

    const worktrees = await new WorktreeResolver().getWorktrees(repo.local);
    const target = worktrees.find(w => w.path === worktreePath);
    expect(target?.isLocked).toBe(true);

    const result = await new WorktreeRemover().remove(target as WorktreeInfo, true, repo.local);

    expect(result.success).toBe(true);
    expect(existsSync(worktreePath)).toBe(false);
  });

  it('prunes only the requested worktree, leaving other prunable ones alone', async () => {
    const repo = makeRepo({ primary: 'release' });
    runCli(repo.local, ['create', '-t', 'feat', '-n', 'gone', '-y']);
    runCli(repo.local, ['create', '-t', 'feat', '-n', 'alsogone', '-y']);

    // Both directories vanish, so git reports both as prunable.
    rmSync(path.join(repo.root, 'feat/gone'), { recursive: true, force: true });
    rmSync(path.join(repo.root, 'feat/alsogone'), { recursive: true, force: true });

    const before = await new WorktreeResolver().getWorktrees(repo.local);
    expect(before.filter(w => w.isPrunable)).toHaveLength(2);

    const target = before.find(w => w.path.endsWith('feat/gone'));
    const result = await new WorktreeRemover().remove(target as WorktreeInfo, false, repo.local);

    expect(result.success).toBe(true);

    const after = await new WorktreeResolver().getWorktrees(repo.local);
    expect(after.some(w => w.path.endsWith('feat/gone'))).toBe(false);
    // The one the user did not ask about must still be registered.
    expect(after.some(w => w.path.endsWith('feat/alsogone'))).toBe(true);
  });

  it('explains an uncommitted-changes refusal in its own words', async () => {
    const repo = makeRepo({ primary: 'release' });
    runCli(repo.local, ['create', '-t', 'feat', '-n', 'dirty', '-y']);

    const worktreePath = path.join(repo.root, 'feat/dirty');
    writeFileSync(path.join(worktreePath, 'tracked.txt'), 'x\n', 'utf8');
    gitIn(worktreePath, ['add', '-A']);
    gitIn(worktreePath, ['-c', 'user.email=t@t.t', '-c', 'user.name=T', 'commit', '-qm', 'add']);
    writeFileSync(path.join(worktreePath, 'tracked.txt'), 'modified\n', 'utf8');

    const worktrees = await new WorktreeResolver().getWorktrees(repo.local);
    const target = worktrees.find(w => w.path === worktreePath);

    const result = await new WorktreeRemover().remove(target as WorktreeInfo, false, repo.local);

    expect(result.success).toBe(false);
    expect(result.message).toBe('Worktree has uncommitted changes. Commit, stash, or use --force.');
  });
});

describe('AuditLogger', () => {
  const operation = (source: string): AuditOperation =>
    ({
      timestamp: new Date().toISOString(),
      operation: 'sync',
      source,
      target: 'Main (test)',
      changesApplied: { added: 1, modified: 0, removed: 0 },
      variableDetails: { added: ['A'], modified: [], removed: [] },
      success: true,
      backupCreated: false
    }) as AuditOperation;

  it('preserves a corrupt history file instead of overwriting it', () => {
    const repo = makeRepo({ primary: 'release' });
    const projectDir = ProjectIdentifier.getProjectDir(repo.local);
    mkdirSync(projectDir, { recursive: true });

    const historyPath = path.join(projectDir, 'sync-history.json');
    writeFileSync(historyPath, '[{"broken": true,,,]', 'utf8');

    new AuditLogger().log(operation('Worktree (a)'), repo.local);

    const salvaged = readFileSync(historyPath, 'utf8');
    expect(JSON.parse(salvaged)).toHaveLength(1);

    // The unreadable original must still exist somewhere.
    const preserved = readdirSync(projectDir).filter(f => f.includes('.corrupt-'));
    expect(preserved.length).toBeGreaterThan(0);
    expect(readFileSync(path.join(projectDir, preserved[0]), 'utf8')).toBe('[{"broken": true,,,]');
  });

  it('keeps every entry when several loggers write at once', () => {
    const repo = makeRepo({ primary: 'release' });
    const projectDir = ProjectIdentifier.getProjectDir(repo.local);
    rmSync(path.join(projectDir, 'sync-history.json'), { force: true });

    for (let i = 0; i < 8; i++) {
      new AuditLogger().log(operation(`Worktree (${i})`), repo.local);
    }

    const history = JSON.parse(readFileSync(path.join(projectDir, 'sync-history.json'), 'utf8'));
    expect(history).toHaveLength(8);
  });
});

describe('toSingleLine', () => {
  it('escapes newlines, tabs and carriage returns visibly', () => {
    expect(toSingleLine('line1\nline2')).toBe('line1\\nline2');
    expect(toSingleLine('a\tb')).toBe('a\\tb');
    expect(toSingleLine('a\r\nb')).toBe('a\\r\\nb');
  });

  it('leaves ordinary values untouched apart from backslashes', () => {
    expect(toSingleLine('postgres://localhost/db')).toBe('postgres://localhost/db');
    expect(toSingleLine('C:\\Users')).toBe('C:\\\\Users');
  });

  it('never emits a real line break', () => {
    expect(toSingleLine('a\nb\nc')).not.toContain('\n');
  });
});

describe('sync-env: --between', () => {
  it('refuses to guess a direction when combined with --yes', () => {
    const repo = makeRepo({ primary: 'release' });
    runCli(repo.local, ['create', '-t', 'feat', '-n', 'bidi', '-y']);

    writeFileSync(path.join(repo.local, '.env'), 'SHARED=main\n', 'utf8');
    writeFileSync(path.join(repo.root, 'feat/bidi/.env'), 'SHARED=worktree\nEXTRA=1\n', 'utf8');
    const before = readFileSync(path.join(repo.local, '.env'), 'utf8');

    const run = runCli(repo.local, [
      'sync-env',
      '--between',
      path.join(repo.root, 'feat/bidi'),
      '--yes'
    ]);

    expect(run.status).not.toBe(0);
    expect(run.output).toContain('cannot be used with --yes');
    expect(readFileSync(path.join(repo.local, '.env'), 'utf8')).toBe(before);
  });
});
