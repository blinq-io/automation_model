import { initContext, closeContext, navigate } from "../build/lib/auto_page.js";
import { getContext } from "../build/lib/init_browser.js";
import fs from "fs";
import { expect } from "chai";

let context = null;

describe("goto", function () {
  before(async function () {
    // check if temp directory exists
    if (!fs.existsSync("temp")) {
      fs.mkdirSync("temp");
    }
  });
  beforeEach(async function () {
    context = await getContext(null, false, null, null, null, true, null, -1, null);
    await context.web.goto("https://shop-blinq.io");
  });
  afterEach(async function () {
    await closeContext();
  });

  it("goto without testdata", async function () {
    let info = {};
    info.log = "";
    let url = "https://superdemo.blinq.io/";
    await context.web.goto(url, this);
    await context.web.verifyTextExistInPage("Welcome to Test on components");
  });
  it("goto with testdata", async function () {
    let info = {};
    info.log = "";
    let url = "";
    await context.web.setTestData({ url: "https://superdemo.blinq.io" });
    await context.web.goto("{{url}}", this);
    await context.web.verifyTextExistInPage("Welcome to Test on components");
  });
});
