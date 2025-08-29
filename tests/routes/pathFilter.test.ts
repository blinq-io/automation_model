import { describe, expect, it } from "vitest";
import { pathFilter } from "../../src/route";
describe("pathFilter", () => {
  describe("Type validation", () => {
    it("should return false when savedPath is not a string", () => {
      expect(pathFilter(null as any, "/some/path")).toBe(false);
      expect(pathFilter(undefined as any, "/some/path")).toBe(false);
      expect(pathFilter(123 as any, "/some/path")).toBe(false);
      expect(pathFilter({} as any, "/some/path")).toBe(false);
      expect(pathFilter([] as any, "/some/path")).toBe(false);
      expect(pathFilter(true as any, "/some/path")).toBe(false);
    });
  });

  describe("Exact path matching", () => {
    it("should return true for exact matches", () => {
      expect(pathFilter("/home/user/documents", "/home/user/documents")).toBe(true);
      expect(pathFilter("/api/v1/users", "/api/v1/users")).toBe(true);
      expect(pathFilter("", "")).toBe(true);
      expect(pathFilter("simple-path", "simple-path")).toBe(true);
    });

    it("should return false for non-exact matches", () => {
      expect(pathFilter("/home/user/documents", "/home/user/downloads")).toBe(false);
      expect(pathFilter("/api/v1/users", "/api/v2/users")).toBe(false);
      expect(pathFilter("/path", "/path/subpath")).toBe(false);
      expect(pathFilter("/path/subpath", "/path")).toBe(false);
      expect(pathFilter("case-sensitive", "Case-Sensitive")).toBe(false);
    });

    it("should handle edge cases for exact matching", () => {
      expect(pathFilter("", "/some/path")).toBe(false);
      expect(pathFilter("/some/path", "")).toBe(false);
      expect(pathFilter(" ", " ")).toBe(true);
      expect(pathFilter("/path with spaces", "/path with spaces")).toBe(true);
    });
  });

  describe("Wildcard pattern matching", () => {
    it("should match single wildcard patterns", () => {
      expect(pathFilter("/home/*/documents", "/home/user/documents")).toBe(true);
      expect(pathFilter("/home/*/documents", "/home/admin/documents")).toBe(true);
      expect(pathFilter("*/config.json", "/app/config.json")).toBe(true);
      expect(pathFilter("*/config.json", "/nested/path/config.json")).toBe(true);
      expect(pathFilter("/api/*/users", "/api/v1/users")).toBe(true);
    });

    it("should match multiple wildcard patterns", () => {
      expect(pathFilter("/*/user/*/files", "/home/user/documents/files")).toBe(true);
      expect(pathFilter("*/*/config", "/app/env/config")).toBe(true);
      expect(pathFilter("*/*/*", "/a/b/c")).toBe(true);
      expect(pathFilter("*.*", "file.txt")).toBe(true);
      expect(pathFilter("*.*.backup", "config.json.backup")).toBe(true);
    });

    it("should handle wildcard at different positions", () => {
      // Wildcard at the beginning
      expect(pathFilter("*/documents/file.txt", "/home/documents/file.txt")).toBe(true);
      expect(pathFilter("*/documents/file.txt", "/users/admin/documents/file.txt")).toBe(true);

      // Wildcard at the end
      expect(pathFilter("/home/user/*", "/home/user/documents")).toBe(true);
      expect(pathFilter("/home/user/*", "/home/user/downloads/file.pdf")).toBe(true);

      // Wildcard in the middle
      expect(pathFilter("/home/*/config", "/home/user/config")).toBe(true);
    });

    it("should not match when wildcard pattern does not fit", () => {
      expect(pathFilter("/home/*/documents", "/home/documents")).toBe(false);
      expect(pathFilter("/home/*/documents", "/office/user/documents")).toBe(false);
      expect(pathFilter("*.txt", "file.pdf")).toBe(false);
      expect(pathFilter("/exact/*/path", "/exact/wrong/different")).toBe(false);
    });

    it("should handle edge cases with wildcards", () => {
      // Single wildcard matching everything
      expect(pathFilter("*", "/any/path/here")).toBe(true);
      expect(pathFilter("*", "")).toBe(true);
      expect(pathFilter("*", "anything")).toBe(true);

      // Multiple consecutive wildcards
      expect(pathFilter("**", "/any/path")).toBe(true);
      expect(pathFilter("***", "anything")).toBe(true);

      // Wildcard with empty string
      expect(pathFilter("*", "")).toBe(true);
      expect(pathFilter("prefix*", "prefix")).toBe(true);
      expect(pathFilter("*suffix", "suffix")).toBe(true);
    });

    it("should handle special regex characters in paths", () => {
      // Paths with regex special characters should be treated literally (except *)
      expect(pathFilter("/path/with.dots", "/path/with.dots")).toBe(true);
      expect(pathFilter("/path/with(parens)", "/path/with(parens)")).toBe(true);
      expect(pathFilter("/path/with[brackets]", "/path/with[brackets]")).toBe(true);
      expect(pathFilter("/path/with+plus", "/path/with+plus")).toBe(true);
      expect(pathFilter("/path/with?question", "/path/with?question")).toBe(true);
    });
    // With wildcards
    it("should handle wildcards with special regex characters", () => {
      expect(pathFilter("/path/*.txt", "/path/file.with.dots.txt")).toBe(true);
      expect(pathFilter("/path/*/file(1).txt", "/path/subdir/file(1).txt")).toBe(true);
    });
  });

  describe("Mixed scenarios", () => {
    it("should handle realistic file system paths", () => {
      // Common file patterns
      expect(pathFilter("/var/log/*.log", "/var/log/application.log")).toBe(true);
      expect(pathFilter("/usr/*/bin/node", "/usr/local/bin/node")).toBe(true);
      expect(pathFilter("/home/*/.*", "/home/user/.bashrc")).toBe(true);

      // Build artifacts
      expect(pathFilter("dist/*.js", "dist/bundle.js")).toBe(true);
      expect(pathFilter("node_modules/*/package.json", "node_modules/express/package.json")).toBe(true);

      // API routes
      expect(pathFilter("/api/*/users/*", "/api/v1/users/123")).toBe(true);
      expect(pathFilter("/assets/*/*.css", "/assets/styles/main.css")).toBe(true);
    });

    it("should handle empty and whitespace paths", () => {
      expect(pathFilter("", "")).toBe(true);
      expect(pathFilter("*", "")).toBe(true);
      expect(pathFilter("", "/some/path")).toBe(false);
      expect(pathFilter(" ", " ")).toBe(true);
      expect(pathFilter("* *", "hello world")).toBe(true);
    });
  });

  describe("Performance and edge cases", () => {
    it("should handle very long paths", () => {
      const longPath = "/very/long/path/with/many/segments/that/goes/on/and/on/file.txt";
      const longPattern = "/very/*/path/with/*/segments/*/goes/*/and/*/file.txt";
      expect(pathFilter(longPattern, longPath)).toBe(true);
    });

    it("should handle paths with unusual but valid characters", () => {
      expect(pathFilter("/path/with spaces", "/path/with spaces")).toBe(true);
      expect(pathFilter("/path/with-dashes_and_underscores", "/path/with-dashes_and_underscores")).toBe(true);
      expect(pathFilter("/path/*/file name.txt", "/path/subdir/file name.txt")).toBe(true);
      expect(pathFilter("/path/with@symbols#and$percent%", "/path/with@symbols#and$percent%")).toBe(true);
    });

    it("should be case sensitive", () => {
      expect(pathFilter("/Path/To/File", "/path/to/file")).toBe(false);
      expect(pathFilter("/Path/*/File", "/path/something/file")).toBe(false);
      expect(pathFilter("*.TXT", "file.txt")).toBe(false);
    });
  });
});
