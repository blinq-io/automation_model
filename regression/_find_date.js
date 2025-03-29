import { initContext, closeContext, navigate } from "../build/lib/auto_page.js";
import { getContext } from "../build/lib/init_browser.js";
import fs from "fs";
import { http, HttpResponse } from "msw";
import { setupServer } from "msw/node";
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
describe("find date api", function () {
  const handlers = [
    // Intercept "GET https://example.com/user" requests...
    http.post("*/api/runs/find-date/find", () => {
      // ...and respond to them using this JSON response.
      return HttpResponse.json({
        status: true,
        result: "13-02-2025",
      });
    }),
  ];
  const server = setupServer(...handlers);
  before(async function () {
    server.listen();
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
    await context.web.goto("https://shop-blinq.io");
    await context.web.waitForPageLoad();
  });
  afterEach(async function () {
    await closeContext();
  });
  after(async function () {
    server.close();
  });

  it("check conversion", async function () {
    let info = {};
    info.log = "";
    const element = await context.web.clickType(
      locElements["textbox_username"],
      "{{date:tomorow>>mm/dd/yyyy}}",
      false,
      null,
      null,
      this
    );
    info = await context.web.extractAttribute(locElements["textbox_username"], "value", "result");
    expect(info.value).to.be.equals("02/13/2025");
  });
});
