import { defineConfig } from 'tsdown';

export default defineConfig({
  entry: ['src/index.ts', 'src/keeper.ts', 'src/mcp.ts'],
  format: ['esm'],
  dts: true,
  clean: true,
  fixedExtension: false,
});
