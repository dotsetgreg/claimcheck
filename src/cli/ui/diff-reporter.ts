/**
 * Diff Reporter
 * Formats diff verification results for output
 */

import chalk from 'chalk';
import type { OutputFormat } from '../../types/index.js';
import type { DiffVerificationResult, MissedFile } from '../../core/analyzer/diff-analyzer.js';

/**
 * Format a diff verification result for output
 */
export function formatDiffResult(result: DiffVerificationResult, format: OutputFormat): string {
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
function formatJson(result: DiffVerificationResult): string {
  return JSON.stringify(result, null, 2);
}

/**
 * Summary output format (brief, for CI)
 */
function formatSummary(result: DiffVerificationResult): string {
  const status = result.verified ? 'VERIFIED' : 'INCOMPLETE';
  const { filesMissed, filesModified, totalMatches } = result.summary;

  return `${status}: ${filesMissed} missed file(s), ${filesModified} modified file(s), ${totalMatches} total reference(s)`;
}

/**
 * Pretty terminal output with colors
 */
function formatPretty(result: DiffVerificationResult): string {
  const lines: string[] = [];

  // Header with claim info
  lines.push('');
  lines.push(formatClaimHeader(result));
  lines.push(chalk.dim('─'.repeat(70)));
  lines.push('');

  // Modified files section
  lines.push(chalk.bold('Modified Files') + chalk.dim(` (${result.modifiedFiles.length})`));
  if (result.modifiedFiles.length === 0) {
    lines.push(chalk.dim('   No files modified'));
  } else {
    for (const file of result.modifiedFiles.slice(0, 10)) {
      const statusIcon = getStatusIcon(file.status);
      lines.push(`   ${statusIcon} ${file.path}`);
    }
    if (result.modifiedFiles.length > 10) {
      lines.push(chalk.dim(`   ... and ${result.modifiedFiles.length - 10} more`));
    }
  }
  lines.push('');

  // Main result
  if (result.verified) {
    lines.push(
      chalk.green.bold('✓ VERIFIED') +
        ' - All files containing references were modified'
    );
  } else {
    lines.push(
      chalk.red.bold('✗ INCOMPLETE') +
        ` - Found ${result.missedFiles.length} file(s) with references that were NOT modified`
    );
    lines.push('');

    // Missed files section
    lines.push(chalk.bold.yellow('Missed Files (need attention):'));
    lines.push('');

    for (const missed of result.missedFiles) {
      lines.push(formatMissedFile(missed));
    }
  }

  // Divider
  lines.push(chalk.dim('─'.repeat(70)));
  lines.push('');

  // Summary
  lines.push(chalk.bold('Summary'));
  lines.push(`   Files modified:        ${result.summary.filesModified}`);
  lines.push(`   Files with references: ${result.summary.filesWithMatches}`);
  lines.push(`   Files missed:          ${chalk.yellow(String(result.summary.filesMissed))}`);
  lines.push(`   Total references:      ${result.summary.totalMatches}`);
  lines.push(`   Duration:              ${result.duration}ms`);

  // Tip for incomplete
  if (!result.verified) {
    lines.push('');
    lines.push(
      chalk.yellow('Tip: ') +
        'The files above contain references but were not modified in your changes.'
    );
  }

  lines.push('');

  return lines.join('\n');
}

/**
 * Format claim header
 */
function formatClaimHeader(result: DiffVerificationResult): string {
  const { claim } = result;

  let header = `   Claim: ${chalk.bold(claim.action)} `;

  if (claim.action === 'rename' || claim.action === 'update') {
    header += `"${chalk.yellow(claim.oldValue)}" → "${chalk.green(claim.newValue)}"`;
  } else {
    header += `"${chalk.yellow(claim.oldValue)}"`;
  }

  return header;
}

/**
 * Format a missed file entry
 */
function formatMissedFile(missed: MissedFile): string {
  const lines: string[] = [];

  lines.push(chalk.cyan(`   ${missed.file}`) + chalk.dim(` (${missed.references.length} reference(s))`));

  // Show first few references
  const refsToShow = missed.references.slice(0, 3);
  for (const ref of refsToShow) {
    const lineNum = chalk.dim(`:${ref.line}`);
    const content = highlightMatch(ref.content.trim(), ref.variant);
    lines.push(`   │ ${lineNum.padEnd(12)} ${content}`);
  }

  if (missed.references.length > 3) {
    lines.push(chalk.dim(`   │ ... and ${missed.references.length - 3} more reference(s)`));
  }

  // Suggestion
  lines.push(chalk.dim(`   └─ ${missed.suggestion}`));
  lines.push('');

  return lines.join('\n');
}

/**
 * Get status icon for file change type
 */
function getStatusIcon(status: string): string {
  switch (status) {
    case 'added':
      return chalk.green('+');
    case 'deleted':
      return chalk.red('-');
    case 'renamed':
      return chalk.blue('→');
    case 'modified':
    default:
      return chalk.yellow('~');
  }
}

/**
 * Highlight the matched term in content
 */
function highlightMatch(content: string, variant: string): string {
  const maxLength = 60;
  let display = content;

  if (display.length > maxLength) {
    // Try to center around the match
    const matchIndex = display.toLowerCase().indexOf(variant.toLowerCase());
    if (matchIndex > 0) {
      const start = Math.max(0, matchIndex - 20);
      const end = Math.min(display.length, matchIndex + variant.length + 40);
      display = (start > 0 ? '...' : '') + display.slice(start, end) + (end < content.length ? '...' : '');
    } else {
      display = display.slice(0, maxLength) + '...';
    }
  }

  const regex = new RegExp(`(${escapeRegex(variant)})`, 'gi');
  return display.replace(regex, chalk.bgRed.white('$1'));
}

/**
 * Escape special regex characters
 */
function escapeRegex(str: string): string {
  return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}
