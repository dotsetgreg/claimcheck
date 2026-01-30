/**
 * Result Analyzer
 * Analyze search results and build verification results
 */

import type {
  ParsedClaim,
  Reference,
  SearchOptions,
  VariantResult,
  VerificationResult,
  VerificationSummary,
} from '../../types/index.js';
import { generateVariants } from '../parser/variant-generator.js';
import { search } from '../verifier/search-engine.js';

export interface AnalyzeOptions extends SearchOptions {
  cwd: string;
  checkVariants?: boolean;
}

/**
 * Verify a claim by searching for remaining references
 */
export async function verifyClaim(
  claim: ParsedClaim,
  options: AnalyzeOptions
): Promise<VerificationResult> {
  const startTime = Date.now();
  const { cwd, checkVariants = true, ...searchOptions } = options;

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
      // Update variant in references
      const refs = result.references.map((ref) => ({
        ...ref,
        variant,
      }));

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
  const deduped = deduplicateReferences(allReferences);

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
