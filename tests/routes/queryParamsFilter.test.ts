import { describe, it, expect } from "vitest";
import { queryParamsFilter } from "../../src/route";

describe("queryParamsFilter", () => {
  it("should return true when savedQueryParams is null", () => {
    const result = queryParamsFilter(null, new URLSearchParams("key=value"));
    expect(result).toBe(true);
  });

  it("should return true when all query parameters match", () => {
    const savedQueryParams = { key: "value", anotherKey: "anotherValue" };
    const actualQueryParams = new URLSearchParams("key=value&anotherKey=anotherValue");
    const result = queryParamsFilter(savedQueryParams, actualQueryParams);
    expect(result).toBe(true);
  });

  it("should return false when a query parameter does not match", () => {
    const savedQueryParams = { key: "value", anotherKey: "anotherValue" };
    const actualQueryParams = new URLSearchParams("key=value&anotherKey=differentValue");
    const result = queryParamsFilter(savedQueryParams, actualQueryParams);
    expect(result).toBe(false);
  });

  it("should return true when a query parameter has a wildcard value", () => {
    const savedQueryParams = { key: "*", anotherKey: "anotherValue" };
    const actualQueryParams = new URLSearchParams("key=anyValue&anotherKey=anotherValue");
    const result = queryParamsFilter(savedQueryParams, actualQueryParams);
    expect(result).toBe(true);
  });

  it("should return false when a query parameter is missing in actualQueryParams", () => {
    const savedQueryParams = { key: "value", anotherKey: "anotherValue" };
    const actualQueryParams = new URLSearchParams("key=value");
    const result = queryParamsFilter(savedQueryParams, actualQueryParams);
    expect(result).toBe(false);
  });

  it("should return true when savedQueryParams is empty", () => {
    const savedQueryParams = {};
    const actualQueryParams = new URLSearchParams("key=value");
    const result = queryParamsFilter(savedQueryParams, actualQueryParams);
    expect(result).toBe(true);
  });

  it("should return false when actualQueryParams is empty", () => {
    const savedQueryParams = { key: "value" };
    const actualQueryParams = new URLSearchParams("");
    const result = queryParamsFilter(savedQueryParams, actualQueryParams);
    expect(result).toBe(false);
  });

  it("should return true when both savedQueryParams and actualQueryParams are empty", () => {
    const savedQueryParams = {};
    const actualQueryParams = new URLSearchParams("");
    const result = queryParamsFilter(savedQueryParams, actualQueryParams);
    expect(result).toBe(true);
  });
});
