import { defineConfig } from 'vitest/config';
import path from 'path';

export default defineConfig({
  test: {
    globals: true,
    environment: 'node',
    setupFiles: ['./tests/setup.ts'],
    // Worker threads rather than forked processes. On Windows, `spawn` can fail
    // with EPERM (commonly an antivirus blocking process creation); the forks
    // pool then drops whole test files and still reports a green run with a
    // lower count, which is worse than failing. These tests need no process
    // isolation, so threads cost nothing.
    pool: 'threads',
  },
  resolve: {
    alias: {
      '@': path.resolve(__dirname, '.'),
    },
  },
});
