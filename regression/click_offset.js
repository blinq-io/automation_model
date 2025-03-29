import { initContext, closeContext, navigate } from "../build/lib/auto_page.js";
import { getContext } from "../build/lib/init_browser.js";
import fs from "fs";
import { expect } from "chai";

let context = null;
const elements = {
  textbox_username: {
    locators: [{ role: ["textbox", { name: "Username" }] }],
    element_name: "username field",
  },

  textbox_password: {
    locators: [
      { role: ["textbox", { name: "Password" }] },
      { priority: 1, css: "#password" },
      { priority: 1, css: "[name='password']" },
    ],
    element_name: "password field",
  },
};
//{"status":true,"result":{"elementNumber":2,"reason":"The element with elementNumber 2 is a button with the name 'Login', which matches the task requirement to click on 'Login button'.","name":"locate_element"}}
describe("click offset", function () {
  before(async function () {
    // check if temp directory exists
    if (!fs.existsSync("temp")) {
      fs.mkdirSync("temp");
    }
  });
  beforeEach(async function () {
    context = await initContext(null, false, false, this);
    await context.web.goto("https://shop-blinq.io");
  });
  afterEach(async function () {
    await closeContext();
  });
  it("basic click offset", async function () {
    let info = {};
    info.log = "";
    const element = {
      locators: [{ css: "button" }],
      element_name: "login button",
    };
    await context.web.clickType(elements["textbox_username"], "blinq_user", false);
    await context.web.clickType(elements["textbox_password"], "let_me_in", false);
    const options = {
      position: { x: 50, y: 150 },
    };
    // will click outside the button
    await context.web.click(element, null, options, this);
    await context.web.click(element, null, null, this);
  });
});
