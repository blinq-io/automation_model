import reg_parser from "regex-parser";
import { expect } from "@playwright/test";
class StableBrowser {
  constructor(browser, page, logger) {
    this.browser = browser;
    this.page = page;
    this.logger = logger;
    if (!this.logger) {
      this.logger = console;
    }
  }

  async goto(url) {
    await this.page.goto(url, {
      timeout: 60000,
    });
  }
  async _checkUnique(locator) {
    let count = await locator.count();
    if (count > 1) {
      this.logger.error("Found more than one element for locator" + JSON.stringify(locator.toString()));
      for (let i = 0; i < count; i++) {
        let loc = locator.nth(i);
        if ((await loc.isVisible()) && (await loc.isEnabled())) {
          return loc;
        }
      }
    }
    return locator;
  }
  async _locate(selector, scope) {
    try {
      if (Array.isArray(selector)) {
        let currentScope = scope;

        for (let i = 0; i < selector.length; i++) {
          currentScope = await this._locate(selector[i], currentScope);
        }
        return currentScope;
      }
      if (typeof selector === "object") {
        if (selector.css) {
          return await this._checkUnique(scope.locator(selector.css));
        }
        if (selector.role) {
          if (selector.role[1].nameReg) {
            selector.role[1].name = reg_parser(selector.role[1].nameReg);
            delete selector.role[1].nameReg;
          }
          return await this._checkUnique(scope.getByRole(selector.role[0], selector.role[1]));
        }
        if (selector.text) {
          return await this._checkUnique(scope.getByText(selector.text));
        }
      } else if (typeof selector === "string" && selector.startsWith("TEXT=")) {
        return await this.page.getByText(selector.substring("TEXT=".length));
      } else {
        return await this.page.locator(selector);
      }
      throw new Error(`Unknown locator type ${type}`);
    } catch (e) {
      console.log("invalid locator object, will try to parse as text");
    }
  }

  async click(selector) {
    await (await this._locate(selector, this.page)).click();
  }
  async fill(selector, value) {
    let element = await this._locate(selector, this.page);
    await element.fill(value);
    await element.dispatchEvent("change");
  }
  async verifyElementExistInPage(selector) {
    const element = await this._locate(selector, this.page);
    await expect(element).toHaveCount(1);
    //await expect(element !== undefined).toBeTruthy();
  }
  async waitForPageLoad() {
    try {
      await Promise.all([
        this.page.waitForLoadState("networkidle"),
        this.page.waitForLoadState("load"),
        this.page.waitForLoadState("domcontentloaded"),
      ]);
    } catch (e) {
      console.log("waitForPageLoad error, ignored");
    }
    await new Promise((resolve) => setTimeout(resolve, 2000));
  }
}
export { StableBrowser };
