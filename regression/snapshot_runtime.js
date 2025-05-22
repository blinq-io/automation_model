import { initContext, closeContext } from "../build/lib/auto_page.js";
import fs from "fs";
import path from "path";
import { expect } from "chai";

let context = null;
describe("snapshot_runtime", function () {
  before(async function () {
    // check if temp directory exists
    if (!fs.existsSync("temp")) {
      fs.mkdirSync("temp");
    }
  });
  beforeEach(async function () {
    context = await initContext("/", true, false);
  });
  afterEach(async function () {
    await closeContext();
  });

  const locElements = {
    link: {
      locators: [{ css: "a" }],
    },
  };
  it("snapshot_runtime simple", async function () {
    let info = null;
    info = await context.web.snapshotValidation(
      null,
      `
yaml:- list:
  - listitem:
    - paragraph: blinq_admin
    `.trim(),
      null,
      { screenshotPath: "./temp/1.png", screenshot: true },
      null
    );
  });
  it("snapshot_runtime error", async function () {
    let info = null;
    try {
      info = await context.web.snapshotValidation(
        null,
        `
yaml:- list:
  - listitem:
    - paragraph: blinq_admin1
    `.trim(),
        null,
        { screenshotPath: "./temp/1.png", screenshot: true },
        null
      );
    } catch (e) {
      expect(e.message.split("\n")[0].trim()).to.be.equal(`No snapshot match Snapshot file: yaml:- list:`);
    }
  });
});
