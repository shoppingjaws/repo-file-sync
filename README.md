# repo-file-sync

A GitHub Action to synchronize files from source repositories and automatically create Pull Requests with the changes.

Keep your repositories in sync with upstream sources, shared configurations, or templates - all automated through GitHub Actions.

---

**Use Cases:**
- 📚 Sync documentation from a central docs repository
- ⚙️ Keep configuration files consistent across projects
- 📋 Distribute shared templates and workflows
- 🔄 Mirror files from upstream repositories with custom modifications

---

## Table of Contents

- [Features](#features)
- [Prerequisites](#prerequisites)
- [Quick Start](#quick-start)
- [Configuration](#configuration)
- [Examples](#examples)
- [How It Works](#how-it-works)
- [Permissions](#permissions)
- [Troubleshooting](#troubleshooting)
- [License](#license)

## Features

- 📦 Sync files from multiple source repositories
- 🎯 Support for glob patterns (`*.md`, `**/*.yaml`, etc.)
- 📁 Directory synchronization
- 🔄 Automatic PR creation and updates with detailed change summary
- ⚡ Fast execution with Bun runtime
- 🤖 Preserves source file paths in destination
- 🔧 **Text replacement with regex patterns** (modify content during sync)

## Prerequisites

Before using this action, you must configure your repository settings:

### 1. Enable PR Creation by GitHub Actions

Go to your repository settings and enable PR creation:

**Settings** → **Actions** → **General** → **Workflow permissions**

✅ Check: **"Allow GitHub Actions to create and approve pull requests"**

<details>
<summary>Why is this needed?</summary>

By default, GitHub Actions workflows using `GITHUB_TOKEN` cannot create pull requests for security reasons. This action creates or updates PRs automatically, so this permission must be explicitly enabled.

</details>

### 2. Understand the Force-Push Behavior

⚠️ **Important**: This action uses a **fixed branch name** and **force-push** strategy.

**How it works:**
- Uses a single branch (`repo-file-sync` by default) for all sync operations
- Updates the branch with `git push --force` on each run
- Keeps a single PR open and continuously updates it
- **Previous commits on the sync branch will be overwritten**

**Benefits:**
- ✅ Single, always-up-to-date PR instead of multiple PRs
- ✅ Clean commit history
- ✅ Easy to review cumulative changes

**Trade-offs:**
- ⚠️ Cannot preserve individual sync history on the branch
- ⚠️ Force-push overwrites any manual changes to the branch

## Quick Start

Get started in 3 simple steps:

### Step 1: Enable GitHub Actions Permissions

Go to **Settings** → **Actions** → **General** → **Workflow permissions**

✅ Check: **"Allow GitHub Actions to create and approve pull requests"**

### Step 2: Create Configuration File

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

### Step 3: Create Workflow

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
| `branch-name` | Fixed branch name for synchronization | No | `repo-file-sync` |
| `commit-message` | Commit message | No | `chore: sync files from source repositories` |
| `pr-title` | Pull Request title | No | `chore: sync files from source repositories` |

### Action Outputs

| Output | Description |
|--------|-------------|
| `pr-number` | Created Pull Request number (empty if no changes) |
| `pr-url` | Created Pull Request URL (empty if no changes) |
| `files-synced` | Number of files synchronized |
| `changes-detected` | Whether changes were detected (`true` or `false`) |

### Configuration File Format

#### Basic Format (Files Only)

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

#### Advanced Format (With Text Replacements)

```yaml
repos:
  owner/repository-name:
    files:
      # File with text replacements
      README.md:
        replacements:
          - pattern: 'original-org'
            replacement: 'my-org'
            flags: 'g'
          - pattern: 'https://example\.com'
            replacement: 'https://mysite.com'
            flags: 'gi'

      # File without replacements
      LICENSE:

      # Glob pattern with replacements
      "docs/*.md":
        replacements:
          - pattern: '\bfoo\b'
            replacement: 'bar'
            flags: 'g'
```

**Replacement Rule Fields:**
- `pattern`: Regular expression pattern (string)
- `replacement`: Replacement text (string)
- `flags`: Regex flags (`'g'` = global, `'i'` = case-insensitive, `'m'` = multiline)

## Examples

### Basic Usage

```yaml
repos:
  awesome-org/shared-configs:
    files:
      - .editorconfig
      - .prettierrc
```

### With Text Replacements

```yaml
repos:
  upstream-org/template-repo:
    files:
      README.md:
        replacements:
          # Replace organization name
          - pattern: 'upstream-org'
            replacement: 'my-org'
            flags: 'g'
          # Replace URLs
          - pattern: 'https://upstream-org\.com'
            replacement: 'https://my-org.com'
            flags: 'gi'

      # Sync LICENSE without modifications
      LICENSE:

      # Replace placeholder values in configs
      .github/workflows/*.yml:
        replacements:
          - pattern: 'SLACK_WEBHOOK_PLACEHOLDER'
            replacement: '${{ secrets.SLACK_WEBHOOK }}'
            flags: 'g'
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
          branch-name: automated-sync
          pr-title: "📦 Sync files from upstream"
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
4. **Apply Replacements**: Applies regex replacements if configured
5. **Copy Files**: Copies matched files to the same paths in target repository
6. **Update Branch**:
   - Uses a fixed branch name (`repo-file-sync` by default)
   - If branch exists remotely: checks out existing branch and resets to main
   - If not exists: creates new branch from main
   - **Force-pushes updates** to keep the same PR open
7. **Create or Update PR**:
   - Checks for existing PR using the branch name
   - If PR exists: updates title and body with new changes
   - If not exists: creates new PR

### Branch Strategy Details

This action uses a **single, reusable branch** approach:

```
┌─────────────┐
│    main     │
└─────────────┘
       │
       ├─── (run 1) ──→ create branch "repo-file-sync" ──→ create PR #1
       │
       ├─── (run 2) ──→ force-push to "repo-file-sync" ──→ update PR #1
       │
       └─── (run 3) ──→ force-push to "repo-file-sync" ──→ update PR #1
```

**Why force-push?**
- Maintains a single PR for all syncs
- Avoids creating multiple PRs for each sync
- Keeps PR history clean and focused on the current state
- Easier to review and merge cumulative changes

## Permissions

### Workflow Permissions

The workflow needs the following permissions in your workflow file:

```yaml
permissions:
  contents: write        # To create branches and commits
  pull-requests: write   # To create Pull Requests
```

### Repository Settings

⚠️ **Required**: You must also enable PR creation in your repository settings:

**Settings** → **Actions** → **General** → **Workflow permissions**

✅ Check: **"Allow GitHub Actions to create and approve pull requests"**

Without this setting, the action will fail when trying to create or update PRs, even with the correct workflow permissions.

## Authentication

By default, the action uses `${{ github.token }}` which works for:
- Public repositories
- Repositories within the same organization

For cross-organization access or private repositories, you may need a Personal Access Token (PAT) with appropriate permissions.

## Troubleshooting

### "GitHub Actions is not permitted to create pull requests"

**Error message:**
```
refusing to allow a GitHub Action to create or update workflow
```

**Solution:** Enable PR creation in repository settings:

**Settings** → **Actions** → **General** → **Workflow permissions**

✅ Check: **"Allow GitHub Actions to create and approve pull requests"**

### Configuration file not found

Ensure `.github/repo-file-sync.yaml` exists in your repository. You can customize the path with the `config-path` input.

### Permission denied

Check that your workflow has the required permissions:

```yaml
permissions:
  contents: write
  pull-requests: write
```

### PR gets closed unexpectedly

If the PR gets closed after a sync run:
- **Do not delete the sync branch manually** - the action reuses it
- The action uses force-push to keep the same PR open
- If you need to start fresh, merge or close the existing PR first, then let the action create a new one

### Manual changes to sync branch are lost

⚠️ This is expected behavior. The action uses **force-push** strategy:
- All commits on the sync branch are overwritten on each run
- Do not make manual changes to the sync branch
- Any custom commits will be lost on the next sync

**Solution:** If you need to make changes:
1. Merge the PR
2. Make your changes on the main branch
3. Let the action sync again

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
