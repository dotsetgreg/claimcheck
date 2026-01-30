/**
 * Config loader - supports .claimcheckrc.json files
 */

import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import type { SearchOptions } from '../../types/index.js';

export interface ClaimCheckConfig {
  /** Default search options */
  search?: {
    caseSensitive?: boolean;
    contextLines?: number;
    codeOnly?: boolean;
    excludePatterns?: string[];
    includePatterns?: string[];
  };
  /** Patterns to always exclude */
  exclude?: string[];
  /** Watch mode defaults */
  watch?: {
    gitAware?: boolean;
    autoVerify?: boolean;
    format?: 'pretty' | 'json' | 'summary';
  };
  /** Custom claim patterns to recognize */
  customPatterns?: Array<{
    name: string;
    pattern: string;
    action: 'rename' | 'remove' | 'update' | 'add';
  }>;
}

const CONFIG_FILES = ['.claimcheckrc.json', '.claimcheckrc', 'claimcheck.config.json'];

/**
 * Find and load config file from cwd or parent directories
 */
export function loadConfig(cwd: string = process.cwd()): ClaimCheckConfig | null {
  let currentDir = cwd;

  // Walk up directory tree looking for config
  while (currentDir !== '/') {
    for (const configFile of CONFIG_FILES) {
      const configPath = join(currentDir, configFile);
      if (existsSync(configPath)) {
        try {
          const content = readFileSync(configPath, 'utf-8');
          const config = JSON.parse(content) as ClaimCheckConfig;
          return config;
        } catch (error) {
          console.warn(`Warning: Failed to parse ${configPath}: ${error}`);
        }
      }
    }

    // Move up one directory
    const parentDir = join(currentDir, '..');
    if (parentDir === currentDir) break;
    currentDir = parentDir;
  }

  return null;
}

/**
 * Merge config with CLI options (CLI options take precedence)
 */
export function mergeWithConfig(
  options: Partial<SearchOptions>,
  config: ClaimCheckConfig | null
): SearchOptions {
  if (!config?.search) {
    return options as SearchOptions;
  }

  return {
    caseSensitive: options.caseSensitive ?? config.search.caseSensitive ?? false,
    contextLines: options.contextLines ?? config.search.contextLines ?? 2,
    includePatterns: options.includePatterns ?? config.search.includePatterns,
    excludePatterns: options.excludePatterns ?? config.search.excludePatterns,
    respectGitignore: options.respectGitignore ?? true,
  };
}

/**
 * Get excluded patterns from config
 */
export function getExcludedPatterns(config: ClaimCheckConfig | null): string[] {
  return config?.exclude ?? [];
}
