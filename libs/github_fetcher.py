import os
import requests
from pathlib import Path


class GitHubFetcher:
    def fetch_file(self, repo: str, ref: str, file_path: str) -> str:
        url = f"https://raw.githubusercontent.com/{repo}/{ref}/{file_path}"
        
        try:
            response = requests.get(url)
            
            if not response.ok:
                raise Exception(f"Failed to fetch {url}: {response.status_code} {response.reason}")
            
            return response.text
        except Exception as error:
            raise Exception(f"Error fetching file from {url}: {error}")

    def save_file(self, content: str, local_path: str) -> None:
        try:
            # Create directory if it doesn't exist
            path = Path(local_path)
            path.parent.mkdir(parents=True, exist_ok=True)
            
            # Write file
            with open(local_path, 'w', encoding='utf-8') as file:
                file.write(content)
            print(f"Saved: {local_path}")
        except Exception as error:
            raise Exception(f"Error saving file to {local_path}: {error}")

    def download_file(self, repo: str, ref: str, file_path: str, local_path: str = None) -> None:
        content = self.fetch_file(repo, ref, file_path)
        target_path = local_path or os.path.join('downloaded', repo, file_path)
        self.save_file(content, target_path)