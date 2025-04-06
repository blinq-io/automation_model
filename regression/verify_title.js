import { initContext, closeContext, navigate } from "../build/lib/auto_page.js";
import { getContext } from "../build/lib/init_browser.js";
import fs from "fs";
import { expect } from "chai";

let context = null;

//{"status":true,"result":{"elementNumber":2,"reason":"The element with elementNumber 2 is a button with the name 'Login', which matches the task requirement to click on 'Login button'.","name":"locate_element"}}
describe("verifyPageTitle", function () {
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

  it("verifyPageTitle basic", async function () {
    let info = {};
    info.log = "";

    await context.web.verifyPageTitle("Shop BlinqIO", {}, this);
  });
  it("verifyPageTitle fail", async function () {
    let info = {};
    info.log = "";
    let ex = null;
    try {
      await context.web.verifyPageTitle("Shop BlinqIO1", {}, this);
    } catch (error) {
      ex = error;
      //{textNotFound: true, lastError: 'failed to locate unique element', locatorNotFound: true, error: Error: failed to locate first element no eleme…d, ***** click on undefined *****attempt 0: …, fail: true}

      console.log("error: " + error);
    }
    expect(ex).to.not.be.null;
  });
});
