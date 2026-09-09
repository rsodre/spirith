import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    include: ['test/**/*.test.ts'],
  },
  resolve: {
    alias: [
      {
        find: /^@spirith\/core$/,
        replacement: new URL('../core/src/index.ts', import.meta.url).pathname,
      },
    ],
  },
});
