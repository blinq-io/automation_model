import {
  chromium,
  firefox,
  webkit,
  Browser as PlaywrightBrowser,
  BrowserContext,
  Page,
  BrowserContextOptions,
} from "playwright";
import type { Cookie, LocalStorage } from "./environment.js";

type StorageState = {
  cookies: Cookie[];
  origins: { origin: string; localStorage: LocalStorage }[];
};
class BrowserManager {
  constructor(public browsers: Browser[] = []) {}

  async closeAll() {
    await Promise.all(this.browsers.map((browser) => browser.close()));
    this.browsers = [];
  }
  async closeBrowser(browser?: PlaywrightBrowser | Browser) {
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

  async createBrowser(headless = false, storageState?: StorageState, extensionPath?: string, userDataDirPath?: string) {
    const browser = new Browser();
    await browser.init(headless, storageState, extensionPath, userDataDirPath);
    this.browsers.push(browser);
    return browser;
  }
  async getBrowser(headless = false, storageState?: StorageState, extensionPath?: string, userDataDirPath?: string) {
    if (this.browsers.length === 0) {
      return await this.createBrowser(headless, storageState, extensionPath, userDataDirPath);
    }
    return this.browsers[0];
  }
}
class Browser {
  browser: PlaywrightBrowser | null;
  context: BrowserContext | null;
  page: Page | null;
  constructor() {
    this.browser = null;
    this.context = null;
    this.page = null;
  }

  async init(headless = false, storageState?: StorageState, extensionPath?: string, userDataDirPath?: string) {
    let viewport = null;
    if (process.env.HEADLESS === "true") {
      headless = true;
    } else if (process.env.HEADLESS === "false") {
      headless = false;
    }
    if (process.env.VIEWPORT) {
      let viewportParts = process.env.VIEWPORT.split(",");
      viewport = { width: parseInt(viewportParts[0]), height: parseInt(viewportParts[1]) };
    }

    if (!extensionPath && userDataDirPath) {
      this.context = await chromium.launchPersistentContext(userDataDirPath, {
        headless: false,
        timeout: 0,
        bypassCSP: true,
        args: ["--ignore-https-errors", "--no-incognito"],
      });
      // this.browser = await chromium.connectOverCDP({
      //   endpointURL: `http://localhost:${cdpPort}`,
      // });
      // if (!this.browser) {
      //   throw new Error("Could not connect to browser");
      // }
      // this.context = await this.browser.newContext();
      //this.page = await this.context.newPage();
      // if (this.browser.contexts?.length > 0) {
      //   this.context =  (this.browser.contexts as BrowserContext[])[0];
      //   //this.context = await this.browser.contexts[0];
      //   if (this.context.pages.length > 0) {
      //     this.page = await this.context.pages[0];
      //   } else {
      //     this.page = await this.context.newPage();
      //   }
      // } else {
      //   this.context = await this.browser.newContext();
      //   this.page = await this.context.newPage();
      // }
    } else if (extensionPath) {
      this.context = await chromium.launchPersistentContext(userDataDirPath ?? "", {
        headless: headless,
        timeout: 0,
        bypassCSP: true,
        args: [
          "--ignore-https-errors",
          "--disable-extensions-except=" + extensionPath,
          "--load-extension=" + extensionPath,
          "--no-incognito",
        ],
      });
    } else {
      if (process.env.BROWSER === "firefox") {
        this.browser = await firefox.launch({
          headless: headless,
          timeout: 0,
          args: ["--ignore-https-errors"],
        });
      } else if (process.env.BROWSER === "webkit") {
        this.browser = await webkit.launch({
          headless: headless,
          timeout: 0,
          args: ["--ignore-https-errors"],
        });
      } else {
        this.browser = await chromium.launch({
          headless: headless,
          timeout: 0,
          args: ["--ignore-https-errors"],
        });
      }

      let contextOptions = {} as BrowserContextOptions;
      if (storageState) {
        contextOptions.storageState = storageState as unknown as BrowserContextOptions["storageState"];
        contextOptions.bypassCSP = true;
        contextOptions.ignoreHTTPSErrors = true;
      }
      if (viewport) {
        contextOptions.viewport = viewport;
      }
      this.context = await this.browser.newContext(contextOptions as unknown as BrowserContextOptions);
    }
    // }
    this.page = await this.context!.newPage();
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
export type { BrowserManager, Browser };
// let browser = await browserManager.createBrowser();
// browser.page.goto("https://www.cnn.com");
// let browser2 = await browserManager.createBrowser();
// await browser2.page.goto("https://www.google.com");
// // sleep for 2 seconds
// await new Promise((r) => setTimeout(r, 1000));
// await browserManager.closeAll();
