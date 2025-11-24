#!/usr/bin/env bun

/**
 * Local test script for repo-file-sync
 *
 * This script simulates the GitHub Actions environment locally
 * to test file synchronization without creating actual PRs.
 */

import { $ } from "bun";
import { existsSync } from "fs";
import { join } from "path";

const TEST_DIR = join(import.meta.dir, "test-workspace");

async function setup() {
  console.log("🧪 Setting up test environment...\n");

  // Clean up previous test
  if (existsSync(TEST_DIR)) {
    await $`rm -rf ${TEST_DIR}`.quiet();
  }

  // Create test workspace
  await $`mkdir -p ${TEST_DIR}`.quiet();

  // Initialize git repository
  process.chdir(TEST_DIR);
  await $`git init`.quiet();
  await $`git config user.name "Test User"`.quiet();
  await $`git config user.email "test@example.com"`.quiet();

  // Create initial commit
  await Bun.write(join(TEST_DIR, "README.md"), "# Test Repository\n");
  await $`git add .`.quiet();
  await $`git commit -m "Initial commit"`.quiet();

  // Copy configuration file
  await $`mkdir -p ${join(TEST_DIR, ".github")}`.quiet();
  await $`cp ${join(import.meta.dir, ".github/repo-file-sync.yaml")} ${join(TEST_DIR, ".github/")}`.quiet();

  console.log("✅ Test workspace created at:", TEST_DIR);
  console.log("");
}

async function runTest() {
  console.log("🚀 Running file sync test...\n");

  // Set environment variables
  process.env.INPUT_CONFIG_PATH = ".github/repo-file-sync.yaml";
  process.env.INPUT_TOKEN = ""; // No token needed for public repos
  process.env.INPUT_BRANCH_PREFIX = "test/sync";
  process.env.INPUT_COMMIT_MESSAGE = "test: sync files";
  process.env.INPUT_PR_TITLE = "Test: Sync files";
  process.env.INPUT_PR_LABELS = "test";
  process.env.GITHUB_WORKSPACE = TEST_DIR;
  process.env.GITHUB_REPOSITORY = "test/repo";
  process.env.GITHUB_OUTPUT = join(TEST_DIR, "github_output.txt");

  // Run the main script (without PR creation)
  const mainScript = join(import.meta.dir, "src/main.ts");

  try {
    // Import and run a modified version that skips PR creation
    const result = await $`bun run ${mainScript}`.env({
      ...process.env,
      TEST_MODE: "true", // Signal to skip PR creation
    }).nothrow();

    console.log("\n📊 Test Results:");
    console.log("================");

    // Check if files were synced
    const syncedFiles = [
      "README.md",
      "LICENSE",
      "action.yml"
    ];

    for (const file of syncedFiles) {
      const filePath = join(TEST_DIR, file);
      if (existsSync(filePath)) {
        console.log(`✅ ${file} - synced`);
      } else {
        console.log(`❌ ${file} - missing`);
      }
    }

    // Show git status
    console.log("\n📝 Git Status:");
    console.log("==============");
    await $`git status`;

    // Show outputs
    console.log("\n📤 Action Outputs:");
    console.log("==================");
    if (existsSync(process.env.GITHUB_OUTPUT)) {
      const outputs = await Bun.file(process.env.GITHUB_OUTPUT).text();
      console.log(outputs);
    }

  } catch (error) {
    console.error("❌ Test failed:", error);
    throw error;
  }
}

async function cleanup() {
  console.log("\n🧹 Cleaning up...");
  process.chdir(import.meta.dir);

  // Ask user if they want to keep the test workspace
  console.log(`\nTest workspace: ${TEST_DIR}`);
  console.log("To inspect the results, check the test-workspace directory");
  console.log("To clean up manually, run: rm -rf test-workspace");
}

// Main execution
async function main() {
  try {
    await setup();
    await runTest();
    await cleanup();

    console.log("\n✅ Test completed!");
    console.log("\nNext steps:");
    console.log("1. Check the synced files in test-workspace/");
    console.log("2. Review git status to see changes");
    console.log("3. Clean up with: rm -rf test-workspace");

  } catch (error) {
    console.error("\n❌ Test failed:", error);
    process.exit(1);
  }
}

main();
