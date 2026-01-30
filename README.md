# ClaimCheck

Verify AI claims about code changes against your actual codebase.

## Problem

AI coding assistants confidently claim to have completed refactors ("I renamed all references from X to Y") but frequently miss files, leaving orphaned references that cause bugs days later.

## Solution

ClaimCheck parses AI claims about code changes and verifies them against the actual codebase, reporting discrepancies. It goes beyond simple grep by:

- **Understanding context**: Distinguishes between matches in code vs comments/strings
- **Git-aware verification**: Compares claims against actual file changes to identify missed files
- **Smart claim detection**: Parses natural language claims from AI responses

## Installation

```bash
# Install globally
npm install -g claimcheck

# Or run with npx
npx claimcheck verify "I renamed UserService to AuthService"
```

### Prerequisites

ClaimCheck requires [ripgrep](https://github.com/BurntSushi/ripgrep) to be installed:

```bash
# macOS
brew install ripgrep

# Ubuntu/Debian
sudo apt-get install ripgrep

# Windows (scoop)
scoop install ripgrep

# Windows (chocolatey)
choco install ripgrep
```

## Commands

### `verify` - Verify a Claim

Search for remaining references to verify a claim was completed.

```bash
# Basic usage
claimcheck verify "I renamed UserService to AuthService everywhere"

# Only show matches in actual code (not comments/docs)
claimcheck verify "removed all console.logs" --code-only

# With file filters
claimcheck verify "removed console.logs" --include "src/**/*.ts"

# JSON output for scripting
claimcheck verify "updated lodash imports" --format json
```

**Options:**
| Option | Description | Default |
|--------|-------------|---------|
| `-f, --format <format>` | Output format: `pretty`, `json`, `summary` | `pretty` |
| `-i, --include <patterns...>` | Glob patterns to include | all files |
| `-e, --exclude <patterns...>` | Glob patterns to exclude | common ignores |
| `-c, --case-sensitive` | Case sensitive search | `false` |
| `-C, --context <lines>` | Context lines around matches | `2` |
| `--code-only` | Only show matches in code (exclude comments/strings/docs) | `false` |
| `--cwd <directory>` | Working directory to search | current dir |

### `verify-diff` - Git-Aware Verification

Compare claims against actual git changes to identify files you missed.

```bash
# Check against all uncommitted changes
claimcheck verify-diff "I renamed UserService to AuthService"

# Check against staged changes only
claimcheck verify-diff "removed debugger calls" --source staged

# Check against a specific commit
claimcheck verify-diff "updated config" --source commit --commit abc1234
```

**Options:**
| Option | Description | Default |
|--------|-------------|---------|
| `-s, --source <source>` | Diff source: `staged`, `commit`, `working`, `all` | `all` |
| `--commit <hash>` | Commit hash (required if source is `commit`) | |
| Plus all options from `verify` | | |

### `detect-claims` - Parse Text for Claims

Extract verifiable claims from AI responses or commit messages.

```bash
# From command line
claimcheck detect-claims "I renamed UserService to AuthService and removed all console.logs"

# From stdin (pipe AI responses)
pbpaste | claimcheck detect-claims
cat ai-response.txt | claimcheck detect-claims

# JSON output for processing
echo "Renamed config to settings" | claimcheck detect-claims --format json
```

### `check-commit` - Verify Commit Message Claims

Parse claims from a git commit message and verify them.

```bash
# Check the most recent commit
claimcheck check-commit HEAD

# Check a specific commit
claimcheck check-commit abc1234
```

## Example Output

### Basic Verification
```
$ claimcheck verify "I renamed UserService to AuthService"

   Claim: rename "UserService" → "AuthService"
   Searching for: UserService, userService, user_service, USER_SERVICE
────────────────────────────────────────────────────────────

✗ INCOMPLETE - Found 4 remaining reference(s)

   src/services/auth.ts
   │ :12        [code] import { UserService } from './user';

   src/docs/architecture.md
   │ :47        [comment] The UserService handles authentication...

   src/tests/auth.test.ts
   │ :8         [string] describe('UserService', () => {

────────────────────────────────────────────────────────────

Summary
   Files with matches: 3
   Total matches: 4
   In code/imports: 1 (comments: 1, strings: 2)
   Duration: 23ms
```

### Git-Aware Verification
```
$ claimcheck verify-diff "I renamed UserService to AuthService"

   Claim: rename "UserService" → "AuthService"
──────────────────────────────────────────────────────────────────────

Modified Files (3)
   ~ src/services/auth.ts
   ~ src/services/index.ts
   ~ src/types/user.ts

✗ INCOMPLETE - Found 2 file(s) with references that were NOT modified

Missed Files (need attention):

   src/docs/architecture.md (1 reference(s))
   │ :47        The UserService handles authentication...
   └─ Update documentation to reflect the change

   src/tests/auth.test.ts (2 reference(s))
   │ :8         describe('UserService', () => {
   │ :15        const service = new UserService();
   └─ Update test file to use new name/value
```

## Supported Claim Types

ClaimCheck recognizes several types of claims:

### Rename
- "I renamed UserService to AuthService"
- "Changed oldName to newName everywhere"
- "Renamed config -> settings"

### Remove
- "I removed all console.log statements"
- "Deleted all debugger calls"
- "Got rid of the legacy API"

### Update
- "Updated imports from lodash to lodash-es"
- "Updated lodash imports to lodash-es"
- "Replaced axios with fetch"
- "Migrated from moment to dayjs"

### Multiple Claims
ClaimCheck can detect multiple claims in a single text:
- Bullet points: "- Renamed X\n- Removed Y"
- Conjunctions: "I renamed X to Y and removed all Z"

## Context Detection

ClaimCheck analyzes each match to determine its context:

| Context | Priority | Description |
|---------|----------|-------------|
| `[code]` | High | Actual code that needs updating |
| `[import]` | High | Import/require statements |
| `[string]` | Medium | String literals (often test data) |
| `[comment]` | Low | Comments and documentation |

Use `--code-only` to filter to high-priority matches only.

## Variant Detection

ClaimCheck automatically searches for naming convention variants:

| Input | Variants Searched |
|-------|-------------------|
| `UserService` | `UserService`, `userService`, `user_service`, `USER_SERVICE`, `user-service` |
| `getUserById` | `getUserById`, `GetUserById`, `get_user_by_id`, `GET_USER_BY_ID`, `get-user-by-id` |

## Exit Codes

| Code | Meaning |
|------|---------|
| `0` | Claim verified / claims detected |
| `1` | Discrepancies found / no claims detected |
| `2` | Runtime error |

## MCP Server (for AI Assistants)

ClaimCheck includes an MCP (Model Context Protocol) server that allows AI assistants like Claude to verify their own claims about code changes.

### Setup

Add to your Claude Code MCP settings (`~/.claude/mcp_settings.json`):

```json
{
  "mcpServers": {
    "claimcheck": {
      "command": "npx",
      "args": ["claimcheck-mcp"],
      "env": {}
    }
  }
}
```

Or if installed globally:

```json
{
  "mcpServers": {
    "claimcheck": {
      "command": "claimcheck-mcp"
    }
  }
}
```

### Available Tools

The MCP server provides three tools:

| Tool | Description |
|------|-------------|
| `claimcheck_verify` | Verify a claim by searching for remaining references |
| `claimcheck_verify_diff` | Verify against git changes (smarter - finds missed files) |
| `claimcheck_detect` | Detect verifiable claims in text |

### For AI Assistants

Add this to your project's `CLAUDE.md` to instruct the AI to verify its claims:

```markdown
## Claim Verification

After completing refactors (renames, removals, updates), use the claimcheck MCP tools
to verify your changes:

1. Use `claimcheck_verify_diff` after making changes to check for missed files
2. Use `claimcheck_verify` with `code_only: true` to find remaining code references
3. If verification fails, fix the missed references before reporting completion
```

## Programmatic API

```typescript
import {
  parseClaim,
  parseMultipleClaims,
  verifyClaim,
  verifyClaimAgainstDiff,
  generateVariants,
  detectContext,
  startClaimCheckServer, // MCP server
} from 'claimcheck';

// Parse a single claim
const { success, claim } = parseClaim('I renamed UserService to AuthService');

// Parse multiple claims from text
const results = parseMultipleClaims('Renamed X to Y and removed Z');

// Verify a claim (basic search)
const result = await verifyClaim(claim, {
  cwd: process.cwd(),
  detectContexts: true,
  minPriority: 'high', // Only code matches
});

// Verify against git changes
const diffResult = await verifyClaimAgainstDiff(claim, {
  cwd: process.cwd(),
  diffSource: 'all',
});
console.log(diffResult.missedFiles); // Files with refs that weren't modified

// Generate naming variants
const variants = generateVariants('UserService');
console.log(variants.all); // ['UserService', 'userService', 'user_service', ...]

// Start MCP server programmatically
const server = await startClaimCheckServer({ cwd: '/path/to/project' });
```

## License

MIT
