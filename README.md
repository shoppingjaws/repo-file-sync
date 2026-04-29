# repo-file-sync

GitHub Actions composite action that synchronizes files from source repositories and creates a Pull Request with the changes.

## Quick Start

### 1. Create configuration file

`.github/repo-file-sync.yaml`:

```yaml
repos:
  owner/source-repo:
    files:
      - README.md
      - .github/workflows/
      - "*.json"
```

### 2. Create workflow

`.github/workflows/sync-files.yaml`:

```yaml
name: Sync Files

on:
  schedule:
    - cron: '0 0 * * 0'
  workflow_dispatch:

jobs:
  sync:
    runs-on: ubuntu-latest
    steps:
      - name: Generate App Token
        id: app-token
        uses: actions/create-github-app-token@v2
        with:
          app-id: ${{ secrets.APP_ID }}
          private-key: ${{ secrets.APP_PRIVATE_KEY }}
          owner: your-org

      - name: Checkout
        uses: actions/checkout@v6
        with:
          token: ${{ steps.app-token.outputs.token }}

      - name: Sync Files
        id: sync
        uses: shoppingjaws/repo-file-sync@main
        with:
          token: ${{ steps.app-token.outputs.token }}

      - name: Output results
        if: always()
        run: |
          echo "Files synced: ${{ steps.sync.outputs.files-synced }}"
          echo "PR URL: ${{ steps.sync.outputs.pr-url }}"
```

<details>
<summary>Using GITHUB_TOKEN instead</summary>

You can use `GITHUB_TOKEN` instead of a GitHub App Token. However, if your sync targets include workflow files (`.github/workflows/`), you need a token with the `workflows` scope — `GITHUB_TOKEN` does not have this scope, so a GitHub App Token is recommended.

```yaml
permissions:
  contents: write
  pull-requests: write

jobs:
  sync:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v6

      - uses: shoppingjaws/repo-file-sync@main
        with:
          token: ${{ secrets.GITHUB_TOKEN }}
```

You also need to enable PR creation in your repository settings:

**Settings** → **Actions** → **General** → **Workflow permissions** → Enable **"Allow GitHub Actions to create and approve pull requests"**

</details>

## Inputs

| Input | Description | Default |
|-------|-------------|---------|
| `config-path` | Path to configuration file | `.github/repo-file-sync.yaml` |
| `token` | GitHub token for authentication | `${{ github.token }}` |
| `branch-name` | Branch name for synchronization | `repo-file-sync` |
| `commit-message` | Commit message | `chore: sync files from source repositories` |
| `pr-title` | Pull Request title | `chore: sync files from source repositories` |

## Outputs

| Output | Description |
|--------|-------------|
| `pr-number` | PR number (empty if no changes) |
| `pr-url` | PR URL (empty if no changes) |
| `files-synced` | Number of files synchronized |
| `changes-detected` | Whether changes were detected (`true` / `false`) |

## Configuration

### Basic: File list

```yaml
repos:
  owner/repo:
    files:
      - README.md            # Single file
      - "*.md"               # Glob pattern
      - docs/**/*.yaml       # Nested glob
      - .github/workflows/   # Directory
```

### Advanced: Text replacements

Apply regex-based text replacements to file contents during sync.

```yaml
repos:
  owner/repo:
    files:
      README.md:
        replacements:
          - pattern: 'original-org'
            replacement: 'my-org'
            flags: 'g'
          - pattern: 'https://example\.com'
            replacement: 'https://mysite.com'
            flags: 'gi'

      # File without replacements (key only)
      LICENSE:

      # Glob patterns also support replacements
      "docs/*.md":
        replacements:
          - pattern: '\bfoo\b'
            replacement: 'bar'
            flags: 'g'
```

**Replacement fields:**

| Field | Description |
|-------|-------------|
| `pattern` | Regular expression pattern |
| `replacement` | Replacement text (capture groups like `$1` are supported) |
| `flags` | Regex flags (`g`: global, `i`: case-insensitive, `m`: multiline) |

### Mixed: Array and object formats

`files` supports both array and object formats, and they can be mixed.

```yaml
repos:
  owner/repo:
    files:
      - LICENSE                # Array item: no replacements
      - renovate.json
      README.md:               # Object key: with replacements
        replacements:
          - pattern: 'old'
            replacement: 'new'
            flags: 'g'
```

## How It Works

1. Load configuration from `.github/repo-file-sync.yaml`
2. Shallow clone each source repository
3. Match files using glob patterns
4. Apply text replacement rules if configured
5. Copy matched files to the same relative paths
6. Commit and force push to a fixed branch
7. Update existing PR or create a new one

### Branch Strategy

Uses a fixed branch name with force push to maintain a single PR.

```
main ─── (run 1) ──→ create "repo-file-sync" branch ──→ create PR
     ├── (run 2) ──→ force-push to "repo-file-sync"  ──→ update PR
     └── (run 3) ──→ force-push to "repo-file-sync"  ──→ update PR
```

Manual commits on the sync branch will be overwritten on the next run.

## Authentication

| Method | Use case |
|--------|----------|
| `GITHUB_TOKEN` | Public repos, same organization |
| GitHub App Token | Private repos, cross-org access, syncing workflow files |
| Personal Access Token | When neither of the above works |

Syncing workflow files (`.github/workflows/`) requires a token with the `workflows` scope. `GITHUB_TOKEN` does not have this scope, so use a GitHub App Token or PAT.

## Local Testing

```bash
bun run test-local.ts
```

Runs with `TEST_MODE=true`, skipping PR creation and syncing files into `test-workspace/`.

## Troubleshooting

### `refusing to allow a GitHub Action to create or update workflow`

Syncing workflow files requires the `workflows` scope. Use a GitHub App Token or a PAT with the appropriate scope.

### `GitHub Actions is not permitted to create pull requests`

Enable PR creation in repository settings:

**Settings** → **Actions** → **General** → **Workflow permissions** → **"Allow GitHub Actions to create and approve pull requests"**

### PR gets closed unexpectedly

Do not manually delete the sync branch. The action reuses the branch to keep the PR open.

### No changes detected

- Verify your glob patterns match the intended files
- Files identical to the source are skipped
- Check the action logs for details on processed files

## License

MIT
