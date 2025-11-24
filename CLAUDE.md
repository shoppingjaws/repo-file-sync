# CLAUDE.md - Project Context

This file provides context for AI assistants working on this project.

## Project Overview

**repo-file-sync** is a GitHub Actions composite action that automatically synchronizes files from multiple source repositories to a target repository and creates Pull Requests with the changes.

## Purpose

- Synchronize common files (documentation, configuration, templates) across repositories
- Apply regex-based text replacements to synchronized files
- Keep files up-to-date from upstream/source repositories via a single, updateable PR
- Automate file synchronization via GitHub Actions workflows

## Technology Stack

- **Runtime**: Bun 1.3.3+ (JavaScript/TypeScript runtime)
- **Language**: TypeScript
- **YAML Parsing**: `YAML` from `bun` (requires Bun 1.2.21+)
- **Shell Operations**: `Bun.$` and `Bun.spawn` for git/file operations
- **Action Type**: Composite Action
- **PR Creation**: GitHub CLI (`gh pr create`)

## Key Implementation Details

### File Structure

```
repo-file-sync/
├── action.yaml                    # Composite action definition
├── src/
│   └── main.ts                    # Main implementation
├── .github/
│   ├── repo-file-sync.yaml        # Example/test configuration
│   └── workflows/
│       └── sync-files.yaml        # Self-testing workflow
├── test-local.ts                  # Local testing script
├── package.json                   # Dependencies
├── tsconfig.json                  # TypeScript config
├── SPEC.md                        # Detailed specification
└── README.md                      # User documentation
```

### Core Workflow

1. **Read Configuration**: Loads `.github/repo-file-sync.yaml` from target repo
2. **Clone Sources**: Clones each configured source repository (shallow clone)
3. **Match Files**: Uses `Bun.Glob` to expand patterns and match files
4. **Apply Replacements**: Applies regex text replacements if configured (using `String.replace()` with RegExp)
5. **Copy Files**: Copies matched files maintaining source path structure
6. **Detect Changes**: Runs `git status --porcelain`
7. **Update Branch**: Uses fixed branch name (`repo-file-sync` by default)
   - If branch exists remotely: checkout existing branch and reset to main
   - If not exists: create new branch from main
8. **Commit & Force Push**: Commits changes and force pushes to update branch (keeps PR open)
9. **Update or Create PR**:
   - Checks for existing PR using `gh pr list`
   - If PR exists: updates it using `gh pr edit`
   - If not exists: creates new PR using `gh pr create`

### Configuration Format

#### Basic Format (Files Only)
```yaml
repos:
  owner/repo-name:
    files:
      - README.md           # Specific files
      - "*.md"              # Glob patterns
      - docs/**/*.yaml      # Nested patterns
      - .github/workflows/  # Directories
```

#### Advanced Format (With Text Replacements)
```yaml
repos:
  owner/repo-name:
    files:
      README.md:
        replacements:
          - pattern: '\bcheckout\b'      # Word boundary regex
            replacement: 'CHECKOUT'
            flags: 'g'                    # Global flag
          - pattern: 'v([0-9]+)'          # Capture groups
            replacement: 'VERSION_$1'
            flags: 'g'
      LICENSE:                            # File without replacements
      "*.md":                             # Glob pattern with replacements
        replacements:
          - pattern: 'old-text'
            replacement: 'new-text'
            flags: 'gi'                   # Global + case-insensitive
```

### Important Notes

#### Bun Version Requirements
- **Minimum**: Bun 1.2.21 (for native YAML support)
- **Tested**: Bun 1.3.3
- **Import**: Must use `import { YAML } from "bun"`

#### GitHub Actions Permissions
- Repository settings must allow: "Allow GitHub Actions to create and approve pull requests"
- Workflow needs permissions:
  ```yaml
  permissions:
    contents: write
    pull-requests: write
  ```

#### Branch and PR Strategy
- **Fixed Branch Name**: Uses `repo-file-sync` by default (configurable via `branch-name` input)
- **No Timestamps**: Branch name is fixed to enable PR updates instead of creating new PRs
- **Force Push**: Updates existing branch with force push to keep the same PR open
- **PR Updates**: If PR exists, updates title/body; if not, creates new PR
- **Key Implementation**: Must checkout existing branch first before force push to keep PR open:
  ```typescript
  if (branchExists) {
    await $`git checkout -B ${branchName} origin/${branchName}`.quiet();
    await $`git reset --hard main`.quiet();
    await commitAndPush(message, branchName, true); // force push
  }
  ```

### Testing

#### Local Testing
```bash
bun run test-local.ts
```
- Sets `TEST_MODE=true` to skip PR creation
- Creates `test-workspace/` directory
- Clones and syncs files locally
- Useful for verifying file sync logic

#### Integration Testing
- The repo includes `.github/workflows/sync-files.yaml`
- Triggers on push to main
- Uses `actions/checkout` as test source
- Creates real PRs in the repo

## Current Status

✅ **Working**: All features implemented and tested
- File synchronization from multiple repos
- Glob pattern matching with directory support
- Regex-based text replacements with capture groups and flags
- Fixed branch with force push for PR updates
- PR creation and updates with detailed body
- Local and CI testing

## Known Issues / Limitations

1. **Authentication**: Currently uses `GITHUB_TOKEN` (works for same org/public repos)
2. **File Conflicts**: Overwrites files without merge conflict detection
3. **Large Files**: No special handling for large files or LFS

## Future Enhancements

See SPEC.md "Future Enhancements" section for planned features:
- Custom destination paths
- File exclusion patterns
- Branch specification in source repos
- Auto-merge support
- Dry-run mode

## Development Guidelines

### Adding New Features
1. Update SPEC.md with specification
2. Implement in src/main.ts
3. Add local test case in test-local.ts
4. Update README.md with usage examples
5. Test locally before pushing

### Testing Changes
```bash
# Local test
bun run test-local.ts

# Clean up
rm -rf test-workspace

# Push and test in CI
git add -A && git commit -m "..." && git push
gh run watch
```

### Common Issues

**"YAML.parse is not a function"**
- Solution: Upgrade Bun to 1.2.21+ (`bun upgrade`)
- Ensure: `import { YAML } from "bun"`

**"GitHub Actions is not permitted to create pull requests"**
- Solution: Enable in Settings → Actions → General → Workflow permissions
- Check: "Allow GitHub Actions to create and approve pull requests"

**Branch deletion closes PR**
- Problem: Deleting and recreating a branch closes the associated PR
- Solution: Checkout existing branch first, then reset and force push
- Must use: `git checkout -B ${branch} origin/${branch}` before force push

## Reference Links

- Bun YAML docs: https://bun.com/docs/api/yaml
- GitHub Actions permissions: https://docs.github.com/en/actions/security-guides/automatic-token-authentication
- Composite actions: https://docs.github.com/en/actions/creating-actions/creating-a-composite-action
