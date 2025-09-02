// utils.test.ts
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import path from "path";
import CryptoJS from "crypto-js";
import {
  measureAsync,
  encrypt,
  decrypt,
  replaceWithLocalTestData,
  maskValue,
  _copyContext,
  scrollPageToLoadLazyElements,
  _fixUsingParams,
  getWebLogFile,
  _fixLocatorUsingParams,
  _isObject,
  scanAndManipulate,
  KEYBOARD_EVENTS,
  unEscapeString,
  _getServerUrl,
  _convertToRegexQuery,
  extractStepExampleParameters,
  _getDataFile,
  tryParseJson,
  getTestDataValue,
  replaceTestDataValue,
  _getTestData,
  testForRegex,
} from "../../src/utils"; // adjust import path

import fs from "fs";

describe("measureAsync", () => {
  it("measures an async function", async () => {
    const result = await measureAsync("test", async () => {
      return 42;
    });
    expect(result).toBe(42);
  });
});

describe("encryption", () => {
  const key = "test-key";
  it("encrypts and decrypts a string", () => {
    const encrypted = encrypt("hello", key);
    const decrypted = decrypt(encrypted, key);
    expect(decrypted).toBe("hello");
  });

  it("masks secret values", () => {
    expect(maskValue("secret:1234")).toBe("secret:****");
    expect(maskValue("totp:1234")).toBe("totp:****");
    expect(maskValue("mask:abcd")).toBe("mask:****");
  });
});

describe("test data utils", () => {
  const tempFile = path.join(process.cwd(), "data.json");
  const data = {
    "*": [{ DataType: "string", key: "name", value: "blinq" }],
    dev: [{ DataType: "secret", key: "password", value: "abc" }],
  };

  beforeEach(() => {
    fs.writeFileSync(tempFile, JSON.stringify(data));
  });
  afterEach(() => {
    fs.unlinkSync(tempFile);
  });

  it("gets test data value from default env", () => {
    const val = getTestDataValue("name");
    expect(val).toBe("blinq");
  });

  it("returns decrypted secret", () => {
    const val = replaceTestDataValue("dev", "password", data, false);
    expect(val).toMatch(/^secret:/);
  });

  it("loads data file with _getTestData", () => {
    const obj = _getTestData();
    expect(obj["*"][0].value).toBe("blinq");
  });

  it("returns correct test data file path", () => {
    const file = _getDataFile({ reportFolder: "myReports" });
    expect(file).toContain("myReports");
  });
});

describe("regex helpers", () => {
  it("detects regex strings", () => {
    expect(testForRegex("/abc/")).toBe(true);
    expect(testForRegex("notRegex")).toBe(false);
  });

  it("_convertToRegexQuery with literal text", () => {
    const q = _convertToRegexQuery("hello world", false, true, true);
    expect(q).toContain("internal:text=");
    expect(q).toContain("i");
  });
});

describe("object manipulation", () => {
  it("_isObject works", () => {
    expect(_isObject({})).toBe(true);
    expect(_isObject([])).toBe(false);
    expect(_isObject(null)).toBe(false);
  });

  it("_fixUsingParams replaces placeholders", () => {
    const result = _fixUsingParams("Hello {name}", { name: "Alice" });
    expect(result).toBe("Hello Alice");
  });

  it("scanAndManipulate replaces nested values", () => {
    const obj = { a: "Hello {name}" };
    scanAndManipulate(obj, { name: "Bob" });
    expect(obj.a).toBe("Hello Bob");
  });

  it("_fixLocatorUsingParams clones object and replaces", () => {
    const locator = { sel: "Click {btn}" };
    const fixed = _fixLocatorUsingParams(locator, { btn: "Submit" });
    expect(fixed.sel).toBe("Click Submit");
    expect(locator.sel).toBe("Click {btn}"); // original untouched
  });
});

describe("misc helpers", () => {
  it("creates new log file path", () => {
    const folder = path.join(process.cwd(), "logs");
    if (fs.existsSync(folder)) fs.rmSync(folder, { recursive: true });
    const file = getWebLogFile(folder);
    expect(file.endsWith("1.json")).toBe(true);
  });

  it("unEscapeString replaces \\n with newline", () => {
    expect(JSON.stringify(unEscapeString("Hello\\nWorld"))).toBe(JSON.stringify("Hello\nWorld"));
  });

  it("_getServerUrl defaults to prod", () => {
    expect(_getServerUrl()).toBe("https://api.blinq.io");
  });

  it("tryParseJson returns parsed object", () => {
    expect(tryParseJson('{"a":1}')).toEqual({ a: 1 });
    expect(tryParseJson("notJson")).toBe("notJson");
  });
});

describe("extractStepExampleParameters", () => {
  it("returns params from scenario examples", () => {
    const fakeStep = {
      pickle: { astNodeIds: ["s1", "e1"] },
      gherkinDocument: {
        feature: {
          children: [
            {
              scenario: {
                id: "s1",
                examples: [
                  {
                    tableHeader: { cells: [{ value: "col1" }] },
                    tableBody: [{ id: "e1", cells: [{ value: "val1" }] }],
                  },
                ],
              },
            },
          ],
        },
      },
    };
    const params = extractStepExampleParameters(fakeStep);
    expect(params).toEqual({ col1: "val1" });
  });

  it("returns empty object for invalid input", () => {
    expect(extractStepExampleParameters(null)).toEqual({});
  });
});

describe("KEYBOARD_EVENTS", () => {
  it("contains Enter", () => {
    expect(KEYBOARD_EVENTS).toContain("Enter");
  });
});
