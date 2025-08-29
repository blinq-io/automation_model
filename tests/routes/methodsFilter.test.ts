import { describe, it, expect } from "vitest";
import { methodFilter } from "../../src/route";

describe("methodFilter", () => {
  it("should return true if savedMethod is null", () => {
    expect(methodFilter(null, "GET")).toBe(true);
  });

  it("should return true if savedMethod is '*'", () => {
    expect(methodFilter("*", "GET")).toBe(true);
    expect(methodFilter("*", "POST")).toBe(true);
    expect(methodFilter("*", "PUT")).toBe(true);
    expect(methodFilter("*", "DELETE")).toBe(true);
    expect(methodFilter("*", "PATCH")).toBe(true);
    expect(methodFilter("*", "OPTIONS")).toBe(true);
    expect(methodFilter("*", "HEAD")).toBe(true);
  });

  it("should return false if savedMethod is '*' and actualMethod is not a valid HTTP method", () => {
    expect(methodFilter("*", "INVALID")).toBe(false);
    expect(methodFilter("*", "123")).toBe(false);
  });

  it("should return true if savedMethod matches actualMethod", () => {
    expect(methodFilter("GET", "GET")).toBe(true);
    expect(methodFilter("POST", "POST")).toBe(true);
  });

  it("should return false if savedMethod does not match actualMethod", () => {
    expect(methodFilter("GET", "POST")).toBe(false);
    expect(methodFilter("PUT", "DELETE")).toBe(false);
  });
});
