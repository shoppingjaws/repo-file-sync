#!/usr/bin/env bun

import { $, YAML } from "bun";
import { existsSync } from "fs";
import { join } from "path";

// GitHub Actions inputs from environment variables
const CONFIG_PATH = process.env.INPUT_CONFIG_PATH || ".github/repo-file-sync.yaml";
const TOKEN = process.env.INPUT_TOKEN || process.env.GITHUB_TOKEN || "";
const BRANCH_PREFIX = process.env.INPUT_BRANCH_PREFIX || "repo-file-sync/update";
const COMMIT_MESSAGE = process.env.INPUT_COMMIT_MESSAGE || "chore: sync files from source repositories";
const PR_TITLE = process.env.INPUT_PR_TITLE || "chore: sync files from source repositories";
const PR_LABELS = process.env.INPUT_PR_LABELS || "automated";
const WORKSPACE = process.env.GITHUB_WORKSPACE || process.cwd();
const REPOSITORY = process.env.GITHUB_REPOSITORY || "";

interface RepoConfig {
  files: string[];
}

interface Config {
  repos: Record<string, RepoConfig>;
}

// Set GitHub Actions output
function setOutput(name: string, value: string | number | boolean) {
  const outputFile = process.env.GITHUB_OUTPUT;
  if (outputFile) {
    Bun.write(outputFile, `${name}=${value}\n`, { append: true });
  }
}

// Log with GitHub Actions formatting
function log(message: string) {
  console.log(message);
}

function error(message: string) {
  console.error(`::error::${message}`);
}

function warning(message: string) {
  console.warn(`::warning::${message}`);
}

function info(message: string) {
  console.log(`::notice::${message}`);
}

// Parse configuration file
async function loadConfig(configPath: string): Promise<Config | null> {
  const fullPath = join(WORKSPACE, configPath);

  if (!existsSync(fullPath)) {
    warning(`Configuration file not found: ${configPath}`);
    return null;
  }

  try {
    const content = await Bun.file(fullPath).text();
    const config = YAML.parse(content) as Config;

    if (!config.repos || typeof config.repos !== "object") {
      error("Invalid configuration: 'repos' key is missing or invalid");
      return null;
    }

    return config;
  } catch (err) {
    error(`Failed to parse configuration file: ${err}`);
    return null;
  }
}

// Clone a repository to a temporary directory
async function cloneRepository(repo: string, tempDir: string): Promise<boolean> {
  try {
    log(`Cloning repository: ${repo}`);

    const cloneUrl = TOKEN
      ? `https://x-access-token:${TOKEN}@github.com/${repo}.git`
      : `https://github.com/${repo}.git`;

    await $`git clone --depth 1 ${cloneUrl} ${tempDir}`.quiet();
    return true;
  } catch (err) {
    error(`Failed to clone repository ${repo}: ${err}`);
    return false;
  }
}

// Expand glob patterns and copy files
async function syncFiles(sourceDir: string, patterns: string[], destDir: string): Promise<string[]> {
  const syncedFiles: string[] = [];

  for (const pattern of patterns) {
    try {
      log(`Processing pattern: ${pattern}`);

      // Use glob to find matching files
      const glob = new Bun.Glob(pattern);
      const matches = await Array.fromAsync(glob.scan({ cwd: sourceDir, absolute: false, onlyFiles: false }));

      if (matches.length === 0) {
        warning(`No files matched pattern: ${pattern}`);
        continue;
      }

      for (const match of matches) {
        const sourcePath = join(sourceDir, match);
        const destPath = join(destDir, match);

        // Create destination directory if needed
        const destDirPath = join(destPath, "..");
        await $`mkdir -p ${destDirPath}`.quiet();

        // Copy file or directory
        if ((await Bun.file(sourcePath).exists())) {
          await $`cp -r ${sourcePath} ${destPath}`.quiet();
          syncedFiles.push(match);
          log(`Synced: ${match}`);
        }
      }
    } catch (err) {
      error(`Failed to process pattern ${pattern}: ${err}`);
    }
  }

  return syncedFiles;
}

// Configure git user
async function configureGit() {
  await $`git config user.name "github-actions[bot]"`.quiet();
  await $`git config user.email "41898282+github-actions[bot]@users.noreply.github.com"`.quiet();
}

// Check if there are any changes
async function hasChanges(): Promise<boolean> {
  const result = await $`git status --porcelain`.text();
  return result.trim().length > 0;
}

// Create a new branch
async function createBranch(branchName: string) {
  await $`git checkout -b ${branchName}`.quiet();
}

// Commit and push changes
async function commitAndPush(message: string, branchName: string) {
  await $`git add .`.quiet();
  await $`git commit -m ${message}`.quiet();

  const pushUrl = TOKEN
    ? `https://x-access-token:${TOKEN}@github.com/${REPOSITORY}.git`
    : `origin`;

  await $`git push ${pushUrl} ${branchName}`.quiet();
}

// Create a Pull Request using GitHub CLI
async function createPullRequest(branchName: string, title: string, body: string, labels: string): Promise<{ number: string, url: string } | null> {
  try {
    const labelArgs = labels.split(",").map(l => l.trim()).filter(l => l.length > 0);

    // Build command arguments array
    const args = ["pr", "create", "--title", title, "--body", body, "--head", branchName];

    // Add labels
    for (const label of labelArgs) {
      args.push("--label", label);
    }

    const proc = Bun.spawn(["gh", ...args], {
      env: {
        GH_TOKEN: TOKEN,
        ...process.env
      },
      stdout: "pipe",
      stderr: "pipe",
    });

    const [stdout, stderr] = await Promise.all([
      new Response(proc.stdout).text(),
      new Response(proc.stderr).text(),
    ]);

    await proc.exited;

    if (proc.exitCode !== 0) {
      error(`gh pr create failed with exit code ${proc.exitCode}`);
      error(`stdout: ${stdout}`);
      error(`stderr: ${stderr}`);
      return null;
    }

    const result = stdout + stderr;
    const urlMatch = result.match(/https:\/\/github\.com\/[^\s]+/);
    const url = urlMatch ? urlMatch[0] : "";
    const numberMatch = url.match(/\/pull\/(\d+)/);
    const number = numberMatch ? numberMatch[1] : "";

    return { number, url };
  } catch (err) {
    error(`Failed to create Pull Request: ${err}`);
    return null;
  }
}

// Main execution
async function main() {
  log("🚀 Starting repo-file-sync");

  // Load configuration
  const config = await loadConfig(CONFIG_PATH);
  if (!config) {
    setOutput("changes-detected", false);
    setOutput("files-synced", 0);
    process.exit(0);
  }

  // Change to workspace directory
  process.chdir(WORKSPACE);

  // Configure git
  await configureGit();

  const allSyncedFiles: Record<string, string[]> = {};
  let totalFilesSynced = 0;

  // Process each repository
  for (const [repo, repoConfig] of Object.entries(config.repos)) {
    log(`\n📦 Processing repository: ${repo}`);

    const tempDir = join("/tmp", `repo-file-sync-${Date.now()}-${repo.replace("/", "-")}`);

    try {
      // Clone source repository
      const cloneSuccess = await cloneRepository(repo, tempDir);
      if (!cloneSuccess) {
        warning(`Skipping repository: ${repo}`);
        continue;
      }

      // Sync files
      const syncedFiles = await syncFiles(tempDir, repoConfig.files, WORKSPACE);

      if (syncedFiles.length > 0) {
        allSyncedFiles[repo] = syncedFiles;
        totalFilesSynced += syncedFiles.length;
      }

    } finally {
      // Cleanup temporary directory
      await $`rm -rf ${tempDir}`.quiet();
    }
  }

  // Check if there are any changes
  const changesDetected = await hasChanges();
  setOutput("changes-detected", changesDetected);
  setOutput("files-synced", totalFilesSynced);

  if (!changesDetected) {
    info("✅ No changes detected. Skipping PR creation.");
    return;
  }

  // In test mode, skip branch creation and PR
  const testMode = process.env.TEST_MODE === "true";

  if (testMode) {
    info("🧪 Test mode: Skipping branch creation and PR");
    log("\n✅ Files synced successfully (test mode)");
    return;
  }

  // Create branch and commit
  const timestamp = new Date().toISOString().replace(/[:.]/g, "-").replace("T", "-").slice(0, -5);
  const branchName = `${BRANCH_PREFIX}-${timestamp}`;

  log(`\n📝 Creating branch: ${branchName}`);
  await createBranch(branchName);

  log("💾 Committing changes");
  await commitAndPush(COMMIT_MESSAGE, branchName);

  // Create PR body
  let prBody = "## Synchronized Files\n\n";
  for (const [repo, files] of Object.entries(allSyncedFiles)) {
    prBody += `### From \`${repo}\`\n\n`;
    for (const file of files) {
      prBody += `- \`${file}\`\n`;
    }
    prBody += "\n";
  }
  prBody += `---\n\n*Automated by [repo-file-sync](https://github.com/${REPOSITORY})*`;

  // Create Pull Request
  log("🔀 Creating Pull Request");
  const pr = await createPullRequest(branchName, PR_TITLE, prBody, PR_LABELS);

  if (pr) {
    setOutput("pr-number", pr.number);
    setOutput("pr-url", pr.url);
    info(`✅ Pull Request created: ${pr.url}`);
  } else {
    error("Failed to create Pull Request");
    process.exit(1);
  }
}

// Run main function
main().catch((err) => {
  error(`Unexpected error: ${err}`);
  process.exit(1);
});
