import { initContext, closeContext, navigate } from "../build/lib/auto_page.js";
import { getContext } from "../build/lib/init_browser.js";
import fs from "fs";
import { http, HttpResponse } from "msw";
import { setupServer } from "msw/node";

let context = null;

//{"status":true,"result":{"elementNumber":2,"reason":"The element with elementNumber 2 is a button with the name 'Login', which matches the task requirement to click on 'Login button'.","name":"locate_element"}}
describe("Actions Tests", function () {
  const handlers = [
    // Intercept "GET https://example.com/user" requests...
    http.post("*/api/runs/locate-element/locate", () => {
      // ...and respond to them using this JSON response.
      return HttpResponse.json({
        status: true,
        result: {
          elementNumber: 2,
          reason:
            "The element with elementNumber 2 is a button with the name 'Login', which matches the task requirement to click on 'Login button'.",
          name: "locate_element",
        },
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
        // ignore
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

  it("simple click", async function () {
    let info = {};
    info.log = "";
    const element = await context.web.simpleClick("Login button");
  });
});
