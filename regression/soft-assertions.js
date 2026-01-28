import { initContext, closeContext } from "../build/lib/auto_page.js";
import fs from "fs";
import { expect } from "chai";

let context = null;
describe("Soft Assertions", function () {
  before(async function () {
    // check if temp directory exists
    if (!fs.existsSync("temp")) {
      fs.mkdirSync("temp");
    }
    //console.log("Actions Tests: before");
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
    button_login: {
      locators: [
        // { text: "LOGIN1", tag: "button" },
        // { role: ["button", { name: "LOGIN1" }], parameterDependent: false },
        {
          css: "internal:text='Login1'",
        },
      ],
    },
  };
  it("click should fail", async function () {
    let info = null;
    let key = "button_login";
    console.log(`click "${key}" element using locator "${locElements[key].locators[0].css}"`);
    let ex = null;
    let attachments = [];
    const world = {
      attach: (data, mimeType) => {
        attachments.push({ data, mimeType });
      },
    };
    try {
      info = await context.web.click(
        locElements[key],
        null,
        { screenshotPath: "./temp/1.png", screenshot: true, timeout: 1000 },
        world
      );
    } catch (error) {
      ex = error;
      //{textNotFound: true, lastError: 'failed to locate unique element', locatorNotFound: true, error: Error: failed to locate first element no eleme…d, ***** click on undefined *****attempt 0: …, fail: true}

      console.log("error: " + error);
    }
    expect(attachments.length).to.be.greaterThan(0);
    expect(ex).to.not.be.null;
    expect(ex.info).to.not.be.null;
    expect(ex.info.failCause).to.not.be.null;
    expect(ex.info.failCause.fail).to.be.true;
    // expect(ex.info.failCause.textNotFound).to.be.true;
    expect(ex.info.failCause.locatorNotFound).to.be.true;
    //console.log("info object: " + JSON.stringify(info, null, 2));
  });
  it("click should not fail", async function () {
    let info = null;
    let key = "button_login";
    console.log(`click "${key}" element using locator "${locElements[key].locators[0].css}"`);
    let ex = null;
    let attachments = [];
    const world = {
      attach: (data, mimeType) => {
        attachments.push({ data, mimeType });
      },
    };
    try {
      info = await context.web.click(
        locElements[key],
        null,
        { screenshotPath: "./temp/1.png", screenshot: true, timeout: 1000, dontThrowOnFailure: true },
        world
      );
    } catch (error) {
      ex = error;
      //{textNotFound: true, lastError: 'failed to locate unique element', locatorNotFound: true, error: Error: failed to locate first element no eleme…d, ***** click on undefined *****attempt 0: …, fail: true}

      console.log("error: " + error);
    }
    expect(ex).to.be.null;
    expect(info).to.not.be.null;
    expect(attachments.length).to.be.greaterThan(0);
    console.log("info object: " + JSON.stringify(info, null, 2));
    console.log("attachments: " + JSON.stringify(attachments, null, 2));

    // expect(info.success).to.be.true;
    //console.log("info object: " + JSON.stringify(info, null, 2));
  });
  //   let info = null;
  //   let key = "textbox_username";
  //   console.log(`fill "${key}" element using locator "${locElements[key].locators[0].css}"`);
  //   info = await context.web.fill(
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
  //   info = await context.web.containsPattern(
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
