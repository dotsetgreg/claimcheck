# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

**ClaimCheck** is a CLI tool that verifies AI claims about code changes against the actual codebase. When an AI assistant says "I renamed UserService to AuthService everywhere", ClaimCheck searches for remaining references to detect incomplete refactors.

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

# Check a commit message
pnpm exec claimcheck check-commit HEAD
```

## Architecture

```
src/
├── cli/
│   ├── index.ts              # CLI entry point (Commander)
│   ├── commands/
│   │   ├── verify.ts         # Main verify command
│   │   └── check-commit.ts   # Verify from commit message
│   └── ui/
│       ├── reporter.ts       # Output formatting (pretty, json, summary)
│       └── spinner.ts        # Progress indicators (ora)
├── core/
│   ├── parser/
│   │   ├── claim-parser.ts   # NLP claim extraction
│   │   ├── patterns.ts       # Regex patterns for claim types
│   │   └── variant-generator.ts # Generate naming variants
│   ├── verifier/
│   │   ├── search-engine.ts  # ripgrep wrapper
│   │   └── file-filter.ts    # File type filtering
│   └── analyzer/
│       └── result-analyzer.ts # Analyze search results
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

### Variant Detection
When searching for a term, ClaimCheck generates naming convention variants:
- `UserService` → `UserService`, `userService`, `user_service`, `USER_SERVICE`, `user-service`

### Search Engine
Uses ripgrep (rg) for fast, .gitignore-respecting searches. Returns structured references with file, line, column, and context.

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

- `0`: Claim verified (no remaining references)
- `1`: Discrepancies found (references remain)
- `2`: Runtime error
