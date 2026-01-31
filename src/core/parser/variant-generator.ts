/**
 * Variant Generator
 * Generates naming convention variants for search terms
 */

export interface GeneratedVariants {
  original: string;
  variants: string[];
  all: string[]; // original + variants
}

/**
 * Generate naming convention variants for a term
 * Example: "UserService" -> ["UserService", "userService", "user_service", "USER_SERVICE", "user-service"]
 */
export function generateVariants(term: string): GeneratedVariants {
  const variants = new Set<string>();

  // Add original
  variants.add(term);

  // Detect the current case style and extract words
  const words = extractWords(term);

  if (words.length > 0) {
    // PascalCase
    variants.add(toPascalCase(words));

    // camelCase
    variants.add(toCamelCase(words));

    // snake_case
    variants.add(toSnakeCase(words));

    // SCREAMING_SNAKE_CASE
    variants.add(toScreamingSnakeCase(words));

    // kebab-case
    variants.add(toKebabCase(words));

    // lowercase (for imports, package names)
    variants.add(words.join('').toLowerCase());
  }

  // Remove the original from variants set for the response
  const variantArray = Array.from(variants).filter((v) => v !== term);

  return {
    original: term,
    variants: variantArray,
    all: [term, ...variantArray],
  };
}

/**
 * Extract words from a term in any common naming convention
 */
function extractWords(term: string): string[] {
  // Handle empty or single char
  if (term.length <= 1) {
    return [term.toLowerCase()];
  }

  let words: string[] = [];

  // Check for separators first
  if (term.includes('_')) {
    // snake_case or SCREAMING_SNAKE_CASE
    words = term.split('_').map((w) => w.toLowerCase());
  } else if (term.includes('-')) {
    // kebab-case
    words = term.split('-').map((w) => w.toLowerCase());
  } else {
    // camelCase or PascalCase - split on case changes
    words = term
      .replace(/([a-z])([A-Z])/g, '$1 $2') // camelCase boundary
      .replace(/([A-Z]+)([A-Z][a-z])/g, '$1 $2') // ACRONYMWord boundary
      .split(/\s+/)
      .map((w) => w.toLowerCase())
      .filter((w) => w.length > 0);
  }

  return words.filter((w) => w.length > 0);
}

function toPascalCase(words: string[]): string {
  if (words.length === 0) return '';
  return words.map((w) => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase()).join('');
}

function toCamelCase(words: string[]): string {
  if (words.length === 0) return '';
  const [first, ...rest] = words;
  return first.toLowerCase() + rest.map((w) => w.charAt(0).toUpperCase() + w.slice(1)).join('');
}

function toSnakeCase(words: string[]): string {
  if (words.length === 0) return '';
  return words.map((w) => w.toLowerCase()).join('_');
}

function toScreamingSnakeCase(words: string[]): string {
  if (words.length === 0) return '';
  return words.map((w) => w.toUpperCase()).join('_');
}

function toKebabCase(words: string[]): string {
  if (words.length === 0) return '';
  return words.map((w) => w.toLowerCase()).join('-');
}
