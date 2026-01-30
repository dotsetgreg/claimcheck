/**
 * Verify Command
 * Main command for verifying AI claims
 */

import type { Command } from 'commander';
import { verifyClaim } from '../../core/analyzer/result-analyzer.js';
import { parseClaim } from '../../core/parser/claim-parser.js';
import { checkRipgrep } from '../../core/verifier/search-engine.js';
import type { OutputFormat, VerifyOptions } from '../../types/index.js';
import { EXIT_CODES } from '../../types/index.js';
import { formatResult } from '../ui/reporter.js';
import { failSpinner, startSpinner, succeedSpinner } from '../ui/spinner.js';

/**
 * Register the verify command
 */
export function registerVerifyCommand(program: Command): void {
  program
    .command('verify')
    .description('Verify an AI claim about code changes')
    .argument('<claim>', 'The claim to verify (e.g., "I renamed UserService to AuthService")')
    .option('-f, --format <format>', 'Output format: pretty, json, summary', 'pretty')
    .option('-i, --include <patterns...>', 'Glob patterns to include')
    .option('-e, --exclude <patterns...>', 'Glob patterns to exclude')
    .option('-c, --case-sensitive', 'Case sensitive search', false)
    .option('-C, --context <lines>', 'Context lines around matches', '2')
    .option('--cwd <directory>', 'Working directory to search in', process.cwd())
    .action(async (claim: string, opts: Record<string, unknown>) => {
      const exitCode = await runVerify(claim, {
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
 * Run the verify command
 */
export async function runVerify(claimText: string, options: VerifyOptions): Promise<number> {
  const { format } = options;
  const isPretty = format === 'pretty';

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
    startSpinner('Verifying claim...');
  }

  try {
    const result = await verifyClaim(parseResult.claim, {
      cwd: options.cwd || process.cwd(),
      caseSensitive: options.caseSensitive,
      includePatterns: options.include,
      excludePatterns: options.exclude,
      contextLines: options.contextLines,
    });

    if (isPretty) {
      if (result.verified) {
        succeedSpinner('Claim verified');
      } else {
        failSpinner('Found discrepancies');
      }
    }

    // Output results
    console.log(formatResult(result, format));

    return result.verified ? EXIT_CODES.SUCCESS : EXIT_CODES.DISCREPANCIES;
  } catch (error) {
    if (isPretty) {
      failSpinner('Verification failed');
    }
    console.error(`Error: ${error instanceof Error ? error.message : 'Unknown error'}`);
    return EXIT_CODES.ERROR;
  }
}
