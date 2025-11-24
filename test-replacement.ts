#!/usr/bin/env bun

/**
 * Test script for text replacement feature
 */

import { $ } from "bun";
import { existsSync } from "fs";
import { join } from "path";

const TEST_DIR = join(import.meta.dir, "test-replacement-workspace");

async function setup() {
  console.log("🧪 Setting up test environment for text replacement...\n");

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

  // Copy test configuration file
  await $`mkdir -p ${join(TEST_DIR, ".github")}`.quiet();
  await $`cp ${join(import.meta.dir, ".github/repo-file-sync-test.yaml")} ${join(TEST_DIR, ".github/repo-file-sync.yaml")}`.quiet();

  console.log("✅ Test workspace created at:", TEST_DIR);
  console.log("");
}

async function runTest() {
  console.log("🚀 Running text replacement test...\n");

  // Set environment variables
  process.env.INPUT_CONFIG_PATH = ".github/repo-file-sync.yaml";
  process.env.INPUT_TOKEN = "";
  process.env.INPUT_BRANCH_PREFIX = "test/sync";
  process.env.INPUT_COMMIT_MESSAGE = "test: sync files with replacements";
  process.env.INPUT_PR_TITLE = "Test: Sync files with replacements";
  process.env.INPUT_PR_LABELS = "test";
  process.env.GITHUB_WORKSPACE = TEST_DIR;
  process.env.GITHUB_REPOSITORY = "test/repo";
  process.env.GITHUB_OUTPUT = join(TEST_DIR, "github_output.txt");
  process.env.TEST_MODE = "true";

  // Run the main script
  const mainScript = join(import.meta.dir, "src/main.ts");

  try {
    await $`bun run ${mainScript}`.env(process.env);

    console.log("\n📊 Test Results:");
    console.log("================");

    // Check if files were synced and replacements applied
    const readmePath = join(TEST_DIR, "README.md");
    const licensePath = join(TEST_DIR, "LICENSE");
    const actionPath = join(TEST_DIR, "action.yml");

    // Test README.md replacements
    if (existsSync(readmePath)) {
      const content = await Bun.file(readmePath).text();
      const hasCheckoutUppercase = content.includes("CHECKOUT");
      const hasReplacedUrl = content.includes("https://example.com/test-repo");

      console.log(`✅ README.md - synced`);
      console.log(`  ${hasCheckoutUppercase ? '✅' : '❌'} 'checkout' -> 'CHECKOUT' replacement`);
      console.log(`  ${hasReplacedUrl ? '✅' : '❌'} URL replacement`);

      if (!hasCheckoutUppercase) {
        console.log(`    Sample content: ${content.slice(0, 200)}...`);
      }
    } else {
      console.log(`❌ README.md - missing`);
    }

    // Test LICENSE (no replacements)
    if (existsSync(licensePath)) {
      console.log(`✅ LICENSE - synced (no replacements)`);
    } else {
      console.log(`❌ LICENSE - missing`);
    }

    // Test action.yml replacements
    if (existsSync(actionPath)) {
      const content = await Bun.file(actionPath).text();
      const hasReplacement = content.includes("name: 'Test Action'");

      console.log(`✅ action.yml - synced`);
      console.log(`  ${hasReplacement ? '✅' : '❌'} Name replacement`);
    } else {
      console.log(`❌ action.yml - missing`);
    }

    // Show git status
    console.log("\n📝 Git Status:");
    console.log("==============");
    await $`git status --short`;

  } catch (error) {
    console.error("❌ Test failed:", error);
    throw error;
  }
}

async function cleanup() {
  console.log("\n🧹 Test workspace location:");
  console.log(`  ${TEST_DIR}`);
  console.log("\nTo inspect results:");
  console.log(`  cat ${TEST_DIR}/README.md | head -20`);
  console.log("\nTo clean up:");
  console.log(`  rm -rf ${TEST_DIR}`);
}

// Main execution
async function main() {
  try {
    await setup();
    await runTest();
    await cleanup();

    console.log("\n✅ Text replacement test completed!");

  } catch (error) {
    console.error("\n❌ Test failed:", error);
    process.exit(1);
  }
}

main();
