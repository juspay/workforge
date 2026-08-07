import { describe, it, expect, afterAll } from 'vitest';
import { existsSync, readFileSync, writeFileSync, mkdirSync } from 'fs';
import * as path from 'path';
import {
  makeRepo,
  makeTempDir,
  cleanupFixtures,
  runCli,
  gitIn,
  branchExists
} from './helpers/fixtures.js';

afterAll(cleanupFixtures);

describe('create: base branch resolution', () => {
  it('forks from the remote tip, not the stale local branch', () => {
    const repo = makeRepo({ primary: 'release', advanceRemote: true });

    // The clone's local `release` is behind; only origin/release has the new commit.
    expect(gitIn(repo.local, ['rev-parse', '--short', 'release'])).not.toBe(
      repo.remoteTip('release')
    );

    const run = runCli(repo.local, ['create', '-t', 'feat', '-n', 'a', '-y']);

    expect(run.output).toContain('Detected primary branch: release');
    expect(run.output).toContain('Branching from origin/release');
    expect(repo.tipOf('feat/a')).toBe(repo.remoteTip('release'));
    expect(readFileSync(path.join(repo.root, 'feat/a/file.txt'), 'utf8').trim()).toBe('v2');
  });

  it('does not set the base branch as the new branch upstream', () => {
    const repo = makeRepo({ primary: 'release' });
    runCli(repo.local, ['create', '-t', 'feat', '-n', 'a', '-y']);

    const upstream = gitIn(path.join(repo.root, 'feat/a'), [
      'rev-parse',
      '--abbrev-ref',
      '--symbolic-full-name',
      '@{u}'
    ]);
    expect(upstream).toBe('');
  });

  it('accepts a base that exists only on the remote', () => {
    const repo = makeRepo({ primary: 'main', branches: ['develop'] });
    expect(branchExists(repo.local, 'develop')).toBe(false);

    const run = runCli(repo.local, ['create', '-t', 'fix', '-n', 'b', '-b', 'develop', '-y']);

    expect(run.output).toContain('Workspace created successfully');
    expect(run.output).toContain('Branching from origin/develop');
    expect(repo.tipOf('fix/b')).toBe(repo.remoteTip('develop'));
  });

  it('never overrides an explicit --base with auto-detection', () => {
    const repo = makeRepo({ primary: 'release', branches: ['main'] });

    const run = runCli(repo.local, ['create', '-t', 'feat', '-n', 'c', '-b', 'main', '-y']);

    expect(run.output).toContain('Using base branch from --base: main');
    expect(run.output).not.toContain('Detected primary branch');
    expect(repo.tipOf('feat/c')).toBe(repo.remoteTip('main'));
  });

  it('accepts a base already qualified as origin/<branch>', () => {
    const repo = makeRepo({ primary: 'release', advanceRemote: true });

    const run = runCli(repo.local, ['create', '-t', 'feat', '-n', 'i', '-b', 'origin/release', '-y']);

    expect(run.output).toContain('Branching from origin/release');
    expect(repo.tipOf('feat/i')).toBe(repo.remoteTip('release'));
  });

  it('accepts a tag as the base', () => {
    const repo = makeRepo({ primary: 'release' });
    gitIn(repo.local, ['tag', 'v0.1']);

    const run = runCli(repo.local, ['create', '-t', 'chore', '-n', 'j', '-b', 'v0.1', '-y']);

    expect(run.output).toContain('commit-ish');
    expect(repo.tipOf('chore/j')).toBe(gitIn(repo.local, ['rev-parse', '--short', 'v0.1']));
  });
});

describe('create: primary branch inference', () => {
  it('queries the remote when origin/HEAD is not cached locally', () => {
    const repo = makeRepo({ primary: 'release', advanceRemote: true });
    gitIn(repo.local, ['symbolic-ref', '-d', 'refs/remotes/origin/HEAD']);

    const run = runCli(repo.local, ['create', '-t', 'feat', '-n', 'g', '-y']);

    expect(run.output).toContain('Detected primary branch: release');
    expect(repo.tipOf('feat/g')).toBe(repo.remoteTip('release'));
    expect(gitIn(repo.local, ['symbolic-ref', '--short', 'refs/remotes/origin/HEAD'])).toBe(
      'origin/release'
    );
  });

  it('picks up a default branch the remote has since renamed', () => {
    const repo = makeRepo({ primary: 'master' });

    // The remote renames master -> main after the clone was taken.
    gitIn(repo.seed, ['checkout', '--quiet', '-b', 'main']);
    gitIn(repo.seed, ['push', '--quiet', 'origin', 'main']);
    gitIn(repo.remote, ['symbolic-ref', 'HEAD', 'refs/heads/main']);
    gitIn(repo.seed, ['push', '--quiet', 'origin', '--delete', 'master']);

    expect(gitIn(repo.local, ['symbolic-ref', '--short', 'refs/remotes/origin/HEAD'])).toBe(
      'origin/master'
    );

    const run = runCli(repo.local, ['create', '-t', 'feat', '-n', 'a1', '-y']);

    expect(run.output).toContain('Detected primary branch: main');
    expect(gitIn(repo.local, ['symbolic-ref', '--short', 'refs/remotes/origin/HEAD'])).toBe(
      'origin/main'
    );
  });

  it('uses a remote that is not named origin', () => {
    const repo = makeRepo({ primary: 'release', advanceRemote: true });
    gitIn(repo.local, ['remote', 'rename', 'origin', 'upstream']);

    const run = runCli(repo.local, ['create', '-t', 'feat', '-n', 'f', '-y']);

    expect(run.output).toContain('upstream');
    expect(repo.tipOf('feat/f')).toBe(repo.remoteTip('release'));
  });
});

describe('create: degraded environments', () => {
  it('warns but still creates a worktree when no remote is configured', () => {
    const root = makeTempDir('wf-noremote-');
    const local = path.join(root, 'local');
    mkdirSync(local, { recursive: true });
    gitIn(local, ['init', '--quiet']);
    gitIn(local, ['config', 'user.email', 'test@example.com']);
    gitIn(local, ['config', 'user.name', 'Test']);
    gitIn(local, ['checkout', '--quiet', '-b', 'release']);
    writeFileSync(path.join(local, 'f.txt'), 'x\n', 'utf8');
    gitIn(local, ['add', '-A']);
    gitIn(local, ['commit', '--quiet', '-m', 'c1']);

    const run = runCli(local, ['create', '-t', 'feat', '-n', 'd', '-y']);

    expect(run.output).toContain('No Git remote configured');
    expect(run.output).toContain('Workspace created successfully');
    expect(run.output).toContain('warning(s)');
    expect(existsSync(path.join(root, 'feat/d'))).toBe(true);
  });

  it('warns but continues when the remote is unreachable', () => {
    const repo = makeRepo({ primary: 'release' });
    gitIn(repo.local, ['remote', 'set-url', 'origin', path.join(repo.root, 'missing.git')]);

    const run = runCli(repo.local, ['create', '-t', 'feat', '-n', 'e', '-y']);

    expect(run.output).toContain('Failed to fetch');
    expect(run.output).toContain('Workspace created successfully');
    expect(run.output).toContain('origin/release');
  });
});

describe('create: errors and collisions', () => {
  it('lists both local and remote branches when the base does not exist', () => {
    const repo = makeRepo({ primary: 'release' });

    const run = runCli(repo.local, ['create', '-t', 'feat', '-n', 'h', '-b', 'nope', '-y']);

    expect(run.output).toContain('not found locally or on the remote');
    expect(run.output).toContain('Remote branches');
    expect(run.output).toContain('Local branches');
  });

  it('refuses a branch name that already exists on the remote, with a remedy', () => {
    const repo = makeRepo({ primary: 'release', branches: ['feat/taken'] });
    gitIn(repo.local, ['fetch', '--quiet', '--prune']);

    const run = runCli(repo.local, ['create', '-t', 'feat', '-n', 'taken', '-y']);

    expect(run.output).toContain('already exists on');
    expect(run.output).toContain('git worktree add');
  });
});

describe('create: worktree placement and extras', () => {
  it('places a worktree as a sibling even when run from inside another worktree', () => {
    const repo = makeRepo({ primary: 'release', advanceRemote: true });
    runCli(repo.local, ['create', '-t', 'feat', '-n', 'first', '-y']);

    const run = runCli(path.join(repo.root, 'feat/first'), [
      'create',
      '-t',
      'feat',
      '-n',
      'second',
      '-y'
    ]);

    expect(run.output).toContain('Found main repository');
    expect(existsSync(path.join(repo.root, 'feat/second'))).toBe(true);
    expect(existsSync(path.join(repo.local, 'feat/second'))).toBe(false);
    expect(repo.tipOf('feat/second')).toBe(repo.remoteTip('release'));
  });

  it('copies .env from the main repository', () => {
    const repo = makeRepo({ primary: 'release' });
    writeFileSync(path.join(repo.local, '.env'), 'SECRET=abc123\n', 'utf8');

    const run = runCli(repo.local, ['create', '-t', 'feat', '-n', 'l', '-y']);

    expect(run.output).toContain('Copied .env');
    expect(readFileSync(path.join(repo.root, 'feat/l/.env'), 'utf8')).toBe('SECRET=abc123\n');
  });

  it('includes the Jira ticket in the branch and folder names', () => {
    const repo = makeRepo({ primary: 'release', advanceRemote: true });

    runCli(repo.local, ['create', '-t', 'feat', '-n', 'm', '-j', 'BZ-123', '-y']);

    const worktree = path.join(repo.root, 'feat/BZ-123-m');
    expect(gitIn(worktree, ['branch', '--show-current'])).toBe('feat/BZ-123-m');
    expect(repo.tipOf('feat/BZ-123-m')).toBe(repo.remoteTip('release'));
  });

  it('continues through the remaining steps when dependency install fails', () => {
    const repo = makeRepo({ primary: 'release' });
    writeFileSync(path.join(repo.seed, 'package.json'), '{"name":"x"}\n', 'utf8');
    writeFileSync(path.join(repo.seed, 'pnpm-lock.yaml'), 'lockfileVersion: 6.0\nNOT VALID: [\n', 'utf8');
    gitIn(repo.seed, ['add', '-A']);
    gitIn(repo.seed, ['commit', '--quiet', '-m', 'broken lockfile']);
    gitIn(repo.seed, ['push', '--quiet', 'origin', 'release']);

    const run = runCli(repo.local, ['create', '-t', 'feat', '-n', 'k', '-y']);

    expect(run.output).toContain('Installing dependencies');
    expect(run.output).toContain('Workspace created successfully');
    expect(existsSync(path.join(repo.root, 'feat/k'))).toBe(true);
  });
});
