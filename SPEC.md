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
- Create a single PR containing all changes
- Preserve source file paths in destination repository

## Workflow Type

This is a **reusable workflow** that can be called from other GitHub Actions workflows.

## Configuration File

### Location

`.github/repo-file-sync.yaml`

### Format

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

### Configuration Schema

- `repos`: Object containing source repositories
  - Key: Repository identifier in `owner/repo` format
  - Value: Object containing file configuration
    - `files`: Array of file or directory paths to sync
      - Supports wildcards (e.g., `*.md`, `**/*.yaml`)
      - Supports directory paths (trailing `/` is optional)

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
   - Copy matched files to the same relative path in the target repository
3. If changes are detected:
   - Create a new branch (e.g., `repo-file-sync/update-YYYYMMDD-HHMMSS`)
   - Commit all changes
   - Create a Pull Request with all synchronized files

### Pull Request

- **Branch naming**: `repo-file-sync/update-{timestamp}`
- **PR title**: `chore: sync files from source repositories`
- **PR body**: List of synchronized files and their source repositories
- **Single PR**: All changes from multiple repositories are included in one PR

### File Placement

- Files are placed at the **same relative path** as in the source repository
- Example:
  - Source: `owner/repo:docs/README.md`
  - Destination: `docs/README.md` (same path)

## Inputs

TBD (to be defined during implementation)

Possible inputs:
- `config-path`: Path to configuration file (default: `.github/repo-file-sync.yaml`)
- `branch-name`: Custom branch name for PR
- `commit-message`: Custom commit message
- `pr-title`: Custom PR title
- `token`: GitHub token for authentication (default: `${{ github.token }}`)

## Outputs

TBD (to be defined during implementation)

Possible outputs:
- `pr-number`: Created PR number
- `pr-url`: Created PR URL
- `files-changed`: Number of files changed

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
