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
  _getLocator(locator, scope, _params: Params, exact: boolean = false) {
    if (locator.role) {
      if (locator.role[1].nameReg) {
        locator.role[1].name = reg_parser(locator.role[1].nameReg);
        delete locator.role[1].nameReg;
      }
      if (locator.role[1].name) {
        locator.role[1].name = this._fixUsingParams(locator.role[1].name, _params);
      }
      if (exact) {
        locator.role[1].exact = true;
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
        document.isParent = isParent;
        function collectAllShadowDomElements(element, result = []) {
          // Check and add the element if it has a shadow root
          if (element.shadowRoot) {
            result.push(element);
            // Also search within the shadow root
            document.collectAllShadowDomElements(element.shadowRoot, result);
          }

          // Iterate over child nodes
          element.childNodes.forEach((child) => {
            // Recursively call the function for each child node
            document.collectAllShadowDomElements(child, result);
          });

          return result;
        }
        document.collectAllShadowDomElements = collectAllShadowDomElements;
        if (!tag) {
          tag = "*";
        }
        let elements = Array.from(document.querySelectorAll(tag));
        let shadowHosts = [];
        document.collectAllShadowDomElements(document, shadowHosts);
        for (let i = 0; i < shadowHosts.length; i++) {
          let shadowElement = shadowHosts[i].shadowElement;
          if (!shadowElement) {
            console.log("shadowElement is null, for host " + shadowHosts[i]);
            continue;
          }
          let shadowElements = Array.from(shadowElement.querySelectorAll(tag));
          elements = elements.concat(shadowElements);
        }
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

  async _collectLocatorInformation(selectorHierarchy, index = 0, scope, foundLocators, _params: Params, exact = false) {
    let locatorSearch = selectorHierarchy[index];
    let locator = null;
    if (locatorSearch.text) {
      let result = await this._locateElementByText(scope, locatorSearch.text, locatorSearch.tag, false, _params);
      if (result.elementCount === 0) {
        return;
      }
      locatorSearch.css = "[data-blinq-id='blinq-id-" + result.randomToken + "']";
      locator = this._getLocator(locatorSearch, scope, _params, exact);
    } else {
      locator = this._getLocator(locatorSearch, scope, _params, exact);
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
    let arrayMode = Array.isArray(selectors);
    let scope = this.page;
    if (!arrayMode && selectors.iframe_src) {
      while (true) {
        scope = this.page.frame({ url: selectors.iframe_src });
        if (!scope) {
          info.log.push("unable to locate iframe " + selectors.iframe_src);
          if (performance.now() - startTime > timeout) {
            throw new Error("unable to locate iframe " + selectors.iframe_src);
          }
          await new Promise((resolve) => setTimeout(resolve, 1000));
        } else {
          break;
        }
      }
    }
    let selectorsLocators = null;
    if (!arrayMode) {
      selectorsLocators = selectors.locators;
    } else {
      selectorsLocators = [];
      for (let i = 0; i < selectors.length; i++) {
        selectorsLocators.push(selectors[i][0]);
      }
    }
    let exact = false;
    while (true) {
      locatorsCount = 0;
      let selectorIndex = 0;
      // check for iframe section
      const foundElements = [];
      for (let i = 0; i < selectorsLocators.length; i++) {
        let foundLocators = [];
        try {
          await this._collectLocatorInformation(selectorsLocators, i, scope, foundLocators, _params, exact);
        } catch (e) {
          this.logger.info("unable to use locator " + JSON.stringify(selectorsLocators[i]));
          foundLocators = [];
          try {
            await this._collectLocatorInformation(selectorsLocators, i, this.page, foundLocators, _params, exact);
          } catch (e) {
            this.logger.info("unable to use locator (second try) " + JSON.stringify(selectorsLocators[i]));
          }
        }
        if (foundLocators.length === 1) {
          foundElements.push({ locator: foundLocators[0], box: await foundLocators[0].boundingBox(), unique: true });
        } else if (foundLocators.length > 1) {
          exact = true;
        }
      }

      if (foundElements.length === 1 && foundElements[0].unique) {
        info.box = foundElements[0].box;
        return foundElements[0].locator;
      }
      //info.log.push("total elements found " + foundElements.length);
      if (foundElements.length > 1) {
        let electionResult = {};
        for (let i = 0; i < foundElements.length; i++) {
          let element = foundElements[i];
          if (!electionResult[element.box]) {
            electionResult[element.box] = {
              locator: element.locator,
              count: 1,
            };
          } else {
            electionResult[element.box].count++;
          }
        }
        let maxCountElement = null;
        for (let key in electionResult) {
          if (!maxCountElement) {
            maxCountElement = electionResult[key];
          } else {
            if (maxCountElement.count < electionResult[key].count) {
              maxCountElement = electionResult[key];
            }
          }
        }
        if (maxCountElement) {
          info.box = await maxCountElement.locator.boundingBox();
          return maxCountElement.locator;
        }
      }
      if (performance.now() - startTime > timeout) {
        break;
      }
      await new Promise((resolve) => setTimeout(resolve, 1000));
    }
    this.logger.debug("unable to locate unique element, total elements found " + locatorsCount);
    info.log.push("failed to locate unique element, total elements found " + locatorsCount);

    throw new Error("failed to locate first element no elements found, " + JSON.stringify(info));
  }

  async click(selector, _params?: Params, options = {}, world = null) {
    const startTime = Date.now();
    const info = {};
    info.log = [];
    info.operation = "click";
    info.selector = selector;
    let error = null;
    let screenshotId = null;
    try {
      let element = await this._locate(selector, info, _params);

      screenshotId = await this._screenShot(options, world);
      try {
        await element.click({ timeout: 5000 });
      } catch (e) {
        info.log.push("click failed, will try force click");
        await element.click({ timeout: 10000, force: true });
      }
      await this.waitForPageLoad();
      return info;
    } catch (e) {
      this.logger.error("click failed " + JSON.stringify(info));
      Object.assign(e, { info: info });
      screenshotId = await this._screenShot(options, world);
      error = e;
      throw e;
    } finally {
      const endTime = Date.now();
      this._reportToWorld(world, {
        type: "click",
        text: `Click element`,
        screenshotId,
        result: error
          ? {
              status: "FAILED",
              startTime,
              endTime,
              message: error?.message,
            }
          : {
              status: "PASSED",
              startTime,
              endTime,
            },
      });
    }
  }

  async selectOption(selector, values, _params = null, options = {}, world = null) {
    const startTime = Date.now();
    let error = null;
    let screenshotId = null;
    const info = {};
    info.log = [];
    info.operation = "selectOptions";
    info.selector = selector;

    try {
      let element = await this._locate(selector, info, _params);

      screenshotId = await this._screenShot(options, world);
      try {
        await element.selectOption(values, { timeout: 5000 });
      } catch (e) {
        info.log.push("selectOption failed, will try force");
        await element.selectOption(values, { timeout: 10000, force: true });
      }
      await this.waitForPageLoad();
      return info;
    } catch (e) {
      this.logger.error("selectOption failed " + JSON.stringify(info));
      Object.assign(e, { info: info });
      screenshotId = await this._screenShot(options, world);
      this.logger.info("click failed, will try next selector");
      error = e;
      throw e;
    } finally {
      const endTime = Date.now();
      this._reportToWorld(world, {
        type: "select",
        text: `Select option: ${values}`,
        value: values.toString(),
        screenshotId,
        result: error
          ? {
              status: "FAILED",
              startTime,
              endTime,
              message: error?.message,
            }
          : {
              status: "PASSED",
              startTime,
              endTime,
            },
      });
    }
  }

  async clickType(selector, value, enter = false, _params = null, options = {}, world = null) {
    const startTime = Date.now();
    let error = null;
    let screenshotId = null;

    const info = {};
    info.log = [];
    info.operation = "clickType";
    info.selector = selector;
    info.value = value;
    try {
      let element = await this._locate(selector, info, _params);
      screenshotId = await this._screenShot(options, world);
      await element.click({ timeout: 5000 });
      await this.page.keyboard.type(value, { timeout: 10000 });
      if (enter) {
        await this.page.keyboard.press("Enter");
        await this.waitForPageLoad();
      } else {
        await element.dispatchEvent("change");
      }
      return info;
    } catch (e) {
      this.logger.error("fill failed " + JSON.stringify(info));
      Object.assign(e, { info: info });
      screenshotId = await this._screenShot(options, world);
      error = e;
      throw e;
    } finally {
      const endTime = Date.now();
      this._reportToWorld(world, {
        type: "clickType",
        screenshotId,
        value,
        text: `clickType input with value: ${value}`,
        result: error
          ? {
              status: "FAILED",
              startTime,
              endTime,
              message: error?.message,
            }
          : {
              status: "PASSED",
              startTime,
              endTime,
            },
      });
    }
  }

  async fill(selector, value, enter = false, _params = null, options = {}, world = null) {
    const startTime = Date.now();
    let error = null;
    let screenshotId = null;

    const info = {};
    info.log = [];
    info.operation = "fill";
    info.selector = selector;
    info.value = value;
    try {
      let element = await this._locate(selector, info, _params);
      screenshotId = await this._screenShot(options, world);
      await element.fill(value, { timeout: 10000 });
      await element.dispatchEvent("change");
      if (enter) {
        await this.page.keyboard.press("Enter");
      }
      await this.waitForPageLoad();
      return info;
    } catch (e) {
      this.logger.error("fill failed " + JSON.stringify(info));
      Object.assign(e, { info: info });
      screenshotId = await this._screenShot(options, world);
      error = e;
      throw e;
    } finally {
      const endTime = Date.now();
      this._reportToWorld(world, {
        type: "fill",
        screenshotId,
        value,
        text: `Fill input with value: ${value}`,
        result: error
          ? {
              status: "FAILED",
              startTime,
              endTime,
              message: error?.message,
            }
          : {
              status: "PASSED",
              startTime,
              endTime,
            },
      });
    }
  }

  async getText(selector, _params = null, options = {}, info = {}, world = null) {
    if (!info.log) {
      info.log = [];
    }
    info.operation = "getText";
    info.selector = selector;
    let element = await this._locate(selector, info, _params);
    let screenshotId = await this._screenShot(options, world);
    try {
      return await element.innerText();
    } catch (e) {
      this.logger.info("no innerText will use textContent");
      return await element.textContent();
    }
  }
  async containsPattern(selector, pattern, text, _params = null, options = {}, world = null) {
    const startTime = Date.now();
    let error = null;
    let screenshotId = null;
    const info = {};
    info.log = [];
    info.operation = "containsPattern";
    info.selector = selector;
    info.value = text;
    info.pattern = pattern;
    let foundText = null;
    try {
      foundText = await this.getText(selector, _params, options, info, world);
      let escapedText = text.replace(/[-[\]{}()*+?.,\\^$|#\s]/g, "\\$&");
      pattern = pattern.replace("{text}", escapedText);
      let regex = new RegExp(pattern, "im");
      if (!regex.test(foundText)) {
        info.foundText = foundText;
        throw new Error("element doesn't contain text " + text);
      }
      return info;
    } catch (e) {
      this.logger.error("verify element contains text failed " + JSON.stringify(info));
      this.logger.error("found text " + foundText + " pattern " + pattern);
      Object.assign(e, { info: info });
      screenshotId = await this._screenShot(options, world);
      error = e;
      throw e;
    } finally {
      const endTime = Date.now();
      this._reportToWorld(world, {
        type: "containsPattern",
        value: pattern,
        text: `Verify element contains pattern: ${pattern}`,
        screenshotId,
        result: error
          ? {
              status: "FAILED",
              startTime,
              endTime,
              message: error?.message,
            }
          : {
              status: "PASSED",
              startTime,
              endTime,
            },
      });
    }
  }

  async containsText(selector, text, _params = null, options = {}, world = null) {
    const startTime = Date.now();
    let error = null;
    let screenshotId = null;
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
      Object.assign(e, { info: info });
      screenshotId = await this._screenShot(options, world);
      error = e;
      throw e;
    } finally {
      const endTime = Date.now();
      this._reportToWorld(world, {
        type: "containsText",
        text: `Verify element contains text: ${text}`,
        value: text,
        screenshotId,
        result: error
          ? {
              status: "FAILED",
              startTime,
              endTime,
              message: error?.message,
            }
          : {
              status: "PASSED",
              startTime,
              endTime,
            },
      });
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
      return nextIndex;
    } else if (options.screenshot) {
      await this.page.screenshot({ path: options.screenshotPath });
    }
  }
  async verifyElementExistInPage(selector, _params = null, options = {}, world = null) {
    const startTime = Date.now();
    let error = null;
    let screenshotId = null;
    await new Promise((resolve) => setTimeout(resolve, 2000));
    const info = {};
    info.log = [];
    info.operation = "verify";
    info.selector = selector;
    try {
      const element = await this._locate(selector, info, _params);
      screenshotId = await this._screenShot(options, world);
      await expect(element).toHaveCount(1, { timeout: 10000 });
      return info;
    } catch (e) {
      this.logger.error("verify failed " + JSON.stringify(info));
      Object.assign(e, { info: info });
      screenshotId = await this._screenShot(options, world);
      error = e;
      throw e;
    } finally {
      const endTime = Date.now();
      this._reportToWorld(world, {
        type: "verify",
        text: "Verify element exists in page",
        screenshotId,
        result: error
          ? {
              status: "FAILED",
              startTime,
              endTime,
              message: error?.message,
            }
          : {
              status: "PASSED",
              startTime,
              endTime,
            },
      });
    }
  }
  async analyzeTable(selector, query, operator, value, _params = null, options = {}, world = null) {
    const startTime = Date.now();
    let error = null;
    let screenshotId = null;
    const info = {};
    info.log = [];
    info.operation = "analyzeTable";
    info.selector = selector;
    info.query = query;
    query = this._fixUsingParams(query, _params);
    info.query_fixed = query;
    info.operator = operator;
    info.value = value;
    try {
      let table = await this._locate(selector, info, _params);
      screenshotId = await this._screenShot(options, world);
      const cells = await getTableCells(this.page, table, query, info);

      if (cells && cells.error) {
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
      } else if (operator === "contains") {
        if (cells.length === 0) {
          throw new Error("no cells found");
        }
        let found = false;
        for (let i = 0; i < cells.length; i++) {
          if (cells[i].toLowerCase().includes(value.toLowerCase())) {
            found = true;
            break;
          }
        }
        if (!found) {
          throw new Error(`no table cell contains value ${value}`);
        }
      } else {
        throw new Error("unknown operator " + operator);
      }
      return info;
    } catch (e) {
      this.logger.error("analyzeTable failed " + JSON.stringify(info));
      Object.assign(e, { info: info });
      screenshotId = await this._screenShot(options, world);
      error = e;
      throw e;
    } finally {
      const endTime = Date.now();
      this._reportToWorld(world, {
        type: "analyzeTable",
        text: "Analyze table",
        screenshotId,
        result: error
          ? {
              status: "FAILED",
              startTime,
              endTime,
              message: error?.message,
            }
          : {
              status: "PASSED",
              startTime,
              endTime,
            },
      });
    }
  }
  async waitForPageLoad(options = {}, world = null) {
    let timeout = 10000;
    const startTime = Date.now();
    let error = null;
    let screenshotId = null;
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
    } finally {
      await new Promise((resolve) => setTimeout(resolve, 2000));
      screenshotId = await this._screenShot(options, world);
      const endTime = Date.now();
      this._reportToWorld(world, {
        type: "waitForPageLoad",
        text: "Wait for page load",
        screenshotId,
        result: error
          ? {
              status: "FAILED",
              startTime,
              endTime,
              message: error?.message,
            }
          : {
              status: "PASSED",
              startTime,
              endTime,
            },
      });
    }
  }
  _reportToWorld(world, properties: JsonCommandReport) {
    if (!world || !world.attach) {
      return;
    }
    world.attach(JSON.stringify(properties), { mediaType: "application/json" });
  }
}
type JsonTimestamp = number;
type JsonResultPassed = {
  status: "PASSED";
  startTime: JsonTimestamp;
  endTime: JsonTimestamp;
};
type JsonResultFailed = {
  status: "FAILED";
  startTime: JsonTimestamp;
  endTime: JsonTimestamp;
  message?: string;
  // exception?: JsonException
};

type JsonCommandResult = JsonResultPassed | JsonResultFailed;
type JsonCommandReport = {
  type: string;
  value?: string;
  text: string;
  screenshotId?: string;
  result: JsonCommandResult;
};
export { StableBrowser };
