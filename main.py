#!/usr/bin/env python3
import sys
from repo_file_sync import RepoFileSync


def main():
    config_path = sys.argv[1] if len(sys.argv) > 1 else 'repo-file-sync.yaml'
    try:
        sync = RepoFileSync()
        sync.sync(config_path)
    except Exception as error:
        print(f'Error: {error}')
        sys.exit(1)


if __name__ == '__main__':
    main()