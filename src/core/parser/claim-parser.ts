/**
 * Claim Parser
 * Extracts structured claims from natural language descriptions
 */

import type { ClaimAction, ClaimScope, ParsedClaim } from '../../types/index.js';
import { CLAIM_PATTERNS, SCOPE_PATTERNS } from './patterns.js';

export interface ParseResult {
  success: boolean;
  claim?: ParsedClaim;
  error?: string;
}

/**
 * Parse a natural language claim into a structured format
 */
export function parseClaim(text: string): ParseResult {
  const trimmed = text.trim();

  if (!trimmed) {
    return { success: false, error: 'Empty claim text' };
  }

  // Try each pattern until one matches
  for (const { action, pattern, oldValueGroup, newValueGroup } of CLAIM_PATTERNS) {
    const match = trimmed.match(pattern);
    if (match) {
      const oldValue = oldValueGroup !== undefined ? match[oldValueGroup + 1] : undefined;
      const newValue = newValueGroup !== undefined ? match[newValueGroup + 1] : undefined;

      // For remove/rename/update, we need oldValue
      if ((action === 'remove' || action === 'rename' || action === 'update') && !oldValue) {
        continue;
      }

      // For rename/update, we also need newValue
      if ((action === 'rename' || action === 'update') && !newValue) {
        continue;
      }

      // Detect scope
      const { scope, scopePattern } = detectScope(trimmed);

      const claim: ParsedClaim = {
        action,
        oldValue: oldValue ?? '',
        newValue,
        scope,
        scopePattern,
        raw: trimmed,
      };

      return { success: true, claim };
    }
  }

  // If no pattern matched, try a simple extraction
  const simpleClaim = trySimpleParse(trimmed);
  if (simpleClaim) {
    return { success: true, claim: simpleClaim };
  }

  return {
    success: false,
    error: `Could not parse claim: "${trimmed.slice(0, 50)}${trimmed.length > 50 ? '...' : ''}"`,
  };
}

/**
 * Detect the scope of a claim
 */
function detectScope(text: string): { scope: ClaimScope; scopePattern?: string } {
  for (const { pattern, scope, patternGroup } of SCOPE_PATTERNS) {
    const match = text.match(pattern);
    if (match) {
      const scopePattern = patternGroup !== undefined ? match[patternGroup + 1] : undefined;
      return { scope, scopePattern };
    }
  }

  // Default to everywhere if no specific scope mentioned
  return { scope: 'everywhere' };
}

/**
 * Try a simpler parsing approach for claims that don't match patterns
 * Looks for quoted values that should be searched for
 */
function trySimpleParse(text: string): ParsedClaim | null {
  // Look for action keywords
  let action: ClaimAction = 'remove';
  if (/\b(?:renamed?|changed?)\b/i.test(text)) {
    action = 'rename';
  } else if (/\b(?:updated?|replaced?|migrated?)\b/i.test(text)) {
    action = 'update';
  } else if (/\b(?:added?|created?)\b/i.test(text)) {
    action = 'add';
  }

  // Extract quoted or backticked values
  const quotedValues = text.match(/["'`]([^"'`]+)["'`]/g);
  if (quotedValues && quotedValues.length > 0) {
    const values = quotedValues.map((q) => q.slice(1, -1));

    if (action === 'rename' || action === 'update') {
      if (values.length >= 2) {
        return {
          action,
          oldValue: values[0],
          newValue: values[1],
          scope: 'everywhere',
          raw: text,
        };
      }
    }

    // For remove or single value, search for it
    return {
      action: 'remove',
      oldValue: values[0],
      scope: 'everywhere',
      raw: text,
    };
  }

  return null;
}

/**
 * Parse multiple claims from a block of text (e.g., commit message)
 */
export function parseMultipleClaims(text: string): ParseResult[] {
  const results: ParseResult[] = [];

  // Split by newlines and common delimiters
  const lines = text.split(/[\n\r]+/).filter((line) => line.trim());

  // Also handle bullet points, numbered lists, and conjunctions
  const segments: string[] = [];
  for (const line of lines) {
    // Split on bullet points or numbers at start of segments
    let parts = line.split(/(?:^|\s)[-*•]\s+|\d+\.\s+/);

    // Further split on conjunctions like "and also", "and", ", and"
    const furtherSplit: string[] = [];
    for (const part of parts) {
      // Split on " and " followed by an action word
      const subParts = part.split(/\s+and\s+(?=renamed?|removed?|updated?|replaced?|deleted?|added?|changed?|migrated?)/i);
      furtherSplit.push(...subParts);
    }
    parts = furtherSplit;

    for (const part of parts) {
      const trimmed = part.trim();
      if (trimmed) {
        segments.push(trimmed);
      }
    }
  }

  // Try to parse each segment
  for (const segment of segments) {
    const result = parseClaim(segment);
    if (result.success) {
      results.push(result);
    }
  }

  return results;
}
