import { execFileSync, spawnSync } from 'child_process';
import { mkdtempSync, mkdirSync, rmSync, writeFileSync } from 'fs';
import * as os from 'os';
import * as path from 'path';
import { fileURLToPath } from 'url';

const HERE = path.dirname(fileURLToPath(import.meta.url));

/** Repository root, derived from this file's location. */
export const REPO_ROOT = path.resolve(HERE, '..', '..');

/** The built CLI entry point. `pnpm test` builds before running. */
export const CLI = path.join(REPO_ROOT, 'dist', 'index.js');

const tempRoots: string[] = [];

/** Create a temp directory that `cleanupFixtures()` will remove. */
export function makeTempDir(prefix = 'wf-test-'): string {
  const dir = mkdtempSync(path.join(os.tmpdir(), prefix));
  tempRoots.push(dir);
  return dir;
}

/** Remove every temp directory created during the run. */
export function cleanupFixtures(): void {
  while (tempRoots.length > 0) {
    const dir = tempRoots.pop();
    if (dir) {
      rmSync(dir, { recursive: true, force: true });
    }
  }
}

function git(cwd: string, args: string[]): string {
  return execFileSync('git', args, {
    cwd,
    encoding: 'utf8',
    stdio: 'pipe',
    env: { ...process.env, GIT_CONFIG_GLOBAL: '/dev/null', GIT_CONFIG_SYSTEM: '/dev/null' }
  });
}

export type Fixture = {
  /** Directory holding remote.git, seed/, local/ and any created worktrees. */
  root: string;
  /** The bare repository standing in for the remote. */
  remote: string;
  /** A checkout used to push changes "from someone else". */
  seed: string;
  /** The clone under test. */
  local: string;
  /** Push a new commit to `branch` on the remote, leaving the clone stale. */
  advanceRemote(branch: string, message?: string): string;
  /** Short SHA of a ref on the remote. */
  remoteTip(branch: string): string;
  /** Short SHA of HEAD in a directory under the fixture root. */
  tipOf(relativePath: string): string | null;
};

export type FixtureOptions = {
  /** Primary branch name; also becomes the remote's HEAD. */
  primary?: string;
  /** Extra branches to create and push. */
  branches?: string[];
  /** Push a second commit so the clone's local branch starts out stale. */
  advanceRemote?: boolean;
};

/**
 * Build an isolated bare "remote" plus a clone of it.
 *
 * `.env` is gitignored, matching how real projects treat it — otherwise it
 * registers as an uncommitted change and blocks `close`.
 */
export function makeRepo(options: FixtureOptions = {}): Fixture {
  const { primary = 'release', branches = [], advanceRemote = false } = options;

  const root = makeTempDir();
  const remote = path.join(root, 'remote.git');
  const seed = path.join(root, 'seed');
  const local = path.join(root, 'local');

  mkdirSync(remote, { recursive: true });
  git(root, ['init', '--quiet', '--bare', remote]);

  mkdirSync(seed, { recursive: true });
  git(seed, ['init', '--quiet']);
  git(seed, ['config', 'user.email', 'test@example.com']);
  git(seed, ['config', 'user.name', 'Test']);
  git(seed, ['checkout', '--quiet', '-b', primary]);
  writeFileSync(path.join(seed, 'file.txt'), 'v1\n', 'utf8');
  writeFileSync(path.join(seed, '.gitignore'), '.env\n', 'utf8');
  git(seed, ['add', '-A']);
  git(seed, ['commit', '--quiet', '-m', 'c1: initial']);
  git(seed, ['remote', 'add', 'origin', remote]);
  git(seed, ['push', '--quiet', '-u', 'origin', primary]);

  for (const branch of branches) {
    git(seed, ['checkout', '--quiet', '-b', branch, primary]);
    writeFileSync(path.join(seed, 'branch-marker.txt'), `${branch}\n`, 'utf8');
    git(seed, ['add', '-A']);
    git(seed, ['commit', '--quiet', '-m', `commit on ${branch}`]);
    git(seed, ['push', '--quiet', 'origin', branch]);
  }

  git(seed, ['checkout', '--quiet', primary]);
  git(remote, ['symbolic-ref', 'HEAD', `refs/heads/${primary}`]);
  git(root, ['clone', '--quiet', remote, local]);

  const fixture: Fixture = {
    root,
    remote,
    seed,
    local,
    advanceRemote(branch, message = 'remote moved ahead') {
      git(seed, ['checkout', '--quiet', branch]);
      writeFileSync(path.join(seed, 'file.txt'), 'v2\n', 'utf8');
      git(seed, ['commit', '--quiet', '-am', message]);
      git(seed, ['push', '--quiet', 'origin', branch]);
      return fixture.remoteTip(branch);
    },
    remoteTip(branch) {
      return git(remote, ['rev-parse', '--short', branch]).trim();
    },
    tipOf(relativePath) {
      const target = path.join(root, relativePath);
      const result = spawnSync('git', ['rev-parse', '--short', 'HEAD'], {
        cwd: target,
        encoding: 'utf8',
        stdio: 'pipe'
      });
      return result.status === 0 ? result.stdout.trim() : null;
    }
  };

  if (advanceRemote) {
    fixture.advanceRemote(primary);
  }

  return fixture;
}

export type CliResult = {
  status: number;
  stdout: string;
  stderr: string;
  /** stdout and stderr combined, for message assertions. */
  output: string;
};

/** Run the built CLI in `cwd`. Never throws on a non-zero exit. */
export function runCli(cwd: string, args: string[]): CliResult {
  const result = spawnSync(process.execPath, [CLI, ...args], {
    cwd,
    encoding: 'utf8',
    stdio: 'pipe',
    env: { ...process.env, FORCE_COLOR: '0', GIT_TERMINAL_PROMPT: '0' }
  });

  const stdout = result.stdout ?? '';
  const stderr = result.stderr ?? '';

  return { status: result.status ?? 1, stdout, stderr, output: stdout + stderr };
}

/** Run a git command in a fixture directory, returning trimmed stdout. */
export function gitIn(cwd: string, args: string[]): string {
  const result = spawnSync('git', args, { cwd, encoding: 'utf8', stdio: 'pipe' });
  return (result.stdout ?? '').trim();
}

/** True when the branch exists locally in `cwd`. */
export function branchExists(cwd: string, branch: string): boolean {
  const result = spawnSync('git', ['show-ref', '--verify', '--quiet', `refs/heads/${branch}`], {
    cwd,
    stdio: 'pipe'
  });
  return result.status === 0;
}
