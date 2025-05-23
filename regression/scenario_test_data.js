import { initContext, closeContext, navigate } from "../build/lib/auto_page.js";
import fs from "fs";
import { _getDataFile } from "../build/lib/utils.js";
import { expect } from "chai";

const elements = {
  textbox_username: {
    locators: [
      { role: ["textbox", { name: "Username" }] },
      { priority: 1, css: "#username" },
      { priority: 1, css: "[name='username']" },
    ],
    element_name: "username field",
  },
};
let context = null;
describe("scenario test data", function () {
  before(async function () {
    // check if temp directory exists
    if (!fs.existsSync("temp")) {
      try {
        fs.mkdirSync("temp");
      } catch (e) {
        // ignore
      }
    }
  });
  beforeEach(async function () {
    context = await initContext(null, false, false, this);
    await context.web.goto("https://shop-blinq.io");
    await context.web.waitForPageLoad();
  });
  afterEach(async function () {
    await closeContext();
  });

  it("scenario test data no replace", async function () {
    try {
      await context.web.beforeScenario(this, {
        pickleStep: { text: "I am on the login page", keyword: "Given" },
        gherkinDocument: { feature: { name: "Login" } },
        pickle: {
          name: "Login scenario",
        },
      });
  
      const _params = {};
      const options = {};
      await context.web.clickType(elements["textbox_username"], "{{user1}}", false, _params, options, null);
  
      const info = await context.web.extractAttribute(elements["textbox_username"], "value", "result");
      expect(info.value).to.be.equals("{{user1}}");
    } catch (e) {
      const message = e.message || e;
      expect(message).to.equal('Parameter "{{user1}}" is undefined in the test data');
    }
  });
  it("scenario test data replace", async function () {
    await context.web.beforeScenario(this, {
      pickleStep: { text: "I am on the login page", keyword: "Given" },
      gherkinDocument: { feature: { name: "Login" } },
      pickle: {
        name: "basic scenario",
      },
    });
    // login to the app
    const _params = {};
    const options = {};
    await context.web.clickType(elements["textbox_username"], "{{user1}}", false, _params, options, null);
    // add verification for the username field should be guy1
    const info = await context.web.extractAttribute(elements["textbox_username"], "value", "result");
    expect(info.value).to.be.equals("guy1");
  });
});
