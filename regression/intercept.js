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
describe("route", function () {
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

  it("route change code", async function () {
    const stepObject = {
      pickleStep: { text: 'login with "user_name" and "password"', keyword: "Given" },
      gherkinDocument: { feature: { name: "Login" } },
      pickle: {
        name: "Login scenario",
      },
    };
    await context.web.beforeStep(context, stepObject);
    await context.web.page.reload();
    await context.web.waitForPageLoad();
    await context.web.afterStep(context, this);
    await new Promise((resolve) => setTimeout(resolve, 10000));
  });
});
