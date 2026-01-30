/**
 * Diff Analyzer
 * Compares claims against actual git changes to identify missed files
 */

import type { ParsedClaim, Reference, SearchOptions, VerificationSummary } from '../../types/index.js';
import { getAllChangedFiles, getCommitFiles, getStagedFiles, type GitDiffFile } from '../git/index.js';
import { generateVariants } from '../parser/variant-generator.js';
import { search } from '../verifier/search-engine.js';

export type DiffSource = 'staged' | 'commit' | 'working' | 'all';

export interface DiffVerificationOptions extends SearchOptions {
  cwd: string;
  diffSource: DiffSource;
  commit?: string; // Required if diffSource is 'commit'
  checkVariants?: boolean;
}

export interface MissedFile {
  file: string;
  references: Reference[];
  wasModified: boolean;
  suggestion: string;
}

export interface DiffVerificationResult {
  claim: ParsedClaim;
  verified: boolean;
  modifiedFiles: GitDiffFile[];
  missedFiles: MissedFile[];
  allReferences: Reference[];
  summary: DiffVerificationSummary;
  duration: number;
}

export interface DiffVerificationSummary extends VerificationSummary {
  filesModified: number;
  filesMissed: number;
  filesWithReferencesModified: number;
}

/**
 * Verify a claim against actual git changes
 * This is smarter than plain search - it tells you which files you MISSED
 */
export async function verifyClaimAgainstDiff(
  claim: ParsedClaim,
  options: DiffVerificationOptions
): Promise<DiffVerificationResult> {
  const startTime = Date.now();
  const { cwd, diffSource, commit, checkVariants = true, ...searchOptions } = options;

  // Get the list of modified files
  const diffResult = await getDiffForSource(diffSource, cwd, commit);
  if (!diffResult.success) {
    throw new Error(`Failed to get git diff: ${diffResult.error}`);
  }

  const modifiedFiles = diffResult.files;
  const modifiedPaths = new Set(modifiedFiles.map((f) => f.path));

  // Generate variants to search for
  const searchTerm = claim.oldValue;
  const variants = checkVariants ? generateVariants(searchTerm) : { all: [searchTerm] };

  // Search for all remaining references
  const allReferences: Reference[] = [];
  const filesWithReferences = new Set<string>();

  for (const variant of variants.all) {
    const result = await search(variant, cwd, searchOptions);

    if (result.success) {
      for (const ref of result.references) {
        // Normalize path (remove leading ./)
        const normalizedPath = ref.file.replace(/^\.\//, '');
        allReferences.push({ ...ref, file: normalizedPath, variant });
        filesWithReferences.add(normalizedPath);
      }
    }
  }

  // Identify missed files: files with references that weren't modified
  const missedFilesMap = new Map<string, MissedFile>();

  for (const ref of allReferences) {
    const wasModified = modifiedPaths.has(ref.file);

    if (!wasModified) {
      const existing = missedFilesMap.get(ref.file);
      if (existing) {
        existing.references.push(ref);
      } else {
        missedFilesMap.set(ref.file, {
          file: ref.file,
          references: [ref],
          wasModified: false,
          suggestion: generateSuggestion(ref.file, claim),
        });
      }
    }
  }

  const missedFiles = Array.from(missedFilesMap.values());

  // Count how many files with references were actually modified
  let filesWithReferencesModified = 0;
  for (const file of filesWithReferences) {
    if (modifiedPaths.has(file)) {
      filesWithReferencesModified++;
    }
  }

  const summary: DiffVerificationSummary = {
    totalFilesSearched: filesWithReferences.size,
    filesWithMatches: filesWithReferences.size,
    totalMatches: allReferences.length,
    filesModified: modifiedFiles.length,
    filesMissed: missedFiles.length,
    filesWithReferencesModified,
  };

  return {
    claim,
    verified: missedFiles.length === 0,
    modifiedFiles,
    missedFiles,
    allReferences,
    summary,
    duration: Date.now() - startTime,
  };
}

/**
 * Get diff based on source type
 */
async function getDiffForSource(source: DiffSource, cwd: string, commit?: string) {
  switch (source) {
    case 'staged':
      return getStagedFiles(cwd);
    case 'commit':
      if (!commit) {
        throw new Error('Commit hash required for commit diff source');
      }
      return getCommitFiles(commit, cwd);
    case 'working':
    case 'all':
    default:
      return getAllChangedFiles(cwd);
  }
}

/**
 * Generate a helpful suggestion for a missed file
 */
function generateSuggestion(file: string, claim: ParsedClaim): string {
  const ext = file.split('.').pop()?.toLowerCase();

  // Documentation files
  if (ext === 'md' || ext === 'mdx' || ext === 'txt' || ext === 'rst') {
    return 'Update documentation to reflect the change';
  }

  // Test files
  if (file.includes('.test.') || file.includes('.spec.') || file.includes('__tests__')) {
    return 'Update test file to use new name/value';
  }

  // Config files
  if (
    file.includes('config') ||
    ext === 'json' ||
    ext === 'yaml' ||
    ext === 'yml' ||
    ext === 'toml'
  ) {
    return 'Check if configuration needs updating';
  }

  // Type definition files
  if (ext === 'd.ts') {
    return 'Update type definitions';
  }

  // Default suggestion based on claim action
  switch (claim.action) {
    case 'rename':
      return `Rename "${claim.oldValue}" to "${claim.newValue}"`;
    case 'remove':
      return `Remove remaining "${claim.oldValue}" reference`;
    case 'update':
      return `Update "${claim.oldValue}" to "${claim.newValue}"`;
    default:
      return 'Review and update this file';
  }
}
