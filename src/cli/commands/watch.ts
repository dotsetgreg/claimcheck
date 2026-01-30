/**
 * Watch Command
 * Monitor session logs for claims and auto-verify
 */

import type { Command } from 'commander';
import chalk from 'chalk';
import { homedir } from 'node:os';
import { existsSync } from 'node:fs';
import { readdir, stat } from 'node:fs/promises';
import { join, resolve } from 'node:path';
import { WatchSession, type DetectedClaim } from '../../core/watcher/watch-session.js';
import { EXIT_CODES } from '../../types/index.js';
import { formatResult } from '../ui/reporter.js';
import { formatDiffResult } from '../ui/diff-reporter.js';
import type { DiffVerificationResult } from '../../core/analyzer/diff-analyzer.js';
import type { VerificationResult } from '../../types/index.js';

export interface WatchOptions {
  cwd: string;
  gitAware: boolean;
  codeOnly: boolean;
  autoVerify: boolean;
  format: 'pretty' | 'json' | 'summary';
  session?: string;
}

/**
 * Register the watch command
 */
export function registerWatchCommand(program: Command): void {
  program
    .command('watch')
    .description('Monitor a session log for claims and auto-verify (Ctrl+C to stop)')
    .argument('[file]', 'Session log file to watch (defaults to latest Claude Code session)')
    .option('--cwd <directory>', 'Working directory for verification', process.cwd())
    .option('-g, --git-aware', 'Use git-aware verification (find missed files)', false)
    .option('--code-only', 'Only report matches in actual code', true)
    .option('--no-code-only', 'Include matches in comments and strings')
    .option('--no-auto-verify', 'Only detect claims, don\'t verify')
    .option('-f, --format <format>', 'Output format: pretty, json, summary', 'pretty')
    .option('-s, --session <id>', 'Claude Code session ID to watch')
    .action(async (file: string | undefined, opts: Record<string, unknown>) => {
      const exitCode = await runWatch(file, {
        cwd: opts.cwd as string,
        gitAware: opts.gitAware as boolean,
        codeOnly: opts.codeOnly as boolean,
        autoVerify: opts.autoVerify as boolean,
        format: opts.format as 'pretty' | 'json' | 'summary',
        session: opts.session as string | undefined,
      });

      process.exit(exitCode);
    });
}

/**
 * Run the watch command
 */
export async function runWatch(file: string | undefined, options: WatchOptions): Promise<number> {
  const isPretty = options.format === 'pretty';

  // Resolve the file to watch
  let filePath: string;

  if (file) {
    filePath = resolve(file);
  } else if (options.session) {
    const sessionPath = await findSessionFile(options.session);
    if (!sessionPath) {
      console.error(`Error: Could not find session "${options.session}"`);
      return EXIT_CODES.ERROR;
    }
    filePath = sessionPath;
  } else {
    // Try to find the latest Claude Code session
    const latestSession = await findLatestSession();
    if (!latestSession) {
      console.error('Error: No Claude Code session found.');
      console.error('Specify a file path or use --session <id>');
      console.error('');
      console.error('Claude Code sessions are stored in: ~/.claude/projects/');
      return EXIT_CODES.ERROR;
    }
    filePath = latestSession;
  }

  if (!existsSync(filePath)) {
    console.error(`Error: File not found: ${filePath}`);
    return EXIT_CODES.ERROR;
  }

  if (isPretty) {
    console.log('');
    console.log(chalk.bold('ClaimCheck Watch Mode'));
    console.log(chalk.dim('─'.repeat(60)));
    console.log(`Watching: ${chalk.cyan(filePath)}`);
    console.log(`Verify:   ${options.autoVerify ? chalk.green('auto') : chalk.yellow('detect only')}`);
    console.log(`Mode:     ${options.gitAware ? chalk.blue('git-aware') : 'basic search'}`);
    console.log(`Filter:   ${options.codeOnly ? 'code only' : 'all contexts'}`);
    console.log(chalk.dim('─'.repeat(60)));
    console.log(chalk.dim('Press Ctrl+C to stop'));
    console.log('');
  }

  // Create watch session
  const session = new WatchSession({
    filePath,
    cwd: options.cwd,
    gitAware: options.gitAware,
    codeOnly: options.codeOnly,
    autoVerify: options.autoVerify,
  });

  // Set up event handlers
  session.on('ready', () => {
    if (isPretty) {
      console.log(chalk.green('Watching for claims...'));
      console.log('');
    }
  });

  session.on('claim', (detected: DetectedClaim) => {
    if (isPretty) {
      console.log(chalk.yellow('Claim detected:'), formatClaimBrief(detected));
      if (!options.autoVerify) {
        console.log(chalk.dim(`  Run: claimcheck verify "${detected.claim.raw.slice(0, 50)}..."`));
      }
    } else if (options.format === 'json') {
      console.log(JSON.stringify({ event: 'claim', data: detected }));
    }
  });

  session.on('verified', (detected: DetectedClaim) => {
    if (isPretty) {
      const status = detected.verified
        ? chalk.green('VERIFIED')
        : chalk.red('INCOMPLETE');
      console.log(`${status}: ${formatClaimBrief(detected)}`);

      // Show details for incomplete claims
      if (!detected.verified && detected.result) {
        console.log('');
        if (options.gitAware && 'missedFiles' in detected.result) {
          console.log(formatDiffResult(detected.result as DiffVerificationResult, 'pretty'));
        } else {
          console.log(formatResult(detected.result as VerificationResult, 'pretty'));
        }
      }
      console.log('');
    } else if (options.format === 'json') {
      console.log(JSON.stringify({ event: 'verified', data: detected }));
    } else {
      // summary
      const status = detected.verified ? 'VERIFIED' : 'INCOMPLETE';
      console.log(`${status}: ${formatClaimBrief(detected)}`);
    }
  });

  session.on('error', (error: Error) => {
    if (isPretty) {
      console.error(chalk.red('Error:'), error.message);
    } else {
      console.error(JSON.stringify({ event: 'error', message: error.message }));
    }
  });

  // Handle graceful shutdown
  const cleanup = () => {
    if (isPretty) {
      console.log('');
      const stats = session.getStats();
      console.log(chalk.dim('─'.repeat(60)));
      console.log(chalk.bold('Session Summary'));
      console.log(`  Claims detected:  ${stats.claimsDetected}`);
      console.log(`  Claims verified:  ${stats.claimsVerified}`);
      console.log(`  Claims pending:   ${stats.claimsPending}`);
      console.log('');
    }
    session.stop();
    process.exit(0);
  };

  process.on('SIGINT', cleanup);
  process.on('SIGTERM', cleanup);

  // Start watching
  try {
    await session.start();

    // Keep the process running
    await new Promise(() => {
      // This promise never resolves - we exit via signal handlers
    });
  } catch (error) {
    console.error(`Error: ${error instanceof Error ? error.message : 'Unknown error'}`);
    return EXIT_CODES.ERROR;
  }

  return EXIT_CODES.SUCCESS;
}

/**
 * Format a claim briefly for display
 */
function formatClaimBrief(detected: DetectedClaim): string {
  const { claim } = detected;
  if (claim.action === 'rename' || claim.action === 'update') {
    return `${claim.action} "${claim.oldValue}" -> "${claim.newValue}"`;
  }
  return `${claim.action} "${claim.oldValue}"`;
}

/**
 * Find the latest Claude Code session file
 */
async function findLatestSession(): Promise<string | null> {
  const claudeDir = join(homedir(), '.claude', 'projects');

  if (!existsSync(claudeDir)) {
    return null;
  }

  try {
    // Find all session files recursively
    const sessionFiles = await findJsonlFiles(claudeDir);

    if (sessionFiles.length === 0) {
      return null;
    }

    // Sort by modification time (newest first)
    sessionFiles.sort((a, b) => b.mtime - a.mtime);

    return sessionFiles[0].path;
  } catch {
    return null;
  }
}

/**
 * Find a specific session by ID
 */
async function findSessionFile(sessionId: string): Promise<string | null> {
  const claudeDir = join(homedir(), '.claude', 'projects');

  if (!existsSync(claudeDir)) {
    return null;
  }

  try {
    const sessionFiles = await findJsonlFiles(claudeDir);
    const match = sessionFiles.find((f) => f.path.includes(sessionId));
    return match?.path || null;
  } catch {
    return null;
  }
}

/**
 * Recursively find all .jsonl files in a directory
 */
async function findJsonlFiles(
  dir: string,
  results: Array<{ path: string; mtime: number }> = []
): Promise<Array<{ path: string; mtime: number }>> {
  try {
    const entries = await readdir(dir, { withFileTypes: true });

    for (const entry of entries) {
      const fullPath = join(dir, entry.name);

      if (entry.isDirectory()) {
        await findJsonlFiles(fullPath, results);
      } else if (entry.name.endsWith('.jsonl')) {
        const stats = await stat(fullPath);
        results.push({ path: fullPath, mtime: stats.mtimeMs });
      }
    }
  } catch {
    // Ignore permission errors, etc.
  }

  return results;
}
