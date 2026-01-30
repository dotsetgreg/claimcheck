# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

**ClaimCheck** is a CLI tool that verifies AI claims about code changes against the actual codebase. When an AI assistant says "I renamed UserService to AuthService everywhere", ClaimCheck searches for remaining references to detect incomplete refactors.

**Key Features:**
- Context-aware search (distinguishes code vs comments/strings)
- Git-aware verification (identifies files with references that weren't modified)
- Smart claim parsing (extracts claims from natural language)

## Build Commands

```bash
pnpm install              # Install dependencies
pnpm run build            # Build with tsup (outputs to ./dist)
pnpm run dev              # Build in watch mode
pnpm run test             # Run vitest tests
pnpm run test:run         # Run tests once (no watch)
pnpm run lint             # ESLint TypeScript files
pnpm run typecheck        # TypeScript type checking
pnpm run format           # Format with Prettier
```

## Running the CLI

```bash
# After building
./dist/cli/index.js verify "I renamed UserService to AuthService"

# Or via pnpm
pnpm exec claimcheck verify "claim text"

# All commands
pnpm exec claimcheck verify "claim"           # Basic verification
pnpm exec claimcheck verify-diff "claim"      # Git-aware verification
pnpm exec claimcheck detect-claims "text"     # Extract claims from text
pnpm exec claimcheck check-commit HEAD        # Verify commit message claims
```

## Architecture

```
src/
├── cli/
│   ├── index.ts              # CLI entry point (Commander)
│   ├── commands/
│   │   ├── verify.ts         # Basic verification command
│   │   ├── verify-diff.ts    # Git-aware verification command
│   │   ├── detect-claims.ts  # Claim extraction command
│   │   └── check-commit.ts   # Verify from commit message
│   └── ui/
│       ├── reporter.ts       # Verification output formatting
│       ├── diff-reporter.ts  # Diff verification output formatting
│       └── spinner.ts        # Progress indicators (ora)
├── core/
│   ├── parser/
│   │   ├── claim-parser.ts   # NLP claim extraction
│   │   ├── patterns.ts       # Regex patterns for claim types
│   │   └── variant-generator.ts # Generate naming variants
│   ├── verifier/
│   │   ├── search-engine.ts  # ripgrep wrapper
│   │   └── file-filter.ts    # File type filtering
│   ├── analyzer/
│   │   ├── result-analyzer.ts # Basic verification analysis
│   │   ├── diff-analyzer.ts   # Git-aware verification
│   │   └── context-detector.ts # Code vs comment detection
│   └── git/
│       └── git-utils.ts      # Git diff utilities
├── types/
│   └── index.ts              # TypeScript interfaces
├── utils/
│   ├── logger.ts
│   └── constants.ts
└── index.ts                  # Programmatic API exports
```

## Key Concepts

### Claim Types
- `rename`: X was renamed to Y (search for remaining X)
- `remove`: X was removed (search for remaining X)
- `update`: X was replaced with Y (search for remaining X)
- `add`: Y was added (verify Y exists - future)

### Context Detection
Each match is analyzed to determine if it's in:
- `code`: Actual code (high priority)
- `import`: Import/require statements (high priority)
- `string`: String literals (medium priority in tests)
- `comment`: Comments and documentation (low priority)

Use `--code-only` to filter to high-priority matches only.

### Variant Detection
When searching for a term, ClaimCheck generates naming convention variants:
- `UserService` → `UserService`, `userService`, `user_service`, `USER_SERVICE`, `user-service`

### Git-Aware Verification
The `verify-diff` command compares claims against actual git changes:
- Gets list of modified files from git
- Searches for references in all files
- Identifies "missed files" - files with references that weren't modified

### Search Engine
Uses ripgrep (rg) for fast, .gitignore-respecting searches. Returns structured references with file, line, column, context, and match type.

## External Dependencies

- **ripgrep (rg)**: Must be installed on the system. Provides fast codebase searching.

## Tech Stack

- TypeScript 5.7+ with strict mode
- ESM modules
- Commander for CLI
- Chalk for colors
- Ora for spinners
- Vitest for testing
- tsup for building

## Exit Codes

- `0`: Claim verified (no remaining references) / claims detected
- `1`: Discrepancies found (references remain) / no claims found
- `2`: Runtime error
