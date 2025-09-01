import { initContext, closeContext, navigate } from "../build/lib/auto_page.js";
import fs from "fs";
import { _getDataFile } from "../build/lib/utils.js";
import { expect } from "chai";
const elements = {
  textbox_username: {
    locators: [
      { role: ["textbox", { name: "Username" }] },
      { priority: 1, css: "#username" },
      { priority: 1, css: "[name='username']" },
    ],
    element_name: "username field",
  },
  link_response_formats: {
    locators: [
      { css: 'internal:text="Response formats"s >> xpath=..', priority: 1 },
      { css: 'internal:text="Response formats"i >> xpath=..', priority: 1 },
      { css: 'a >> internal:has-text="Response formats"i', priority: 1 },
      { css: "a >> internal:has-text=/^Response formats$/", priority: 1 },
      { css: 'internal:role=link[name="Response formats"s]', priority: 1 },
    ],
    element_name: "Response formats link",
    element_key: "link_response_formats",
  },
  text_get: {
    locators: [{ css: '[id="operations-Response formats-get_json"] >> span', priority: 2, index: 0 }],
    element_name: "GET Text",
    element_key: "text_get",
  },
  button_try_it_out: {
    locators: [
      { css: 'internal:text="Try it out"s', priority: 1 },
      { css: 'internal:text="Try it out"i', priority: 1 },
      { css: 'button >> internal:has-text="Try it out"i', priority: 1 },
      { css: 'internal:role=button[name="Try it out"s]', priority: 1 },
      { css: 'internal:role=button[name="Try it out"i]', priority: 1 },
    ],
    element_name: "Try it out button",
    element_key: "button_try_it_out",
  },
  button_execute: {
    locators: [
      { css: 'internal:text="Execute"s', priority: 1 },
      { css: 'internal:text="Execute"i', priority: 1 },
      { css: 'button >> internal:has-text="Execute"i', priority: 1 },
      { css: "button >> internal:has-text=/^Execute$/", priority: 1 },
      { css: 'internal:role=button[name="Execute"s]', priority: 1 },
    ],
    element_name: "Execute button",
    element_key: "button_execute",
  },
  button_cancel: {
    locators: [
      { css: 'internal:text="Cancel"s', priority: 1 },
      { css: 'internal:text="Cancel"i', priority: 1 },
      { css: 'button >> internal:has-text="Cancel"i', priority: 1 },
      { css: "button >> internal:has-text=/^Cancel$/", priority: 1 },
      { css: 'internal:role=button[name="Cancel"s]', priority: 1 },
    ],
    element_name: "Cancel button",
    element_key: "button_cancel",
  },
  link_json: {
    locators: [
      { css: 'internal:text="/json"s >> xpath=..', priority: 1 },
      { css: 'a >> internal:has-text="/json"i', priority: 1 },
      { css: "a >> internal:has-text=/^\\/json$/", priority: 1 },
      { css: 'internal:role=link[name="/json"s]', priority: 1 },
      { css: 'internal:role=link[name="/json"i]', priority: 1 },
    ],
    element_name: "/json link",
    element_key: "link_json",
  },
  link_html: {
    locators: [
      { css: 'internal:text="/html"s >> xpath=..', priority: 1 },
      { css: 'internal:text="/html"i >> xpath=..', priority: 1 },
      { css: 'a >> internal:has-text="/html"i', priority: 1 },
      { css: "a >> internal:has-text=/^\\/html$/", priority: 1 },
      { css: 'internal:role=link[name="/html"s]', priority: 1 },
    ],
    element_name: "/html link",
    element_key: "link_html",
  },
  button_try_it_out_1: {
    locators: [
      { css: 'internal:text="Try it out"s', priority: 1 },
      { css: 'internal:text="Try it out"i', priority: 1 },
      { css: 'button >> internal:has-text="Try it out"i', priority: 1 },
      { css: 'internal:role=button[name="Try it out"s]', priority: 1 },
      { css: 'internal:role=button[name="Try it out"i]', priority: 1 },
    ],
    element_name: "Try it out button",
    element_key: "button_try_it_out_1",
  },
  button_execute_1: {
    locators: [
      { css: 'internal:text="Execute"s', priority: 1 },
      { css: 'internal:text="Execute"i', priority: 1 },
      { css: 'button >> internal:has-text="Execute"i', priority: 1 },
      { css: "button >> internal:has-text=/^Execute$/", priority: 1 },
      { css: 'internal:role=button[name="Execute"s]', priority: 1 },
    ],
    element_name: "Execute button",
    element_key: "button_execute_1",
  },
  text_moby: {
    locators: [
      { css: 'internal:text="Moby"i', priority: 1 },
      { css: 'internal:text="Moby"s', priority: 1 },
      { css: 'span >> internal:has-text="Moby"i', priority: 1 },
      { css: "span >> internal:has-text=/^Moby$/", priority: 1 },
    ],
    element_name: "Moby Text",
    element_key: "text_moby",
  },
};
let context = null;
describe("route", function () {
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

  it("route change code", async function () {
    const stepObject = {
      pickleStep: { text: 'login with "user_name" and "password"', keyword: "Given" },
      gherkinDocument: { feature: { name: "Login" } },
      pickle: {
        name: "Login scenario",
      },
    };
    try {
      await context.web.beforeStep(context, stepObject);
      await context.web.page.reload();
      await context.web.waitForPageLoad();
      await context.web.afterStep(context, this);
      console.log(JSON.stringify(context.routeResults, null, 2));
    } catch (e) {
      console.log(e.message);
      expect(e.message).to.include(
        `Route verification failed:\nRoute to https://www.shop-blinq.io/login failed with status: fail`
      );
    }
  });
  it("route status code", async function () {
    const stepObject = {
      pickleStep: { text: 'login with "user_name" and "password" 2', keyword: "Given" },
      gherkinDocument: { feature: { name: "Login" } },
      pickle: {
        name: "Login scenario",
      },
    };
    await context.web.beforeStep(context, stepObject);
    await context.web.page.reload();
    await context.web.waitForPageLoad();
    await context.web.afterStep(context, this);
    console.log(JSON.stringify(context.routeResults, null, 2));

    expect(context.routeResults).to.have.lengthOf(1);

    const result = context.routeResults[0];
    expect(result.filters.path).to.equal("/assets/index-_1_OQ1og.css");
    expect(result.filters.method).to.equal("GET");
    expect(result.overallStatus).to.equal("success");

    const actions = result.actions;
    expect(actions).to.have.lengthOf(1);

    // Check status_code_verification
    const verifyAction = actions.find((a) => a.type === "status_code_verification");
    expect(verifyAction).to.exist;
    expect(verifyAction?.status).to.equal("success");
    expect(verifyAction?.description).to.equal("200");
  });
  it("route timeout", async function () {
    const stepObject = {
      pickleStep: { text: 'login with "user_name" and "password" 3', keyword: "Given" },
      gherkinDocument: { feature: { name: "Login" } },
      pickle: {
        name: "Login scenario",
      },
    };
    try {
      await context.web.beforeStep(context, stepObject);
      await context.web.page.reload();
      await context.web.waitForPageLoad();
      await context.web.afterStep(context, this);
      console.log(JSON.stringify(context.routeResults, null, 2));
    } catch (e) {
      expect(e).instanceOf(Error);
      expect(e.message).to.include(`Route verification failed:
  Route to  failed with status: timeout`);
    }
  });
  it("route change_text", async function () {
    const stepObject = {
      pickleStep: { text: 'login with "user_name" and "password" 4', keyword: "Given" },
      gherkinDocument: { feature: { name: "Login" } },
      pickle: {
        name: "Login scenario",
      },
    };
    await context.web.beforeStep(context, stepObject);
    await context.web.page.reload();
    await context.web.waitForPageLoad();
    await context.web.verifyTextExistInPage("Modified by Playwright");
    await context.web.afterStep(context, this);
    console.log(JSON.stringify(context.routeResults, null, 2));

    expect(context.routeResults).to.have.lengthOf(1);

    const result = context.routeResults[0];
    expect(result.filters.path).to.equal("/login");
    expect(result.filters.method).to.equal("GET");
    expect(result.overallStatus).to.equal("success");
  });
  it("route change_json", async function () {
    const stepObject = {
      pickleStep: { text: 'login with "user_name" and "password" 5', keyword: "Given" },
      gherkinDocument: { feature: { name: "Login" } },
      pickle: {
        name: "Login scenario",
      },
    };
    await context.web.beforeStep(context, stepObject);
    await context.web.goto("https://main.dldrg2rtamdtd.amplifyapp.com/site/api/index.html");
    await context.web.waitForPageLoad();

    await context.web.verifyTextExistInPage("55");
    await context.web.afterStep(context, this);
    console.log(JSON.stringify(context.routeResults, null, 2));
    expect(context.routeResults).to.have.lengthOf(1);
    const result = context.routeResults[0];
    expect(result.actions).to.have.lengthOf(1);
    expect(result.actions[0].type).to.equal("json_modify");
    expect(result.actions[0].status).to.equal("success");
  });
  it("route assert_json", async function () {
    const stepObject = {
      pickleStep: { text: 'login with "user_name" and "password" 6', keyword: "Given" },
      gherkinDocument: { feature: { name: "Login" } },
      pickle: {
        name: "Login scenario",
      },
    };
    await context.web.beforeStep(context, stepObject);
    await context.web.goto("https://main.dldrg2rtamdtd.amplifyapp.com/site/api/index.html");
    await context.web.waitForPageLoad();

    await context.web.afterStep(context, this);
    console.log(JSON.stringify(context.routeResults, null, 2));
    expect(context.routeResults).to.have.lengthOf(1);
    const result = context.routeResults[0];
    expect(result.actions).to.have.lengthOf(1);
    expect(result.actions[0].type).to.equal("assert_json");
    expect(result.actions[0].status).to.equal("success");
  });
  it("route assert_whole_json", async function () {
    // Navigate to http://localhost:3000
    const stepObject = {
      pickleStep: {
        text: "The user navigates to GET response format and executes it and verifies json body",
        keyword: "Given",
      },
      gherkinDocument: { feature: { name: "Login" } },
      pickle: {
        name: "HTTPBin scenario",
      },
    };
    await context.web.beforeStep(context, stepObject);
    await context.web.goto("http://localhost:3000");
    await context.web.waitForPageLoad();
    await context.web.click(elements["link_response_formats"], null, null, this);
    await context.web.click(elements["text_get"], null, null, this);
    await context.web.click(elements["button_try_it_out"], null, null, this);
    await context.web.click(elements["button_execute"], null, null, this);
    await context.web.verifyTextExistInPage("slideshow", null, this);
    await context.web.verifyTextExistInPage("Yours Truly", null, this);
    console.log(JSON.stringify(context.routeResults, null, 2));
  });
  it("route modify_whole_json", async function () {
    const stepObject = {
      pickleStep: {
        text: "The user navigates to GET response format and executes it",
        keyword: "Given",
      },
      gherkinDocument: { feature: { name: "Login" } },
      pickle: {
        name: "HTTPBin scenario",
      },
    };
    await context.web.beforeStep(context, stepObject);
    await context.web.goto("http://localhost:3000");
    await context.web.waitForPageLoad();
    await context.web.click(elements["link_response_formats"], null, null, this);
    await context.web.click(elements["text_get"], null, null, this);
    await context.web.click(elements["button_try_it_out"], null, null, this);
    await context.web.click(elements["button_execute"], null, null, this);
    await context.web.verifyTextExistInPage("blinqio", null, this);
    await context.web.verifyTextExistInPage("virtual tester", null, this);
    console.log(JSON.stringify(context.routeResults, null, 2));
  });
  it("route stub_text", async function () {
    const stepObject = {
      pickleStep: {
        text: "The user navigates through various links and buttons on the httpbin.org page",
        keyword: "Given",
      },
      gherkinDocument: { feature: { name: "Login" } },
      pickle: {
        name: "HTTPBin scenario",
      },
    };
    const _params = {};
    await context.web.beforeStep(context, stepObject);
    await context.web.goto("http://localhost:3000");
    await context.web.waitForPageLoad();
    await context.web.click(elements["link_response_formats"], null, null, this);
    await context.web.click(elements["link_html"], _params, null, this);
    await context.web.click(elements["button_try_it_out_1"], _params, null, this);
    await context.web.click(elements["button_execute_1"], _params, null, this);
    await context.web.verifyTextExistInPage("BVT Analysis Formatter", null, this);
    try {
      await context.web.click(elements["text_moby"], _params, null, this);
    } catch (e) {
      expect(e).property("info").property("errorType").to.equal("ElementNotFoundError");
    }
    console.log(JSON.stringify(context.routeResults, null, 2));
  });
  it("route test data", async function () {
    const stepObject = {
      pickleStep: { text: 'login with "user_name" and "password" 7', keyword: "Given" },
      gherkinDocument: { feature: { name: "Login" } },
      pickle: {
        name: "Login scenario",
      },
    };
    context.web.setTestData({ status_code: 200 });
    await context.web.beforeStep(context, stepObject);
    await context.web.page.reload();
    await context.web.waitForPageLoad();
    await context.web.afterStep(context, this);
    console.log(JSON.stringify(context.routeResults, null, 2));
  });

  // https://weatherapi.pelmorex.com/api/v1/observation?locale=en-CA&lat=40.712&long=-74.005&unit=metric
});
