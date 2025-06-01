import { RepoFileSync } from './repo-file-sync.js';

async function main() {
  const configPath = process.argv[2] || 'repo-file-sync.yaml';
  
  try {
    const sync = new RepoFileSync();
    await sync.sync(configPath);
  } catch (error) {
    console.error('Error:', error);
    process.exit(1);
  }
}

main();