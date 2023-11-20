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
    if (!browser && this.browsers.length > 0) {
      browser = this.browsers[0];
    }

    if (browser) {
      await browser.close();
      for (let i = 0; i < this.browsers.length; i++) {
        if (this.browsers[i].browser === browser || this.browsers[i] === browser) {
          this.browsers.splice(i, 1);
          i--;
          break;
        }
      }
    }
  }

  async createBrowser(headless = false, storageState = undefined) {
    const browser = new Browser();
    await browser.init(headless, storageState);
    this.browsers.push(browser);
    return browser;
  }
  async getBrowser(headless = false, storageState = undefined) {
    if (this.browsers.length === 0) {
      return await this.createBrowser(headless, storageState);
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

  async init(headless = false, storageState = undefined) {
    this.browser = await chromium.launch({
      headless: headless,
      timeout: 0,
      args: ["--ignore-https-errors"],
    });

    this.context = await this.browser.newContext({storageState});
    this.page = await this.context.newPage();
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

export { browserManager };

// let browser = await browserManager.createBrowser();
// browser.page.goto("https://www.cnn.com");
// let browser2 = await browserManager.createBrowser();
// await browser2.page.goto("https://www.google.com");
// // sleep for 2 seconds
// await new Promise((r) => setTimeout(r, 1000));
// await browserManager.closeAll();
