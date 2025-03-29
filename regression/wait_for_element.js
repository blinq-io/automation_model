import { initContext, closeContext, navigate } from "../build/lib/auto_page.js";
import fs from "fs";
import { expect } from "chai";

let context = null;
let context2 = null;
const elements = {
  textbox_username: {
    locators: [{ role: ["textbox", { name: "Username1" }] }],
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
let port = -1;
//{"status":true,"result":{"elementNumber":2,"reason":"The element with elementNumber 2 is a button with the name 'Login', which matches the task requirement to click on 'Login button'.","name":"locate_element"}}
describe("wait for element", function () {
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
  it("wait for element", async function () {
    let info = {};
    info.log = "";
    const element = {
      locators: [{ text: "login", climb: 1, css: "button" }],
      element_name: "login button",
    };
    // await context.web.clickType(elements["textbox_username"], "blinq_user", false);
    // await context2.web.clickType(elements["textbox_password"], "let_me_in", false);
    const found = await context.web.waitForElement(element, null, { timeout: 2000 }, this);
    expect(found).to.be.true;
    const found2 = await context.web.waitForElement(elements.textbox_username, null, { timeout: 2000 }, this);
    expect(found2).to.be.false;
  });
});
