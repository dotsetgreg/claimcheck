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

// Analyzer
export { verifyClaim, type AnalyzeOptions } from './core/analyzer/index.js';

// CLI utilities (for integration)
export { runVerify } from './cli/commands/verify.js';
export { runCheckCommit } from './cli/commands/check-commit.js';
export { formatResult } from './cli/ui/reporter.js';
