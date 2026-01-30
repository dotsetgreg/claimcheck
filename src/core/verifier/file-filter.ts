/**
 * File Filter
 * Generate glob patterns for different file type presets
 */

import type { FileTypePreset } from '../../types/index.js';
import { FILE_TYPE_PATTERNS } from '../../utils/constants.js';

/**
 * Get include patterns for a file type preset
 */
export function getIncludePatternsForPreset(preset: FileTypePreset): string[] {
  switch (preset) {
    case 'code':
      return FILE_TYPE_PATTERNS.code;
    case 'docs':
      return FILE_TYPE_PATTERNS.docs;
    case 'tests':
      return FILE_TYPE_PATTERNS.tests;
    case 'all':
    default:
      return [];
  }
}

/**
 * Merge custom patterns with preset patterns
 */
export function mergePatterns(
  preset: FileTypePreset,
  customInclude: string[] = [],
  customExclude: string[] = []
): { include: string[]; exclude: string[] } {
  const presetPatterns = getIncludePatternsForPreset(preset);

  return {
    include: [...presetPatterns, ...customInclude],
    exclude: customExclude,
  };
}
