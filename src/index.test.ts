import { describe, expect, test } from "bun:test";
import { main } from "./index";

describe("repo-file-sync", () => {
  test("main function exists", () => {
    expect(main).toBeDefined();
    expect(typeof main).toBe("function");
  });

  test("main function returns a promise", () => {
    const result = main();
    expect(result).toBeInstanceOf(Promise);
    
    // Clean up the promise to avoid unhandled rejection
    result.catch(() => {
      // Ignore errors in test
    });
  });
});