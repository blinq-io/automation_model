import { initContext, closeContext } from "../build/lib/auto_page.js";
import fs from "fs";
import { expect } from "chai";

let context = null;
describe("Actions Tests", function () {
  before(async function () {
    // check if temp directory exists
    if (!fs.existsSync("temp")) {
      fs.mkdirSync("temp");
    }
    console.log("Actions Tests: before");
  });
  beforeEach(async function () {
    context = await initContext("/", true, false);
    //let url = "https://main.dldrg2rtamdtd.amplifyapp.com/site/automation_model_regression/name_locators/index.html";
    // let url = "http://[::]:8000/site/automation_model_regression/name_locators/"
    //await context.stable.goto(url);
  });
  afterEach(async function () {
    await closeContext();
  });

  const locElements = {
    textbox_username: {
      locators: [
        { role: ["textbox", { name: "Username1" }], parameterDependent: false },
        { priority: 1, css: "#username1" },
        { priority: 1, css: "[name='username1']" },
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
      locators: [
        { text: "LOGIN1", tag: "button" },
        { role: ["button", { name: "LOGIN1" }], parameterDependent: false },
      ],
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
  };
  it("click fail", async function () {
    let info = null;
    let key = "button_login";
    console.log(`click "${key}" element using locator "${locElements[key].locators[0].css}"`);
    let ex = null;
    try {
      info = await context.stable.click(
        locElements[key],
        null,
        { screenshotPath: "./temp/1.png", screenshot: true, timeout: 1000 },
        null
      );
    } catch (error) {
      ex = error;
      //{textNotFound: true, lastError: 'failed to locate unique element', locatorNotFound: true, error: Error: failed to locate first element no eleme…d, ***** click on undefined *****attempt 0: …, fail: true}

      console.log("error: " + error);
    }
    expect(ex).to.not.be.null;
    expect(ex.info).to.not.be.null;
    expect(ex.info.failCause).to.not.be.null;
    expect(ex.info.failCause.fail).to.be.true;
    expect(ex.info.failCause.textNotFound).to.be.true;
    expect(ex.info.failCause.locatorNotFound).to.be.true;
    console.log("info object: " + JSON.stringify(info, null, 2));
  });
  // it("hover", async function () {
  //   let info = null;
  //   let key = "button_login";
  //   console.log(`hover "${key}" element using locator "${locElements[key].locators[0].css}"`);
  //   info = await context.stable.hover(
  //     locElements[key],
  //     null,
  //     { screenshotPath: "./temp/2.png", screenshot: true },
  //     null
  //   );
  //   console.log("info object: " + JSON.stringify(info, null, 2));
  // });
  it("clickType fail", async function () {
    let info = null;
    let key = "textbox_username";
    console.log(`clickType "${key}" element using locator "${locElements[key].locators[0].css}"`);
    let ex = null;
    try {
      info = await context.stable.clickType(
        locElements[key],
        "hi",
        false,
        null,
        { screenshotPath: "./temp/3.png", screenshot: true, timeout: 1000 },
        null
      );
    } catch (error) {
      ex = error;
      console.log("error: " + error);
    }
    expect(ex).to.not.be.null;
    expect(ex.info).to.not.be.null;
    expect(ex.info.failCause).to.not.be.null;
    expect(ex.info.failCause.fail).to.be.true;
    expect(ex.info.failCause.locatorNotFound).to.be.true;
    console.log("info object: " + JSON.stringify(info, null, 2));
  });
  // it("fill", async function () {
  //   let info = null;
  //   let key = "textbox_username";
  //   console.log(`fill "${key}" element using locator "${locElements[key].locators[0].css}"`);
  //   info = await context.stable.fill(
  //     locElements[key],
  //     "hi",
  //     false,
  //     null,
  //     { screenshotPath: "./temp/4.png", screenshot: true },
  //     null
  //   );
  //   console.log("info object: " + JSON.stringify(info, null, 2));
  // });
  // it("containsPattern", async function () {
  //   let info = null;
  //   let key = "section2";
  //   console.log(`containsPattern "${key}" element using locator "${locElements[key].locators[0].css}"`);
  //   info = await context.stable.containsPattern(
  //     locElements[key],
  //     "{text}",
  //     "Accepted usernames are:",
  //     null,
  //     { screenshotPath: "./temp/5.png", screenshot: true },
  //     null
  //   );
  //   console.log("info object: " + JSON.stringify(info, null, 2));
  // });
});
