import { chromium, Browser as PlaywrightBrowser, BrowserContext, Page, BrowserContextOptions } from "playwright";
import type { Cookie, LocalStorage } from "./environment.js";

type StorageState = {
  cookies: Cookie[],
  origins: {origin: string, localStorage: LocalStorage}[]
}
class BrowserManager {
  constructor(public browsers: Browser[] = []) {
  }

  async closeAll() {
    await Promise.all(this.browsers.map((browser) => browser.close()));
    this.browsers = [];
  }
  async closeBrowser(browser?: PlaywrightBrowser |Browser) {
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

  async createBrowser(headless = false, storageState?:StorageState, extensionPath?: string, userDataDirPath?: string) {
    const browser = new Browser();
    await browser.init(headless, storageState, extensionPath, userDataDirPath);
    this.browsers.push(browser);
    return browser;
  }
  async getBrowser(headless = false, storageState?:StorageState, extensionPath?: string, userDataDirPath?: string) {
    if (this.browsers.length === 0) {
      return await this.createBrowser(headless, storageState, extensionPath, userDataDirPath);
    }
    return this.browsers[0];
  }
}
class Browser {
  browser : PlaywrightBrowser|null;
  context : BrowserContext | null;
  page : Page | null;
  constructor() {
    this.browser = null;
    this.context = null;
    this.page = null;
  }

  async init(headless = false, storageState?:StorageState, extensionPath?: string, userDataDirPath?: string) {

    // if(userDataDirPath) {
    //   this.browser = await chromium.connectOverCDP(userDataDirPath, {

    //   });
    //   const contextOptions:BrowserContextOptions |undefined = !!storageState ? {storageState, } : undefined
    //   this.context = await this.browser.newContext({});
    // } else {
      if (extensionPath) {
        this.context = await chromium.launchPersistentContext(userDataDirPath ?? "", {
          headless: headless,
          timeout: 0,
        args: ["--ignore-https-errors", "--disable-extensions-except=" + extensionPath, "--load-extension=" + extensionPath],
        });
      } else {
        this.browser = await chromium.launch({
          headless: headless,
          timeout: 0,
          args: ["--ignore-https-errors"],
        });
        
        const contextOptions = !!storageState ? {storageState} : undefined
        this.context = await this.browser.newContext(contextOptions as unknown as BrowserContextOptions);
      }
    // }
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
export type {BrowserManager, Browser}
// let browser = await browserManager.createBrowser();
// browser.page.goto("https://www.cnn.com");
// let browser2 = await browserManager.createBrowser();
// await browser2.page.goto("https://www.google.com");
// // sleep for 2 seconds
// await new Promise((r) => setTimeout(r, 1000));
// await browserManager.closeAll();
