import { promises as fs } from 'fs';
import YAML from 'yaml';
import { Config } from '../types.js';

export class ConfigParser {
  async parseConfig(configPath: string): Promise<Config> {
    try {
      const content = await fs.readFile(configPath, 'utf-8');
      const config = YAML.parse(content) as Config;
      
      this.validateConfig(config);
      return config;
    } catch (error) {
      throw new Error(`Error parsing config file ${configPath}: ${error}`);
    }
  }

  private validateConfig(config: Config): void {
    if (!config || !config.sources || !Array.isArray(config.sources)) {
      throw new Error('Invalid config: sources must be an array');
    }

    for (const source of config.sources) {
      if (!source.repo || typeof source.repo !== 'string') {
        throw new Error('Invalid config: each source must have a repo string');
      }
      
      if (!source.ref || typeof source.ref !== 'string') {
        throw new Error('Invalid config: each source must have a ref string');
      }
      
      if (!source.files || !Array.isArray(source.files)) {
        throw new Error('Invalid config: each source must have a files array');
      }
      
      for (const file of source.files) {
        if (typeof file !== 'string') {
          throw new Error('Invalid config: all files must be strings');
        }
      }
    }
  }
}