# ClaimCheck

Verify AI claims about code changes against your actual codebase.

## Problem

AI coding assistants confidently claim to have completed refactors ("I renamed all references from X to Y") but frequently miss files, leaving orphaned references that cause bugs days later.

## Solution

ClaimCheck parses AI claims about code changes and verifies them against the actual codebase, reporting discrepancies.

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

## Usage

### Verify a Claim

```bash
# Basic usage
claimcheck verify "I renamed UserService to AuthService everywhere"

# With options
claimcheck verify "removed all console.logs" --include "src/**/*.ts"
claimcheck verify "renamed config to settings" --case-sensitive
claimcheck verify "updated lodash imports" --format json
```

### Check a Commit Message

```bash
# Check the most recent commit
claimcheck check-commit HEAD

# Check a specific commit
claimcheck check-commit abc1234
```

### Options

| Option | Description | Default |
|--------|-------------|---------|
| `-f, --format <format>` | Output format: `pretty`, `json`, `summary` | `pretty` |
| `-i, --include <patterns...>` | Glob patterns to include | all files |
| `-e, --exclude <patterns...>` | Glob patterns to exclude | common ignores |
| `-c, --case-sensitive` | Case sensitive search | `false` |
| `-C, --context <lines>` | Context lines around matches | `2` |
| `--cwd <directory>` | Working directory to search | current dir |

## Example Output

```
$ claimcheck verify "I renamed UserService to AuthService everywhere"

✗ Verifying claim...

   Claim: rename "UserService" → "AuthService"
   Searching for: UserService, userService, user_service, USER_SERVICE

────────────────────────────────────────────────────────────

✗ INCOMPLETE - Found 4 remaining reference(s)

   src/docs/architecture.md
   │ :47       The UserService handles all authentication...

   src/tests/integration/auth.test.ts
   │ :12       import { UserService } from '../services';

   README.md
   │ :89       See `UserService` for authentication details.

   src/config/di.ts
   │ :23       container.register('UserService', AuthService);

────────────────────────────────────────────────────────────

Summary
   Files with matches: 4
   Total matches: 4
   Duration: 45ms

Tip: Run the refactor again or manually update these files.
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
- "Replaced axios with fetch"
- "Migrated from moment to dayjs"

## Variant Detection

ClaimCheck automatically searches for naming convention variants:

| Input | Variants Searched |
|-------|-------------------|
| `UserService` | `UserService`, `userService`, `user_service`, `USER_SERVICE`, `user-service` |
| `getUserById` | `getUserById`, `GetUserById`, `get_user_by_id`, `GET_USER_BY_ID`, `get-user-by-id` |

## Exit Codes

| Code | Meaning |
|------|---------|
| `0` | Claim verified - no remaining references found |
| `1` | Discrepancies found - remaining references exist |
| `2` | Runtime error |

## Programmatic API

```typescript
import { parseClaim, verifyClaim, generateVariants } from 'claimcheck';

// Parse a claim
const { success, claim } = parseClaim('I renamed UserService to AuthService');

// Verify a claim
const result = await verifyClaim(claim, { cwd: process.cwd() });
console.log(result.verified); // false if references remain

// Generate naming variants
const variants = generateVariants('UserService');
console.log(variants.all); // ['UserService', 'userService', 'user_service', ...]
```

## License

MIT
