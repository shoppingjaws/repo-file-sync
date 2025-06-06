# CLAUDE.md

このファイルは、このリポジトリでコードを操作する際にClaude Code (claude.ai/code)にガイダンスを提供します。

## 開発コマンド

- **ツールの実行**: `python main.py [config-file]` (デフォルトは `repo-file-sync.yaml`)
- **依存関係のインストール**: `pip install -r requirements.txt`

## アーキテクチャ概要

これはYAML設定に基づいてGitHubリポジトリからローカルディレクトリにファイルを同期するPythonツールです。

### コアコンポーネント

- **`RepoFileSync`** (`repo_file_sync.py`): 同期プロセスを調整するメインオーケストレータークラス
- **`ConfigParser`** (`libs/config_parser.py`): YAML設定ファイルの解析と検証を処理
- **`GitHubFetcher`** (`libs/github_fetcher.py`): GitHubのraw content APIからのファイルダウンロードを管理
- **Types** (`types.py`): `Config`と`RepoSource`のTypedDict定義

### データフロー

1. `main.py`エントリーポイントが`RepoFileSync`インスタンスを作成
2. `ConfigParser`がソースリポジトリとファイルリストを含むYAML設定を読み込み・検証
3. 各ソースに対して、`GitHubFetcher`が`https://raw.githubusercontent.com/{repo}/{ref}/{file}`からファイルをダウンロード
4. ファイルはデフォルトで`downloaded/{repo}/{file}`に保存される

### 設定ファイル形式

YAML設定は以下でソースを定義：
- `repo`: GitHubリポジトリ (owner/name形式)
- `ref`: Git参照 (ブランチ、タグ、またはコミット)
- `files`: 同期するファイルパスの配列

### 実行環境

- Python 3.7以降が必要
- 依存関係: PyYAML, requests