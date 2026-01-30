/**
 * Check Commit Command
 * Verify claims from a git commit message
 */

import { spawn } from 'node:child_process';
import type { Command } from 'commander';
import { verifyClaim } from '../../core/analyzer/result-analyzer.js';
import { parseMultipleClaims } from '../../core/parser/claim-parser.js';
import { checkRipgrep } from '../../core/verifier/search-engine.js';
import type { OutputFormat, VerificationResult, VerifyOptions } from '../../types/index.js';
import { EXIT_CODES } from '../../types/index.js';
import { formatResult } from '../ui/reporter.js';
import { failSpinner, startSpinner, succeedSpinner, updateSpinner } from '../ui/spinner.js';

/**
 * Register the check-commit command
 */
export function registerCheckCommitCommand(program: Command): void {
  program
    .command('check-commit')
    .description('Verify claims from a git commit message')
    .argument('[commit]', 'Commit hash or reference (default: HEAD)', 'HEAD')
    .option('-f, --format <format>', 'Output format: pretty, json, summary', 'pretty')
    .option('-i, --include <patterns...>', 'Glob patterns to include')
    .option('-e, --exclude <patterns...>', 'Glob patterns to exclude')
    .option('-c, --case-sensitive', 'Case sensitive search', false)
    .option('-C, --context <lines>', 'Context lines around matches', '2')
    .option('--cwd <directory>', 'Working directory to search in', process.cwd())
    .action(async (commit: string, opts: Record<string, unknown>) => {
      const exitCode = await runCheckCommit(commit, {
        format: opts.format as OutputFormat,
        include: opts.include as string[] | undefined,
        exclude: opts.exclude as string[] | undefined,
        caseSensitive: opts.caseSensitive as boolean,
        contextLines: parseInt(opts.context as string, 10),
        cwd: opts.cwd as string,
      });

      process.exit(exitCode);
    });
}

/**
 * Get commit message from git
 */
async function getCommitMessage(commit: string, cwd: string): Promise<string | null> {
  return new Promise((resolve) => {
    const proc = spawn('git', ['log', '-1', '--format=%B', commit], { cwd });

    let stdout = '';

    proc.stdout.on('data', (data: Buffer) => {
      stdout += data.toString();
    });

    // Ignore stderr
    proc.stderr.on('data', () => {});

    proc.on('error', () => {
      resolve(null);
    });

    proc.on('close', (code) => {
      if (code === 0) {
        resolve(stdout.trim());
      } else {
        resolve(null);
      }
    });
  });
}

/**
 * Run the check-commit command
 */
export async function runCheckCommit(commit: string, options: VerifyOptions): Promise<number> {
  const { format } = options;
  const isPretty = format === 'pretty';
  const cwd = options.cwd || process.cwd();

  // Check ripgrep availability
  if (isPretty) {
    startSpinner('Checking ripgrep...');
  }

  const hasRipgrep = await checkRipgrep();
  if (!hasRipgrep) {
    if (isPretty) {
      failSpinner('ripgrep not found');
    }
    console.error(
      'Error: ripgrep (rg) is not installed. Please install it: https://github.com/BurntSushi/ripgrep#installation'
    );
    return EXIT_CODES.ERROR;
  }

  // Get commit message
  if (isPretty) {
    updateSpinner(`Getting commit message for ${commit}...`);
  }

  const commitMessage = await getCommitMessage(commit, cwd);
  if (!commitMessage) {
    if (isPretty) {
      failSpinner('Failed to get commit message');
    }
    console.error(`Error: Could not get commit message for "${commit}"`);
    return EXIT_CODES.ERROR;
  }

  // Parse claims from commit message
  if (isPretty) {
    updateSpinner('Parsing claims from commit message...');
  }

  const parseResults = parseMultipleClaims(commitMessage);
  if (parseResults.length === 0) {
    if (isPretty) {
      succeedSpinner('No verifiable claims found in commit message');
    }
    console.log('No verifiable claims found in commit message.');
    return EXIT_CODES.SUCCESS;
  }

  if (isPretty) {
    updateSpinner(`Found ${parseResults.length} claim(s) to verify...`);
  }

  // Verify each claim
  const results: VerificationResult[] = [];
  let allVerified = true;

  for (const parseResult of parseResults) {
    if (!parseResult.success || !parseResult.claim) continue;

    if (isPretty) {
      updateSpinner(`Verifying: ${parseResult.claim.action} "${parseResult.claim.oldValue}"...`);
    }

    const result = await verifyClaim(parseResult.claim, {
      cwd,
      caseSensitive: options.caseSensitive,
      includePatterns: options.include,
      excludePatterns: options.exclude,
      contextLines: options.contextLines,
    });

    results.push(result);

    if (!result.verified) {
      allVerified = false;
    }
  }

  if (isPretty) {
    if (allVerified) {
      succeedSpinner('All claims verified');
    } else {
      failSpinner('Some claims have discrepancies');
    }
  }

  // Output results
  for (const result of results) {
    console.log(formatResult(result, format));
  }

  return allVerified ? EXIT_CODES.SUCCESS : EXIT_CODES.DISCREPANCIES;
}
