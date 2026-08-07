import { spawnSync } from 'child_process';
import { BranchStartPoint, PrimaryBranchDetection } from '../types/index.js';

/**
 * Candidate primary branch names, in probe order.
 *
 * `release` is included because several repositories (e.g. juspay/neurolink)
 * use it as their primary branch and would otherwise never be auto-detected.
 */
const PRIMARY_BRANCH_CANDIDATES = [
  'main',
  'master',
  'release',
  'develop',
  'trunk',
  'beta',
  'dev',
  'stable'
];

/** Network-bound git calls are capped so a dead remote cannot hang the CLI. */
const NETWORK_TIMEOUT_MS = 20_000;

/**
 * Branch Resolver
 *
 * Resolves the remote, the repository's primary branch, and the commit a new
 * worktree should fork from.
 *
 * Every method here treats the remote as the source of truth and the local
 * branch as a possibly-stale cache: `git fetch` only advances
 * `refs/remotes/<remote>/*`, never `refs/heads/*`, so branching off a local
 * branch name forks from whatever commit that branch happened to be left at.
 */
export class BranchResolver {
  private readonly repoRoot: string;

  constructor(repoRoot: string) {
    this.repoRoot = repoRoot;
  }

  /**
   * Name of the remote to treat as authoritative.
   * Prefers `origin`, otherwise the first configured remote.
   */
  getRemoteName(): string | null {
    const remotes = this.git(['remote']);
    if (!remotes) {
      return null;
    }

    const names = remotes
      .split('\n')
      .map(line => line.trim())
      .filter(line => line.length > 0);

    if (names.length === 0) {
      return null;
    }

    return names.includes('origin') ? 'origin' : names[0];
  }

  /**
   * Update remote-tracking refs. Best effort: an offline machine or an
   * unreachable host must not block worktree creation.
   */
  fetch(remote: string): { ok: boolean; error?: string } {
    const result = spawnSync('git', ['fetch', remote, '--prune'], {
      cwd: this.repoRoot,
      stdio: 'pipe',
      encoding: 'utf8',
      timeout: NETWORK_TIMEOUT_MS
    });

    if (result.status === 0) {
      return { ok: true };
    }

    const error = (result.stderr || result.error?.message || 'unknown error')
      .trim()
      .split('\n')
      .filter(Boolean)
      .pop();

    return { ok: false, error };
  }

  /**
   * Re-read the remote's HEAD and update the local cache.
   *
   * `git fetch` never updates `refs/remotes/<remote>/HEAD`, so a repository
   * cloned before the remote renamed its default branch keeps pointing at the
   * retired branch forever. Called after a successful fetch, when the network
   * is known to be reachable.
   */
  refreshRemoteHead(remote: string): string | null {
    const branch = this.queryRemoteHead(remote);
    if (!branch) {
      return null;
    }

    this.cacheRemoteHead(remote, branch);
    return branch;
  }

  /**
   * Determine the repository's primary branch.
   *
   * Probes in order of decreasing confidence, falling through on every
   * failure so that a repository without a remote still resolves to something
   * usable.
   */
  detectPrimaryBranch(remote: string | null): PrimaryBranchDetection | null {
    if (remote) {
      // 1. Cached remote HEAD — instant, offline, and normally correct.
      const cachedHead = this.git(['symbolic-ref', '--short', `refs/remotes/${remote}/HEAD`]);
      if (cachedHead) {
        const branch = this.stripRemotePrefix(cachedHead, remote);
        if (branch) {
          return { branch, source: `${remote}/HEAD` };
        }
      }

      // 2. Ask the remote directly, then cache the answer for next time.
      const symrefBranch = this.queryRemoteHead(remote);
      if (symrefBranch) {
        this.cacheRemoteHead(remote, symrefBranch);
        return { branch: symrefBranch, source: `${remote} (queried)` };
      }

      // 3. Probe well-known names against remote-tracking refs.
      for (const candidate of PRIMARY_BRANCH_CANDIDATES) {
        if (this.remoteBranchExists(remote, candidate)) {
          return { branch: candidate, source: `${remote}/${candidate}` };
        }
      }
    }

    // 4. Probe well-known names against local branches.
    for (const candidate of PRIMARY_BRANCH_CANDIDATES) {
      if (this.localBranchExists(candidate)) {
        return { branch: candidate, source: 'local branch' };
      }
    }

    // 5. Whatever the main repository currently has checked out.
    const current = this.git(['branch', '--show-current']);
    if (current) {
      return { branch: current, source: 'current branch' };
    }

    return null;
  }

  /**
   * Resolve the commit a new branch should fork from.
   *
   * A base that exists on the remote always resolves to `<remote>/<base>` so
   * the worktree starts at the remote tip rather than the local branch tip.
   */
  resolveStartPoint(base: string, remote: string | null): BranchStartPoint {
    // Already qualified as `<remote>/<branch>` — honour it verbatim.
    if (remote && base.startsWith(`${remote}/`)) {
      const branch = this.stripRemotePrefix(base, remote);
      if (branch && this.remoteBranchExists(remote, branch)) {
        return { base: branch, startPoint: base, source: 'remote', isStale: false };
      }
    }

    if (remote && this.remoteBranchExists(remote, base)) {
      return {
        base,
        startPoint: `${remote}/${base}`,
        source: 'remote',
        isStale: false
      };
    }

    if (this.localBranchExists(base)) {
      return {
        base,
        startPoint: base,
        source: 'local',
        isStale: remote !== null
      };
    }

    // Last resort: a tag or commit-ish the user passed deliberately.
    if (this.isValidCommittish(base)) {
      return { base, startPoint: base, source: 'committish', isStale: false };
    }

    return { base, startPoint: null, source: 'missing', isStale: false };
  }

  /** Local branches, for error messages. */
  listLocalBranches(): string[] {
    return this.splitLines(this.git(['branch', '--format=%(refname:short)']));
  }

  /** Remote-tracking branches for `remote`, for error messages. */
  listRemoteBranches(remote: string): string[] {
    return this.splitLines(
      this.git(['branch', '--remotes', '--format=%(refname:short)'])
    )
      .filter(name => name.startsWith(`${remote}/`))
      .filter(name => !name.includes('HEAD'))
      .map(name => name.slice(remote.length + 1));
  }

  localBranchExists(branch: string): boolean {
    return this.gitSucceeds(['show-ref', '--verify', '--quiet', `refs/heads/${branch}`]);
  }

  remoteBranchExists(remote: string, branch: string): boolean {
    return this.gitSucceeds([
      'show-ref',
      '--verify',
      '--quiet',
      `refs/remotes/${remote}/${branch}`
    ]);
  }

  /** Resolve a start point to a short commit hash, for reporting. */
  describeCommit(revision: string): string | null {
    return this.git(['rev-parse', '--short', revision]);
  }

  /**
   * Ask the remote which branch its HEAD points at.
   * Requires network access; returns null when unavailable.
   */
  private queryRemoteHead(remote: string): string | null {
    const result = spawnSync('git', ['ls-remote', '--symref', remote, 'HEAD'], {
      cwd: this.repoRoot,
      stdio: 'pipe',
      encoding: 'utf8',
      timeout: NETWORK_TIMEOUT_MS
    });

    if (result.status !== 0 || !result.stdout) {
      return null;
    }

    const match = result.stdout.match(/^ref:\s+refs\/heads\/(\S+)\s+HEAD$/m);
    return match ? match[1] : null;
  }

  /**
   * Persist the remote's HEAD locally so subsequent runs skip the network hop.
   * Purely an optimisation — failure is ignored.
   */
  private cacheRemoteHead(remote: string, branch: string): void {
    if (!this.remoteBranchExists(remote, branch)) {
      return;
    }

    this.gitSucceeds([
      'symbolic-ref',
      `refs/remotes/${remote}/HEAD`,
      `refs/remotes/${remote}/${branch}`
    ]);
  }

  private isValidCommittish(revision: string): boolean {
    return this.gitSucceeds(['rev-parse', '--verify', '--quiet', `${revision}^{commit}`]);
  }

  private stripRemotePrefix(ref: string, remote: string): string | null {
    const prefix = `${remote}/`;
    if (!ref.startsWith(prefix)) {
      return null;
    }

    const branch = ref.slice(prefix.length);
    return branch.length > 0 ? branch : null;
  }

  private splitLines(value: string | null): string[] {
    if (!value) {
      return [];
    }

    return value
      .split('\n')
      .map(line => line.trim())
      .filter(line => line.length > 0);
  }

  private git(args: string[]): string | null {
    const result = spawnSync('git', args, {
      cwd: this.repoRoot,
      stdio: 'pipe',
      encoding: 'utf8'
    });

    if (result.status !== 0 || !result.stdout) {
      return null;
    }

    const output = result.stdout.trim();
    return output.length > 0 ? output : null;
  }

  private gitSucceeds(args: string[]): boolean {
    const result = spawnSync('git', args, {
      cwd: this.repoRoot,
      stdio: 'pipe',
      encoding: 'utf8'
    });

    return result.status === 0;
  }
}
