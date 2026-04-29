# repo-file-sync

ソースリポジトリからファイルを同期し、変更内容の Pull Request を自動作成する GitHub Actions composite action です。

## Quick Start

### 1. 設定ファイルの作成

`.github/repo-file-sync.yaml`:

```yaml
repos:
  owner/source-repo:
    files:
      - README.md
      - .github/workflows/
      - "*.json"
```

### 2. ワークフローの作成

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
<summary>GITHUB_TOKEN を使う場合</summary>

GitHub App Token の代わりに `GITHUB_TOKEN` を使うこともできます。ただし、同期対象にワークフローファイル (`.github/workflows/`) が含まれる場合は `workflows` スコープを持つトークンが必要なため、GitHub App Token の使用を推奨します。

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

また、リポジトリ設定で PR 作成を許可する必要があります:

**Settings** → **Actions** → **General** → **Workflow permissions** → **"Allow GitHub Actions to create and approve pull requests"** を有効化

</details>

## Inputs

| Input | 説明 | デフォルト |
|-------|------|-----------|
| `config-path` | 設定ファイルのパス | `.github/repo-file-sync.yaml` |
| `token` | GitHub トークン | `${{ github.token }}` |
| `branch-name` | 同期用ブランチ名 | `repo-file-sync` |
| `commit-message` | コミットメッセージ | `chore: sync files from source repositories` |
| `pr-title` | PR タイトル | `chore: sync files from source repositories` |

## Outputs

| Output | 説明 |
|--------|------|
| `pr-number` | 作成/更新された PR 番号 (変更なしの場合は空) |
| `pr-url` | 作成/更新された PR の URL (変更なしの場合は空) |
| `files-synced` | 同期されたファイル数 |
| `changes-detected` | 変更の有無 (`true` / `false`) |

## Configuration

### Basic: ファイルリスト

```yaml
repos:
  owner/repo:
    files:
      - README.md            # 単一ファイル
      - "*.md"               # glob パターン
      - docs/**/*.yaml       # ネストした glob
      - .github/workflows/   # ディレクトリ
```

### Advanced: テキスト置換

同期時にファイル内容を正規表現で置換できます。

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

      # 置換なしのファイル (キーだけ書く)
      LICENSE:

      # glob パターンにも置換を適用可能
      "docs/*.md":
        replacements:
          - pattern: '\bfoo\b'
            replacement: 'bar'
            flags: 'g'
```

**Replacement fields:**

| Field | 説明 |
|-------|------|
| `pattern` | 正規表現パターン |
| `replacement` | 置換テキスト (キャプチャグループ `$1` 等も使用可) |
| `flags` | 正規表現フラグ (`g`: global, `i`: case-insensitive, `m`: multiline) |

### Mixed: 配列とオブジェクトの混在

`files` は配列形式とオブジェクト形式を混在できます。

```yaml
repos:
  owner/repo:
    files:
      - LICENSE                # 配列: 置換なし
      - renovate.json
      README.md:               # オブジェクト: 置換あり
        replacements:
          - pattern: 'old'
            replacement: 'new'
            flags: 'g'
```

## How It Works

1. 設定ファイル (`.github/repo-file-sync.yaml`) を読み込む
2. 各ソースリポジトリを shallow clone する
3. glob パターンでファイルをマッチング
4. テキスト置換ルールがあれば適用
5. マッチしたファイルをソースと同じ相対パスにコピー
6. 変更があれば固定ブランチにコミット & force push
7. 既存 PR があれば更新、なければ新規作成

### Branch Strategy

固定ブランチ名 + force push により、常に1つの PR を維持します。

```
main ─── (run 1) ──→ create "repo-file-sync" branch ──→ create PR
     ├── (run 2) ──→ force-push to "repo-file-sync"  ──→ update PR
     └── (run 3) ──→ force-push to "repo-file-sync"  ──→ update PR
```

同期ブランチへの手動コミットは次回実行時に上書きされます。

## Authentication

| 方法 | 用途 |
|------|------|
| `GITHUB_TOKEN` | 公開リポジトリ、同一 Organization 内 |
| GitHub App Token | プライベートリポジトリ、Organization 横断、ワークフローファイルの同期 |
| Personal Access Token | 上記いずれかが使えない場合 |

ワークフローファイル (`.github/workflows/`) を同期対象に含める場合は `workflows` スコープを持つトークンが必要です。`GITHUB_TOKEN` ではこのスコープを持てないため、GitHub App Token の使用を推奨します。

## Local Testing

```bash
bun run test-local.ts
```

`TEST_MODE=true` で実行され、PR 作成をスキップして `test-workspace/` にファイルを同期します。

## Troubleshooting

### `refusing to allow a GitHub Action to create or update workflow`

ワークフローファイルの同期には `workflows` スコープが必要です。GitHub App Token または適切なスコープを持つ PAT を使用してください。

### `GitHub Actions is not permitted to create pull requests`

リポジトリ設定で PR 作成を許可してください:

**Settings** → **Actions** → **General** → **Workflow permissions** → **"Allow GitHub Actions to create and approve pull requests"**

### PR が意図せずクローズされる

同期ブランチを手動で削除しないでください。action がブランチを再利用して PR を維持します。

### 変更が検出されない

- glob パターンがファイルにマッチしているか確認
- 同期済みファイルとソースが同一の場合はスキップされます
- action ログで処理されたファイルを確認してください

## License

MIT
