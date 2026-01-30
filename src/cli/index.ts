/**
 * ClaimCheck CLI
 * Verify AI claims about code changes
 */

import { Command } from 'commander';
import { registerCheckCommitCommand } from './commands/check-commit.js';
import { registerVerifyCommand } from './commands/verify.js';

const program = new Command();

program
  .name('claimcheck')
  .description('Verify AI claims about code changes against actual codebase')
  .version('0.1.0');

// Register commands
registerVerifyCommand(program);
registerCheckCommitCommand(program);

// Parse and run
program.parse();
