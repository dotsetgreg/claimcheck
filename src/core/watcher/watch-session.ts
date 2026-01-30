/**
 * Watch Session
 * Monitors session logs for claims and automatically verifies them
 */

import { EventEmitter } from 'node:events';
import { FileWatcher } from './file-watcher.js';
import type { SessionMessage } from './session-parser.js';
import { parseMultipleClaims, parseClaim } from '../parser/claim-parser.js';
import { verifyClaim } from '../analyzer/result-analyzer.js';
import { verifyClaimAgainstDiff } from '../analyzer/diff-analyzer.js';
import type { ParsedClaim, VerificationResult } from '../../types/index.js';
import type { DiffVerificationResult } from '../analyzer/diff-analyzer.js';

/**
 * Configuration for watch session
 */
export interface WatchSessionConfig {
  /** File to watch (session log) */
  filePath: string;
  /** Working directory for verification */
  cwd?: string;
  /** Use git-aware verification (default: false) */
  gitAware?: boolean;
  /** Only report code-level matches (default: true) */
  codeOnly?: boolean;
  /** Auto-verify detected claims (default: true) */
  autoVerify?: boolean;
  /** Debounce delay in ms (default: 500) */
  debounceMs?: number;
}

/**
 * A detected claim with optional verification result
 */
export interface DetectedClaim {
  claim: ParsedClaim;
  source: string; // The message content that contained the claim
  verified?: boolean;
  result?: VerificationResult | DiffVerificationResult;
  timestamp: Date;
}

/**
 * Events emitted by watch session
 */
export interface WatchSessionEvents {
  ready: () => void;
  message: (message: SessionMessage) => void;
  claim: (detected: DetectedClaim) => void;
  verified: (detected: DetectedClaim) => void;
  error: (error: Error) => void;
}

/**
 * Watch session that monitors logs, detects claims, and verifies them
 */
export class WatchSession extends EventEmitter {
  private config: Required<WatchSessionConfig>;
  private watcher: FileWatcher;
  private verificationQueue: DetectedClaim[] = [];
  private isVerifying: boolean = false;
  private processedClaims: Set<string> = new Set();

  constructor(config: WatchSessionConfig) {
    super();
    this.config = {
      filePath: config.filePath,
      cwd: config.cwd || process.cwd(),
      gitAware: config.gitAware ?? false,
      codeOnly: config.codeOnly ?? true,
      autoVerify: config.autoVerify ?? true,
      debounceMs: config.debounceMs ?? 500,
    };

    this.watcher = new FileWatcher({
      filePath: this.config.filePath,
      debounceMs: this.config.debounceMs,
      parseJsonl: true,
    });

    this.setupWatcher();
  }

  /**
   * Start watching for claims
   */
  async start(): Promise<void> {
    await this.watcher.start();
  }

  /**
   * Stop watching
   */
  stop(): void {
    this.watcher.stop();
  }

  /**
   * Get statistics about the session
   */
  getStats(): { claimsDetected: number; claimsVerified: number; claimsPending: number } {
    return {
      claimsDetected: this.processedClaims.size,
      claimsVerified: this.processedClaims.size - this.verificationQueue.length,
      claimsPending: this.verificationQueue.length,
    };
  }

  /**
   * Set up watcher event handlers
   */
  private setupWatcher(): void {
    this.watcher.on('ready', () => {
      this.emit('ready');
    });

    this.watcher.on('message', (message: SessionMessage) => {
      this.emit('message', message);
      this.processMessage(message);
    });

    this.watcher.on('error', (error: Error) => {
      this.emit('error', error);
    });
  }

  /**
   * Process an assistant message for claims
   */
  private processMessage(message: SessionMessage): void {
    if (message.role !== 'assistant') return;

    // Detect claims in the message
    const claims = this.detectClaims(message.content);

    for (const claim of claims) {
      const claimKey = this.claimKey(claim);

      // Skip already processed claims
      if (this.processedClaims.has(claimKey)) continue;
      this.processedClaims.add(claimKey);

      const detected: DetectedClaim = {
        claim,
        source: message.content.slice(0, 200), // First 200 chars for context
        timestamp: new Date(),
      };

      this.emit('claim', detected);

      if (this.config.autoVerify) {
        this.verificationQueue.push(detected);
        this.processQueue();
      }
    }
  }

  /**
   * Detect claims from message content
   */
  private detectClaims(content: string): ParsedClaim[] {
    const claims: ParsedClaim[] = [];

    // Try multiple claims first
    const multipleResults = parseMultipleClaims(content);
    for (const result of multipleResults) {
      if (result.success && result.claim) {
        claims.push(result.claim);
      }
    }

    // If no claims found, try parsing the whole thing
    if (claims.length === 0) {
      const singleResult = parseClaim(content);
      if (singleResult.success && singleResult.claim) {
        claims.push(singleResult.claim);
      }
    }

    return claims;
  }

  /**
   * Process the verification queue
   */
  private async processQueue(): Promise<void> {
    if (this.isVerifying || this.verificationQueue.length === 0) return;

    this.isVerifying = true;

    while (this.verificationQueue.length > 0) {
      const detected = this.verificationQueue.shift()!;

      try {
        if (this.config.gitAware) {
          // Git-aware verification shows missed files
          // Note: context detection not yet supported in diff mode
          const result = await verifyClaimAgainstDiff(detected.claim, {
            cwd: this.config.cwd,
            diffSource: 'all',
          });
          detected.result = result;
          detected.verified = result.verified;
        } else {
          const result = await verifyClaim(detected.claim, {
            cwd: this.config.cwd,
            detectContexts: true,
            minPriority: this.config.codeOnly ? 'high' : undefined,
          });
          detected.result = result;
          detected.verified = result.verified;
        }

        this.emit('verified', detected);
      } catch (error) {
        this.emit('error', error instanceof Error ? error : new Error(String(error)));
      }
    }

    this.isVerifying = false;
  }

  /**
   * Generate unique key for a claim
   */
  private claimKey(claim: ParsedClaim): string {
    return `${claim.action}:${claim.oldValue}:${claim.newValue || ''}`;
  }
}

/**
 * Create and start a watch session
 */
export async function createWatchSession(config: WatchSessionConfig): Promise<WatchSession> {
  const session = new WatchSession(config);
  await session.start();
  return session;
}
