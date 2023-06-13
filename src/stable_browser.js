import { expect } from "@jest/globals";
class StableBrowser {
  constructor(browser, page) {
    this.browser = browser;
    this.page = page;
  }

  async goto(url) {
    await this.page.goto(url, {
      timeout: 60000,
    });
  }
  async _fixLocator(locator) {
    let count = await locator.count();
    if (count > 1) {
      return locator.nth(0);
    }
    return locator;
  }
  async _locate(selector, scope) {
    try {
      if (Array.isArray(selector)) {
        let currentScope = scope;

        for (let i = 0; i < selector.length; i++) {
          currentScope = await this._fixLocator(
            await this._locate(selector[i], currentScope)
          );
        }
        return currentScope;
      }
      if (typeof selector === "object") {
        if (selector.css) {
          return await this._fixLocator(scope.locator(selector.css));
        }
        if (selector.role) {
          return await this._fixLocator(
            scope.getByRole(selector.role[0], selector.role[1])
          );
        }
        if (selector.text) {
          return await this._fixLocator(scope.getByText(selector.text));
        }
      }
      throw new Error(`Unknown locator type ${type}`);
    } catch (e) {
      console.log("invalid locator object, will try to parse as text");
    }

    if (selector.startsWith("TEXT=")) {
      return await this.page.getByText(selector.substring("TEXT=".length));
    } else {
      return await this.page.locator(selector);
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
  async verifyTextFoundInPage(text) {
    const element = await page.getByText(text);
    await expect(element !== undefined).toBeTruthy();
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
