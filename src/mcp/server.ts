/**
 * ClaimCheck MCP Server
 *
 * MCP server providing claim verification tools for AI assistants.
 * Allows AI to verify its own claims about code changes.
 */

import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { z } from 'zod';
import { verifyClaim } from '../core/analyzer/result-analyzer.js';
import { verifyClaimAgainstDiff, type DiffSource } from '../core/analyzer/diff-analyzer.js';
import { parseClaim, parseMultipleClaims } from '../core/parser/claim-parser.js';
import { isGitRepo } from '../core/git/git-utils.js';
import { checkRipgrep } from '../core/verifier/search-engine.js';
import type { VerificationResult } from '../types/index.js';
import type { DiffVerificationResult } from '../core/analyzer/diff-analyzer.js';

/**
 * Configuration for the ClaimCheck MCP server
 */
export interface ClaimCheckServerConfig {
  /** Working directory for searches (defaults to cwd) */
  cwd?: string;

  /** Server name */
  name?: string;

  /** Server version */
  version?: string;
}

/**
 * ClaimCheck MCP Server
 *
 * Provides three tools:
 * - claimcheck_verify: Verify a claim by searching for remaining references
 * - claimcheck_verify_diff: Verify a claim against git changes (smarter)
 * - claimcheck_detect: Detect verifiable claims in text
 */
export class ClaimCheckServer {
  private server: McpServer;
  private cwd: string;

  constructor(config: ClaimCheckServerConfig = {}) {
    this.cwd = config.cwd || process.cwd();

    this.server = new McpServer(
      {
        name: config.name || 'claimcheck',
        version: config.version || '0.2.0',
      },
      {
        capabilities: {
          tools: {},
        },
      }
    );

    this.registerTools();
  }

  /**
   * Start the server
   */
  async start(): Promise<void> {
    // Verify ripgrep is available
    const hasRipgrep = await checkRipgrep();
    if (!hasRipgrep) {
      console.error(
        'Warning: ripgrep (rg) not found. Install it for claimcheck to work: https://github.com/BurntSushi/ripgrep'
      );
    }

    const transport = new StdioServerTransport();
    await this.server.connect(transport);
  }

  /**
   * Register MCP tools
   */
  private registerTools(): void {
    // claimcheck_verify tool - basic verification
    this.server.registerTool(
      'claimcheck_verify',
      {
        description:
          'Verify a claim about code changes by searching for remaining references. ' +
          'Use this AFTER making code changes to verify that a refactor or removal was complete. ' +
          'Example claims: "I renamed UserService to AuthService", "I removed all console.log statements"',
        inputSchema: {
          claim: z.string().describe('The claim to verify (e.g., "I renamed UserService to AuthService")'),
          cwd: z.string().optional().describe('Working directory to search in (defaults to current directory)'),
          code_only: z
            .boolean()
            .optional()
            .describe('Only show matches in actual code (not comments/docs). Default: false'),
        },
      },
      async (args) => {
        return this.handleVerify(args as { claim: string; cwd?: string; code_only?: boolean });
      }
    );

    // claimcheck_verify_diff tool - git-aware verification
    this.server.registerTool(
      'claimcheck_verify_diff',
      {
        description:
          'Verify a claim against actual git changes. This is SMARTER than basic verify - ' +
          'it identifies files that contain references but were NOT modified. ' +
          'Use this after making changes to find files you may have missed.',
        inputSchema: {
          claim: z.string().describe('The claim to verify'),
          cwd: z.string().optional().describe('Working directory (defaults to current directory)'),
          source: z
            .enum(['staged', 'commit', 'working', 'all'])
            .optional()
            .describe('Diff source: staged, commit, working, or all (default: all)'),
          commit: z.string().optional().describe('Commit hash (required if source is "commit")'),
        },
      },
      async (args) => {
        return this.handleVerifyDiff(
          args as { claim: string; cwd?: string; source?: DiffSource; commit?: string }
        );
      }
    );

    // claimcheck_detect tool - detect claims in text
    this.server.registerTool(
      'claimcheck_detect',
      {
        description:
          'Detect verifiable claims in text. Use this to parse AI responses or commit messages ' +
          'to find claims that can be verified.',
        inputSchema: {
          text: z.string().describe('Text to parse for claims'),
        },
      },
      async (args) => {
        return this.handleDetect(args as { text: string });
      }
    );
  }

  /**
   * Handle claimcheck_verify tool call
   */
  private async handleVerify(args: {
    claim: string;
    cwd?: string;
    code_only?: boolean;
  }): Promise<{ content: Array<{ type: 'text'; text: string }> }> {
    const cwd = args.cwd || this.cwd;

    // Parse the claim
    const parseResult = parseClaim(args.claim);
    if (!parseResult.success || !parseResult.claim) {
      return {
        content: [
          {
            type: 'text',
            text: `Failed to parse claim: ${parseResult.error || 'Unknown error'}\n\nTry phrasing like: "I renamed X to Y" or "I removed all X"`,
          },
        ],
      };
    }

    try {
      const result = await verifyClaim(parseResult.claim, {
        cwd,
        detectContexts: true,
        minPriority: args.code_only ? 'high' : undefined,
      });

      return {
        content: [
          {
            type: 'text',
            text: this.formatVerificationResult(result),
          },
        ],
      };
    } catch (error) {
      return {
        content: [
          {
            type: 'text',
            text: `Verification failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
          },
        ],
      };
    }
  }

  /**
   * Handle claimcheck_verify_diff tool call
   */
  private async handleVerifyDiff(args: {
    claim: string;
    cwd?: string;
    source?: DiffSource;
    commit?: string;
  }): Promise<{ content: Array<{ type: 'text'; text: string }> }> {
    const cwd = args.cwd || this.cwd;
    const source = args.source || 'all';

    // Check if we're in a git repo
    const inGitRepo = await isGitRepo(cwd);
    if (!inGitRepo) {
      return {
        content: [
          {
            type: 'text',
            text: 'Not a git repository. Use claimcheck_verify instead for non-git directories.',
          },
        ],
      };
    }

    // Validate source and commit
    if (source === 'commit' && !args.commit) {
      return {
        content: [
          {
            type: 'text',
            text: 'Commit hash is required when source is "commit"',
          },
        ],
      };
    }

    // Parse the claim
    const parseResult = parseClaim(args.claim);
    if (!parseResult.success || !parseResult.claim) {
      return {
        content: [
          {
            type: 'text',
            text: `Failed to parse claim: ${parseResult.error || 'Unknown error'}`,
          },
        ],
      };
    }

    try {
      const result = await verifyClaimAgainstDiff(parseResult.claim, {
        cwd,
        diffSource: source,
        commit: args.commit,
      });

      return {
        content: [
          {
            type: 'text',
            text: this.formatDiffResult(result),
          },
        ],
      };
    } catch (error) {
      return {
        content: [
          {
            type: 'text',
            text: `Verification failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
          },
        ],
      };
    }
  }

  /**
   * Handle claimcheck_detect tool call
   */
  private handleDetect(args: { text: string }): {
    content: Array<{ type: 'text'; text: string }>;
  } {
    const results = parseMultipleClaims(args.text);

    // Also try single claim if no results
    if (results.length === 0) {
      const single = parseClaim(args.text);
      if (single.success && single.claim) {
        results.push(single);
      }
    }

    const claims = results.filter((r) => r.success && r.claim).map((r) => r.claim!);

    if (claims.length === 0) {
      return {
        content: [
          {
            type: 'text',
            text: 'No verifiable claims detected.\n\nLook for claims like:\n- "renamed X to Y"\n- "removed all X"\n- "updated X to Y"',
          },
        ],
      };
    }

    const lines: string[] = [];
    lines.push(`Found ${claims.length} verifiable claim(s):\n`);

    for (let i = 0; i < claims.length; i++) {
      const claim = claims[i];
      let desc = `${i + 1}. ${claim.action}`;
      if (claim.action === 'rename' || claim.action === 'update') {
        desc += ` "${claim.oldValue}" → "${claim.newValue}"`;
      } else {
        desc += ` "${claim.oldValue}"`;
      }
      lines.push(desc);
    }

    lines.push('\nUse claimcheck_verify or claimcheck_verify_diff to verify these claims.');

    return {
      content: [
        {
          type: 'text',
          text: lines.join('\n'),
        },
      ],
    };
  }

  /**
   * Format a verification result for display
   */
  private formatVerificationResult(result: VerificationResult): string {
    const lines: string[] = [];
    const { claim } = result;

    // Header
    let claimDesc = `Claim: ${claim.action}`;
    if (claim.action === 'rename' || claim.action === 'update') {
      claimDesc += ` "${claim.oldValue}" → "${claim.newValue}"`;
    } else {
      claimDesc += ` "${claim.oldValue}"`;
    }
    lines.push(claimDesc);
    lines.push('');

    if (result.verified) {
      lines.push('✓ VERIFIED - No remaining references found');
    } else {
      lines.push(`✗ INCOMPLETE - Found ${result.summary.totalMatches} remaining reference(s)`);
      lines.push('');

      // Group by file
      const byFile = new Map<string, typeof result.remainingReferences>();
      for (const ref of result.remainingReferences) {
        const existing = byFile.get(ref.file) || [];
        existing.push(ref);
        byFile.set(ref.file, existing);
      }

      for (const [file, refs] of byFile) {
        lines.push(`  ${file}:`);
        for (const ref of refs.slice(0, 3)) {
          const ctx = ref.matchContext ? `[${ref.matchContext}] ` : '';
          lines.push(`    :${ref.line} ${ctx}${ref.content.trim().slice(0, 60)}`);
        }
        if (refs.length > 3) {
          lines.push(`    ... and ${refs.length - 3} more`);
        }
      }
    }

    lines.push('');
    lines.push(`Duration: ${result.duration}ms`);

    return lines.join('\n');
  }

  /**
   * Format a diff verification result for display
   */
  private formatDiffResult(result: DiffVerificationResult): string {
    const lines: string[] = [];
    const { claim } = result;

    // Header
    let claimDesc = `Claim: ${claim.action}`;
    if (claim.action === 'rename' || claim.action === 'update') {
      claimDesc += ` "${claim.oldValue}" → "${claim.newValue}"`;
    } else {
      claimDesc += ` "${claim.oldValue}"`;
    }
    lines.push(claimDesc);
    lines.push('');

    // Modified files
    lines.push(`Modified files: ${result.modifiedFiles.length}`);

    if (result.verified) {
      lines.push('');
      lines.push('✓ VERIFIED - All files with references were modified');
    } else {
      lines.push('');
      lines.push(`✗ INCOMPLETE - ${result.missedFiles.length} file(s) with references were NOT modified:`);
      lines.push('');

      for (const missed of result.missedFiles) {
        lines.push(`  ${missed.file} (${missed.references.length} reference(s))`);
        lines.push(`    └─ ${missed.suggestion}`);
      }
    }

    lines.push('');
    lines.push(`Duration: ${result.duration}ms`);

    return lines.join('\n');
  }
}

/**
 * Create and start the ClaimCheck MCP server
 */
export async function startClaimCheckServer(config?: ClaimCheckServerConfig): Promise<ClaimCheckServer> {
  const server = new ClaimCheckServer(config);
  await server.start();
  return server;
}

// CLI entry point
const isMainModule = process.argv[1]?.endsWith('server.js') || process.argv[1]?.endsWith('server.ts');
if (isMainModule) {
  startClaimCheckServer().catch((error) => {
    console.error('Failed to start ClaimCheck MCP server:', error);
    process.exit(1);
  });
}
