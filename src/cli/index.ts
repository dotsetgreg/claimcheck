/**
 * ClaimCheck CLI
 * Verify AI claims about code changes
 */

import { Command } from 'commander';
import { registerCheckCommitCommand } from './commands/check-commit.js';
import { registerDetectClaimsCommand } from './commands/detect-claims.js';
import { registerVerifyCommand } from './commands/verify.js';
import { registerVerifyDiffCommand } from './commands/verify-diff.js';
import { registerWatchCommand } from './commands/watch.js';

const program = new Command();

program
  .name('claimcheck')
  .description('Verify AI claims about code changes against actual codebase')
  .version('0.1.0');

// Register commands
registerVerifyCommand(program);
registerVerifyDiffCommand(program);
registerCheckCommitCommand(program);
registerDetectClaimsCommand(program);
registerWatchCommand(program);

// Parse and run
program.parse();
