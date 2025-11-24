#!/usr/bin/env bun

import { $, YAML } from "bun";
import { existsSync } from "fs";
import { join } from "path";

// GitHub Actions inputs from environment variables
const CONFIG_PATH = process.env.INPUT_CONFIG_PATH || ".github/repo-file-sync.yaml";
const TOKEN = process.env.INPUT_TOKEN || process.env.GITHUB_TOKEN || "";
const BRANCH_NAME = process.env.INPUT_BRANCH_NAME || process.env.INPUT_BRANCH_PREFIX || "repo-file-sync";
const COMMIT_MESSAGE = process.env.INPUT_COMMIT_MESSAGE || "chore: sync files from source repositories";
const PR_TITLE = process.env.INPUT_PR_TITLE || "chore: sync files from source repositories";
const PR_LABELS = process.env.INPUT_PR_LABELS || "automated";
const WORKSPACE = process.env.GITHUB_WORKSPACE || process.cwd();
const REPOSITORY = process.env.GITHUB_REPOSITORY || "";

// Warn if deprecated branch-prefix is used
if (process.env.INPUT_BRANCH_PREFIX && !process.env.INPUT_BRANCH_NAME) {
  warning("branch-prefix is deprecated. Please use branch-name instead. Using first part of branch-prefix as branch-name.");
}

interface ReplacementRule {
  pattern: string;
  replacement: string;
  flags: string;
}

interface FileConfigWithReplacements {
  replacements?: ReplacementRule[];
}

type FileEntry = string | Record<string, FileConfigWithReplacements>;

interface RepoConfig {
  files: FileEntry[] | Record<string, FileConfigWithReplacements>;
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

// Apply text replacements to file content
async function applyReplacements(filePath: string, replacements: ReplacementRule[]): Promise<void> {
  try {
    let content = await Bun.file(filePath).text();

    for (const rule of replacements) {
      try {
        const regex = new RegExp(rule.pattern, rule.flags);
        content = content.replace(regex, rule.replacement);
        log(`  Applied replacement: ${rule.pattern} -> ${rule.replacement} (flags: ${rule.flags})`);
      } catch (err) {
        warning(`  Invalid regex pattern: ${rule.pattern} - ${err}`);
      }
    }

    await Bun.write(filePath, content);
  } catch (err) {
    error(`Failed to apply replacements to ${filePath}: ${err}`);
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

// Expand glob patterns and copy files with optional text replacements
async function syncFiles(
  sourceDir: string,
  pattern: string,
  destDir: string,
  replacements?: ReplacementRule[]
): Promise<string[]> {
  const syncedFiles: string[] = [];

  try {
    log(`Processing pattern: ${pattern}`);

    // Use glob to find matching files
    const glob = new Bun.Glob(pattern);
    const matches = await Array.fromAsync(glob.scan({ cwd: sourceDir, absolute: false, onlyFiles: false }));

    if (matches.length === 0) {
      warning(`No files matched pattern: ${pattern}`);
      return syncedFiles;
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

        // Apply text replacements if specified and it's a file
        if (replacements && replacements.length > 0) {
          const stat = await Bun.file(destPath).stat();
          if (stat && !stat.isDirectory()) {
            await applyReplacements(destPath, replacements);
          }
        }

        syncedFiles.push(match);
        log(`Synced: ${match}${replacements && replacements.length > 0 ? ' (with replacements)' : ''}`);
      }
    }
  } catch (err) {
    error(`Failed to process pattern ${pattern}: ${err}`);
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
async function commitAndPush(message: string, branchName: string, force: boolean = false) {
  await $`git add .`.quiet();
  await $`git commit -m ${message}`.quiet();

  const pushUrl = TOKEN
    ? `https://x-access-token:${TOKEN}@github.com/${REPOSITORY}.git`
    : `origin`;

  try {
    if (force) {
      await $`git push --force ${pushUrl} ${branchName}`;
    } else {
      await $`git push -u ${pushUrl} ${branchName}`;
    }
  } catch (err) {
    error(`Failed to push: ${err}`);
    throw err;
  }
}

// Check if remote branch exists
async function remotebranchExists(branchName: string): Promise<boolean> {
  try {
    await $`git fetch origin ${branchName}`.quiet();
    const result = await $`git rev-parse --verify origin/${branchName}`.quiet().nothrow();
    return result.exitCode === 0;
  } catch {
    return false;
  }
}

// Delete remote and local branches
async function deleteBranch(branchName: string) {
  try {
    // Delete remote branch
    const pushUrl = TOKEN
      ? `https://x-access-token:${TOKEN}@github.com/${REPOSITORY}.git`
      : `origin`;

    await $`git push ${pushUrl} --delete ${branchName}`.quiet().nothrow();
    log(`Deleted remote branch: ${branchName}`);
  } catch {
    // Ignore errors if branch doesn't exist
  }

  try {
    // Delete local branch if exists
    await $`git branch -D ${branchName}`.quiet().nothrow();
  } catch {
    // Ignore errors
  }
}

// Find existing PR for the branch
async function findExistingPR(branchName: string): Promise<string | null> {
  try {
    const proc = Bun.spawn(["gh", "pr", "list", "--head", branchName, "--json", "number", "--jq", ".[0].number"], {
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

    if (proc.exitCode === 0 && stdout.trim()) {
      return stdout.trim();
    }
    return null;
  } catch (err) {
    warning(`Failed to find existing PR: ${err}`);
    return null;
  }
}

// Update existing PR
async function updateExistingPR(prNumber: string, title: string, body: string, labels: string): Promise<boolean> {
  try {
    log(`Updating existing PR #${prNumber}`);

    // Update title and body
    const proc = Bun.spawn(["gh", "pr", "edit", prNumber, "--title", title, "--body", body], {
      env: {
        GH_TOKEN: TOKEN,
        ...process.env
      },
      stdout: "pipe",
      stderr: "pipe",
    });

    await proc.exited;

    if (proc.exitCode !== 0) {
      const stderr = await new Response(proc.stderr).text();
      error(`Failed to update PR: ${stderr}`);
      return false;
    }

    // Try to add labels
    const labelArgs = labels.split(",").map(l => l.trim()).filter(l => l.length > 0);
    if (labelArgs.length > 0) {
      try {
        const labelProc = Bun.spawn(["gh", "pr", "edit", prNumber, ...labelArgs.flatMap(l => ["--add-label", l])], {
          env: {
            GH_TOKEN: TOKEN,
            ...process.env
          },
        });
        await labelProc.exited;
        if (labelProc.exitCode !== 0) {
          warning(`Could not add labels to PR #${prNumber} (labels may not exist)`);
        }
      } catch (err) {
        warning(`Could not add labels: ${err}`);
      }
    }

    return true;
  } catch (err) {
    error(`Failed to update PR: ${err}`);
    return false;
  }
}

// Create a Pull Request using GitHub CLI
async function createPullRequest(branchName: string, title: string, body: string, labels: string): Promise<{ number: string, url: string } | null> {
  try {
    // Build command arguments array
    const args = ["pr", "create", "--title", title, "--body", body, "--head", branchName];

    // Create PR without labels first
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

    // Try to add labels if specified (but don't fail if labels don't exist)
    const labelArgs = labels.split(",").map(l => l.trim()).filter(l => l.length > 0);
    if (labelArgs.length > 0 && number) {
      try {
        const labelProc = Bun.spawn(["gh", "pr", "edit", number, ...labelArgs.flatMap(l => ["--add-label", l])], {
          env: {
            GH_TOKEN: TOKEN,
            ...process.env
          },
        });
        await labelProc.exited;
        if (labelProc.exitCode !== 0) {
          warning(`Could not add labels to PR #${number} (labels may not exist)`);
        }
      } catch (err) {
        warning(`Could not add labels: ${err}`);
      }
    }

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

      // Parse files configuration (array or object format)
      const filesConfig = repoConfig.files;
      let syncedFiles: string[] = [];

      if (Array.isArray(filesConfig)) {
        // Array format: can contain strings or objects
        for (const entry of filesConfig) {
          if (typeof entry === "string") {
            // Simple string pattern
            const files = await syncFiles(tempDir, entry, WORKSPACE);
            syncedFiles.push(...files);
          } else if (typeof entry === "object") {
            // Object with pattern as key
            for (const [pattern, config] of Object.entries(entry)) {
              const files = await syncFiles(tempDir, pattern, WORKSPACE, config?.replacements);
              syncedFiles.push(...files);
            }
          }
        }
      } else if (typeof filesConfig === "object") {
        // Object format: keys are patterns
        for (const [pattern, config] of Object.entries(filesConfig)) {
          const files = await syncFiles(tempDir, pattern, WORKSPACE, config?.replacements);
          syncedFiles.push(...files);
        }
      }

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

  // Use fixed branch name (no timestamp)
  const branchName = BRANCH_NAME;

  // Check if remote branch exists and delete it if so
  log(`\n🔍 Checking for existing branch: ${branchName}`);
  const branchExists = await remotebranchExists(branchName);

  if (branchExists) {
    log(`Found existing branch, deleting and recreating from main`);
    await deleteBranch(branchName);
  }

  // Create new branch from main
  log(`📝 Creating branch: ${branchName}`);
  await createBranch(branchName);

  log("💾 Committing changes");
  await commitAndPush(COMMIT_MESSAGE, branchName, false);

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

  // Check for existing PR
  log("🔍 Checking for existing Pull Request");
  const existingPrNumber = await findExistingPR(branchName);

  if (existingPrNumber) {
    // Update existing PR
    log(`Found existing PR #${existingPrNumber}, updating it`);
    const updated = await updateExistingPR(existingPrNumber, PR_TITLE, prBody, PR_LABELS);

    if (updated) {
      const prUrl = `https://github.com/${REPOSITORY}/pull/${existingPrNumber}`;
      setOutput("pr-number", existingPrNumber);
      setOutput("pr-url", prUrl);
      info(`✅ Pull Request updated: ${prUrl}`);
    } else {
      error("Failed to update Pull Request");
      process.exit(1);
    }
  } else {
    // Create new PR
    log("🔀 Creating new Pull Request");
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
}

// Run main function
main().catch((err) => {
  error(`Unexpected error: ${err}`);
  process.exit(1);
});
