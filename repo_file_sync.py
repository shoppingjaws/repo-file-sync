from libs.config_parser import ConfigParser
from libs.github_fetcher import GitHubFetcher
from types import Config, RepoSource


class RepoFileSync:
    def __init__(self):
        self.config_parser = ConfigParser()
        self.fetcher = GitHubFetcher()

    def sync(self, config_path: str) -> None:
        print(f"Reading config from {config_path}...")
        config = self.config_parser.parse_config(config_path)
        
        print(f"Found {len(config['sources'])} source(s) to sync")
        
        for source in config['sources']:
            self._sync_source(source)
        
        print('Sync completed successfully!')

    def _sync_source(self, source: RepoSource) -> None:
        print(f"\nSyncing from {source['repo']} (ref: {source['ref']})")
        
        for file in source['files']:
            try:
                print(f"  Downloading {file}...")
                self.fetcher.download_file(source['repo'], source['ref'], file)
            except Exception as error:
                print(f"  Failed to download {file}: {error}")
                raise error