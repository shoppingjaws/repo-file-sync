# repo-file-sync

A GitHub Action to synchronize files from source repositories and automatically create Pull Requests with the changes.

## Features

- 📦 Sync files from multiple source repositories
- 🎯 Support for glob patterns (`*.md`, `**/*.yaml`, etc.)
- 📁 Directory synchronization
- 🔄 Automatic PR creation with detailed change summary
- ⚡ Fast execution with Bun runtime
- 🤖 Preserves source file paths in destination

## Usage

### 1. Create Configuration File

Create `.github/repo-file-sync.yaml` in your repository:

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

### 2. Create Workflow

Create `.github/workflows/sync-files.yaml`:

```yaml
name: Sync Files

on:
  schedule:
    - cron: '0 0 * * 0'  # Weekly on Sunday
  workflow_dispatch:      # Manual trigger

permissions:
  contents: write
  pull-requests: write

jobs:
  sync:
    runs-on: ubuntu-latest
    steps:
      - name: Checkout
        uses: actions/checkout@v4

      - name: Sync Files
        id: sync
        uses: shoppingjaws/repo-file-sync@main
        with:
          token: ${{ secrets.GITHUB_TOKEN }}

      - name: Output results
        if: always()
        run: |
          echo "Files synced: ${{ steps.sync.outputs.files-synced }}"
          echo "PR URL: ${{ steps.sync.outputs.pr-url }}"
```

## Configuration

### Action Inputs

| Input | Description | Required | Default |
|-------|-------------|----------|---------|
| `config-path` | Path to configuration file | No | `.github/repo-file-sync.yaml` |
| `token` | GitHub token for authentication | No | `${{ github.token }}` |
| `branch-prefix` | Prefix for sync branch name | No | `repo-file-sync/update` |
| `commit-message` | Commit message | No | `chore: sync files from source repositories` |
| `pr-title` | Pull Request title | No | `chore: sync files from source repositories` |
| `pr-labels` | Comma-separated PR labels | No | `automated` |

### Action Outputs

| Output | Description |
|--------|-------------|
| `pr-number` | Created Pull Request number (empty if no changes) |
| `pr-url` | Created Pull Request URL (empty if no changes) |
| `files-synced` | Number of files synchronized |
| `changes-detected` | Whether changes were detected (`true` or `false`) |

### Configuration File Format

```yaml
repos:
  # Repository in owner/repo format
  owner/repository-name:
    files:
      # Specific files
      - README.md
      - LICENSE

      # Glob patterns
      - "*.md"
      - docs/**/*.yaml

      # Directories (with or without trailing slash)
      - .github/workflows/
      - scripts
```

## Examples

### Basic Usage

```yaml
repos:
  awesome-org/shared-configs:
    files:
      - .editorconfig
      - .prettierrc
```

### Multiple Repositories

```yaml
repos:
  company/documentation:
    files:
      - docs/API.md
      - docs/CONTRIBUTING.md

  company/templates:
    files:
      - .github/ISSUE_TEMPLATE/
      - .github/PULL_REQUEST_TEMPLATE.md
```

### With Custom Settings

```yaml
name: Sync Files
on:
  schedule:
    - cron: '0 0 * * 0'

jobs:
  sync:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4

      - name: Sync Files
        id: sync
        uses: shoppingjaws/repo-file-sync@main
        with:
          config-path: .github/sync-config.yaml
          branch-prefix: automated/sync
          pr-title: "📦 Sync files from upstream"
          pr-labels: "automated,documentation"
          token: ${{ secrets.GITHUB_TOKEN }}

      - name: Check outputs
        if: always()
        run: |
          echo "PR created: ${{ steps.sync.outputs.pr-url }}"
          echo "Files synced: ${{ steps.sync.outputs.files-synced }}"
```

## How It Works

1. **Read Configuration**: Loads `.github/repo-file-sync.yaml`
2. **Clone Sources**: Clones each configured source repository
3. **Match Files**: Expands glob patterns and matches files
4. **Copy Files**: Copies matched files to the same paths in target repository
5. **Create PR**: If changes detected, creates a branch and Pull Request

## Permissions

The action requires the following permissions:

```yaml
permissions:
  contents: write        # To create branches and commits
  pull-requests: write   # To create Pull Requests
```

## Authentication

By default, the action uses `${{ github.token }}` which works for:
- Public repositories
- Repositories within the same organization

For cross-organization access or private repositories, you may need a Personal Access Token (PAT) with appropriate permissions.

## Troubleshooting

### Configuration file not found

Ensure `.github/repo-file-sync.yaml` exists in your repository. You can customize the path with the `config-path` input.

### Permission denied

Check that your workflow has the required permissions:

```yaml
permissions:
  contents: write
  pull-requests: write
```

### No changes detected

The action will skip PR creation if:
- No files matched the patterns
- All synced files are identical to existing files
- The configuration file is empty or invalid

Check the action logs for details about which files were processed.

## Technology

Built with:
- [Bun](https://bun.sh) - Fast JavaScript runtime
- TypeScript - Type-safe implementation
- Bun Shell - Efficient shell operations
- Native YAML parsing

## License

MIT

## Contributing

Contributions are welcome! Please feel free to submit a Pull Request.
