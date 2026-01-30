/**
 * ClaimCheck Constants
 */

// File patterns for different presets
export const FILE_TYPE_PATTERNS: Record<string, string[]> = {
  code: [
    '*.ts',
    '*.tsx',
    '*.js',
    '*.jsx',
    '*.mjs',
    '*.cjs',
    '*.py',
    '*.rb',
    '*.go',
    '*.rs',
    '*.java',
    '*.kt',
    '*.swift',
    '*.c',
    '*.cpp',
    '*.h',
    '*.hpp',
    '*.cs',
    '*.php',
    '*.vue',
    '*.svelte',
  ],
  docs: ['*.md', '*.mdx', '*.txt', '*.rst', '*.adoc'],
  tests: ['*.test.ts', '*.spec.ts', '*.test.js', '*.spec.js', '*_test.go', '*_test.py'],
  config: [
    '*.json',
    '*.yaml',
    '*.yml',
    '*.toml',
    '*.ini',
    '*.env',
    '*.config.js',
    '*.config.ts',
  ],
};

// Default exclude patterns (always excluded unless overridden)
export const DEFAULT_EXCLUDE_PATTERNS = [
  'node_modules',
  '.git',
  'dist',
  'build',
  'coverage',
  '.next',
  '.nuxt',
  '__pycache__',
  '.pytest_cache',
  'target',
  'vendor',
];

// Default context lines for search results
export const DEFAULT_CONTEXT_LINES = 2;
