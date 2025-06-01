# CLAUDE.md

このファイルは、このリポジトリでコードを操作する際にClaude Code (claude.ai/code)にガイダンスを提供します。

## 開発コマンド

- **ツールの実行**: `bun run index.ts [config-file]` (デフォルトは `repo-file-sync.yaml`)
- **型チェック**: `bun tsc --noEmit`
- **依存関係のインストール**: `bun install`

## アーキテクチャ概要

これはYAML設定に基づいてGitHubリポジトリからローカルディレクトリにファイルを同期するTypeScriptツールです。

### コアコンポーネント

- **`RepoFileSync`** (`repo-file-sync.ts`): 同期プロセスを調整するメインオーケストレータークラス
- **`ConfigParser`** (`libs/config-parser.ts`): YAML設定ファイルの解析と検証を処理
- **`GitHubFetcher`** (`libs/github-fetcher.ts`): GitHubのraw content APIからのファイルダウンロードを管理
- **Types** (`types.ts`): `Config`と`RepoSource`インターフェースを定義

### データフロー

1. `index.ts`エントリーポイントが`RepoFileSync`インスタンスを作成
2. `ConfigParser`がソースリポジトリとファイルリストを含むYAML設定を読み込み・検証
3. 各ソースに対して、`GitHubFetcher`が`https://raw.githubusercontent.com/{repo}/{ref}/{file}`からファイルをダウンロード
4. ファイルはデフォルトで`downloaded/{repo}/{file}`に保存される

### 設定ファイル形式

YAML設定は以下でソースを定義：
- `repo`: GitHubリポジトリ (owner/name形式)
- `ref`: Git参照 (ブランチ、タグ、またはコミット)
- `files`: 同期するファイルパスの配列

### 実行環境

- ランタイムおよびパッケージマネージャーとしてBunを使用
- TypeScriptファイルに`.js`インポートを使用するESモジュール
- bundlerモジュール解決を使用した厳密なTypeScript設定