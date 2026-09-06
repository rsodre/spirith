import { defineConfig } from 'tsdown';

export default defineConfig({
  entry: ['src/index.ts'],
  format: ['esm'],
  dts: true,
  clean: true,
  // Plain .js / .d.ts output (the package is ESM-only via "type": "module").
  fixedExtension: false,
});
