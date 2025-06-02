import yaml
from typing import Any
import sys
import os
sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
from types import Config


class ConfigParser:
    def parse_config(self, config_path: str) -> Config:
        try:
            with open(config_path, 'r', encoding='utf-8') as file:
                content = file.read()
                config = yaml.safe_load(content)
                
            self._validate_config(config)
            return config
        except Exception as error:
            raise Exception(f"Error parsing config file {config_path}: {error}")

    def _validate_config(self, config: Any) -> None:
        if not config or 'sources' not in config or not isinstance(config['sources'], list):
            raise Exception('Invalid config: sources must be an array')

        for source in config['sources']:
            if not source.get('repo') or not isinstance(source['repo'], str):
                raise Exception('Invalid config: each source must have a repo string')
            
            if not source.get('ref') or not isinstance(source['ref'], str):
                raise Exception('Invalid config: each source must have a ref string')
            
            if not source.get('files') or not isinstance(source['files'], list):
                raise Exception('Invalid config: each source must have a files array')
            
            for file in source['files']:
                if not isinstance(file, str):
                    raise Exception('Invalid config: all files must be strings')