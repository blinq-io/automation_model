import { initContext, closeContext, navigate } from "../build/lib/auto_page.js";
import { getContext } from "../build/lib/init_browser.js";
import fs from "fs";
import { expect } from "chai";

let context = null;

//{"status":true,"result":{"elementNumber":2,"reason":"The element with elementNumber 2 is a button with the name 'Login', which matches the task requirement to click on 'Login button'.","name":"locate_element"}}
describe("script injection", function () {
  before(async function () {
    // check if temp directory exists
    if (!fs.existsSync("temp")) {
      fs.mkdirSync("temp");
    }
  });
  beforeEach(async function () {
    const initScript = {
      recorderCjs: null,
      scripts: ["document.test = 'test';"],
    };
    context = await getContext(null, false, null, null, null, true, null, -1, null, initScript);
    await context.web.goto("https://shop-blinq.io");
  });
  afterEach(async function () {
    await closeContext();
  });

  it("verify injection works", async function () {
    let info = {};
    info.log = "";
    // check that the document.test variable is set
    const testValue = await context.web.page.evaluate(() => {
      return document.test;
    });
    expect(testValue).to.equal("test");
  });
});
