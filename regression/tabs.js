import { initContext, closeContext } from "../build/lib/auto_page.js";
import fs from "fs";
import path from "path";
import { expect } from "chai";

let context = null;
describe("tabs", function () {
  before(async function () {
    // check if temp directory exists
    if (!fs.existsSync("temp")) {
      fs.mkdirSync("temp");
    }
  });
  beforeEach(async function () {
    context = await initContext("/", true, false);
    let url = "https://main.dldrg2rtamdtd.amplifyapp.com/site/tabs/index.html";
    await context.web.goto(url);
    await context.web.waitForPageLoad();
  });
  afterEach(async function () {
    await closeContext();
  });

  const locElements = {
    link: {
      locators: [{ css: "a" }],
    },
  };
  it("tabs", async function () {
    let info = null;
    info = await context.web.click(
      locElements["link"],
      null,
      { screenshotPath: "./temp/1.png", screenshot: true },
      null
    );
    await context.web.verifyTextExistInPage("Page 2");
    await context.web.switchTab(0);
    await context.web.verifyTextExistInPage("Page 1");
    await context.web.switchTab("Page 2");
    await context.web.verifyTextExistInPage("Page 2");
    await context.web.switchTab("0");
    await context.web.verifyTextExistInPage("Page 1");
  });
});
