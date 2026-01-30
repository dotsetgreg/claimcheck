/**
 * Verify Diff Command
 * Verify claims against actual git changes
 */

import type { Command } from 'commander';
import {
  verifyClaimAgainstDiff,
  type DiffSource,
} from '../../core/analyzer/diff-analyzer.js';
import { isGitRepo } from '../../core/git/index.js';
import { parseClaim } from '../../core/parser/claim-parser.js';
import { checkRipgrep } from '../../core/verifier/search-engine.js';
import type { OutputFormat } from '../../types/index.js';
import { EXIT_CODES } from '../../types/index.js';
import { failSpinner, startSpinner, succeedSpinner } from '../ui/spinner.js';
import { formatDiffResult } from '../ui/diff-reporter.js';

export interface VerifyDiffOptions {
  format: OutputFormat;
  source: DiffSource;
  commit?: string;
  include?: string[];
  exclude?: string[];
  caseSensitive: boolean;
  contextLines: number;
  cwd?: string;
}

/**
 * Register the verify-diff command
 */
export function registerVerifyDiffCommand(program: Command): void {
  program
    .command('verify-diff')
    .description('Verify a claim against actual git changes (smarter than plain search)')
    .argument('<claim>', 'The claim to verify (e.g., "I renamed UserService to AuthService")')
    .option('-f, --format <format>', 'Output format: pretty, json, summary', 'pretty')
    .option(
      '-s, --source <source>',
      'Diff source: staged, commit, working, all',
      'all'
    )
    .option('--commit <hash>', 'Commit hash (required if source is "commit")')
    .option('-i, --include <patterns...>', 'Glob patterns to include')
    .option('-e, --exclude <patterns...>', 'Glob patterns to exclude')
    .option('-c, --case-sensitive', 'Case sensitive search', false)
    .option('-C, --context <lines>', 'Context lines around matches', '2')
    .option('--cwd <directory>', 'Working directory to search in', process.cwd())
    .action(async (claim: string, opts: Record<string, unknown>) => {
      const exitCode = await runVerifyDiff(claim, {
        format: opts.format as OutputFormat,
        source: opts.source as DiffSource,
        commit: opts.commit as string | undefined,
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
 * Run the verify-diff command
 */
export async function runVerifyDiff(claimText: string, options: VerifyDiffOptions): Promise<number> {
  const { format, source, commit } = options;
  const isPretty = format === 'pretty';
  const cwd = options.cwd || process.cwd();

  // Validate source and commit combination
  if (source === 'commit' && !commit) {
    console.error('Error: --commit is required when using --source commit');
    return EXIT_CODES.ERROR;
  }

  // Check ripgrep availability
  if (isPretty) {
    startSpinner('Checking dependencies...');
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

  // Check if we're in a git repo
  const inGitRepo = await isGitRepo(cwd);
  if (!inGitRepo) {
    if (isPretty) {
      failSpinner('Not a git repository');
    }
    console.error('Error: Not a git repository. Use "verify" command for non-git directories.');
    return EXIT_CODES.ERROR;
  }

  // Parse the claim
  if (isPretty) {
    startSpinner('Parsing claim...');
  }

  const parseResult = parseClaim(claimText);
  if (!parseResult.success || !parseResult.claim) {
    if (isPretty) {
      failSpinner('Failed to parse claim');
    }
    console.error(`Error: ${parseResult.error}`);
    return EXIT_CODES.ERROR;
  }

  // Run verification
  if (isPretty) {
    startSpinner('Analyzing changes and verifying claim...');
  }

  try {
    const result = await verifyClaimAgainstDiff(parseResult.claim, {
      cwd,
      diffSource: source,
      commit,
      caseSensitive: options.caseSensitive,
      includePatterns: options.include,
      excludePatterns: options.exclude,
      contextLines: options.contextLines,
    });

    if (isPretty) {
      if (result.verified) {
        succeedSpinner('All files with references were modified');
      } else {
        failSpinner(`Found ${result.missedFiles.length} missed file(s)`);
      }
    }

    // Output results
    console.log(formatDiffResult(result, format));

    return result.verified ? EXIT_CODES.SUCCESS : EXIT_CODES.DISCREPANCIES;
  } catch (error) {
    if (isPretty) {
      failSpinner('Verification failed');
    }
    console.error(`Error: ${error instanceof Error ? error.message : 'Unknown error'}`);
    return EXIT_CODES.ERROR;
  }
}
