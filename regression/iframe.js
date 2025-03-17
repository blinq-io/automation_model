import { initContext, closeContext } from "../build/lib/auto_page.js";
import fs from "fs";
import path from "path";
import { expect } from "chai";

let context = null;
describe("Iframe Tests", function () {
  before(async function () {
    // check if temp directory exists
    if (!fs.existsSync("temp")) {
      fs.mkdirSync("temp");
    }
  });
  beforeEach(async function () {
    context = await initContext("/", true, false);
    let url = "https://main.dldrg2rtamdtd.amplifyapp.com/site/table_iframe/index.html";
    // let url = "http://[::]:8000/site/automation_model_regression/name_locators/"
    await context.stable.goto(url);
    await context.stable.waitForPageLoad();
  });
  afterEach(async function () {
    await closeContext();
  });

  const locElements = {
    button: {
      iframe_src: "https://main.dldrg2rtamdtd.amplifyapp.com/site/table_iframe/frame_table.html",
      locators: [{ role: ["button", { name: "Click me" }], parameterDependent: false }],
    },
  };
  it("click", async function () {
    let info = null;
    let key = "button";
    info = await context.stable.click(
      locElements[key],
      null,
      { screenshotPath: "./temp/1.png", screenshot: true },
      null
    );
    const locatorLog = info.locatorLog.toString();
    //console.log("locatorLog: " + locatorLog);
    // verify that the locatorLog contain ***** click on login button *****
    await context.stable.verifyTextExistInPage("Hello! You clicked the button.");
  });
});
