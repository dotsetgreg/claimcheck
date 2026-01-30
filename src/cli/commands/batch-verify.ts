/**
 * Batch Verify Command
 * Verify multiple claims from a file or stdin
 */

import type { Command } from 'commander';
import { readFile } from 'node:fs/promises';
import { createInterface } from 'node:readline';
import chalk from 'chalk';
import { verifyClaim } from '../../core/analyzer/result-analyzer.js';
import { parseClaim } from '../../core/parser/claim-parser.js';
import { checkRipgrep } from '../../core/verifier/search-engine.js';
import type { OutputFormat } from '../../types/index.js';
import { EXIT_CODES } from '../../types/index.js';

export interface BatchOptions {
  file?: string;
  format: OutputFormat;
  caseSensitive: boolean;
  codeOnly: boolean;
  cwd: string;
  contextLines?: number;
}

interface BatchResult {
  claim: string;
  success: boolean;
  verified?: boolean;
  error?: string;
}

/**
 * Register the batch-verify command
 */
export function registerBatchVerifyCommand(program: Command): void {
  program
    .command('batch-verify')
    .description('Verify multiple claims from a file')
    .option('-f, --file <path>', 'File containing claims (one per line)')
    .option('--format <format>', 'Output format: pretty, json, summary', 'pretty')
    .option('-c, --case-sensitive', 'Case sensitive search', false)
    .option('--code-only', 'Only show matches in code', false)
    .option('--cwd <directory>', 'Working directory', process.cwd())
    .action(async (opts: Record<string, unknown>) => {
      const exitCode = await runBatchVerify({
        file: opts.file as string | undefined,
        format: opts.format as OutputFormat,
        caseSensitive: opts.caseSensitive as boolean,
        codeOnly: opts.codeOnly as boolean,
        cwd: opts.cwd as string,
      });

      process.exit(exitCode);
    });
}

/**
 * Run batch verification
 */
export async function runBatchVerify(options: BatchOptions): Promise<number> {
  const isPretty = options.format === 'pretty';

  // Check ripgrep
  const hasRipgrep = await checkRipgrep();
  if (!hasRipgrep) {
    console.error(
      'Error: ripgrep (rg) is not installed. Please install it: https://github.com/BurntSushi/ripgrep#installation'
    );
    return EXIT_CODES.ERROR;
  }

  // Get claims to verify
  const claims = await loadClaims(options.file);

  if (claims.length === 0) {
    console.error('Error: No claims to verify. Provide a file with --file or pipe claims via stdin.');
    return EXIT_CODES.ERROR;
  }

  if (isPretty) {
    console.log(chalk.bold('\n📋 Batch Claim Verification'));
    console.log(chalk.gray(`Found ${claims.length} claim(s) to verify\n`));
  }

  // Verify each claim
  const results: BatchResult[] = [];
  let verifiedCount = 0;
  let incompleteCount = 0;
  let errorCount = 0;

  let index = 0;
  for (const claimText of claims) {
    index++;
    
    if (isPretty) {
      console.log(chalk.gray(`[${index}/${claims.length}] ${claimText.slice(0, 60)}${claimText.length > 60 ? '...' : ''}`));
    }

    const parseResult = parseClaim(claimText);
    if (!parseResult.success || !parseResult.claim) {
      results.push({ claim: claimText, success: false, error: parseResult.error });
      errorCount++;
      continue;
    }

    try {
      const result = await verifyClaim(parseResult.claim, {
        cwd: options.cwd,
        caseSensitive: options.caseSensitive,
        detectContexts: true,
        minPriority: options.codeOnly ? 'high' : undefined,
      });

      results.push({
        claim: claimText,
        success: true,
        verified: result.verified,
      });

      if (result.verified) {
        verifiedCount++;
      } else {
        incompleteCount++;
      }

      // Show result
      if (isPretty) {
        const status = result.verified
          ? chalk.green('  ✓ VERIFIED')
          : chalk.red('  ✗ INCOMPLETE');
        console.log(status);

        if (!result.verified && result.remainingReferences.length > 0) {
          console.log(chalk.gray(`    Found ${result.remainingReferences.length} remaining reference(s)`));
        }
        console.log();
      }
    } catch (error) {
      results.push({
        claim: claimText,
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      });
      errorCount++;
    }
  }

  // Summary
  if (isPretty) {
    console.log(chalk.dim('─'.repeat(50)));
    console.log(chalk.bold('Summary'));
    console.log(`  Verified:   ${chalk.green(verifiedCount)}`);
    console.log(`  Incomplete: ${chalk.red(incompleteCount)}`);
    console.log(`  Errors:     ${chalk.yellow(errorCount)}`);
    console.log();
  } else if (options.format === 'json') {
    console.log(JSON.stringify({ results, summary: { verifiedCount, incompleteCount, errorCount } }, null, 2));
  } else {
    // summary format
    console.log(`VERIFIED: ${verifiedCount}, INCOMPLETE: ${incompleteCount}, ERRORS: ${errorCount}`);
  }

  // Return appropriate exit code
  if (errorCount > 0) return EXIT_CODES.ERROR;
  if (incompleteCount > 0) return EXIT_CODES.DISCREPANCIES;
  return EXIT_CODES.SUCCESS;
}

/**
 * Load claims from file or stdin
 */
async function loadClaims(filePath?: string): Promise<string[]> {
  const claims: string[] = [];

  if (filePath) {
    // Read from file
    const content = await readFile(filePath, 'utf-8');
    claims.push(...parseClaimFile(content));
  } else {
    // Read from stdin
    const rl = createInterface({
      input: process.stdin,
      crlfDelay: Infinity,
    });

    for await (const line of rl) {
      const trimmed = line.trim();
      if (trimmed && !trimmed.startsWith('#')) {
        claims.push(trimmed);
      }
    }
  }

  return claims;
}

/**
 * Parse claims from file content
 * Supports:
 * - One claim per line
 * - JSON array of strings
 * - Comments starting with #
 */
function parseClaimFile(content: string): string[] {
  const trimmed = content.trim();

  // Try JSON first
  if (trimmed.startsWith('[')) {
    try {
      const parsed = JSON.parse(trimmed) as string[];
      return parsed.filter((c) => typeof c === 'string' && c.trim());
    } catch {
      // Not valid JSON, fall through to line parsing
    }
  }

  // Parse as lines
  return content
    .split('\n')
    .map((line) => line.trim())
    .filter((line) => line && !line.startsWith('#'));
}
