// @ts-nocheck
import reg_parser from "regex-parser";
import { expect } from "@playwright/test";
import fs from "fs";
import path from "path";
import { getTableCells } from "./table_analyze.js";
import type { Browser, Page } from "playwright";
let configuration = null;
type Params = Record<string, string>;
class StableBrowser {
  constructor(public browser: Browser, public page: Page, public logger: any = null) {
    // this.browser = browser;
    // this.page = page;
    // this.logger = logger;
    if (!this.logger) {
      this.logger = console;
    }
  }

  async goto(url: string) {
    await this.page.goto(url, {
      timeout: 60000,
    });
  }
  _fixUsingParams(text, _params: Params) {
    if (!_params || typeof text !== "string") {
      return text;
    }
    for (let key in _params) {
      text = text.replaceAll(new RegExp("{" + key + "}", "g"), _params[key]);
    }
    return text;
  }
  _getLocator(locator, scope, _params: Params) {
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
    throw new Error("unknown locator type");
  }
  async _locateElementByText(scope, text1, tag1, regex = false, _params: Params) {
    //const stringifyText = JSON.stringify(text);
    return await scope.evaluate(
      ([text, tag]) => {
        function isParent(parent, child) {
          let currentNode = child.parentNode;
          while (currentNode !== null) {
            if (currentNode === parent) {
              return true;
            }
            currentNode = currentNode.parentNode;
          }
          return false;
        }
        if (!tag) {
          tag = "*";
        }
        let elements = Array.from(document.querySelectorAll(tag));
        let randomToken = null;

        text = text.trim();
        const foundElements = [];
        for (let i = 0; i < elements.length; i++) {
          const element = elements[i];
          if (element.innerText && element.innerText.trim() === text) {
            foundElements.push(element);
          }
        }
        let noChildElements = [];
        for (let i = 0; i < foundElements.length; i++) {
          let element = foundElements[i];
          let hasChild = false;
          for (let j = 0; j < foundElements.length; j++) {
            if (i === j) {
              continue;
            }
            if (isParent(element, foundElements[j])) {
              hasChild = true;
              break;
            }
          }
          if (!hasChild) {
            noChildElements.push(element);
          }
        }
        let elementCount = 0;
        if (noChildElements.length > 0) {
          for (let i = 0; i < noChildElements.length; i++) {
            if (randomToken === null) {
              randomToken = Math.random().toString(36).substring(7);
            }
            let element = noChildElements[i];
            element.setAttribute("data-blinq-id", "blinq-id-" + randomToken);
            elementCount++;
          }
        }
        return { elementCount: elementCount, randomToken: randomToken };
      },
      [text1, tag1]
    );
  }

  async _collectLocatorInformation(selectorHierarchy, index = 0, scope, foundLocators, _params: Params) {
    if (index === selectorHierarchy.length) {
      return;
    }
    if (selectorHierarchy.length !== 1) {
      this.logger.info("only single selector hierarchy supported, will use first selector");
    }

    let locatorSearch = selectorHierarchy[index];
    let locator = null;
    if (locatorSearch.text) {
      let result = await this._locateElementByText(scope, locatorSearch.text, locatorSearch.tag, false, _params);
      if (result.elementCount === 0) {
        return;
      }
      locatorSearch.css = "[data-blinq-id='blinq-id-" + result.randomToken + "']";
      locator = this._getLocator(locatorSearch, scope, _params);
    } else {
      locator = this._getLocator(locatorSearch, scope, _params);
    }

    let count = await locator.count();
    //let visibleCount = 0;
    let visibleLocator = null;
    for (let j = 0; j < count; j++) {
      if ((await locator.nth(j).isVisible()) && (await locator.nth(j).isEnabled())) {
        //visibleCount++;
        // if (index === selectorHierarchy.length - 1) {
        foundLocators.push(locator.nth(j));
        // } else {
        //   this._collectLocatorInformation(selectorHierarchy, index + 1, locator.nth(j), foundLocators);
        // }
      }
    }
  }
  async _locate(selectors, info, _params?: Params, timeout = 30000) {
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

  async click(selector, _params?: Params, options = {}, world = null) {
    const info = {};
    info.log = [];
    info.operation = "click";
    info.selector = selector;
    this._reportToWorld(world, { command: "click", params: _params, selector: selector });
    try {
      let element = await this._locate(selector, info, _params);

      await this._screenShot(options, world);
      try {
        await element.click({ timeout: 5000 });
      } catch (e) {
        info.log.push("click failed, will try force click");
        this._reportToWorld(world, { message: "click failed, will try force click" });
        await element.click({ timeout: 10000, force: true });
      }
      this._reportToWorld(world, { result: "success", info: info });
      await this.waitForPageLoad();
      return info;
    } catch (e) {
      this.logger.error("click failed " + JSON.stringify(info));
      this._reportToWorld(world, { result: "failed", info: info, error: e });
      Object.assign(e, { info: info });
      await this._screenShot(options, world);
      throw e;
    }
  }

  async selectOption(selector, values, _params = null, options = {}, world = null) {
    const info = {};
    info.log = [];
    info.operation = "selectOptions";
    info.selector = selector;
    this._reportToWorld(world, { command: "select", values, params: _params, selector: selector });
    try {
      let element = await this._locate(selector, info, _params);

      await this._screenShot(options, world);
      try {
        await element.selectOption(values, { timeout: 5000 });
      } catch (e) {
        info.log.push("selectOption failed, will try force");
        this._reportToWorld(world, { message: "select failed, will try force select" });
        await element.selectOption(values, { timeout: 10000, force: true });
      }
      await this.waitForPageLoad();
      return info;
    } catch (e) {
      this.logger.error("selectOption failed " + JSON.stringify(info));
      this._reportToWorld(world, { result: "failed", info: info, error: e });
      Object.assign(e, { info: info });
      await this._screenShot(options, world);
      throw e;

      this.logger.info("click failed, will try next selector");
    }
  }

  async fill(selector, value, enter = false, _params = null, options = {}, world = null) {
    const info = {};
    info.log = [];
    info.operation = "fill";
    info.selector = selector;
    info.value = value;
    this._reportToWorld(world, { command: "fill", value, enter, params: _params, selector: selector });
    try {
      let element = await this._locate(selector, info, _params);
      await this._screenShot(options, world);
      await element.fill(value, { timeout: 10000 });
      await element.dispatchEvent("change");
      if (enter) {
        await this.page.keyboard.press("Enter");
      }
      await this.waitForPageLoad();
      return info;
    } catch (e) {
      this.logger.error("fill failed " + JSON.stringify(info));
      this._reportToWorld(world, { result: "failed", info: info, error: e });
      Object.assign(e, { info: info });
      await this._screenShot(options, world);
      throw e;
    }
  }

  async getText(selector, _params = null, options = {}, info = {}, world = null) {
    if (!info.log) {
      info.log = [];
    }
    let element = await this._locate(selector, info, _params);
    await this._screenShot(options, world);
    try {
      return await element.innerText();
    } catch (e) {
      this.logger.info("no innerText will use textContent");
      return await element.textContent();
    }
  }
  async containsPattern(selector, pattern, text, _params = null, options = {}, world = null) {
    const info = {};
    info.log = [];
    info.operation = "containsPattern";
    info.selector = selector;
    info.value = text;
    info.pattern = pattern;
    let foundText = null;
    this._reportToWorld(world, { command: "contains", pattern, text, params: _params, selector: selector });
    try {
      foundText = await this.getText(selector, _params, options, info, world);
      let escapedText = text.replace(/[-[\]{}()*+?.,\\^$|#\s]/g, "\\$&");
      pattern = pattern.replace("{text}", escapedText);
      let regex = new RegExp(pattern, "m");
      if (!regex.test(foundText)) {
        info.foundText = foundText;
        throw new Error("element doesn't contain text " + text);
      }
      return info;
    } catch (e) {
      this.logger.error("verify element contains text failed " + JSON.stringify(info));
      this.logger.error("found text " + foundText + " pattern " + pattern);
      this._reportToWorld(world, { result: "failed", info: info, error: e });
      Object.assign(e, { info: info });
      await this._screenShot(options, world);
      throw e;
    }
  }

  async containsText(selector, text, _params = null, options = {}, world = null) {
    const info = {};
    info.log = [];
    info.operation = "containsText";
    info.selector = selector;
    info.value = text;
    try {
      let foundText = await this.getText(selector, _params, options, info, world);
      if (!foundText.includes(text)) {
        info.foundText = foundText;
        throw new Error("element doesn't contain text " + text);
      }
      return info;
    } catch (e) {
      this.logger.error("verify element contains text failed " + JSON.stringify(info));
      this._reportToWorld(world, { result: "failed", info: info, error: e });
      Object.assign(e, { info: info });
      await this._screenShot(options, world);
      throw e;
    }
  }
  async _screenShot(options = {}, world = null) {
    if (world && world.attach && world.screenshot && world.screenshotPath) {
      if (!fs.existsSync(world.screenshotPath)) {
        fs.mkdirSync(world.screenshotPath, { recursive: true });
      }
      let nextIndex = 1;
      while (fs.existsSync(path.join(world.screenshotPath, nextIndex + ".png"))) {
        nextIndex++;
      }
      const screenshotPath = path.join(world.screenshotPath, nextIndex + ".png");
      await this.page.screenshot({ path: screenshotPath });
      await world.attach(JSON.stringify({ path: screenshotPath }), {
        mediaType: "application/json",
      });
    } else if (options && options.screenshot) {
      await this.page.screenshot({ path: options.screenshotPath });
    }
  }
  async verifyElementExistInPage(selector, _params = null, options = {}, world = null) {
    await new Promise((resolve) => setTimeout(resolve, 2000));
    const info = {};
    info.log = [];
    info.operation = "verify";
    info.selector = selector;
    this._reportToWorld(world, { command: "verify", params: _params, selector: selector });
    try {
      const element = await this._locate(selector, info, _params);
      await this._screenShot(options, world);
      await expect(element).toHaveCount(1, { timeout: 10000 });
      return info;
    } catch (e) {
      this.logger.error("verify failed " + JSON.stringify(info));
      this._reportToWorld(world, { result: "failed", info: info, error: e });
      Object.assign(e, { info: info });
      await this._screenShot(options, world);
      throw e;
    }
  }
  async analyzeTable(selector, query, operator, value, _params = null, options = {}, world = null) {
    const info = {};
    info.log = [];
    info.operation = "analyzeTable";
    info.selector = selector;
    info.query = query;
    query = this._fixUsingParams(query, _params);
    info.query_fixed = query;
    info.operator = operator;
    info.value = value;
    this._reportToWorld(world, {
      command: "analyzeTable",
      query,
      operator,
      value,
      params: _params,
      selector: selector,
    });
    try {
      let table = await this._locate(selector, info, _params);
      await this._screenShot(options, world);
      const cells = await getTableCells(this.page, table, query, info);

      if (cells.error) {
        throw new Error(cells.error);
      }
      if (operator === "===" || operator === "==" || operator === "=" || operator === "equals") {
        if (cells.length === 0) {
          throw new Error("no cells found");
        }
        for (let i = 0; i < cells.length; i++) {
          if (cells[i] !== value) {
            throw new Error("table data doesn't match");
          }
        }
      } else if (operator === "!==" || operator === "!=" || operator === "not_equals") {
        if (cells.length === 0) {
          throw new Error("no cells found");
        }
        for (let i = 0; i < cells.length; i++) {
          if (cells[i] === value) {
            throw new Error("table data doesn't match");
          }
        }
      } else if (operator === ">=" || operator === "greater_than_or_equal") {
        if (cells.length === 0) {
          throw new Error("no cells found");
        }
        value = Number(value);
        for (let i = 0; i < cells.length; i++) {
          let foundValue = Number(cells[i]);

          if (foundValue < value) {
            throw new Error(`found table cell value ${cells[i]} < ${value}`);
          }
        }
      } else if (operator === ">" || operator === "greater_than") {
        if (cells.length === 0) {
          throw new Error("no cells found");
        }
        value = Number(value);
        for (let i = 0; i < cells.length; i++) {
          let foundValue = Number(cells[i]);
          if (foundValue <= value) {
            throw new Error(`found table cell value ${cells[i]} <= ${value}`);
          }
        }
      } else if (operator === "<=" || operator === "less_than_or_equal") {
        if (cells.length === 0) {
          throw new Error("no cells found");
        }
        value = Number(value);
        for (let i = 0; i < cells.length; i++) {
          let foundValue = Number(cells[i]);
          if (foundValue > value) {
            throw new Error(`found table cell value ${cells[i]} > ${value}`);
          }
        }
      } else if (operator === "<" || operator === "less_than") {
        if (cells.length === 0) {
          throw new Error("no cells found");
        }
        value = Number(value);
        for (let i = 0; i < cells.length; i++) {
          let foundValue = Number(cells[i]);
          if (foundValue >= value) {
            throw new Error(`found table cell value ${cells[i]} >= ${value}`);
          }
        }
      } else {
        throw new Error("unknown operator " + operator);
      }
      return info;
    } catch (e) {
      this.logger.error("analyzeTable failed " + JSON.stringify(info));
      this._reportToWorld(world, { result: "failed", info: info, error: e });
      Object.assign(e, { info: info });
      await this._screenShot(options, world);
      throw e;
    }
  }
  async waitForPageLoad(options = {}, world = null) {
    let timeout = 10000;
    this._reportToWorld(world, { command: "waitForPageLoade" });
    if (!configuration) {
      try {
        if (fs.existsSync("ai_config.json")) {
          configuration = JSON.parse(fs.readFileSync("ai_config.json"));
        } else {
          configuration = {};
        }
      } catch (e) {
        this.logger.error("unable to read ai_config.json");
      }
    }
    if (configuration.page_timeout) {
      timeout = configuration.page_timeout;
    }
    if (options.page_timeout) {
      timeout = options.page_timeout;
    }
    const waitOptions = {
      timeout: timeout,
    };
    try {
      await Promise.all([
        this.page.waitForLoadState("networkidle", waitOptions),
        this.page.waitForLoadState("load", waitOptions),
        this.page.waitForLoadState("domcontentloaded", waitOptions),
      ]);
    } catch (e) {
      console.log("waitForPageLoad error, ignored");
    }
    await new Promise((resolve) => setTimeout(resolve, 2000));
    await this._screenShot(options, world);
  }
  _reportToWorld(world, properties = {}) {
    if (!world || !world.attach) {
      return;
    }
    world.attach(JSON.stringify(properties), { mediaType: "application/json" });
  }
}

export { StableBrowser };
