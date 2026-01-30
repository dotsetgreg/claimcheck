/**
 * ClaimCheck - Verify AI claims about code changes
 *
 * Programmatic API for use in other tools
 */

// Core types
export type {
  ClaimAction,
  ClaimScope,
  ExitCode,
  FileTypePreset,
  MatchContext,
  MatchPriority,
  OutputFormat,
  ParsedClaim,
  Reference,
  SearchOptions,
  VariantResult,
  VerificationResult,
  VerificationSummary,
  VerifyOptions,
} from './types/index.js';

export { EXIT_CODES } from './types/index.js';

// Parser
export { parseClaim, parseMultipleClaims, type ParseResult } from './core/parser/index.js';
export { generateVariants, type GeneratedVariants } from './core/parser/index.js';

// Verifier
export { checkRipgrep, search, searchMultiple, type SearchResult } from './core/verifier/index.js';
export { getIncludePatternsForPreset, mergePatterns } from './core/verifier/index.js';

// Analyzer - basic verification
export { verifyClaim, type AnalyzeOptions } from './core/analyzer/index.js';

// Analyzer - git-aware verification
export {
  verifyClaimAgainstDiff,
  type DiffSource,
  type DiffVerificationOptions,
  type DiffVerificationResult,
  type DiffVerificationSummary,
  type MissedFile,
} from './core/analyzer/index.js';

// Analyzer - context detection
export {
  detectContext,
  filterByPriority,
  getPriorityLabel,
  type ContextInfo,
} from './core/analyzer/index.js';

// Git utilities
export {
  isGitRepo,
  getStagedFiles,
  getCommitFiles,
  getAllChangedFiles,
  getCommitMessage,
  type GitDiffFile,
  type GitDiffResult,
} from './core/git/index.js';

// CLI utilities (for integration)
export { runVerify } from './cli/commands/verify.js';
export { runVerifyDiff } from './cli/commands/verify-diff.js';
export { runCheckCommit } from './cli/commands/check-commit.js';
export { runDetectClaims } from './cli/commands/detect-claims.js';
export { formatResult } from './cli/ui/reporter.js';
export { formatDiffResult } from './cli/ui/diff-reporter.js';
