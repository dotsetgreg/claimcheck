/**
 * Context Detector
 * Detects whether a match is in code, comment, or string literal
 */

export type MatchContext = 'code' | 'comment' | 'string' | 'import' | 'unknown';

export type MatchPriority = 'high' | 'medium' | 'low';

export interface ContextInfo {
  context: MatchContext;
  priority: MatchPriority;
  confidence: number; // 0-1, how confident we are in the detection
}

// Language-specific comment patterns
const COMMENT_PATTERNS: Record<string, RegExp[]> = {
  // Single-line comments
  singleLine: [
    /^\s*\/\//, // JavaScript, TypeScript, C, C++, Java, Go, Rust
    /^\s*#/, // Python, Ruby, Shell, YAML
    /^\s*--/, // SQL, Lua, Haskell
    /^\s*;/, // Lisp, Assembly
    /^\s*%/, // LaTeX, Erlang
  ],
  // Block comment starts (simplified - doesn't track nesting)
  blockStart: [
    /\/\*/, // C-style
    /"""/, // Python docstring
    /'''/, // Python docstring
    /<!--/, // HTML/XML
    /\{-/, // Haskell
  ],
};

// Import/require patterns
const IMPORT_PATTERNS = [
  /^\s*import\s+/, // ES6 import
  /^\s*from\s+['"]/, // Python from import
  /^\s*const\s+\w+\s*=\s*require\s*\(/, // CommonJS require
  /^\s*require\s*\(/, // Ruby require
  /^\s*use\s+/, // Rust use
  /^\s*using\s+/, // C# using
  /^\s*#include\s*[<"]/, // C/C++ include
];

/**
 * Detect the context of a match within a line
 */
export function detectContext(
  line: string,
  matchColumn: number,
  _variant: string,
  filePath: string
): ContextInfo {
  const ext = getFileExtension(filePath);
  const beforeMatch = line.slice(0, matchColumn);
  const lineStart = line.trimStart();

  // Check if this is an import/require line (high priority)
  if (isImportLine(lineStart)) {
    return { context: 'import', priority: 'high', confidence: 0.9 };
  }

  // Check if line is a comment
  if (isCommentLine(lineStart, ext)) {
    return { context: 'comment', priority: 'low', confidence: 0.85 };
  }

  // Check if match is inside a string literal
  if (isInsideString(beforeMatch)) {
    // Strings in test files are often test data
    if (isTestFile(filePath)) {
      return { context: 'string', priority: 'medium', confidence: 0.7 };
    }
    return { context: 'string', priority: 'low', confidence: 0.7 };
  }

  // Check if this looks like documentation (markdown, etc.)
  if (isDocFile(filePath)) {
    return { context: 'comment', priority: 'low', confidence: 0.9 };
  }

  // Check for inline comment after code
  const inlineCommentMatch = beforeMatch.match(/\/\/|#(?!\w)|\/\*/);
  if (inlineCommentMatch && inlineCommentMatch.index !== undefined) {
    if (matchColumn > inlineCommentMatch.index) {
      return { context: 'comment', priority: 'low', confidence: 0.75 };
    }
  }

  // Default: assume it's code (high priority)
  return { context: 'code', priority: 'high', confidence: 0.6 };
}

/**
 * Check if a line is likely a comment
 */
function isCommentLine(line: string, _ext: string): boolean {
  // Check single-line comment patterns
  for (const pattern of COMMENT_PATTERNS.singleLine) {
    if (pattern.test(line)) {
      return true;
    }
  }

  // Check block comment patterns
  for (const pattern of COMMENT_PATTERNS.blockStart) {
    if (pattern.test(line)) {
      return true;
    }
  }

  // JSDoc-style comments
  if (/^\s*\*/.test(line)) {
    return true;
  }

  return false;
}

/**
 * Check if a line is an import statement
 */
function isImportLine(line: string): boolean {
  for (const pattern of IMPORT_PATTERNS) {
    if (pattern.test(line)) {
      return true;
    }
  }
  return false;
}

/**
 * Check if match position is inside a string literal
 */
function isInsideString(beforeMatch: string): boolean {
  // Track quote states with proper escape handling
  let inDouble = false;
  let inSingle = false;
  let inTemplate = false;
  let escaped = false;

  for (let i = 0; i < beforeMatch.length; i++) {
    const char = beforeMatch[i];

    // If previous char was backslash and we're in a string, this char is escaped
    if (escaped) {
      escaped = false;
      continue;
    }

    // Check for escape character (only matters inside strings)
    if (char === '\\' && (inDouble || inSingle || inTemplate)) {
      escaped = true;
      continue;
    }

    if (char === '"' && !inSingle && !inTemplate) {
      inDouble = !inDouble;
    } else if (char === "'" && !inDouble && !inTemplate) {
      inSingle = !inSingle;
    } else if (char === '`' && !inDouble && !inSingle) {
      inTemplate = !inTemplate;
    }
  }

  return inDouble || inSingle || inTemplate;
}

/**
 * Check if file is a documentation file
 */
function isDocFile(filePath: string): boolean {
  const ext = getFileExtension(filePath);
  return ['md', 'mdx', 'txt', 'rst', 'adoc'].includes(ext);
}

/**
 * Check if file is a test file
 */
function isTestFile(filePath: string): boolean {
  const lower = filePath.toLowerCase();
  return (
    lower.includes('.test.') ||
    lower.includes('.spec.') ||
    lower.includes('_test.') ||
    lower.includes('__tests__') ||
    lower.includes('/test/') ||
    lower.includes('/tests/')
  );
}

/**
 * Get file extension
 */
function getFileExtension(filePath: string): string {
  const parts = filePath.split('.');
  return parts.length > 1 ? parts[parts.length - 1].toLowerCase() : '';
}

/**
 * Get priority label for display
 */
export function getPriorityLabel(priority: MatchPriority): string {
  switch (priority) {
    case 'high':
      return 'code';
    case 'medium':
      return 'test';
    case 'low':
      return 'docs/comments';
  }
}

/**
 * Filter references by minimum priority
 */
export function filterByPriority(
  references: Array<{ priority?: MatchPriority }>,
  minPriority: MatchPriority
): Array<{ priority?: MatchPriority }> {
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
