/**
 * Detect Claims Command
 * Parse text for verifiable claims
 */

import type { Command } from 'commander';
import { parseMultipleClaims, parseClaim } from '../../core/parser/claim-parser.js';
import type { OutputFormat, ParsedClaim } from '../../types/index.js';
import { EXIT_CODES } from '../../types/index.js';

export interface DetectClaimsOptions {
  format: OutputFormat;
}

interface DetectedClaimResult {
  text: string;
  claims: ParsedClaim[];
  count: number;
}

/**
 * Register the detect-claims command
 */
export function registerDetectClaimsCommand(program: Command): void {
  program
    .command('detect-claims')
    .description('Parse text for verifiable claims (supports stdin)')
    .argument('[text]', 'Text to parse for claims (or pipe via stdin)')
    .option('-f, --format <format>', 'Output format: pretty, json, summary', 'pretty')
    .action(async (text: string | undefined, opts: Record<string, unknown>) => {
      const exitCode = await runDetectClaims(text, {
        format: opts.format as OutputFormat,
      });

      process.exit(exitCode);
    });
}

/**
 * Run the detect-claims command
 */
export async function runDetectClaims(
  text: string | undefined,
  options: DetectClaimsOptions
): Promise<number> {
  // Get text from argument or stdin
  let inputText = text;

  if (!inputText) {
    // Check if stdin has data
    if (process.stdin.isTTY) {
      console.error('Error: No text provided. Pass text as argument or pipe via stdin.');
      console.error('Usage: claimcheck detect-claims "your text here"');
      console.error('   or: echo "your text" | claimcheck detect-claims');
      return EXIT_CODES.ERROR;
    }

    // Read from stdin
    inputText = await readStdin();
  }

  if (!inputText || !inputText.trim()) {
    console.error('Error: No text provided.');
    return EXIT_CODES.ERROR;
  }

  // Parse claims from the text
  const parseResults = parseMultipleClaims(inputText);

  // Also try parsing the whole thing as a single claim if no bullet points found
  if (parseResults.length === 0) {
    const singleResult = parseClaim(inputText);
    if (singleResult.success && singleResult.claim) {
      parseResults.push(singleResult);
    }
  }

  const claims = parseResults
    .filter((r) => r.success && r.claim)
    .map((r) => r.claim as ParsedClaim);

  const result: DetectedClaimResult = {
    text: inputText,
    claims,
    count: claims.length,
  };

  // Output results
  console.log(formatDetectedClaims(result, options.format));

  return claims.length > 0 ? EXIT_CODES.SUCCESS : EXIT_CODES.DISCREPANCIES;
}

/**
 * Read all input from stdin
 */
async function readStdin(): Promise<string> {
  return new Promise((resolve) => {
    let data = '';
    let resolved = false;

    const cleanup = () => {
      process.stdin.removeListener('readable', onReadable);
      process.stdin.removeListener('end', onEnd);
      process.stdin.removeListener('error', onError);
    };

    const doResolve = (value: string) => {
      if (!resolved) {
        resolved = true;
        cleanup();
        resolve(value);
      }
    };

    const onReadable = () => {
      let chunk;
      while ((chunk = process.stdin.read()) !== null) {
        data += chunk;
      }
    };

    const onEnd = () => {
      doResolve(data);
    };

    const onError = () => {
      doResolve(data);
    };

    process.stdin.setEncoding('utf8');
    process.stdin.on('readable', onReadable);
    process.stdin.on('end', onEnd);
    process.stdin.on('error', onError);

    // Resume stdin in case it's paused
    process.stdin.resume();

    // Set a timeout in case stdin never ends (e.g., empty pipe)
    // This is a fallback for edge cases
    setTimeout(() => {
      if (!resolved && !data) {
        doResolve('');
      }
    }, 100);
  });
}

/**
 * Format detected claims for output
 */
function formatDetectedClaims(result: DetectedClaimResult, format: OutputFormat): string {
  switch (format) {
    case 'json':
      return JSON.stringify(result, null, 2);
    case 'summary':
      return `Found ${result.count} verifiable claim(s)`;
    case 'pretty':
    default:
      return formatPretty(result);
  }
}

/**
 * Pretty format for detected claims
 */
function formatPretty(result: DetectedClaimResult): string {
  const lines: string[] = [];

  if (result.count === 0) {
    lines.push('No verifiable claims detected in the text.');
    lines.push('');
    lines.push('Tip: Claims should contain action words like:');
    lines.push('  - "renamed X to Y"');
    lines.push('  - "removed all X"');
    lines.push('  - "updated X to Y"');
    lines.push('  - "replaced X with Y"');
    return lines.join('\n');
  }

  lines.push(`Found ${result.count} verifiable claim(s):\n`);

  for (let i = 0; i < result.claims.length; i++) {
    const claim = result.claims[i];
    lines.push(`${i + 1}. ${formatClaim(claim)}`);
    lines.push(`   Raw: "${truncate(claim.raw, 60)}"`);
    lines.push('');
  }

  lines.push('Run verification with:');
  for (const claim of result.claims) {
    lines.push(`  claimcheck verify "${escapeSingleQuotes(claim.raw)}"`);
  }

  return lines.join('\n');
}

/**
 * Format a single claim
 */
function formatClaim(claim: ParsedClaim): string {
  switch (claim.action) {
    case 'rename':
      return `Rename "${claim.oldValue}" → "${claim.newValue}"`;
    case 'remove':
      return `Remove "${claim.oldValue}"`;
    case 'update':
      return `Update "${claim.oldValue}" → "${claim.newValue}"`;
    case 'add':
      return `Add "${claim.newValue || claim.oldValue}"`;
    default:
      return `${claim.action} "${claim.oldValue}"`;
  }
}

/**
 * Truncate string with ellipsis
 */
function truncate(str: string, maxLength: number): string {
  if (str.length <= maxLength) return str;
  return str.slice(0, maxLength - 3) + '...';
}

/**
 * Escape single quotes for shell
 */
function escapeSingleQuotes(str: string): string {
  return str.replace(/'/g, "'\\''");
}
