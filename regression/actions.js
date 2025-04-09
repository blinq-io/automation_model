import { initContext, closeContext } from "../build/lib/auto_page.js";
import fs from "fs";
import path from "path";
import { expect } from "chai";

let context = null;
describe("Actions Tests", function () {
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
    context = await initContext("/", true, false);
    //let url = "https://main.dldrg2rtamdtd.amplifyapp.com/site/automation_model_regression/name_locators/index.html";
    // let url = "http://[::]:8000/site/automation_model_regression/name_locators/"
    //await context.web.goto(url);
  });
  afterEach(async function () {
    await closeContext();
  });

  const locElements = {
    textbox_username: {
      locators: [
        { role: ["textbox", { name: "Username" }], parameterDependent: false },
        { priority: 1, css: "#username" },
        { priority: 1, css: "[name='username']" },
      ],
    },
    textbox_password: {
      locators: [
        { role: ["textbox", { name: "Password" }], parameterDependent: false },
        { priority: 1, css: "#password" },
        { priority: 1, css: "[name='password']" },
      ],
    },
    button_login: {
      locators: [{ text: "LOGIN", tag: "button" }],
      element_name: "login button",
    },
    button_: {
      locators: [
        {
          priority: 3,
          css: "#root > div > div > div > div.MuiGrid-root.MuiGrid-item.MuiGrid-grid-xs-1.MuiGrid-grid-lg-4.css-zerdg2 > div > div.MuiBox-root.css-k008qs > button",
        },
      ],
    },
    section2: {
      locators: [{ css: ".MuiCardContent-root" }],
    },
    button_google: {
      locators: [{ text: "Google", tag: "a" }],
    },
    date: {
      locators: [{ priority: 1, css: "#dateInput" }],
    },
    time: {
      locators: [{ priority: 1, css: "#timeInput" }],
    },
  };
  it("click", async function () {
    let info = null;
    let key = "button_login";
    console.log(`click "${key}" element using locator "${locElements[key].locators[0].css}"`);
    info = await context.web.click(locElements[key], null, { screenshotPath: "./temp/1.png", screenshot: true }, null);
    const locatorLog = info.locatorLog.toString();
    //console.log("locatorLog: " + locatorLog);
    // verify that the locatorLog contain ***** click on login button *****
    expect(locatorLog).to.include("***** click on login button *****");
    expect(locatorLog).to.include('#1 {"text":"LOGIN","tag":"button"}');
    expect(locatorLog).to.include("0s 0s FOUND");
    //console.log("info object: " + JSON.stringify(info, null, 2));
  });
  it("hover", async function () {
    let info = null;
    let key = "button_login";
    //console.log(`hover "${key}" element using locator "${locElements[key].locators[0].css}"`);
    info = await context.web.hover(locElements[key], null, { screenshotPath: "./temp/2.png", screenshot: true }, null);
    //console.log("info object: " + JSON.stringify(info, null, 2));
  });
  it("clickType", async function () {
    let info = null;
    let key = "textbox_username";
    //console.log(`clickType "${key}" element using locator "${locElements[key].locators[0].css}"`);
    info = await context.web.clickType(
      locElements[key],
      "hi",
      false,
      null,
      { screenshotPath: "./temp/3.png", screenshot: true },
      null
    );
    //console.log("info object: " + JSON.stringify(info, null, 2));
  });
  it("fill", async function () {
    let info = null;
    let key = "textbox_username";
    //console.log(`fill "${key}" element using locator "${locElements[key].locators[0].css}"`);
    info = await context.web.fill(
      locElements[key],
      "hi",
      false,
      null,
      { screenshotPath: "./temp/4.png", screenshot: true },
      null
    );
    //console.log("info object: " + JSON.stringify(info, null, 2));
  });
  it("containsPattern", async function () {
    let info = null;
    let key = "section2";
    //console.log(`containsPattern "${key}" element using locator "${locElements[key].locators[0].css}"`);
    info = await context.web.containsPattern(
      locElements[key],
      "{text}",
      "Accepted usernames are:",
      null,
      { screenshotPath: "./temp/5.png", screenshot: true },
      null
    );
    //console.log("info object: " + JSON.stringify(info, null, 2));
  });
  it("verifyTextExistInPage", async function () {
    let info = null;
    //let key = "section2";
    //console.log(`verifyTextExistInPage let_me_in"`);
    info = await context.web.verifyTextExistInPage(
      "let_me_in",
      { screenshotPath: "./temp/6.png", screenshot: true },
      null
    );
    //console.log("info object: " + JSON.stringify(info, null, 2));
  });
  it("verifyTextRelatedToText", async function () {
    let info = null;
    //console.log(`verifyTextRelatedToText"`);
    info = await context.web.verifyTextRelatedToText(
      "blinq_user",
      2,
      "blinq_admin",
      { screenshotPath: "./temp/6.png", screenshot: true },
      null
    );
    //console.log("info object: " + JSON.stringify(info, null, 2));
  });
  it("extract", async function () {
    let info = null;
    let key = "button_login";
    //console.log(`extract "${key}" element using locator "${locElements[key].locators[0].css}"`);
    info = await context.web.extractAttribute(
      locElements[key],
      "inner_text",
      "login_name",
      null,
      { screenshotPath: "./temp/7.png", screenshot: true },
      null
    );
    //console.log("info object: " + JSON.stringify(info, null, 2));
    const dataFilePath = path.join(context.reportFolder, "data.json");
    const data = JSON.parse(fs.readFileSync(dataFilePath));
    expect(data.login_name).to.equal("LOGIN");
  });
  it("closePage", async function () {
    let info = null;
    let url = "https://main.dldrg2rtamdtd.amplifyapp.com/site/form/";
    await context.web.goto(url);
    let key = "button_google";
    //console.log(`click "${key}" element using locator "${locElements[key].locators[0].css}"`);
    info = await context.web.click(locElements[key], null, { screenshotPath: "./temp/8.png", screenshot: true }, null);
    //console.log("info object: " + JSON.stringify(info, null, 2));
    //console.log("closePage");
    info = await context.web.closePage({ screenshotPath: "./temp/9.png", screenshot: true }, null);
    //console.log("info object: " + JSON.stringify(info, null, 2));
    //console.log(`verifyTextExistInPage Hi you"`);
    info = await context.web.verifyTextExistInPage(
      "Hi you",
      { screenshotPath: "./temp/10.png", screenshot: true },
      null
    );
    //console.log("info object: " + JSON.stringify(info, null, 2));
  });
  it("setDateTime", async function () {
    let info = null;
    let url = "https://main.dldrg2rtamdtd.amplifyapp.com/site/automation_model_regression/name_locators/index.html";
    await context.web.goto(url);
    let key = "date";
    info = await context.web.setDateTime(
      locElements[key],
      "2024-11-08",
      null,
      false,
      null,
      { screenshotPath: "./temp/11.png", screenshot: true },
      null
    );
    //console.log("info object: " + JSON.stringify(info, null, 2));
    key = "time";
    info = await context.web.setDateTime(
      locElements[key],
      "2024-11-08T12:30:00",
      null,
      false,
      null,
      { screenshotPath: "./temp/12.png", screenshot: true },
      null
    );
    //console.log("info object: " + JSON.stringify(info, null, 2));
  });
  it("verifyAttribute", async function () {
    let info = null;
    let key = "button_login";
    console.log(`verifyAttribute "${key}" element using locator "${locElements[key].locators[0].css}"`);
    info = await context.web.verifyAttribute(
      locElements[key],
      "innerText",
      "LOGIN",
      { screenshotPath: "./temp/13.png", screenshot: true },
      null
    );
    //console.log("info object: " + JSON.stringify(info, null, 2));
  });
  it("verifyTextExistInPage regex", async function () {
    let info = null;
    //let key = "section2";
    console.log(`verifyTextExistInPage let_me_in"`);
    info = await context.web.verifyTextExistInPage(
      "/blinq_user\\s*blinq_.*/",
      { screenshotPath: "./temp/14.png", screenshot: true },
      null
    );
    //console.log("info object: " + JSON.stringify(info, null, 2));
  });
});
