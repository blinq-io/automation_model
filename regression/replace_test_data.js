import { expect } from "chai";
import { replaceWithLocalTestData } from "../build/lib/utils.js";

describe("replaceWithLocalTestData", function () {
  const world = {
    attachs: [],
    attach: function (content, type) {
      this.attachs.push({ content, type });
    },
  };

  let context = null;

  beforeEach(function () {
    context = {
      environment: { name: "dev" },
      _data_: {
        "*": [
          {
            key: "username",
            value: "user123",
          },
          {
            key: "password",
            value: "pass456",
          },
          {
            key: "nested",
            value: "{{username}}-xyz",
          },
          {
            key: "u",
            value: "ayush",
          },
        ],
        dev: [
          {
            key: "envKey",
            value: "dev-value",
          },
        ],
      },
    };
  });

  it("should replace a single basic placeholder", async function () {
    const value = "Login with {{username}}";
    const result = await replaceWithLocalTestData(value, world, true, true, context);
    expect(result).to.equal("Login with user123");
  });

  it("should replace multiple placeholders", async function () {
    const value = "Login with {{username}} and {{password}}";
    const result = await replaceWithLocalTestData(value, world, true, true, context);
    expect(result).to.equal("Login with user123 and pass456");
  });

  it("should resolve nested placeholders recursively", async function () {
    const value = "Nested value is {{nested}}";
    const result = await replaceWithLocalTestData(value, world, true, true, context);
    expect(result).to.equal("Nested value is user123-xyz");
  });

  it("should prioritize environment-specific values", async function () {
    const value = "Env value: {{envKey}}";
    const result = await replaceWithLocalTestData(value, world, true, true, context);
    expect(result).to.equal("Env value: dev-value");
  });

  it("should return original string if no placeholders", async function () {
    const value = "Static content";
    const result = await replaceWithLocalTestData(value, world, true, true, context);
    expect(result).to.equal("Static content");
  });

  it("should throw for undefined placeholder if throwError is true", async function () {
    const value = "Missing value: {{missingKey}}";
    try {
      await replaceWithLocalTestData(value, world, true, true, context, null, true);
      throw new Error("Expected error was not thrown");
    } catch (err) {
      expect(err.message).to.include("is undefined in the test data");
    }
  });

  it("should skip undefined placeholder if throwError is false", async function () {
    const value = "Missing value: {{missingKey}}";
    const result = await replaceWithLocalTestData(value, world, true, true, context, null, false);
    expect(result).to.equal("Missing value: {{missingKey}}");
  });

  it("should evaluate expression wrapped in ${}", async function () {
    const value = "${'Hello ' + 'World'}";
    const result = await replaceWithLocalTestData(value, world, true, true, {
      ...context,
      examplesRow: {},
    });
    expect(result).to.equal("Hello World");
  });

  it("should resolve placeholders inside expressions: ${{{u}} + bharti}", async function () {
    const value = "${'{{u}}' + 'bharti'}";
    const result = await replaceWithLocalTestData(value, world, true, true, {
      ...context,
      examplesRow: {},
    });
    expect(result).to.equal("ayushbharti");
  });
});
