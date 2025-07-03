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
describe("snapshot", function () {
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
  const world = {
    attachs: [],
    attach: function (content, type) {
      world.attachs.push({ content, type });
    },
  };
  it("basic before after", async function () {
    // let info = {};
    // info.log = "";
    // const element = {
    //   locators: [{ text: "login", climb: 1, css: "button" }],
    // };
    // await context.web.beforeStep(world);
    // await context.web.clickType(elements["textbox_username"], "blinq_user", false);
    // await context.web.clickType(elements["textbox_password"], "let_me_in", false);
    // // check that the document.test variable is set
    // await context.web.click(element);
    // await context.web.afterStep(world, null);
    // console.log(world.attachs);
    // expect(world.attachs).to.have.lengthOf(4, "Expected exactly 4 attachments");
    // const [first, second, third] = world.attachs;
    // // Validate type
    // expect(first.type).to.equal("application/json+snapshot-before", "First attachment type mismatch");
    // expect(second.type).to.equal("application/json+snapshot-after", "Second attachment type mismatch");
    // expect(third.type.mediaType).to.equal("application/json", "Third attachment type mismatch");
    // // Validate content structure
    // // expect(first.content).to.have.property("snapshot_init");
    // // expect(second.content).to.have.property("snapshot_0");
    // // Validate paths
    // expect(first.content).to.include("/login", "'snapshot_init' does not contain '/login' path");
    // expect(second.content).to.include("/products", "'snapshot_0' does not contain '/products' path");
  });
});
