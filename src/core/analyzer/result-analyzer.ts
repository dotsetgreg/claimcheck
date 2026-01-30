/**
 * Result Analyzer
 * Analyze search results and build verification results
 */

import type {
  MatchPriority,
  ParsedClaim,
  Reference,
  SearchOptions,
  VariantResult,
  VerificationResult,
  VerificationSummary,
} from '../../types/index.js';
import { detectContext } from './context-detector.js';
import { generateVariants } from '../parser/variant-generator.js';
import { search } from '../verifier/search-engine.js';

export interface AnalyzeOptions extends SearchOptions {
  cwd: string;
  checkVariants?: boolean;
  detectContexts?: boolean; // Whether to detect code/comment/string contexts
  minPriority?: MatchPriority; // Filter results by minimum priority
}

/**
 * Verify a claim by searching for remaining references
 */
export async function verifyClaim(
  claim: ParsedClaim,
  options: AnalyzeOptions
): Promise<VerificationResult> {
  const startTime = Date.now();
  const {
    cwd,
    checkVariants = true,
    detectContexts = true,
    minPriority,
    ...searchOptions
  } = options;

  // For rename/remove/update, search for the old value (should be gone)
  const searchTerm = claim.oldValue;

  // Generate variants if enabled
  const variants = checkVariants ? generateVariants(searchTerm) : { all: [searchTerm] };

  const variantResults: VariantResult[] = [];
  const allReferences: Reference[] = [];
  const filesWithMatches = new Set<string>();

  // Search for each variant
  for (const variant of variants.all) {
    const result = await search(variant, cwd, searchOptions);

    if (result.success && result.references.length > 0) {
      // Update variant in references and detect context
      const refs = result.references.map((ref) => {
        const enhanced: Reference = { ...ref, variant };

        if (detectContexts) {
          const contextInfo = detectContext(ref.content, ref.column - 1, variant, ref.file);
          enhanced.matchContext = contextInfo.context;
          enhanced.priority = contextInfo.priority;
        }

        return enhanced;
      });

      variantResults.push({
        variant,
        matches: refs,
      });

      for (const ref of refs) {
        allReferences.push(ref);
        filesWithMatches.add(ref.file);
      }
    } else if (!result.success) {
      // If search failed, we should report it
      variantResults.push({
        variant,
        matches: [],
      });
    }
  }

  // Deduplicate references (same file:line might match multiple variants)
  let deduped = deduplicateReferences(allReferences);

  // Filter by priority if specified
  if (minPriority) {
    deduped = filterByMinPriority(deduped, minPriority);
  }

  const summary: VerificationSummary = {
    totalFilesSearched: filesWithMatches.size,
    filesWithMatches: filesWithMatches.size,
    totalMatches: deduped.length,
  };

  return {
    claim,
    verified: deduped.length === 0,
    remainingReferences: deduped,
    variants: variantResults,
    summary,
    duration: Date.now() - startTime,
  };
}

/**
 * Deduplicate references by file:line
 * Keep the first occurrence with the shortest variant (most specific match)
 */
function deduplicateReferences(references: Reference[]): Reference[] {
  const seen = new Map<string, Reference>();

  for (const ref of references) {
    const key = `${ref.file}:${ref.line}`;
    const existing = seen.get(key);

    if (!existing || ref.variant.length < existing.variant.length) {
      seen.set(key, ref);
    }
  }

  return Array.from(seen.values());
}

/**
 * Filter references by minimum priority level
 */
function filterByMinPriority(references: Reference[], minPriority: MatchPriority): Reference[] {
  const priorityOrder: Record<MatchPriority, number> = {
    high: 3,
    medium: 2,
    low: 1,
  };

  const minLevel = priorityOrder[minPriority];

  return references.filter((ref) => {
    const level = priorityOrder[ref.priority || 'high'];
    return level >= minLevel;
  });
}
