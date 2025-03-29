import { initContext, closeContext, navigate } from "../build/lib/auto_page.js";
import { getContext } from "../build/lib/init_browser.js";
import fs from "fs";
import { expect } from "chai";

let context = null;
const elements = {
  textbox_username: {
    locators: [
      { role: ["textbox", { name: "Username" }] },
      { priority: 1, css: "#username" },
      { priority: 1, css: "[name='username']" },
    ],
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
describe("climb", function () {
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

  it("climb basic", async function () {
    let info = {};
    info.log = "";
    const element = {
      locators: [{ text: "login", climb: 1, css: "button" }],
    };
    await context.web.clickType(elements["textbox_username"], "blinq_user", false);
    await context.web.clickType(elements["textbox_password"], "123456", false);

    // check that the document.test variable is set
    await context.web.click(element);
    await context.web.verifyTextExistInPage("Invalid username or password", {}, null);
  });
  it("climb 2 locators for same element", async function () {
    let info = {};
    info.log = "";
    const element = {
      locators: [
        { text: "login", climb: 1, css: "button" },
        { text: "login", climb: 1, css: "button" },
      ],
    };
    await context.web.clickType(elements["textbox_username"], "blinq_user", false);
    await context.web.clickType(elements["textbox_password"], "123456", false);
    await context.web.click(element);
    await context.web.verifyTextExistInPage("Invalid username or password", {}, null);
  });
});
