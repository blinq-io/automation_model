import { chromium } from "playwright";
class BrowserManager {
  constructor() {
    this.browsers = [];
  }

  async closeAll() {
    await Promise.all(this.browsers.map((browser) => browser.close()));
    this.browsers = [];
  }
  async closeBrowser(browser) {
    if (browser !== null) {
      await browser.close();
      for (let i = 0; i < this.browsers.length; i++) {
        if (
          this.browsers[i].browser === browser ||
          this.browsers[i] === browser
        ) {
          this.browsers.splice(i, 1);
          i--;
          break;
        }
      }
    }
  }

  async createBrowser() {
    const browser = new Browser();
    await browser.init();
    this.browsers.push(browser);
    return browser;
  }
  async getBrowser() {
    if (this.browsers.length === 0) {
      return await this.createBrowser();
    }
    return this.browsers[0];
  }
}
class Browser {
  constructor() {
    this.browser = null;
    this.context = null;
    this.page = null;
  }

  async init() {
    //let port = 9222;
    this.browser = await chromium.launch({
      headless: false,
      timeout: 0,
      //args: ["--remote-debugging-port=" + port],
    });
    // const cdpBrowser = await chromium.connectOverCDP({
    //   endpointURL: `http://127.0.0.1:${port}/`,
    // });
    // //let context = await browser.newContext();
    // const context = cdpBrowser.contexts()[0];
    // let page = await context.newPage();
    // page.goto("https://www.cnn.com");
    this.context = await this.browser.newContext();
    this.page = await this.context.newPage();
    //console.log("browser", this.browser);
  }

  async close() {
    if (this.browser !== null) {
      await this.browser.close();
      this.browser = null;
      this.context = null;
      this.page = null;
    }
  }
}
const browserManager = new BrowserManager();

export default browserManager;

// let browser = await browserManager.createBrowser();
// browser.page.goto("https://www.cnn.com");
// let browser2 = await browserManager.createBrowser();
// await browser2.page.goto("https://www.google.com");
// // sleep for 2 seconds
// await new Promise((r) => setTimeout(r, 1000));
// await browserManager.closeAll();
