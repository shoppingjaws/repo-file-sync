import { promises as fs } from 'fs';
import { dirname, join } from 'path';
import type { TemplateVar } from '../types.js';

export class GitHubFetcher {
  async fetchFile(repo: string, ref: string, filePath: string): Promise<string> {
    const url = `https://raw.githubusercontent.com/${repo}/${ref}/${filePath}`;
    
    try {
      const response = await fetch(url);
      
      if (!response.ok) {
        throw new Error(`Failed to fetch ${url}: ${response.status} ${response.statusText}`);
      }
      
      return await response.text();
    } catch (error) {
      throw new Error(`Error fetching file from ${url}: ${error}`);
    }
  }

  async saveFile(content: string, localPath: string): Promise<void> {
    try {
      // Create directory if it doesn't exist
      const dir = dirname(localPath);
      await fs.mkdir(dir, { recursive: true });
      
      // Write file
      await fs.writeFile(localPath, content, 'utf-8');
      console.log(`Saved: ${localPath}`);
    } catch (error) {
      throw new Error(`Error saving file to ${localPath}: ${error}`);
    }
  }

  private replaceVariables(content: string, vars?: TemplateVar[]): string {
    if (!vars || vars.length === 0) {
      return content;
    }
    
    let result = content;
    for (const variable of vars) {
      // Replace all occurrences of the key with the value
      result = result.replaceAll(variable.key, variable.value);
    }
    
    return result;
  }

  async downloadFile(repo: string, ref: string, filePath: string, localPath?: string, vars?: TemplateVar[]): Promise<void> {
    let content = await this.fetchFile(repo, ref, filePath);
    
    // Apply variable replacements if provided
    content = this.replaceVariables(content, vars);
    
    const targetPath = localPath || join('downloaded', repo, filePath);
    await this.saveFile(content, targetPath);
  }
}