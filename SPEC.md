# repo-file-sync Specification

## Overview

`repo-file-sync` is a GitHub Actions workflow that synchronizes files from specified source repositories to the repository where the action is executed. It reads configuration from `.github/repo-file-sync.yaml` and creates a Pull Request with the synchronized files.

## Purpose

- Synchronize common files (documentation, configuration files, etc.) across multiple repositories
- Keep files up-to-date from source repositories
- Automate file synchronization through GitHub Actions

## Features

- Support multiple source repositories
- Support file patterns with wildcards (e.g., `*.md`, `*.yaml`)
- Support directory synchronization
- Text replacement with regex patterns during synchronization
- Fixed branch name with force push for consistent updates
- Create or update a single PR containing all changes
- Preserve source file paths in destination repository

## Implementation

### Technology Stack

- **Runtime**: Bun (JavaScript/TypeScript runtime)
- **Language**: TypeScript with Bun Shell
- **YAML Parser**: `Bun.YAML` (native YAML support)
- **Shell Operations**: `Bun.$` for git and file operations
- **Action Type**: Composite Action

### Project Structure

```
repo-file-sync/
├── action.yaml          # Composite action definition
├── src/
│   └── main.ts          # Main TypeScript implementation
├── package.json         # Bun dependencies and scripts
├── tsconfig.json        # TypeScript configuration
├── SPEC.md              # This specification
└── README.md            # Usage documentation
```

### Why Bun?

- Native YAML parsing with `Bun.YAML.parse()`
- Fast TypeScript execution without transpilation
- Integrated shell scripting with `Bun.$`
- Official GitHub Actions support via `oven-sh/setup-bun`
- Single binary, no complex build process

## Workflow Type

This is a **composite action** that can be used in any GitHub Actions workflow.

## Configuration File

### Location

`.github/repo-file-sync.yaml`

### Format

#### Basic Format (Files Only)

```yaml
repos:
  owner/repo1:
    files:
      - README.md
      - docs/*.md
      - .github/workflows/
  owner/repo2:
    files:
      - LICENSE
      - "*.txt"
```

#### Advanced Format (With Text Replacements)

```yaml
repos:
  owner/repo1:
    files:
      README.md:
        replacements:
          - pattern: 'original-text'
            replacement: 'new-text'
            flags: 'g'
          - pattern: 'https://example\.com'
            replacement: 'https://mysite.com'
            flags: 'gi'
      docs/*.md:
        replacements:
          - pattern: '\bfoo\b'
            replacement: 'bar'
            flags: 'g'
      .github/workflows/:
        # No replacements, sync as-is
```

#### Mixed Format

```yaml
repos:
  owner/repo:
    files:
      - LICENSE              # Simple file path (no replacements)
      README.md:             # File with replacements
        replacements:
          - pattern: 'old'
            replacement: 'new'
            flags: 'g'
      - docs/*.md            # Glob pattern (no replacements)
```

### Configuration Schema

- `repos`: Object containing source repositories
  - Key: Repository identifier in `owner/repo` format
  - Value: Object containing file configuration
    - `files`: Array or Object containing file paths and optional replacement rules
      - **Array format**: List of file/directory paths (no text replacement)
        - Supports wildcards (e.g., `*.md`, `**/*.yaml`)
        - Supports directory paths (trailing `/` is optional)
      - **Object format**: File path as key, configuration as value
        - `replacements`: Array of replacement rules (optional)
          - `pattern`: Regular expression pattern (string)
          - `replacement`: Replacement text (string)
          - `flags`: Regex flags (string, e.g., `'g'`, `'gi'`, `'gm'`)
      - **Mixed format**: Can combine both array items and object entries

## Authentication

- Uses `GITHUB_TOKEN` (GitHub Actions default token)
- Sufficient for accessing public repositories and repositories within the same organization
- For cross-organization access, consider using Personal Access Token (future enhancement)

## Behavior

### File Synchronization

1. Read `.github/repo-file-sync.yaml` from the target repository
2. For each configured source repository:
   - Clone or fetch the source repository
   - Match files based on the specified patterns
   - Apply regex text replacements if configured
   - Copy matched files to the same relative path in the target repository
3. If changes are detected:
   - Check if the branch already exists remotely
   - If exists: checkout the existing branch and reset to main
   - If not exists: create a new branch from main
   - Commit all changes
   - Force push to update the branch (keeps existing PR open)
4. Check for existing Pull Request for the branch:
   - If PR exists: update the PR title, body, and labels
   - If not exists: create a new Pull Request

### Pull Request and Branch Management

- **Branch naming**: Fixed name `repo-file-sync` (no timestamp)
- **Branch updates**: Force push to keep the same branch and PR open
- **PR behavior**: Single PR is created once, then updated on subsequent runs
- **PR title**: `chore: sync files from source repositories` (configurable)
- **PR body**: List of synchronized files and their source repositories
- **Single PR**: All changes from multiple repositories are included in one PR

### File Placement

- Files are placed at the **same relative path** as in the source repository
- Example:
  - Source: `owner/repo:docs/README.md`
  - Destination: `docs/README.md` (same path)

## Inputs

| Name | Description | Required | Default |
|------|-------------|----------|---------|
| `config-path` | Path to configuration file | No | `.github/repo-file-sync.yaml` |
| `token` | GitHub token for authentication | No | `${{ github.token }}` |
| `branch-name` | Fixed branch name for synchronization | No | `repo-file-sync` |
| `branch-prefix` | **DEPRECATED** - Use `branch-name` instead | No | (ignored) |
| `commit-message` | Commit message template | No | `chore: sync files from source repositories` |
| `pr-title` | Pull Request title | No | `chore: sync files from source repositories` |

## Outputs

| Name | Description |
|------|-------------|
| `pr-number` | Created Pull Request number (empty if no changes) |
| `pr-url` | Created Pull Request URL (empty if no changes) |
| `files-synced` | Number of files synchronized |
| `changes-detected` | Whether changes were detected (`true` or `false`) |

## Error Handling

- If configuration file doesn't exist, skip the workflow
- If source repository is not accessible, log error and skip that repository
- If no changes detected, skip PR creation
- Report all errors in workflow logs

## Future Enhancements

- Support for custom destination paths (different from source path)
- Support for file exclusion patterns
- Support for branch specification in source repositories
- Support for auto-merge when CI passes
- Support for dry-run mode
- Repository-specific PRs (one PR per source repository)
