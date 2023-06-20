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
  async _checkUnique(locator, info) {
    info.log.push("check unique");
    let count = await locator.count();
    info.log.push("count=" + count);
    if (count > 1) {
      this.logger.error("Found more than one element for locator" + JSON.stringify(locator.toString()));
      for (let i = 0; i < count; i++) {
        let loc = locator.nth(i);
        if ((await loc.isVisible()) && (await loc.isEnabled())) {
          info.box = await loc.boundingBox();
          return loc;
        }
      }
    }
    if (count === 1) {
      info.box = await locator.boundingBox();
    }
    return locator;
  }
  async _locate(selector, scope, info) {
    try {
      if (Array.isArray(selector)) {
        let currentScope = scope;

        for (let i = 0; i < selector.length; i++) {
          currentScope = await this._locate(selector[i], currentScope, info);
        }
        return currentScope;
      }
      if (typeof selector === "object") {
        info.log.push("try selector " + JSON.stringify(selector));
        if (selector.css) {
          return await this._checkUnique(scope.locator(selector.css), info);
        }
        if (selector.role) {
          if (selector.role[1].nameReg) {
            selector.role[1].name = reg_parser(selector.role[1].nameReg);
            delete selector.role[1].nameReg;
          }
          return await this._checkUnique(scope.getByRole(selector.role[0], selector.role[1]), info);
        }
        if (selector.text) {
          return await this._checkUnique(scope.getByText(selector.text), info);
        }
      } else if (typeof selector === "string" && selector.startsWith("TEXT=")) {
        info.log.push("try getByText");
        return await this.page.getByText(selector.substring("TEXT=".length));
      } else {
        info.log.push("try direct css selector");
        return await this.page.locator(selector);
      }
      throw new Error(`Unknown locator type ${type}`);
    } catch (e) {
      console.log("invalid locator object, will try to parse as text");
    }
  }

  async click(selector) {
    const info = {};
    info.log = [];
    info.operation = "click";
    info.selector = selector;
    for (let i = 0; i < selector.length; i++) {
      info.log.push("try selector " + i);
      try {
        await (await this._locate(selector[i], this.page, info)).click({ timeout: 10000 });
        return info;
      } catch (e) {
        if (i === selector.length - 1) {
          this.logger.error("click failed " + JSON.stringify(info));
          Object.assign(e, { info: info });
          throw e;
        }
        this.logger.info("click failed, will try next selector");
      }
    }
  }
  async fill(selector, value) {
    const info = {};
    info.log = [];
    info.operation = "fill";
    info.selector = selector;
    info.value = value;
    for (let i = 0; i < selector.length; i++) {
      info.log.push("try selector " + i);
      try {
        let element = await this._locate(selector[i], this.page, info);
        await element.fill(value, { timeout: 10000 });
        await element.dispatchEvent("change");
        return info;
      } catch (e) {
        if (i === selector.length - 1) {
          this.logger.error("fill failed " + JSON.stringify(info));
          Object.assign(e, { info: info });
          throw e;
        }
        this.logger.info("click failed, will try next selector");
      }
    }
  }
  async verifyElementExistInPage(selector) {
    const info = {};
    info.log = [];
    info.operation = "verify";
    info.selector = selector;
    for (let i = 0; i < selector.length; i++) {
      try {
        const element = await this._locate(selector[0], this.page, info);
        await expect(element).toHaveCount(1, { timeout: 10000 });
        return info;
      } catch (e) {
        if (i === selector.length - 1) {
          this.logger.error("verify failed " + JSON.stringify(info));
          Object.assign(e, { info: info });
          throw e;
        }
        this.logger.info("click failed, will try next selector");
      }
    }

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
