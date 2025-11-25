import { initContext, closeContext, navigate } from "../build/lib/auto_page.js";
import { getContext } from "../build/lib/init_browser.js";
import fs from "fs";
import { expect } from "chai";
import { chromium } from "playwright";
import path from "path";
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
describe("verifiy", function () {
  before(async function () {
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
  after(async function () {});

  it("verify locators", async function () {
    let info = {};
    info.log = "";
    const start = new Date();
    const html = await context.web.page.content();
    const doctype = await context.web.page.evaluate(() => new XMLSerializer().serializeToString(document.doctype));
    const end = new Date();
    console.log("Time taken to get HTML: " + (end - start) + "ms");
    const fullHTML = doctype + html;
    // check if temp directory exists
    if (!fs.existsSync("temp")) {
      try {
        fs.mkdirSync("temp");
      } catch (e) {
        console.log(e);
      }
    }
    // store the full HTML in a file
    fs.writeFileSync("temp/fullHTML.html", fullHTML);
    const args = ["--ignore-https-errors", "--ignore-certificate-errors"];
    args.push("--use-gtk");
    const browser = await chromium.launch({
      headless: true,
      timeout: 0,
      args,
      //downloadsPath: downloadsPath,
    });
    const c = await browser.newContext();
    const page = await c.newPage();
    await page.goto("file://" + path.resolve("temp/fullHTML.html"));
    // find in page #username
    await page.locator("#username").click();
  });
});
