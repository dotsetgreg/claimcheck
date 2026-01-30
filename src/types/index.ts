/**
 * ClaimCheck Core Types
 */

// Claim action types that can be extracted from natural language
export type ClaimAction = 'rename' | 'remove' | 'update' | 'add';

// Scope of the claim
export type ClaimScope = 'everywhere' | 'specific';

// Parsed claim from natural language
export interface ParsedClaim {
  action: ClaimAction;
  oldValue: string; // What should be gone/changed
  newValue?: string; // What it should be changed to (for rename/update)
  scope: ClaimScope;
  scopePattern?: string; // File pattern if scope is 'specific'
  raw: string; // Original claim text
}

// A single reference found in the codebase
export interface Reference {
  file: string; // Relative file path
  line: number; // 1-indexed line number
  column: number; // 1-indexed column number
  content: string; // The matched line content
  context: string[]; // Surrounding lines for context
  variant: string; // Which variant of the search term matched
}

// Result for a specific variant search
export interface VariantResult {
  variant: string;
  matches: Reference[];
}

// Summary statistics for a verification
export interface VerificationSummary {
  totalFilesSearched: number;
  filesWithMatches: number;
  totalMatches: number;
}

// Complete verification result
export interface VerificationResult {
  claim: ParsedClaim;
  verified: boolean; // true if no remaining references found
  remainingReferences: Reference[];
  variants: VariantResult[];
  summary: VerificationSummary;
  duration: number; // Time taken in milliseconds
}

// Search options for the verification engine
export interface SearchOptions {
  caseSensitive?: boolean;
  includePatterns?: string[];
  excludePatterns?: string[];
  contextLines?: number;
  respectGitignore?: boolean;
}

// File type preset for filtering
export type FileTypePreset = 'code' | 'docs' | 'tests' | 'all';

// CLI output format
export type OutputFormat = 'pretty' | 'json' | 'summary';

// CLI options
export interface VerifyOptions {
  format: OutputFormat;
  include?: string[];
  exclude?: string[];
  caseSensitive: boolean;
  contextLines: number;
  cwd?: string;
}

// Exit codes for CLI
export const EXIT_CODES = {
  SUCCESS: 0, // Claim verified, no remaining references
  DISCREPANCIES: 1, // Found remaining references
  ERROR: 2, // Runtime error
} as const;

export type ExitCode = (typeof EXIT_CODES)[keyof typeof EXIT_CODES];
