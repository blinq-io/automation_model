import { initContext, closeContext, navigate } from "../build/lib/auto_page.js";
import fs from "fs";
import { _getDataFile } from "../build/lib/utils.js";

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
  button_login: {
    locators: [
      { text: "LOGIN", tag: "button" },
      { role: ["button", { name: "LOGIN" }] },
      { tagOnly: true, priority: 3, css: "button" },
    ],
    element_name: "login button",
  },
};
//{"status":true,"result":{"elementNumber":2,"reason":"The element with elementNumber 2 is a button with the name 'Login', which matches the task requirement to click on 'Login button'.","name":"locate_element"}}
let context = null;
describe("store session", function () {
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

//   it("store session test", async function () {
//     // login to the app
//     const _params = {};
//     const options = {};
//     await context.web.clickType(elements["textbox_username"], "blinq_user", false, _params, options, null);
//     // Fill password field with "password"
//     await context.web.clickType(elements["textbox_password"], "let_me_in", false, _params, options, null);
//     // Click on login button
//     await context.web.click(elements["button_login"], _params, options, null);
//     // store the session
//     await context.web.saveStoreState(null, this);
//     const dataFile = _getDataFile(this, context, context.web);
//     // close context
//     await closeContext();
//     // configure global test data
//     process.env.GLOBAL_TEST_DATA_FILE = dataFile;
//     // create new session
//     context = await initContext("/", true, true);
//     process.env.GLOBAL_TEST_DATA_FILE = "";

//     await context.web.waitForPageLoad();
//     // verify browser on the products page
//     await context.web.verifyTextExistInPage("KeyX 3000 - Mechanical Keyboard", {}, this);
//   });
//   it("restore session test", async function () {
//     // login to the app
//     const _params = {};
//     const options = {};
//     await context.web.clickType(elements["textbox_username"], "blinq_user", false, _params, options, null);
//     // Fill password field with "password"
//     await context.web.clickType(elements["textbox_password"], "let_me_in", false, _params, options, null);
//     // Click on login button
//     await context.web.click(elements["button_login"], _params, options, null);
//     // store the session
//     await context.web.saveStoreState("test.json", this);
//     await context.web.restoreSaveState("test.json", this);
//     // verify browser on the products page
//     await context.web.verifyTextExistInPage("KeyX 3000 - Mechanical Keyboard", {}, this);
//   });

//   it("restore session test with test data", async function () {
//     // login to the app
//     const _params = {};
//     const options = {};
//     await context.web.clickType(elements["textbox_username"], "blinq_user", false, _params, options, null);
//     // Fill password field with "password"
//     await context.web.clickType(elements["textbox_password"], "let_me_in", false, _params, options, null);
//     // Click on login button
//     await context.web.click(elements["button_login"], _params, options, null);
//     // store the session
//     await context.web.saveStoreState("test.json", this);
//     await context.web.setTestData({ file: "test.json" });
//     await context.web.restoreSaveState("{{file}}", this);
//     // verify browser on the products page
//     await context.web.verifyTextExistInPage("KeyX 3000 - Mechanical Keyboard", {}, this);
//   });
// });
