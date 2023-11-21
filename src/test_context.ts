import { BrowserContext, Page, Browser as PlaywrightBrowser } from "playwright";
import { Environment } from "./environment.js";
import { StableBrowser } from "./stable_browser.js";

class TestContext {
  stable: StableBrowser|null = null
  browser: PlaywrightBrowser|null = null
  playContext: BrowserContext | null = null
  page: Page | null = null
  environment: Environment|null = null
  reportFolder: string|null = null
  constructor(
  ) {
  }
}
export { TestContext };
