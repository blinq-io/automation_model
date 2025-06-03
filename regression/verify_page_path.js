import { initContext, closeContext, navigate } from "../build/lib/auto_page.js";
import { getContext } from "../build/lib/init_browser.js";
import fs from "fs";
import { expect } from "chai";

let context = null;
describe("verifyPagePath", function () {
  before(async function () {
    // ensure temp/ exists (for screenshots, if any)
    if (!fs.existsSync("temp")) fs.mkdirSync("temp");
  });
  beforeEach(async function () {
    // mirror verify_title.js setup
    context = await getContext(null, false, null, null, null, true, null, -1, null);
    // pick a known fixture URL
    await context.web.goto("https://main.dldrg2rtamdtd.amplifyapp.com/site/form/index.html");
  });
  afterEach(async function () {
    await closeContext();
  });

  it("passes when the path contains the expected segment", async function () {
    // should resolve cleanly (no throw)
    await context.web.verifyPagePath("contains:/site/form/index.html", {}, this);
  });

  it("throws when the path segment never appears", async function () {
    let caught = null;
    try {
      await context.web.verifyPagePath("contains:$$NON_EXISTENT_PATH$$", {}, this);
    } catch (e) {
      caught = e;
      console.log("error:", e.message);
    }
    expect(caught).to.not.be.null;
  });
});
