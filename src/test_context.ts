import { BrowserContext, Page, Browser as PlaywrightBrowser } from "playwright";
import { Environment } from "./environment.js";
import { StableBrowser } from "./stable_browser.js";
import { Api } from "./api.js";

class TestContext {
  stable: StableBrowser | null = null;
  browser: PlaywrightBrowser | null = null;
  playContext: BrowserContext | null = null;
  page: Page | null = null;
  environment: Environment | null = null;
  reportFolder: string | null = null;
  api: Api | null = null;
  constructor() {}
}
export { TestContext };
