# CLAUDE.md - Project Context

This file provides context for AI assistants working on this project.

## Project Overview

**repo-file-sync** is a GitHub Actions composite action that automatically synchronizes files from multiple source repositories to a target repository and creates Pull Requests with the changes.

## Purpose

- Synchronize common files (documentation, configuration, templates) across repositories
- Keep files up-to-date from upstream/source repositories
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
4. **Copy Files**: Copies matched files maintaining source path structure
5. **Detect Changes**: Runs `git status --porcelain`
6. **Create Branch**: Creates timestamped branch (`repo-file-sync/update-YYYY-MM-DD-HH-MM-SS`)
7. **Commit & Push**: Commits changes and pushes to remote
8. **Create PR**: Uses `gh pr create` via `Bun.spawn` (labels are optional)

### Configuration Format

```yaml
repos:
  owner/repo-name:
    files:
      - README.md           # Specific files
      - "*.md"              # Glob patterns
      - docs/**/*.yaml      # Nested patterns
      - .github/workflows/  # Directories
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

#### PR Creation Strategy
- PRs are created WITHOUT labels first (to avoid label-not-found errors)
- Labels are added in a separate step using `gh pr edit` (failures are non-fatal)
- This prevents PR creation failures due to missing labels

#### Branch Naming
- Format: `{branch-prefix}-YYYY-MM-DD-HH-MM-SS`
- Includes timestamp with minutes to avoid conflicts on multiple runs

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
- Glob pattern matching
- PR creation with detailed body
- Optional label handling
- Local and CI testing

## Known Issues / Limitations

1. **Labels**: Labels must exist in the repository or they'll be skipped (warning only)
2. **Authentication**: Currently uses `GITHUB_TOKEN` (works for same org/public repos)
3. **File Conflicts**: Overwrites files without merge conflict detection
4. **Large Files**: No special handling for large files or LFS

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

**"Label not found" errors**
- Status: Working as intended (labels are now optional)
- Labels are added via separate `gh pr edit` command after PR creation

## Reference Links

- Bun YAML docs: https://bun.com/docs/api/yaml
- GitHub Actions permissions: https://docs.github.com/en/actions/security-guides/automatic-token-authentication
- Composite actions: https://docs.github.com/en/actions/creating-actions/creating-a-composite-action
