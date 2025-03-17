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
describe("_text", function () {
  before(async function () {
    // check if temp directory exists
    if (!fs.existsSync("temp")) {
      fs.mkdirSync("temp");
    }
  });
  beforeEach(async function () {
    context = await getContext(null, false, null, null, null, true, null, -1, null);
    await context.stable.goto("https://shop-blinq.io");
    await context.stable.waitForPageLoad();
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
  it("check comamnd _text", async function () {
    console.log("check comamnd _text");
    const start = Date.now();
    let info = {};
    info.log = "";
    const element = {
      locators: [{ text: "login", climb: 1, css: "button" }],
    };
    //await context.stable.beforeStep(world);
    await context.stable.clickType(elements["textbox_username"], "blinq_user", false, null, null, world);
    await context.stable.clickType(elements["textbox_password"], "let_me_in", false, null, null, world);
    // check that the document.test variable is set
    console.log(world.attachs);
    expect(world.attachs).to.have.lengthOf(2, "Expected exactly 2 attachments");

    const [first, second] = world.attachs;

    // Validate type
    expect(first.type.mediaType).to.equal("application/json", "First attachment type mismatch");
    expect(second.type.mediaType).to.equal("application/json", "Second attachment type mismatch");

    // Validate content structure
    expect(JSON.parse(first.content)).to.have.property("_text");
    expect(JSON.parse(second.content)).to.have.property("_text");

    // // Validate paths
    // expect(first.content).to.include("/login", "'snapshot_init' does not contain '/login' path");
    // expect(second.content).to.include("/products", "'snapshot_0' does not contain '/products' path");
  });
});
