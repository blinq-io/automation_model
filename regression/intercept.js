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
    await context.web.beforeStep(context, stepObject);
    await context.web.page.reload();
    await context.web.waitForPageLoad();
    await context.web.afterStep(context, this);
    console.log(JSON.stringify(context.routeResults, null, 2));

    expect(context.routeResults).to.have.lengthOf(1);

    const result = context.routeResults[0];
    expect(result.filters.path).to.equal("/login");
    expect(result.filters.method).to.equal("GET");
    expect(result.overallStatus).to.equal("fail");

    const actions = result.actions;
    expect(actions).to.have.lengthOf(2);

    // Check status_code_change
    const changeAction = actions.find((a) => a.type === "status_code_change");
    expect(changeAction).to.exist;
    expect(changeAction?.status).to.equal("success");
    expect(changeAction?.description).to.equal("502");

    // Check status_code_verification
    const verifyAction = actions.find((a) => a.type === "status_code_verification");
    expect(verifyAction).to.exist;
    expect(verifyAction?.status).to.equal("fail");
    expect(verifyAction?.description).to.equal("501");
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
    await context.web.beforeStep(context, stepObject);
    await context.web.page.reload();
    await context.web.waitForPageLoad();
    await context.web.afterStep(context, this);
    console.log(JSON.stringify(context.routeResults, null, 2));

    expect(context.routeResults).to.have.lengthOf(1);

    const result = context.routeResults[0];
    expect(result.filters.path).to.equal("/favicon1.svg");
    expect(result.filters.method).to.equal("GET");
    expect(result.overallStatus).to.equal("timeout");
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

    // expect(context.routeResults).to.have.lengthOf(1);

    // const result = context.routeResults[0];
    // expect(result.filters.path).to.equal("/login");
    // expect(result.filters.method).to.equal("GET");
    // expect(result.overallStatus).to.equal("success");
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

    // expect(context.routeResults).to.have.lengthOf(1);

    // const result = context.routeResults[0];
    // expect(result.filters.path).to.equal("/login");
    // expect(result.filters.method).to.equal("GET");
    // expect(result.overallStatus).to.equal("success");
  });

  // https://weatherapi.pelmorex.com/api/v1/observation?locale=en-CA&lat=40.712&long=-74.005&unit=metric
});
