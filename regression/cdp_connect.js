import { initContext, closeContext, navigate } from "../build/lib/auto_page.js";
import { getContext } from "../build/lib/init_browser.js";
import fs from "fs";
import { expect } from "chai";
import net from "net";
function findFreePort() {
  return new Promise((resolve, reject) => {
    const server = net.createServer();
    server.listen(0, () => {
      const port = server.address().port;
      server.close(() => resolve(port));
    });
    server.on("error", reject);
  });
}
let context = null;
let context2 = null;
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
let port = -1;
//{"status":true,"result":{"elementNumber":2,"reason":"The element with elementNumber 2 is a button with the name 'Login', which matches the task requirement to click on 'Login button'.","name":"locate_element"}}
describe("cdp attach", function () {
  before(async function () {
    // check if temp directory exists
    if (!fs.existsSync("temp")) {
      fs.mkdirSync("temp");
    }
  });
  beforeEach(async function () {
    // find available port
    port = await findFreePort();
    process.env.CDP_LISTEN_PORT = port;
    context = await getContext(null, false, null, null, null, true, null, -1, null);
    process.env.CDP_LISTEN_PORT = "";
    await context.web.goto("https://shop-blinq.io");
    process.env.CDP_CONNECT_URL = `http://localhost:${port}`;
    context2 = await getContext(null, false, null, null, null, true, null, -1, null);
    process.env.CDP_CONNECT_URL = "";
  });
  afterEach(async function () {
    await closeContext();
  });
  it("share browser", async function () {
    let info = {};
    info.log = "";
    const element = {
      locators: [{ text: "login", climb: 1, css: "button" }],
    };
    await context.web.clickType(elements["textbox_username"], "blinq_user", false);
    await context2.web.clickType(elements["textbox_password"], "let_me_in", false);

    // check that the document.test variable is set
    await context.web.click(element);
    await context2.web.verifyTextExistInPage("KeyX 3000 - Mechanical Keyboard", {}, this);
  });
});
