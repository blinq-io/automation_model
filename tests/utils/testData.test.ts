// src/utils/testDataHelper.test.ts

import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import axios from "axios";
import { replaceWithLocalTestData } from "../../src/utils"; // Adjust the import path as needed

vi.mock("axios");

import { _getTestData, formatDate, _getServerUrl, evaluateString, decrypt } from "../../src/utils";
import { initContext } from "../../src";

describe("replaceWithLocalTestData", () => {
  const mockWorld = {};
  let mockContext: any;

  beforeEach(async () => {
    vi.clearAllMocks();
    mockContext = await initContext("", false, true, null, 0, null, "./environments/shop-blinq.json");
  });

  // --- Basic Cases ---

  it("should return the original value if it is null or empty", async () => {
    expect(await replaceWithLocalTestData(null, mockWorld, true, true, mockContext)).toBeNull();
    expect(await replaceWithLocalTestData("", mockWorld, true, true, mockContext)).toBe("");
  });

  it("should replace a placeholder with environment-specific data", async () => {
    const result = await replaceWithLocalTestData("User: {{username}}", mockWorld, true, true, mockContext);
    expect(result).toBe("User: aditya");
  });

  it("should fall back to wildcard data if environment-specific data is not found", async () => {
    const result = await replaceWithLocalTestData("Role: {{username}}", mockWorld, true, true, mockContext);
    expect(result).toBe("Role: guy");
  });

  // --- Nested Replacements ---

  it("should recursively replace nested placeholders", async () => {
    const input = "Value is {{nested.1}}";
    const expected = "Value is final_dev_value";
    const result = await replaceWithLocalTestData(input, mockWorld, true, true, mockContext);
    expect(result).toBe(expected);
  });

  // --- Date Placeholders ---

  describe("Date Placeholder Resolution", () => {
    beforeEach(() => {
      // Mock a successful API response for the date service
      vi.mocked(axios.request).mockResolvedValue({
        status: 200,
        data: {
          status: true,
          result: "2025-08-29T12:00:00.000Z",
        },
      });
      // Set the required environment variable for the test
      process.env.TOKEN = "test-token";
    });

    it("should call the date service and format the result", async () => {
      const input = "Today is {{date:now}}";
      const result = await replaceWithLocalTestData(input, mockWorld, true, true, mockContext);

      expect(axios.request).toHaveBeenCalledWith(
        expect.objectContaining({
          method: "post",
          url: "http://mock-server.com/api/runs/find-date/find",
          data: JSON.stringify({ value: "now" }),
        })
      );
      expect(formatDate).toHaveBeenCalledWith("2025-08-29T12:00:00.000Z", null);
      expect(result).toBe("Today is formatted_2025-08-29T12:00:00.000Z");
    });

    it("should use the provided format template for the date", async () => {
      const input = "The date is {{date:now>>YYYY-MM-DD}}";
      await replaceWithLocalTestData(input, mockWorld, true, true, mockContext);

      expect(formatDate).toHaveBeenCalledWith("2025-08-29T12:00:00.000Z", "YYYY-MM-DD");
    });

    it("should throw an error if the date service call fails", async () => {
      vi.mocked(axios.request).mockResolvedValue({ status: 500, data: {} });
      const input = "{{date:now}}";

      await expect(replaceWithLocalTestData(input, mockWorld, true, true, mockContext)).rejects.toThrow(
        "Failed to find date"
      );
    });
  });

  // --- Decryption and Evaluation ---

  describe("Decryption and JS Evaluation", () => {
    it('should call decrypt for a "secret:" prefixed string after replacement', async () => {
      const input = "{{api_key}}"; // Resolves to '{{secret_key}}' then to 'secret:12345'
      const result = await replaceWithLocalTestData(input, mockWorld, true, true, mockContext);

      expect(decrypt).toHaveBeenCalledWith("secret:12345", null, true);
      expect(result).toBe("decrypted_secret:12345");
    });

    it("should NOT call decrypt if _decrypt is false", async () => {
      const input = "{{api_key}}"; // Resolves to 'secret:12345'
      const result = await replaceWithLocalTestData(input, mockWorld, false, true, mockContext);

      expect(decrypt).not.toHaveBeenCalled();
      expect(result).toBe("secret:12345");
    });

    it("should call evaluateString for a JS expression", async () => {
      mockContext._data_["*"].js_expr = "${1 + 1}";
      const input = "{{js_expr}}";
      const result = await replaceWithLocalTestData(input, mockWorld, true, true, mockContext);

      expect(evaluateString).toHaveBeenCalledWith("${1 + 1}", undefined);
      expect(result).toBe("evaluated_${1 + 1}");
    });
  });

  // --- Error Handling and Edge Cases ---

  describe("Error Handling", () => {
    it("should throw an error for an undefined placeholder by default", async () => {
      const input = "Value is {{non_existent_key}}";

      await expect(replaceWithLocalTestData(input, mockWorld, true, true, mockContext)).rejects.toThrow(
        'Parameter "{{non_existent_key}}" is undefined in the test data'
      );
    });

    it("should warn and return null replacement when throwError is false", async () => {
      const consoleWarnSpy = vi.spyOn(console, "warn").mockImplementation(() => {});
      const input = "Value: {{non_existent_key}}";

      const result = await replaceWithLocalTestData(input, mockWorld, true, true, mockContext, null, false);

      // String.replace('{{...}}', null) results in the string 'null'
      expect(result).toBe("Value: null");
      expect(consoleWarnSpy).toHaveBeenCalledWith('Parameter "{{non_existent_key}}" is undefined in the test data');

      consoleWarnSpy.mockRestore();
    });
  });
});
