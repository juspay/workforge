import { describe, it, expect, afterAll } from 'vitest';
import { existsSync, readFileSync, writeFileSync, rmSync, mkdirSync, renameSync } from 'fs';
import * as path from 'path';
import { BranchCleaner } from '../src/core/BranchCleaner.js';
import { BackupManager } from '../src/core/BackupManager.js';
import { ProjectIdentifier } from '../src/core/ProjectIdentifier.js';
import { SafetyCheckResult } from '../src/types/index.js';
import { makeRepo, cleanupFixtures, runCli, gitIn, branchExists } from './helpers/fixtures.js';

afterAll(cleanupFixtures);

const cleanSafety: SafetyCheckResult = {
  hasUncommittedChanges: false,
  hasUnpushedCommits: false,
  isMerged: true,
  hasRemoteBranch: true,
  isDetachedHead: false,
  isMergeInProgress: false,
  isRebaseInProgress: false,
  warnings: [],
  canClose: true
};

describe('close: branch deletion safety', () => {
  it('does not force-delete an unmerged, unpushed branch without --force', () => {
    const repo = makeRepo({ primary: 'release' });
    runCli(repo.local, ['create', '-t', 'feat', '-n', 'keepme', '-y']);

    const worktree = path.join(repo.root, 'feat/keepme');
    writeFileSync(path.join(worktree, 'w.txt'), 'precious\n', 'utf8');
    gitIn(worktree, ['add', '-A']);
    gitIn(worktree, ['-c', 'user.email=t@t.t', '-c', 'user.name=T', 'commit', '-qm', 'unpushed work']);
    const sha = gitIn(repo.local, ['rev-parse', 'feat/keepme']);

    const run = runCli(repo.local, ['close', '-n', 'feat/keepme', '-d', '-y']);

    expect(gitIn(repo.local, ['rev-parse', 'feat/keepme'])).toBe(sha);
    expect(run.output).toMatch(/not fully merged|--force|not merged/i);
  });

  it('deletes the branch when --force is given', () => {
    const repo = makeRepo({ primary: 'release' });
    runCli(repo.local, ['create', '-t', 'feat', '-n', 'dropme', '-y']);

    const worktree = path.join(repo.root, 'feat/dropme');
    writeFileSync(path.join(worktree, 'w.txt'), 'throwaway\n', 'utf8');
    gitIn(worktree, ['add', '-A']);
    gitIn(worktree, ['-c', 'user.email=t@t.t', '-c', 'user.name=T', 'commit', '-qm', 'throwaway']);

    runCli(repo.local, ['close', '-n', 'feat/dropme', '-d', '-y', '-f']);

    expect(branchExists(repo.local, 'feat/dropme')).toBe(false);
  });

  it('recognises a branch merged into the remote primary, not local main/master', () => {
    const repo = makeRepo({ primary: 'release' });
    runCli(repo.local, ['create', '-t', 'feat', '-n', 'merged', '-y']);

    const worktree = path.join(repo.root, 'feat/merged');
    writeFileSync(path.join(worktree, 'm.txt'), 'feature\n', 'utf8');
    gitIn(worktree, ['add', '-A']);
    gitIn(worktree, ['-c', 'user.email=t@t.t', '-c', 'user.name=T', 'commit', '-qm', 'feature work']);
    gitIn(worktree, ['push', '--quiet', '-u', 'origin', 'feat/merged']);

    // Merge it on the remote, exactly like a PR merge. The clone's local
    // `release` is deliberately left un-pulled.
    gitIn(repo.seed, ['checkout', '--quiet', 'release']);
    gitIn(repo.seed, ['fetch', '--quiet', 'origin']);
    gitIn(repo.seed, ['merge', '--quiet', '--no-ff', 'origin/feat/merged', '-m', 'merge PR']);
    gitIn(repo.seed, ['push', '--quiet', 'origin', 'release']);

    const run = runCli(repo.local, ['close', '-n', 'feat/merged', '-d', '-y']);

    expect(run.output).not.toContain('has not been merged');
    expect(branchExists(repo.local, 'feat/merged')).toBe(false);
  });
});

describe('BranchCleaner: protected branches', () => {
  it('refuses the repository primary branch even with force', async () => {
    const repo = makeRepo({ primary: 'release' });
    const cleaner = new BranchCleaner();

    const result = await cleaner.cleanup('release', repo.local, cleanSafety, true);

    expect(result.success).toBe(false);
    expect(result.message).toContain("primary branch");
    expect(branchExists(repo.local, 'release')).toBe(true);
  });

  it('keeps main and master protected as a baseline', async () => {
    const repo = makeRepo({ primary: 'release' });
    const cleaner = new BranchCleaner();

    for (const branch of ['main', 'master']) {
      const result = await cleaner.cleanup(branch, repo.local, cleanSafety, true);
      expect(result.success).toBe(false);
      expect(result.message).toContain('protected');
    }
  });
});

describe('close: environment sync safety', () => {
  it('does not destroy a worktree-only .env when the main repo has none', () => {
    const repo = makeRepo({ primary: 'release' });
    runCli(repo.local, ['create', '-t', 'feat', '-n', 'envonly', '-y']);

    expect(existsSync(path.join(repo.local, '.env'))).toBe(false);
    writeFileSync(
      path.join(repo.root, 'feat/envonly/.env'),
      'ONLY_IN_WORKTREE=super-secret\nSECOND=value2\n',
      'utf8'
    );

    const run = runCli(repo.local, ['close', '-n', 'feat/envonly', '-y']);

    expect(run.output).toContain('worktree has a .env but');
    const mainEnv = readFileSync(path.join(repo.local, '.env'), 'utf8');
    expect(mainEnv).toContain('ONLY_IN_WORKTREE=super-secret');
    expect(mainEnv).toContain('SECOND=value2');
  });

  it('aborts rather than syncing when the backup cannot be created', () => {
    const repo = makeRepo({ primary: 'release' });
    runCli(repo.local, ['create', '-t', 'feat', '-n', 'envsync', '-y']);

    writeFileSync(path.join(repo.local, '.env'), 'KEEP=original-value\n', 'utf8');
    writeFileSync(
      path.join(repo.root, 'feat/envsync/.env'),
      'KEEP=original-value\nNEWVAR=added\n',
      'utf8'
    );
    const before = readFileSync(path.join(repo.local, '.env'), 'utf8');

    // Plant a file where the backup directory must be, so createBackup throws.
    const backupDir = ProjectIdentifier.getBackupDir(repo.local);
    rmSync(backupDir, { recursive: true, force: true });
    mkdirSync(path.dirname(backupDir), { recursive: true });
    writeFileSync(backupDir, '', 'utf8');

    try {
      const run = runCli(repo.local, ['close', '-n', 'feat/envsync', '-y']);

      expect(run.output).toContain('Backup failed');
      expect(run.output).toContain('Refusing to sync without a backup');
      expect(readFileSync(path.join(repo.local, '.env'), 'utf8')).toBe(before);
      expect(existsSync(path.join(repo.root, 'feat/envsync'))).toBe(true);
    } finally {
      rmSync(backupDir, { force: true });
    }
  });
});

describe('ProjectIdentifier', () => {
  it('uses a non-origin remote so the id survives a directory rename', () => {
    const repo = makeRepo({ primary: 'release' });
    gitIn(repo.local, ['remote', 'rename', 'origin', 'upstream']);

    const before = ProjectIdentifier.generateId(repo.local);

    const renamed = path.join(repo.root, 'local-renamed');
    renameSync(repo.local, renamed);

    expect(ProjectIdentifier.generateId(renamed)).toBe(before);
  });
});

describe('BackupManager', () => {
  it('never overwrites an earlier snapshot taken in the same second', () => {
    const repo = makeRepo({ primary: 'release' });
    const envPath = path.join(repo.local, '.env');
    writeFileSync(envPath, 'A=1\n', 'utf8');

    const manager = new BackupManager();
    const first = manager.createBackup(envPath, repo.local);

    writeFileSync(envPath, 'A=2\n', 'utf8');
    const second = manager.createBackup(envPath, repo.local);

    expect(first).not.toBe(second);
    expect(readFileSync(first, 'utf8')).toBe('A=1\n');
    expect(readFileSync(second, 'utf8')).toBe('A=2\n');
  });
});
