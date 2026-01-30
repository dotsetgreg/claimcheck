export { verifyClaim, type AnalyzeOptions } from './result-analyzer.js';
export {
  verifyClaimAgainstDiff,
  type DiffSource,
  type DiffVerificationOptions,
  type DiffVerificationResult,
  type DiffVerificationSummary,
  type MissedFile,
} from './diff-analyzer.js';
export {
  detectContext,
  filterByPriority,
  getPriorityLabel,
  type ContextInfo,
} from './context-detector.js';
