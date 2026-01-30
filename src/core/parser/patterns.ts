/**
 * Regex patterns for parsing different claim types
 */

export interface ClaimPattern {
  action: 'rename' | 'remove' | 'update' | 'add';
  pattern: RegExp;
  // Group indices for extracting values (0-indexed for match groups)
  oldValueGroup?: number;
  newValueGroup?: number;
  scopeGroup?: number;
}

// Patterns ordered by specificity (more specific first)
export const CLAIM_PATTERNS: ClaimPattern[] = [
  // Rename patterns
  {
    action: 'rename',
    pattern:
      /(?:renamed?|changed?|refactored?)\s+(?:all\s+)?(?:references?\s+(?:to|of|from)\s+)?["'`]?(\w+)["'`]?\s+(?:to|→|->|=>)\s+["'`]?(\w+)["'`]?/i,
    oldValueGroup: 0,
    newValueGroup: 1,
  },
  {
    action: 'rename',
    pattern:
      /(?:renamed?|changed?)\s+(?:all\s+)?["'`]?(\w+)["'`]?\s+(?:to|→|->|=>)\s+["'`]?(\w+)["'`]?\s+(?:everywhere|throughout|across)/i,
    oldValueGroup: 0,
    newValueGroup: 1,
  },
  {
    action: 'rename',
    pattern:
      /["'`]?(\w+)["'`]?\s+(?:was|has been|is now)\s+(?:renamed?|changed?)\s+(?:to\s+)?["'`]?(\w+)["'`]?/i,
    oldValueGroup: 0,
    newValueGroup: 1,
  },

  // Remove patterns
  {
    action: 'remove',
    pattern:
      /(?:removed?|deleted?|eliminated?|got rid of)\s+(?:all\s+)?(?:instances?\s+of\s+)?(?:the\s+)?["'`]?([\w.]+)["'`]?\s+(?:statements?|calls?|references?|usages?)/i,
    oldValueGroup: 0,
  },
  {
    action: 'remove',
    pattern:
      /(?:removed?|deleted?|eliminated?|got rid of)\s+(?:all\s+)?(?:instances?\s+of\s+)?(?:the\s+)?["'`]?([\w.]+)["'`]?(?:\s+(?:everywhere|throughout|from))?/i,
    oldValueGroup: 0,
  },
  {
    action: 'remove',
    pattern:
      /(?:all\s+)?["'`]?([^"'`]+?)["'`]?\s+(?:statements?|calls?|references?|usages?)\s+(?:have been|were|are)\s+(?:removed?|deleted?)/i,
    oldValueGroup: 0,
  },
  {
    action: 'remove',
    pattern: /(?:no more|no longer any)\s+["'`]?([^"'`]+?)["'`]?/i,
    oldValueGroup: 0,
  },

  // Update/Replace patterns
  {
    action: 'update',
    pattern:
      /(?:updated?|replaced?|migrated?|converted?)\s+(?:all\s+)?(?:imports?\s+(?:from|of)\s+)?["'`]?(\w+(?:[-/]\w+)*)["'`]?\s+(?:to|with|→|->|=>)\s+["'`]?(\w+(?:[-/]\w+)*)["'`]?/i,
    oldValueGroup: 0,
    newValueGroup: 1,
  },
  {
    action: 'update',
    pattern:
      /(?:updated?|replaced?|migrated?|converted?)\s+["'`]?(\w+(?:[-/]\w+)*)["'`]?\s+(?:imports?)\s+(?:to|with|→|->|=>)\s+["'`]?(\w+(?:[-/]\w+)*)["'`]?/i,
    oldValueGroup: 0,
    newValueGroup: 1,
  },
  {
    action: 'update',
    pattern:
      /(?:switched?|moved?)\s+(?:from\s+)?["'`]?(\w+(?:[-/]\w+)*)["'`]?\s+(?:to|→|->|=>)\s+["'`]?(\w+(?:[-/]\w+)*)["'`]?/i,
    oldValueGroup: 0,
    newValueGroup: 1,
  },

  // Add patterns (for checking new things exist)
  {
    action: 'add',
    pattern:
      /(?:added?|created?|introduced?)\s+(?:a\s+)?(?:new\s+)?["'`]?(\w+)["'`]?\s+(?:to|in|throughout)/i,
    newValueGroup: 0,
  },
];

// Scope detection patterns
export const SCOPE_PATTERNS = [
  { pattern: /everywhere/i, scope: 'everywhere' as const },
  { pattern: /throughout\s+(?:the\s+)?(?:code)?base/i, scope: 'everywhere' as const },
  { pattern: /across\s+(?:all\s+)?files?/i, scope: 'everywhere' as const },
  { pattern: /in\s+all\s+files?/i, scope: 'everywhere' as const },
  {
    pattern: /(?:only\s+)?in\s+["'`]?([^"'`]+?)["'`]?(?:\s+files?)?$/i,
    scope: 'specific' as const,
    patternGroup: 0,
  },
  {
    pattern: /(?:within|inside)\s+["'`]?([^"'`]+?)["'`]?/i,
    scope: 'specific' as const,
    patternGroup: 0,
  },
];
