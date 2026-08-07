import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    include: ['test/**/*.test.ts'],
    // Each command test drives real `git` against a temp repository, so the
    // suite is I/O bound rather than CPU bound.
    testTimeout: 120_000,
    hookTimeout: 60_000,
    // Fixtures share ~/.workforge state (backups, audit logs), so files must
    // not run concurrently.
    fileParallelism: false
  }
});
