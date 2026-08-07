import { describe, it, expect, afterAll, vi } from 'vitest';
import { writeFileSync, readFileSync } from 'fs';
import * as path from 'path';
import { EnvFileParser } from '../src/core/EnvFileParser.js';
import { EnvSyncer } from '../src/core/EnvSyncer.js';
import { EnvDiffer } from '../src/core/EnvDiffer.js';
import { SyncDecision } from '../src/types/index.js';
import { makeTempDir, cleanupFixtures } from './helpers/fixtures.js';

const dir = makeTempDir('wf-env-');
const parser = new EnvFileParser();

afterAll(cleanupFixtures);

let counter = 0;
function envFile(content: string): string {
  const file = path.join(dir, `env-${counter++}.env`);
  writeFileSync(file, content, 'utf8');
  return file;
}

/** Parse and re-render through the same path EnvSyncer.sync uses. */
function roundTrip(content: string): string {
  const parsed = parser.parseFile(envFile(content));
  return parser.stringify(parsed.variables, parsed.trailingTrivia);
}

function decision(over: Partial<SyncDecision> = {}): SyncDecision {
  return {
    addedKeys: new Set(),
    modifiedKeys: new Set(),
    removedKeys: new Set(),
    syncAll: false,
    ...over
  };
}

describe('inline comments', () => {
  it('keeps a "#" that is part of an unquoted value', () => {
    const vars = parser.parse(envFile('API_KEY=sk_live_51H8x#special\n'));
    expect(vars.get('API_KEY')?.value).toBe('sk_live_51H8x#special');
    expect(vars.get('API_KEY')?.comment).toBeUndefined();
  });

  it('still treats a whitespace-separated "#" as a comment', () => {
    const vars = parser.parse(envFile('FOO=bar # a real comment\n'));
    expect(vars.get('FOO')?.value).toBe('bar');
    expect(vars.get('FOO')?.comment).toBe('# a real comment');
  });

  it('keeps "//" inside a URL', () => {
    const vars = parser.parse(envFile('URL=http://example.com/path\n'));
    expect(vars.get('URL')?.value).toBe('http://example.com/path');
  });

  it('round-trips a hash-bearing value byte-identically', () => {
    const src = 'API_KEY=sk_live_51H8x#special\n';
    expect(roundTrip(src)).toBe(src);
  });
});

describe('escape sequences', () => {
  it('decodes a Windows path without inventing a newline', () => {
    const vars = parser.parse(envFile('WINPATH="C:\\\\Users\\\\name"\n'));
    expect(vars.get('WINPATH')?.value).toBe('C:\\Users\\name');
  });

  it('keeps a Windows path on one line after a rewrite', () => {
    const src = 'WINPATH="C:\\\\Users\\\\name"\n';
    const out = roundTrip(src);
    expect(out).toBe(src);
    expect(out.trim().split('\n')).toHaveLength(1);
  });

  it('still decodes \\n to a newline', () => {
    const vars = parser.parse(envFile('MULTI="a\\nb"\n'));
    expect(vars.get('MULTI')?.value).toBe('a\nb');
  });

  it('round-trips an escaped newline', () => {
    const src = 'MULTI="a\\nb"\n';
    expect(roundTrip(src)).toBe(src);
  });
});

describe('formatting fidelity', () => {
  it('preserves standalone comments, blank lines and trailing trivia', () => {
    const src =
      '# Database configuration\n' +
      'DATABASE_URL=postgres://localhost/db\n' +
      '\n' +
      '# API settings\n' +
      'API_KEY=abc\n' +
      'FOO=bar\n' +
      '\n' +
      '# trailing note\n';
    expect(roundTrip(src)).toBe(src);
  });

  it('normalises CRLF without leaking a carriage return into values', () => {
    const vars = parser.parse(envFile('KEY="line1\r\nline2"\r\nFOO=bar\r\n'));
    expect(vars.get('KEY')?.value).toBe('line1\nline2');
    expect(vars.get('KEY')?.value).not.toContain('\r');
  });
});

describe('duplicate keys', () => {
  it('keeps the last value and warns', () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => undefined);
    const vars = parser.parse(envFile('FOO=first\nBAR=x\nFOO=second\n'));
    const messages = warn.mock.calls.map(call => String(call[0]));
    warn.mockRestore();

    expect(vars.get('FOO')?.value).toBe('second');
    expect(messages.some(m => /duplicate/i.test(m) && m.includes('FOO'))).toBe(true);
  });
});

describe('EnvSyncer', () => {
  it('appends added variables instead of inserting them mid-file', async () => {
    const target = envFile('AAA=1\nBBB=2\nCCC=3\n');
    const source = envFile('ZZZ=new\nAAA=1\nBBB=2\nCCC=3\n');

    const diff = new EnvDiffer().compare(source, target);
    await new EnvSyncer().sync(source, target, diff, decision({ addedKeys: new Set(['ZZZ']) }));

    expect(readFileSync(target, 'utf8')).toBe('AAA=1\nBBB=2\nCCC=3\nZZZ=new\n');
  });

  it('leaves every unselected variable byte-identical', async () => {
    const original =
      '# Database configuration\n' +
      'DATABASE_URL=postgres://localhost/db\n' +
      '\n' +
      '# API settings\n' +
      'API_KEY=sk_live_51H8x#special\n' +
      'WINPATH="C:\\\\Users\\\\name"\n' +
      'FOO=bar\n';
    const target = envFile(original);
    const source = envFile('BAZ=qux\n');

    const diff = new EnvDiffer().compare(source, target);
    const result = await new EnvSyncer().sync(
      source,
      target,
      diff,
      decision({ addedKeys: new Set(['BAZ']) })
    );

    expect(result.success).toBe(true);
    expect(readFileSync(target, 'utf8')).toBe(original + 'BAZ=qux\n');
  });

  it('applies a modification while preserving surrounding formatting', async () => {
    const target = envFile('# keep me\nFOO=old\nBAR=untouched\n');
    const source = envFile('FOO=new\nBAR=untouched\n');

    const diff = new EnvDiffer().compare(source, target);
    const result = await new EnvSyncer().sync(
      source,
      target,
      diff,
      decision({ modifiedKeys: new Set(['FOO']) })
    );

    expect(result.success).toBe(true);
    const out = readFileSync(target, 'utf8');
    expect(out).toContain('# keep me');
    expect(out).toContain('FOO=new');
    expect(out).toContain('BAR=untouched');
  });

  it('refuses to write when an unselected variable would change', async () => {
    const target = envFile('SAFE=keep\nOTHER=x\n');
    const source = envFile('SAFE=keep\nOTHER=x\nNEW=1\n');
    const before = readFileSync(target, 'utf8');

    const diff = new EnvDiffer().compare(source, target);

    // Corrupt the merge by claiming an untouched key is unchanged while the
    // rendered output drops it — the guard must catch the drift.
    const syncer = new EnvSyncer();
    const merge = Reflect.get(syncer, 'mergeVariables') as unknown;
    Reflect.set(syncer, 'mergeVariables', function corruptedMerge(this: unknown) {
      const vars = (merge as (...a: unknown[]) => Map<string, unknown>).apply(this, arguments as never);
      vars.delete('OTHER');
      return vars;
    });

    const result = await syncer.sync(source, target, diff, decision({ addedKeys: new Set(['NEW']) }));

    expect(result.success).toBe(false);
    expect(result.error).toMatch(/Refusing to write/);
    expect(readFileSync(target, 'utf8')).toBe(before);
  });
});
