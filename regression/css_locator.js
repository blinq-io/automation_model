import { initContext } from "../build/lib/auto_page.js";
import { closeBrowser } from "../build/lib/init_browser.js";
const elements = {
  submit: {
    locators: [{ css: '[name="submit"]' }],
  },
  password: {
    locators: [{ css: "#password" }],
  },
};
let context = null;
describe("CSS Locators", function () {
  this.beforeEach(async function () {
    context = await initContext("/", true, false);
    await context.web.goto("https://main.dldrg2rtamdtd.amplifyapp.com/site/form/index.html");
  });
  this.afterEach(async function () {
    await closeBrowser();
  });
  it("CSS Locator Test", async function () {
    await context.web.click(elements.submit);
  });
});
