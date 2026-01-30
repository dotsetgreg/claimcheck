/**
 * Search Engine
 * Wrapper around ripgrep for fast codebase searching
 */

import { spawn } from 'node:child_process';
import type { Reference, SearchOptions } from '../../types/index.js';
import { DEFAULT_CONTEXT_LINES, DEFAULT_EXCLUDE_PATTERNS } from '../../utils/constants.js';

export interface SearchResult {
  success: boolean;
  references: Reference[];
  filesSearched: number;
  error?: string;
}

interface RipgrepMatch {
  type: 'match';
  data: {
    path: { text: string };
    lines: { text: string };
    line_number: number;
    absolute_offset: number;
    submatches: Array<{
      match: { text: string };
      start: number;
      end: number;
    }>;
  };
}

interface RipgrepSummary {
  type: 'summary';
  data: {
    stats: {
      searches_with_match: number;
      bytes_searched: number;
      matched_lines: number;
    };
  };
}

type RipgrepOutput = RipgrepMatch | RipgrepSummary | { type: string };

/**
 * Check if ripgrep is available
 */
export async function checkRipgrep(): Promise<boolean> {
  return new Promise((resolve) => {
    const proc = spawn('rg', ['--version']);
    proc.on('error', () => resolve(false));
    proc.on('close', (code) => resolve(code === 0));
  });
}

/**
 * Search for a pattern using ripgrep
 */
export async function search(
  pattern: string,
  cwd: string,
  options: SearchOptions = {}
): Promise<SearchResult> {
  const {
    caseSensitive = false,
    includePatterns = [],
    excludePatterns = [],
    contextLines = DEFAULT_CONTEXT_LINES,
    respectGitignore = true,
  } = options;

  // Build ripgrep arguments
  const args: string[] = [
    '--json', // JSON output for parsing
    '--line-number', // Include line numbers
    '--column', // Include column numbers
    '-C',
    String(contextLines), // Context lines
  ];

  // Case sensitivity
  if (!caseSensitive) {
    args.push('-i');
  }

  // Gitignore handling
  if (!respectGitignore) {
    args.push('--no-ignore');
  }

  // Include patterns (globs)
  for (const glob of includePatterns) {
    args.push('--glob', glob);
  }

  // Exclude patterns
  const allExcludes = [...DEFAULT_EXCLUDE_PATTERNS, ...excludePatterns];
  for (const exclude of allExcludes) {
    args.push('--glob', `!${exclude}`);
  }

  // Add the search pattern
  args.push('--', pattern);

  // Add the search path
  args.push('.');

  return new Promise((resolve) => {
    const proc = spawn('rg', args, { cwd });

    let stdout = '';
    let stderr = '';

    proc.stdout.on('data', (data) => {
      stdout += data.toString();
    });

    proc.stderr.on('data', (data) => {
      stderr += data.toString();
    });

    proc.on('error', (err) => {
      if ((err as NodeJS.ErrnoException).code === 'ENOENT') {
        resolve({
          success: false,
          references: [],
          filesSearched: 0,
          error:
            'ripgrep (rg) not found. Please install it: https://github.com/BurntSushi/ripgrep#installation',
        });
      } else {
        resolve({
          success: false,
          references: [],
          filesSearched: 0,
          error: `Search failed: ${err.message}`,
        });
      }
    });

    proc.on('close', (code) => {
      // ripgrep returns 1 when no matches found, 0 when matches found, 2+ for errors
      if (code !== null && code >= 2) {
        resolve({
          success: false,
          references: [],
          filesSearched: 0,
          error: stderr || 'Search failed with unknown error',
        });
        return;
      }

      try {
        const { references, filesSearched } = parseRipgrepOutput(stdout, pattern);
        resolve({
          success: true,
          references,
          filesSearched,
        });
      } catch (parseError) {
        resolve({
          success: false,
          references: [],
          filesSearched: 0,
          error: `Failed to parse search results: ${parseError}`,
        });
      }
    });
  });
}

/**
 * Parse ripgrep JSON output into references
 */
function parseRipgrepOutput(
  output: string,
  variant: string
): { references: Reference[]; filesSearched: number } {
  const references: Reference[] = [];
  const filesWithMatches = new Set<string>();
  let filesSearched = 0;

  const lines = output.trim().split('\n').filter(Boolean);

  // Collect context lines for each match
  const contextMap = new Map<string, string[]>();

  for (const line of lines) {
    try {
      const parsed: RipgrepOutput = JSON.parse(line);

      if (parsed.type === 'match') {
        const match = parsed as RipgrepMatch;
        const file = match.data.path.text;
        const lineNum = match.data.line_number;
        const content = match.data.lines.text.replace(/\n$/, '');

        filesWithMatches.add(file);

        // Get column from first submatch
        const column = match.data.submatches[0]?.start ?? 0;

        // Key for context grouping
        const contextKey = `${file}:${lineNum}`;

        references.push({
          file,
          line: lineNum,
          column: column + 1, // 1-indexed
          content,
          context: contextMap.get(contextKey) || [],
          variant,
        });
      } else if (parsed.type === 'summary') {
        const summary = parsed as RipgrepSummary;
        filesSearched = summary.data.stats.searches_with_match;
      } else if (parsed.type === 'context') {
        // Context lines can be collected if needed
        // For now, we include them in the match line
      }
    } catch {
      // Skip malformed JSON lines
    }
  }

  return {
    references,
    filesSearched: filesWithMatches.size || filesSearched,
  };
}

/**
 * Search for multiple patterns and aggregate results
 */
export async function searchMultiple(
  patterns: string[],
  cwd: string,
  options: SearchOptions = {}
): Promise<{ results: Map<string, SearchResult>; totalFilesSearched: number }> {
  const results = new Map<string, SearchResult>();
  const allFiles = new Set<string>();

  // Run searches in parallel for better performance
  const searches = patterns.map(async (pattern) => {
    const result = await search(pattern, cwd, options);
    results.set(pattern, result);

    if (result.success) {
      for (const ref of result.references) {
        allFiles.add(ref.file);
      }
    }

    return result;
  });

  await Promise.all(searches);

  return {
    results,
    totalFilesSearched: allFiles.size,
  };
}
