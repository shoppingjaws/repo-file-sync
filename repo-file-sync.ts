import { ConfigParser } from './libs/config-parser.js';
import { GitHubFetcher } from './libs/github-fetcher.js';
import type { Config, RepoSource } from './types.js';

export class RepoFileSync {
  private configParser = new ConfigParser();
  private fetcher = new GitHubFetcher();

  async sync(configPath: string): Promise<void> {
    console.log(`Reading config from ${configPath}...`);
    const config = await this.configParser.parseConfig(configPath);
    
    console.log(`Found ${config.sources.length} source(s) to sync`);
    
    for (const source of config.sources) {
      await this.syncSource(source);
    }
    
    console.log('Sync completed successfully!');
  }

  private async syncSource(source: RepoSource): Promise<void> {
    console.log(`\nSyncing from ${source.repo} (ref: ${source.ref})`);
    
    if (source.vars && source.vars.length > 0) {
      console.log(`  Template variables: ${source.vars.map(v => `${v.key} → ${v.value}`).join(', ')}`);
    }
    
    for (const file of source.files) {
      try {
        console.log(`  Downloading ${file}...`);
        await this.fetcher.downloadFile(source.repo, source.ref, file, undefined, source.vars);
      } catch (error) {
        console.error(`  Failed to download ${file}: ${error}`);
        throw error;
      }
    }
  }
}