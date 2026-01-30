import { defineConfig } from 'tsup';

export default defineConfig([
  // Main library
  {
    entry: { index: 'src/index.ts' },
    format: ['esm'],
    dts: true,
    sourcemap: true,
    clean: true,
    target: 'node20',
  },
  // CLI binary
  {
    entry: { 'cli/index': 'src/cli/index.ts' },
    format: ['esm'],
    sourcemap: true,
    target: 'node20',
    banner: {
      js: '#!/usr/bin/env node',
    },
  },
  // MCP server binary
  {
    entry: { 'mcp/server': 'src/mcp/server.ts' },
    format: ['esm'],
    sourcemap: true,
    target: 'node20',
    banner: {
      js: '#!/usr/bin/env node',
    },
  },
]);
