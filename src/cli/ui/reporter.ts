/**
 * Reporter
 * Formats verification results for output
 */

import chalk from 'chalk';
import type { OutputFormat, Reference, VerificationResult } from '../../types/index.js';

/**
 * Format a verification result for output
 */
export function formatResult(result: VerificationResult, format: OutputFormat): string {
  switch (format) {
    case 'json':
      return formatJson(result);
    case 'summary':
      return formatSummary(result);
    case 'pretty':
    default:
      return formatPretty(result);
  }
}

/**
 * JSON output format
 */
function formatJson(result: VerificationResult): string {
  return JSON.stringify(result, null, 2);
}

/**
 * Summary output format (brief, for CI)
 */
function formatSummary(result: VerificationResult): string {
  const status = result.verified ? 'VERIFIED' : 'INCOMPLETE';
  const matches = result.summary.totalMatches;
  const files = result.summary.filesWithMatches;

  return `${status}: ${matches} remaining reference(s) in ${files} file(s)`;
}

/**
 * Pretty terminal output with colors
 */
function formatPretty(result: VerificationResult): string {
  const lines: string[] = [];

  // Header with claim info
  lines.push('');
  lines.push(formatClaimHeader(result));
  lines.push(chalk.dim('─'.repeat(60)));
  lines.push('');

  if (result.verified) {
    lines.push(chalk.green.bold('✓ VERIFIED') + ' - No remaining references found');
  } else {
    lines.push(
      chalk.red.bold('✗ INCOMPLETE') +
        ` - Found ${result.summary.totalMatches} remaining reference(s)`
    );
    lines.push('');

    // Group references by file
    const byFile = groupByFile(result.remainingReferences);

    for (const [file, refs] of byFile) {
      lines.push(chalk.cyan.bold(`   ${file}`));

      for (const ref of refs) {
        lines.push(formatReference(ref));
      }

      lines.push('');
    }
  }

  // Divider
  lines.push(chalk.dim('─'.repeat(60)));
  lines.push('');

  // Summary
  lines.push(chalk.bold('Summary'));
  lines.push(`   Files with matches: ${result.summary.filesWithMatches}`);
  lines.push(`   Total matches: ${result.summary.totalMatches}`);
  lines.push(`   Duration: ${result.duration}ms`);

  // Tip for incomplete
  if (!result.verified) {
    lines.push('');
    lines.push(chalk.yellow('Tip: Run the refactor again or manually update these files.'));
  }

  lines.push('');

  return lines.join('\n');
}

/**
 * Format claim header
 */
function formatClaimHeader(result: VerificationResult): string {
  const { claim } = result;
  const variantsSearched = result.variants.map((v) => v.variant).join(', ');

  let header = `   Claim: ${chalk.bold(claim.action)} `;

  if (claim.action === 'rename' || claim.action === 'update') {
    header += `"${chalk.yellow(claim.oldValue)}" → "${chalk.green(claim.newValue)}"`;
  } else {
    header += `"${chalk.yellow(claim.oldValue)}"`;
  }

  header += `\n   Searching for: ${chalk.dim(variantsSearched)}`;

  return header;
}

/**
 * Format a single reference
 */
function formatReference(ref: Reference): string {
  const lineNum = chalk.dim(`:${ref.line}`);
  const content = highlightMatch(ref.content, ref.variant);

  return `   │ ${lineNum.padEnd(10)} ${content}`;
}

/**
 * Highlight the matched term in content
 */
function highlightMatch(content: string, variant: string): string {
  const trimmed = content.trim();
  const regex = new RegExp(`(${escapeRegex(variant)})`, 'gi');
  return trimmed.replace(regex, chalk.bgRed.white('$1'));
}

/**
 * Escape special regex characters
 */
function escapeRegex(str: string): string {
  return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/**
 * Group references by file
 */
function groupByFile(refs: Reference[]): Map<string, Reference[]> {
  const grouped = new Map<string, Reference[]>();

  for (const ref of refs) {
    const existing = grouped.get(ref.file) || [];
    existing.push(ref);
    grouped.set(ref.file, existing);
  }

  return grouped;
}
