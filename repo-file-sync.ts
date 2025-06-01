import { ConfigParser } from './config-parser.js';
import { GitHubFetcher } from './github-fetcher.js';
import { Config, RepoSource } from './types.js';

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
    
    for (const file of source.files) {
      try {
        console.log(`  Downloading ${file}...`);
        await this.fetcher.downloadFile(source.repo, source.ref, file);
      } catch (error) {
        console.error(`  Failed to download ${file}: ${error}`);
        throw error;
      }
    }
  }
}