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
  _fixUsingParams(text, _params) {
    if (!_params || typeof text !== "string") {
      return text;
    }
    for (let key in _params) {
      text = text.replaceAll(new RegExp("{" + key + "}", "g"), _params[key]);
    }
    return text;
  }
  _getLocator(locator, scope, _params) {
    if (locator.role) {
      if (locator.role[1].nameReg) {
        locator.role[1].name = reg_parser(locator.role[1].nameReg);
        delete locator.role[1].nameReg;
      }
      if (locator.role[1].name) {
        locator.role[1].name = this._fixUsingParams(locator.role[1].name, _params);
      }
      return scope.getByRole(locator.role[0], locator.role[1]);
    }
    if (locator.css) {
      return scope.locator(this._fixUsingParams(locator.css, _params));
    }
    if (locator.text) {
      return scope.getByText(this._fixUsingParams(locator.text, _params));
    }
    throw new Error("unknown locator type");
  }

  async _collectLocatorInformation(locators, index, scope, foundLocators, _params) {
    if (index === locators.length) {
      return;
    }
    const locator = this._getLocator(locators[index], scope, _params);
    let count = await locator.count();
    let visibleCount = 0;
    let visibleLocator = null;
    for (let j = 0; j < count; j++) {
      if ((await locator.nth(j).isVisible()) && (await locator.nth(j).isEnabled())) {
        visibleCount++;
        if (index === locators.length - 1) {
          foundLocators.push(locator.nth(j));
        } else {
          this._collectLocatorInformation(locators, index + 1, locator.nth(j), foundLocators);
        }
      }
    }
  }
  async _locate(selectors, info, _params, timeout = 10000) {
    let locatorsByPriority = [];
    let startTime = performance.now();
    let locatorsCount = 0;
    while (true) {
      locatorsCount = 0;
      for (let i = 0; i < selectors.length; i++) {
        let selectorList = selectors[i];

        let foundLocators = [];
        try {
          await this._collectLocatorInformation(selectorList, 0, this.page, foundLocators, _params);
        } catch (e) {
          foundLocators = [];
          await this._collectLocatorInformation(selectorList, 0, this.page, foundLocators, _params);
        }

        info.log.push("total elements found " + foundLocators.length);
        if (foundLocators.length === 1) {
          info.log.push("found unique element");
          info.box = await foundLocators[0].boundingBox();
          return foundLocators[0];
        }
        locatorsByPriority.push(foundLocators);
        locatorsCount += foundLocators.length;
      }
      if (locatorsCount > 0) {
        break;
      }
      if (performance.now() - startTime > timeout) {
        break;
      }
      await new Promise((resolve) => setTimeout(resolve, 1000));
    }
    this.logger.debug("unable to locate unique element, total elements found " + locatorsCount);
    info.log.push("failed to locate unique element, total elements found " + locatorsCount);
    for (let i = 0; i < locatorsByPriority.length; i++) {
      let locators = locatorsByPriority[i];
      if (locators.length > 0) {
        info.box = await locators[0].boundingBox();
        return locators[0];
      }
    }
    throw new Error("failed to locate first element no elements found, " + JSON.stringify(info));
  }

  async click(selector, _params = null, options = {}) {
    const info = {};
    info.log = [];
    info.operation = "click";
    info.selector = selector;

    try {
      let element = await this._locate(selector, info, _params);

      await this._screenShot(options);
      try {
        await element.click({ timeout: 5000 });
      } catch (e) {
        info.log.push("click failed, will try force click");
        await element.click({ timeout: 10000, force: true });
      }
      return info;
    } catch (e) {
      this.logger.error("click failed " + JSON.stringify(info));
      Object.assign(e, { info: info });
      await this._screenShot(options);
      throw e;

      this.logger.info("click failed, will try next selector");
    }
  }

  async selectOption(selector, values, _params = null, options = {}) {
    const info = {};
    info.log = [];
    info.operation = "selectOptions";
    info.selector = selector;

    try {
      let element = await this._locate(selector, info, _params);

      await this._screenShot(options);
      try {
        await element.selectOption(values, { timeout: 5000 });
      } catch (e) {
        info.log.push("selectOption failed, will try force");
        await element.selectOption(values, { timeout: 10000, force: true });
      }
      return info;
    } catch (e) {
      this.logger.error("selectOption failed " + JSON.stringify(info));
      Object.assign(e, { info: info });
      await this._screenShot(options);
      throw e;

      this.logger.info("click failed, will try next selector");
    }
  }

  async fill(selector, value, _params = null, options = {}) {
    const info = {};
    info.log = [];
    info.operation = "fill";
    info.selector = selector;
    info.value = value;
    try {
      let element = await this._locate(selector, info, _params);
      await this._screenShot(options);
      await element.fill(value, { timeout: 10000 });
      await element.dispatchEvent("change");
      return info;
    } catch (e) {
      this.logger.error("fill failed " + JSON.stringify(info));
      Object.assign(e, { info: info });
      await this._screenShot(options);
      throw e;
    }
  }
  async _screenShot(options = {}) {
    if (options.screenshot) {
      await this.page.screenshot({ path: options.screenshotPath });
    }
  }
  async verifyElementExistInPage(selector, _params = null, options = {}) {
    const info = {};
    info.log = [];
    info.operation = "verify";
    info.selector = selector;
    try {
      const element = await this._locate(selector, info, _params);
      await this._screenShot(options);
      await expect(element).toHaveCount(1, { timeout: 10000 });
      return info;
    } catch (e) {
      this.logger.error("verify failed " + JSON.stringify(info));
      Object.assign(e, { info: info });
      await this._screenShot(options);
      throw e;
    }
  }
  async waitForPageLoad(options = {}) {
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
    await this._screenShot(options);
  }
}
export { StableBrowser };
