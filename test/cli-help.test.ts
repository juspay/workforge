import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { readFileSync } from 'fs';
import * as path from 'path';
import { REPO_ROOT, runCli, makeTempDir, cleanupFixtures } from './helpers/fixtures.js';

/**
 * `--help` shipped `https://github.com/yourusername/workforge` in
 * @juspay/workforge@1.0.0, and a hardcoded "v3.0" banner on a 1.0.0 package.
 * Both are user-facing strings in a published artifact, so they are asserted
 * against package.json rather than against a literal copy of the same text.
 */

let cwd: string;
let pkg: { version: string; homepage: string; bugs: { url: string } };

beforeAll(() => {
  cwd = makeTempDir('wf-help-');
  pkg = JSON.parse(readFileSync(path.join(REPO_ROOT, 'package.json'), 'utf8'));
});

afterAll(cleanupFixtures);

describe('workforge --help', () => {
  // Substring checks rather than regexes: an unanchored pattern over URL-ish
  // text is what CodeQL's js/regex/missing-regexp-anchor exists to catch, and
  // these are plain literals with nothing to match loosely.
  const PLACEHOLDERS = ['yourusername', 'example.com', 'your-org', 'TODO'];

  it('contains no placeholder URLs', () => {
    const result = runCli(cwd, ['--help']);
    const output = result.output.toLowerCase();

    expect(result.status).toBe(0);
    for (const placeholder of PLACEHOLDERS) {
      expect(output).not.toContain(placeholder.toLowerCase());
    }
  });

  it('reports the real package version rather than a hardcoded one', () => {
    const result = runCli(cwd, ['--help']);

    expect(result.output).toContain(`WorkForge v${pkg.version}`);
  });

  it('points at the repository recorded in package.json', () => {
    const result = runCli(cwd, ['--help']);

    expect(result.output).toContain(pkg.homepage);
    expect(result.output).toContain(pkg.bugs.url);
  });

  it('agrees with --version', () => {
    const result = runCli(cwd, ['--version']);

    expect(result.status).toBe(0);
    expect(result.stdout.trim()).toBe(pkg.version);
  });
});
