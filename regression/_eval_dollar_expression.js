import { initContext, closeContext, navigate } from "../build/lib/auto_page.js";
import { getContext } from "../build/lib/init_browser.js";
import fs from "fs";
import { expect } from "chai";
let context = null;
const locElements = {
  textbox_username: {
    locators: [
      { role: ["textbox", { name: "Username" }], parameterDependent: false },
      { priority: 1, css: "#username" },
      { priority: 1, css: "[name='username']" },
    ],
  },
};
//{"status":true,"result":{"elementNumber":2,"reason":"The element with elementNumber 2 is a button with the name 'Login', which matches the task requirement to click on 'Login button'.","name":"locate_element"}}
describe("use dollar expression", function () {
  before(async function () {
    // check if temp directory exists
    if (!fs.existsSync("temp")) {
      try {
        fs.mkdirSync("temp");
      } catch (e) {
        console.log(e);
      }
    }
  });
  beforeEach(async function () {
    context = await getContext(null, false, null);
    await context.stable.goto("https://shop-blinq.io");
    await context.stable.waitForPageLoad();
  });
  afterEach(async function () {
    await closeContext();
  });
  after(async function () {});

  it("expression evaluation", async function () {
    let info = {};
    info.log = "";
    context.examplesRow = { user: "user_" };
    const element = await context.stable.clickType(
      locElements["textbox_username"],
      "${user + '123'}",
      false,
      null,
      null,
      this
    );
    info = await context.stable.extractAttribute(locElements["textbox_username"], "value", "result");
    expect(info.value).to.be.equals("user_123");
  });
});
