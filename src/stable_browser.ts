// @ts-nocheck
import reg_parser from "regex-parser";
import { expect } from "@playwright/test";
import fs from "fs";
import path from "path";
import { getTableCells } from "./table_analyze.js";
import type { Browser, Page } from "playwright";
import { closeUnexpectedPopups } from "./popups.js";
import drawRectangle from "./drawRect.js";
let configuration = null;
type Params = Record<string, string>;

const Types = {
  CLICK: "click_element",
  NAVIGATE: "navigate", ///
  FILL: "fill_element",
  EXECUTE: "execute_page_method", //
  OPEN: "open_environment", //
  COMPLETE: "task_complete",
  ASK: "information_needed",
  GET_PAGE_STATUS: "get_page_status", ///
  CLICK_ROW_ACTION: "click_row_action", //
  VERIFY_ELEMENT_CONTAINS_TEXT: "verify_element_contains_text",
  ANALYZE_TABLE: "analyze_table",
  SELECT: "select_combobox", //
  VERIFY_PAGE_PATH: "verify_page_path",
  TYPE_PRESS: "type_press",
};

class StableBrowser {
  constructor(public browser: Browser, public page: Page, public logger: any = null, context: any = null) {
    if (!this.logger) {
      this.logger = console;
    }
    context.pageLoading = false;
    context.playContext.on("page", async (page) => {
      context.pageLoading.status = true;
      this.page = page;
      context.page = page;

      try {
        await this.waitForPageLoad();
        console.log("Switch page: " + (await page.title()));
      } catch (e) {
        this.logger.error("error on page load " + e);
      }
      context.pageLoading.status = false;
    });
  }
  async closeUnexpectedPopups() {
    await closeUnexpectedPopups(this.page);
  }
  async goto(url: string) {
    await this.page.goto(url, {
      timeout: 60000,
    });
  }
  _validateSelectors(selectors) {
    if (!selectors) {
      throw new Error("selectors is null");
    }
    if (!selectors.locators) {
      throw new Error("selectors.locators is null");
    }
    if (!Array.isArray(selectors.locators)) {
      throw new Error("selectors.locators expected to be array");
    }
    if (selectors.locators.length === 0) {
      throw new Error("selectors.locators expected to be non empty array");
    }
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
  async _locateElmentByTextClimbCss(scope, text, climb, css, _params: Params) {
    let result = await this._locateElementByText(scope, this._fixUsingParams(text, _params), "*", false, true, _params);
    if (result.elementCount === 0) {
      return;
    }
    let textElementCss = "[data-blinq-id='blinq-id-" + result.randomToken + "']";
    // css climb to parent element
    const climbArray = [];
    for (let i = 0; i < climb; i++) {
      climbArray.push("..");
    }
    let climbXpath = "xpath=" + climbArray.join("/");
    return textElementCss + " >> " + climbXpath + " >> " + css;
  }
  async _locateElementByText(scope, text1, tag1, regex1 = false, partial1, _params: Params) {
    //const stringifyText = JSON.stringify(text);
    return await scope.evaluate(
      ([text, tag, regex, partial]) => {
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
          let shadowElement = shadowHosts[i].shadowRoot;
          if (!shadowElement) {
            console.log("shadowElement is null, for host " + shadowHosts[i]);
            continue;
          }
          let shadowElements = Array.from(shadowElement.querySelectorAll(tag));
          elements = elements.concat(shadowElements);
        }
        let randomToken = null;
        const foundElements = [];
        if (regex) {
          let regexpSearch = new RegExp(text, "im");
          for (let i = 0; i < elements.length; i++) {
            const element = elements[i];
            if (element.innerText && regexpSearch.test(element.innerText)) {
              foundElements.push(element);
            }
          }
        } else {
          text = text.trim();
          for (let i = 0; i < elements.length; i++) {
            const element = elements[i];
            if (partial) {
              if (element.innerText && element.innerText.trim().includes(text)) {
                foundElements.push(element);
              }
            } else {
              if (element.innerText && element.innerText.trim() === text) {
                foundElements.push(element);
              }
            }
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
      [text1, tag1, regex1, partial1]
    );
  }

  async _collectLocatorInformation(selectorHierarchy, index = 0, scope, foundLocators, _params: Params) {
    let locatorSearch = selectorHierarchy[index];
    let locator = null;
    if (locatorSearch.climb && locatorSearch.climb >= 0) {
      let locatorString = await this._locateElmentByTextClimbCss(
        scope,
        locatorSearch.text,
        locatorSearch.climb,
        locatorSearch.css,
        _params
      );
      locator = this._getLocator({ css: locatorString }, scope, _params);
    } else if (locatorSearch.text) {
      let result = await this._locateElementByText(
        scope,
        this._fixUsingParams(locatorSearch.text, _params),
        locatorSearch.tag,
        false,
        locatorSearch.partial === true,
        _params
      );
      if (result.elementCount === 0) {
        return;
      }
      locatorSearch.css = "[data-blinq-id='blinq-id-" + result.randomToken + "']";
      if (locatorSearch.childCss) {
        locatorSearch.css = locatorSearch.css + " " + locatorSearch.childCss;
      }
      locator = this._getLocator(locatorSearch, scope, _params);
    } else {
      locator = this._getLocator(locatorSearch, scope, _params);
    }

    let count = await locator.count();
    //let visibleCount = 0;
    let visibleLocator = null;
    if (locatorSearch.index && locatorSearch.index < count) {
      foundLocators.push(locator.nth(locatorSearch.index));
      return;
    }

    for (let j = 0; j < count; j++) {
      if ((await locator.nth(j).isVisible()) && (await locator.nth(j).isEnabled())) {
        foundLocators.push(locator.nth(j));
      }
    }
  }
  async _locate(selectors, info, _params?: Params, timeout = 30000) {
    let highPriorityTimeout = 5000;
    let startTime = performance.now();
    let locatorsCount = 0;
    let arrayMode = Array.isArray(selectors);
    let scope = this.page;
    if (!arrayMode && (selectors.iframe_src || selectors.frameLocators)) {
      while (true) {
        let frameFound = false;
        if (selectors.frameLocators) {
          for (let i = 0; i < selectors.frameLocators.length; i++) {
            let frameLocator = selectors.frameLocators[i];
            if (frameLocator.css) {
              scope = scope.frameLocator(frameLocator.css);
              frameFound = true;
              break;
            }
          }
        }
        if (!frameFound && selectors.iframe_src) {
          scope = this.page.frame({ url: selectors.iframe_src });
        }
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
    // group selectors by priority
    let locatorsByPriority = { "1": [], "2": [], "3": [] };
    for (let i = 0; i < selectorsLocators.length; i++) {
      if (!selectorsLocators[i].priority || selectorsLocators[i].priority === 1) {
        locatorsByPriority["1"].push(selectorsLocators[i]);
      } else if (selectorsLocators[i].priority === 2) {
        locatorsByPriority["2"].push(selectorsLocators[i]);
      } else if (selectorsLocators[i].priority === 3) {
        locatorsByPriority["3"].push(selectorsLocators[i]);
      }
    }
    for (let i = 0; i < locatorsByPriority["1"].length; i++) {
      if (locatorsByPriority["1"][i].role && locatorsByPriority["1"][i].role.length === 2) {
        locatorsByPriority["1"][i].role[1].exact = true;
        // clone the locator
        let locator = JSON.parse(JSON.stringify(locatorsByPriority["1"][i]));
        locator.role[1].exact = false;
        locatorsByPriority["2"].push(locator);
      }
    }

    let highPriorityOnly = true;
    while (true) {
      locatorsCount = 0;
      let result = [];
      result = await this._scanLocatorsGroup(locatorsByPriority["1"], scope, _params);
      if (result.foundElements.length === 0) {
        result = await this._scanLocatorsGroup(locatorsByPriority["2"], scope, _params);
      }
      if (result.foundElements.length === 0 && !highPriorityOnly) {
        result = await this._scanLocatorsGroup(locatorsByPriority["3"], scope, _params);
      }
      let foundElements = result.foundElements;

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
      if (performance.now() - startTime > highPriorityTimeout) {
        highPriorityOnly = false;
      }
      await new Promise((resolve) => setTimeout(resolve, 1000));
    }
    this.logger.debug("unable to locate unique element, total elements found " + locatorsCount);
    info.log.push("failed to locate unique element, total elements found " + locatorsCount);

    throw new Error("failed to locate first element no elements found, " + JSON.stringify(info));
  }
  async _scanLocatorsGroup(locatorsGroup, scope, _params) {
    let foundElements = [];
    const result = {
      foundElements: foundElements,
    };
    for (let i = 0; i < locatorsGroup.length; i++) {
      let foundLocators = [];
      try {
        await this._collectLocatorInformation(locatorsGroup, i, scope, foundLocators, _params);
      } catch (e) {
        this.logger.debug("unable to use locator " + JSON.stringify(locatorsGroup[i]));
        foundLocators = [];
        try {
          await this._collectLocatorInformation(locatorsGroup, i, this.page, foundLocators, _params);
        } catch (e) {
          this.logger.info("unable to use locator (second try) " + JSON.stringify(locatorsGroup[i]));
        }
      }
      if (foundLocators.length === 1) {
        result.foundElements.push({
          locator: foundLocators[0],
          box: await foundLocators[0].boundingBox(),
          unique: true,
        });
      }
    }
    return result;
  }

  async click(selectors, _params?: Params, options = {}, world = null) {
    this._validateSelectors(selectors);
    const startTime = Date.now();
    const info = {};
    info.log = [];
    info.operation = "click";
    info.selectors = selectors;
    let error = null;
    let screenshotId = null;
    let screenshotPath = null;
    try {
      let element = await this._locate(selectors, info, _params);

      ({ screenshotId, screenshotPath } = await this._screenShot(options, world, info));
      try {
        await this._highlightElements(element);
        await element.click({ timeout: 10000 });
        await new Promise((resolve) => setTimeout(resolve, 1000));
      } catch (e) {
        await this.closeUnexpectedPopups();
        info.log.push("click failed, will try again");
        element = await this._locate(selectors, info, _params);
        await element.click({ timeout: 10000 });
        await new Promise((resolve) => setTimeout(resolve, 1000));
      }
      await this.waitForPageLoad();
      return info;
    } catch (e) {
      this.logger.error("click failed " + JSON.stringify(info));
      ({ screenshotId, screenshotPath } = await this._screenShot(options, world, info));
      info.screenshotPath = screenshotPath;
      Object.assign(e, { info: info });
      error = e;
      throw e;
    } finally {
      const endTime = Date.now();
      this._reportToWorld(world, {
        element_name: selectors.element_name,
        type: Types.CLICK,
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

  async selectOption(selectors, values, _params = null, options = {}, world = null) {
    this._validateSelectors(selectors);
    if (!values) {
      throw new Error("values is null");
    }
    const startTime = Date.now();
    let error = null;
    let screenshotId = null;
    let screenshotPath = null;
    const info = {};
    info.log = [];
    info.operation = "selectOptions";
    info.selectors = selectors;

    try {
      let element = await this._locate(selectors, info, _params);

      ({ screenshotId, screenshotPath } = await this._screenShot(options, world, info));
      try {
        await this._highlightElements(element);
        await element.selectOption(values, { timeout: 5000 });
      } catch (e) {
        await this.closeUnexpectedPopups();
        info.log.push("selectOption failed, will try force");
        await element.selectOption(values, { timeout: 10000, force: true });
      }
      await this.waitForPageLoad();
      return info;
    } catch (e) {
      this.logger.error("selectOption failed " + JSON.stringify(info));
      ({ screenshotId, screenshotPath } = await this._screenShot(options, world, info));
      info.screenshotPath = screenshotPath;
      Object.assign(e, { info: info });
      this.logger.info("click failed, will try next selector");
      error = e;
      throw e;
    } finally {
      const endTime = Date.now();
      this._reportToWorld(world, {
        element_name: selectors.element_name,
        type: Types.SELECT,
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
  async type(value, _params = null, options = {}, world = null) {
    const startTime = Date.now();
    let error = null;
    let screenshotId = null;
    let screenshotPath = null;

    const info = {};
    info.log = [];
    info.operation = "type";
    value = this._fixUsingParams(value, _params);
    info.value = value;
    try {
      ({ screenshotId, screenshotPath } = await this._screenShot(options, world, info));
      let keyEvent = false;
      KEYBOARD_EVENTS.forEach((event) => {
        if (value === event || value.startsWith(event + "+")) {
          keyEvent = true;
        }
      });
      if (keyEvent) {
        await this.page.keyboard.press(value);
      } else {
        await this.page.keyboard.type(value);
      }
      return info;
    } catch (e) {
      await this.closeUnexpectedPopups();
      this.logger.error("type failed " + JSON.stringify(info));
      ({ screenshotId, screenshotPath } = await this._screenShot(options, world, info));
      info.screenshotPath = screenshotPath;
      Object.assign(e, { info: info });
      error = e;
      throw e;
    } finally {
      const endTime = Date.now();
      this._reportToWorld(world, {
        type: Types.TYPE_PRESS,
        screenshotId,
        value,
        text: `type value: ${value}`,
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
  async clickType(selectors, value, enter = false, _params = null, options = {}, world = null) {
    this._validateSelectors(selectors);
    const startTime = Date.now();
    let error = null;
    let screenshotId = null;
    let screenshotPath = null;

    const info = {};
    info.log = [];
    info.operation = "clickType";
    info.selectors = selectors;
    info.value = value;
    try {
      let element = await this._locate(selectors, info, _params);
      ({ screenshotId, screenshotPath } = await this._screenShot(options, world, info));
      //insert red border around the element
      await this._highlightElements(element);
      try {
        let currentValue = await element.inputValue();
        if (currentValue) {
          await element.fill("");
        }
      } catch (e) {
        this.logger.error("unable to clear input value");
      }
      await element.click();
      await new Promise((resolve) => setTimeout(resolve, 500));
      let keyEvent = false;
      KEYBOARD_EVENTS.forEach((event) => {
        if (value === event || value.startsWith(event + "+")) {
          keyEvent = true;
        }
      });
      if (keyEvent) {
        await this.page.keyboard.press(value);
      } else {
        await this.page.keyboard.type(value);
        await new Promise((resolve) => setTimeout(resolve, 2000));
      }
      if (enter === true) {
        await new Promise((resolve) => setTimeout(resolve, 2000));
        await this.page.keyboard.press("Enter");
        await this.waitForPageLoad();
      } else if (enter === false) {
        await element.dispatchEvent("change");
        //await this.page.keyboard.press("Tab");
      } else {
        if (enter !== "" && enter !== null && enter !== undefined) {
          await this.page.keyboard.press(enter);
          await this.waitForPageLoad();
        }
      }

      return info;
    } catch (e) {
      await this.closeUnexpectedPopups();
      this.logger.error("fill failed " + JSON.stringify(info));
      ({ screenshotId, screenshotPath } = await this._screenShot(options, world, info));
      info.screenshotPath = screenshotPath;
      Object.assign(e, { info: info });
      error = e;
      throw e;
    } finally {
      const endTime = Date.now();
      this._reportToWorld(world, {
        element_name: selectors.element_name,
        type: Types.FILL,
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

  async fill(selectors, value, enter = false, _params = null, options = {}, world = null) {
    this._validateSelectors(selectors);

    const startTime = Date.now();
    let error = null;
    let screenshotId = null;
    let screenshotPath = null;
    const info = {};
    info.log = [];
    info.operation = "fill";
    info.selectors = selectors;
    info.value = value;
    try {
      let element = await this._locate(selectors, info, _params);
      ({ screenshotId, screenshotPath } = await this._screenShot(options, world, info));
      await this._highlightElements(element);
      await element.fill(value, { timeout: 10000 });
      await element.dispatchEvent("change");
      if (enter) {
        await new Promise((resolve) => setTimeout(resolve, 2000));
        await this.page.keyboard.press("Enter");
      }
      await this.waitForPageLoad();
      return info;
    } catch (e) {
      await this.closeUnexpectedPopups();
      this.logger.error("fill failed " + JSON.stringify(info));
      ({ screenshotId, screenshotPath } = await this._screenShot(options, world, info));
      info.screenshotPath = screenshotPath;
      Object.assign(e, { info: info });
      error = e;
      throw e;
    } finally {
      const endTime = Date.now();
      this._reportToWorld(world, {
        element_name: selectors.element_name,
        type: Types.FILL,
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
  async getText(selectors, _params = null, options = {}, info = {}, world = null) {
    return await this._getText(selectors, 0, _params, options, info, world);
  }
  async _getText(selectors, climb, _params = null, options = {}, info = {}, world = null) {
    this._validateSelectors(selectors);
    let screenshotId = null;
    let screenshotPath = null;
    if (!info.log) {
      info.log = [];
    }
    info.operation = "getText";
    info.selectors = selectors;
    let element = await this._locate(selectors, info, _params);
    if (climb > 0) {
      const climbArray = [];
      for (let i = 0; i < climb; i++) {
        climbArray.push("..");
      }
      let climbXpath = "xpath=" + climbArray.join("/");
      element = element.locator(climbXpath);
    }
    ({ screenshotId, screenshotPath } = await this._screenShot(options, world, info));
    try {
      await this._highlightElements(element);
      const elementText = await element.innerText();
      return { text: elementText, screenshotId, screenshotPath };
    } catch (e) {
      await this.closeUnexpectedPopups();
      this.logger.info("no innerText will use textContent");
      const elementText = await element.textContent();
      return { text: elementText, screenshotId, screenshotPath };
    }
  }
  async containsPattern(selectors, pattern, text, _params = null, options = {}, world = null) {
    this._validateSelectors(selectors);
    if (!pattern) {
      throw new Error("pattern is null");
    }
    if (!text) {
      throw new Error("text is null");
    }
    const startTime = Date.now();
    let error = null;
    let screenshotId = null;
    let screenshotPath = null;
    const info = {};
    info.log = [];
    info.operation = "containsPattern";
    info.selectors = selectors;
    info.value = text;
    info.pattern = pattern;
    let foundObj = null;
    try {
      foundObj = await this._getText(selectors, 0, _params, options, info, world);
      let escapedText = text.replace(/[-[\]{}()*+?.,\\^$|#\s]/g, "\\$&");
      pattern = pattern.replace("{text}", escapedText);
      let regex = new RegExp(pattern, "im");
      if (!regex.test(foundObj?.text)) {
        info.foundText = foundObj?.text;
        throw new Error("element doesn't contain text " + text);
      }
      return info;
    } catch (e) {
      await this.closeUnexpectedPopups();
      this.logger.error("verify element contains text failed " + JSON.stringify(info));
      this.logger.error("found text " + foundObj?.text + " pattern " + pattern);
      ({ screenshotId, screenshotPath } = await this._screenShot(options, world, info));
      info.screenshotPath = screenshotPath;
      Object.assign(e, { info: info });
      error = e;
      throw e;
    } finally {
      const endTime = Date.now();
      this._reportToWorld(world, {
        element_name: selectors.element_name,
        type: Types.VERIFY_ELEMENT_CONTAINS_TEXT,
        value: pattern,
        text: `Verify element contains pattern: ${pattern}`,
        screenshotId: foundObj?.screenshotId,
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

  async containsText(selectors, text, climb, _params = null, options = {}, world = null) {
    this._validateSelectors(selectors);
    if (!text) {
      throw new Error("text is null");
    }
    const startTime = Date.now();
    let error = null;
    let screenshotId = null;
    let screenshotPath = null;
    const info = {};
    info.log = [];
    info.operation = "containsText";
    info.selectors = selectors;
    info.value = text;
    let foundObj = null;
    try {
      foundObj = await this._getText(selectors, climb, _params, options, info, world);
      if (!foundObj?.text.includes(text)) {
        info.foundText = foundObj?.text;
        throw new Error("element doesn't contain text " + text);
      }
      return info;
    } catch (e) {
      await this.closeUnexpectedPopups();
      this.logger.error("verify element contains text failed " + JSON.stringify(info));
      ({ screenshotId, screenshotPath } = await this._screenShot(options, world, info));
      info.screenshotPath = screenshotPath;
      Object.assign(e, { info: info });
      error = e;
      throw e;
    } finally {
      const endTime = Date.now();
      this._reportToWorld(world, {
        element_name: selectors.element_name,
        type: Types.VERIFY_ELEMENT_CONTAINS_TEXT,
        text: `Verify element contains text: ${text}`,
        value: text,
        screenshotId: foundObj?.screenshotId,
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
  async _screenShot(options = {}, world = null, info = null) {
    let result = {};
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
      result.screenshotId = nextIndex;
      result.screenshotPath = screenshotPath;
      if (info && info.box) {
        await drawRectangle(screenshotPath, info.box.x, info.box.y, info.box.width, info.box.height);
      }
    } else if (options && options.screenshot) {
      result.screenshotPath = options.screenshotPath;
      await this.page.screenshot({ path: options.screenshotPath });
      if (info && info.box) {
        await drawRectangle(options.screenshotPath, info.box.x, info.box.y, info.box.width, info.box.height);
      }
    }
    return result;
  }
  async verifyElementExistInPage(selectors, _params = null, options = {}, world = null) {
    this._validateSelectors(selectors);
    const startTime = Date.now();
    let error = null;
    let screenshotId = null;
    let screenshotPath = null;
    await new Promise((resolve) => setTimeout(resolve, 2000));
    const info = {};
    info.log = [];
    info.operation = "verify";
    info.selectors = selectors;
    try {
      const element = await this._locate(selectors, info, _params);
      await this._highlightElements(element);
      ({ screenshotId, screenshotPath } = await this._screenShot(options, world, info));
      await expect(element).toHaveCount(1, { timeout: 10000 });
      return info;
    } catch (e) {
      await this.closeUnexpectedPopups();
      this.logger.error("verify failed " + JSON.stringify(info));
      ({ screenshotId, screenshotPath } = await this._screenShot(options, world, info));
      info.screenshotPath = screenshotPath;
      Object.assign(e, { info: info });
      error = e;
      throw e;
    } finally {
      const endTime = Date.now();
      this._reportToWorld(world, {
        element_name: selectors.element_name,
        type: Types.VERIFY_ELEMENT_CONTAINS_TEXT,
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
  async _highlightElements(scope, css) {
    try {
      if (!scope) {
        return;
      }
      if (!css) {
        await scope.evaluate((node) => {
          if (node && node.style) {
            let originalBorder = node.style.border;
            node.style.border = "2px solid red";
            if (window) {
              window.addEventListener("beforeunload", function (e) {
                node.style.border = originalBorder;
              });
            }
            setTimeout(function () {
              node.style.border = originalBorder;
            }, 2000);
          }
        });
      } else {
        await scope.evaluate(
          ([css]) => {
            if (!css) {
              return;
            }
            let elements = Array.from(document.querySelectorAll(css));
            //console.log("found: " + elements.length);
            for (let i = 0; i < elements.length; i++) {
              let element = elements[i];
              if (!element.style) {
                return;
              }
              var originalBorder = element.style.border;

              // Set the new border to be red and 2px solid
              element.style.border = "2px solid red";
              if (window) {
                window.addEventListener("beforeunload", function (e) {
                  element.style.border = originalBorder;
                });
              }
              // Set a timeout to revert to the original border after 2 seconds
              setTimeout(function () {
                element.style.border = originalBorder;
              }, 2000);
            }
            return;
          },
          [css]
        );
      }
    } catch (error) {
      console.debug(error);
    }
  }
  async verifyPagePath(pathPart, options = {}, world = null) {
    const startTime = Date.now();
    let error = null;
    let screenshotId = null;
    let screenshotPath = null;
    await new Promise((resolve) => setTimeout(resolve, 2000));
    const info = {};
    info.log = [];
    info.operation = "verifyPagePath";
    info.pathPart = pathPart;
    try {
      for (let i = 0; i < 30; i++) {
        const url = await this.page.url();
        if (!url.includes(pathPart)) {
          if (i === 29) {
            throw new Error(`url ${url} doesn't contain ${pathPart}`);
          }
          await new Promise((resolve) => setTimeout(resolve, 1000));
          continue;
        }
        ({ screenshotId, screenshotPath } = await this._screenShot(options, world));
        return info;
      }
    } catch (e) {
      await this.closeUnexpectedPopups();
      this.logger.error("verify page path failed " + JSON.stringify(info));
      ({ screenshotId, screenshotPath } = await this._screenShot(options, world));
      info.screenshotPath = screenshotPath;
      Object.assign(e, { info: info });
      error = e;
      throw e;
    } finally {
      const endTime = Date.now();
      this._reportToWorld(world, {
        type: Types.VERIFY_PAGE_PATH,
        text: "Verify page path",
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
  async verifyTextExistInPage(text, options = {}, world = null) {
    const startTime = Date.now();
    const timeout = this._getLoadTimeout(options);
    let error = null;
    let screenshotId = null;
    let screenshotPath = null;
    await new Promise((resolve) => setTimeout(resolve, 2000));
    const info = {};
    info.log = [];
    info.operation = "verifyTextExistInPage";
    info.text = text;
    try {
      while (true) {
        const frames = this.page.frames();
        let results = [];
        for (let i = 0; i < frames.length; i++) {
          const result = await this._locateElementByText(frames[i], text, "*", true, {});
          result.frame = frames[i];
          results.push(result);
        }
        info.results = results;
        const resultWithElementsFound = results.filter((result) => result.elementCount > 0);

        if (resultWithElementsFound.length === 0) {
          if (Date.now() - startTime > timeout) {
            throw new Error(`Text ${text} not found in page`);
          }
          await new Promise((resolve) => setTimeout(resolve, 1000));
          continue;
        }
        if (resultWithElementsFound[0].randomToken) {
          await this._highlightElements(
            resultWithElementsFound[0].frame,
            `[data-blinq-id="blinq-id-${resultWithElementsFound[0].randomToken}"]`
          );
        }
        ({ screenshotId, screenshotPath } = await this._screenShot(options, world, info));
        return info;
      }

      // await expect(element).toHaveCount(1, { timeout: 10000 });
    } catch (e) {
      await this.closeUnexpectedPopups();
      this.logger.error("verify text exist in page failed " + JSON.stringify(info));
      ({ screenshotId, screenshotPath } = await this._screenShot(options, world, info));
      info.screenshotPath = screenshotPath;
      Object.assign(e, { info: info });
      error = e;
      throw e;
    } finally {
      const endTime = Date.now();
      this._reportToWorld(world, {
        type: Types.VERIFY_ELEMENT_CONTAINS_TEXT,
        text: "Verify text exists in page",
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
  async analyzeTable(selectors, query, operator, value, _params = null, options = {}, world = null) {
    this._validateSelectors(selectors);
    if (!query) {
      throw new Error("query is null");
    }
    if (!operator) {
      throw new Error("operator is null");
    }
    if (!value) {
      throw new Error("value is null");
    }
    const startTime = Date.now();
    let error = null;
    let screenshotId = null;
    let screenshotPath = null;
    const info = {};
    info.log = [];
    info.operation = "analyzeTable";
    info.selectors = selectors;
    info.query = query;
    query = this._fixUsingParams(query, _params);
    info.query_fixed = query;
    info.operator = operator;
    info.value = value;
    try {
      let table = await this._locate(selectors, info, _params);
      ({ screenshotId, screenshotPath } = await this._screenShot(options, world, info));
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
      ({ screenshotId, screenshotPath } = await this._screenShot(options, world, info));
      info.screenshotPath = screenshotPath;
      Object.assign(e, { info: info });
      error = e;
      throw e;
    } finally {
      const endTime = Date.now();
      this._reportToWorld(world, {
        element_name: selectors.element_name,
        type: Types.ANALYZE_TABLE,
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
  _getLoadTimeout(options) {
    let timeout = 15000;
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
    if (options && options.page_timeout) {
      timeout = options.page_timeout;
    }
    return timeout;
  }
  async waitForPageLoad(options = {}, world = null) {
    let timeout = this._getLoadTimeout(options);
    const waitOptions = {
      timeout: timeout,
    };
    const startTime = Date.now();
    let error = null;
    let screenshotId = null;
    let screenshotPath = null;

    try {
      await Promise.all([
        this.page.waitForLoadState("networkidle", waitOptions),
        this.page.waitForLoadState("load", waitOptions),
        this.page.waitForLoadState("domcontentloaded", waitOptions),
      ]);
    } catch (e) {
      console.log(".");
    } finally {
      await new Promise((resolve) => setTimeout(resolve, 2000));
      ({ screenshotId, screenshotPath } = await this._screenShot(options, world));
      const endTime = Date.now();
      this._reportToWorld(world, {
        type: Types.GET_PAGE_STATUS,
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
  async reloadPage(options = {}, world = null) {
    const startTime = Date.now();
    let error = null;
    let screenshotId = null;
    let screenshotPath = null;

    try {
      await this.page.reload();
    } catch (e) {
      console.log(".");
    } finally {
      await new Promise((resolve) => setTimeout(resolve, 2000));
      ({ screenshotId, screenshotPath } = await this._screenShot(options, world));
      const endTime = Date.now();
      this._reportToWorld(world, {
        type: Types.GET_PAGE_STATUS,
        text: "page relaod",
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
const KEYBOARD_EVENTS = [
  "ALT",
  "AltGraph",
  "CapsLock",
  "Control",
  "Fn",
  "FnLock",
  "Hyper",
  "Meta",
  "NumLock",
  "ScrollLock",
  "Shift",
  "Super",
  "Symbol",
  "SymbolLock",
  "Enter",
  "Tab",
  "ArrowDown",
  "ArrowLeft",
  "ArrowRight",
  "ArrowUp",
  "End",
  "Home",
  "PageDown",
  "PageUp",
  "Backspace",
  "Clear",
  "Copy",
  "CrSel",
  "Cut",
  "Delete",
  "EraseEof",
  "ExSel",
  "Insert",
  "Paste",
  "Redo",
  "Undo",
  "Accept",
  "Again",
  "Attn",
  "Cancel",
  "ContextMenu",
  "Escape",
  "Execute",
  "Find",
  "Finish",
  "Help",
  "Pause",
  "Play",
  "Props",
  "Select",
  "ZoomIn",
  "ZoomOut",
  "BrightnessDown",
  "BrightnessUp",
  "Eject",
  "LogOff",
  "Power",
  "PowerOff",
  "PrintScreen",
  "Hibernate",
  "Standby",
  "WakeUp",
  "AllCandidates",
  "Alphanumeric",
  "CodeInput",
  "Compose",
  "Convert",
  "Dead",
  "FinalMode",
  "GroupFirst",
  "GroupLast",
  "GroupNext",
  "GroupPrevious",
  "ModeChange",
  "NextCandidate",
  "NonConvert",
  "PreviousCandidate",
  "Process",
  "SingleCandidate",
  "HangulMode",
  "HanjaMode",
  "JunjaMode",
  "Eisu",
  "Hankaku",
  "Hiragana",
  "HiraganaKatakana",
  "KanaMode",
  "KanjiMode",
  "Katakana",
  "Romaji",
  "Zenkaku",
  "ZenkakuHanaku",
  "F1",
  "F2",
  "F3",
  "F4",
  "F5",
  "F6",
  "F7",
  "F8",
  "F9",
  "F10",
  "F11",
  "F12",
  "Soft1",
  "Soft2",
  "Soft3",
  "Soft4",
  "ChannelDown",
  "ChannelUp",
  "Close",
  "MailForward",
  "MailReply",
  "MailSend",
  "MediaFastForward",
  "MediaPause",
  "MediaPlay",
  "MediaPlayPause",
  "MediaRecord",
  "MediaRewind",
  "MediaStop",
  "MediaTrackNext",
  "MediaTrackPrevious",
  "AudioBalanceLeft",
  "AudioBalanceRight",
  "AudioBassBoostDown",
  "AudioBassBoostToggle",
  "AudioBassBoostUp",
  "AudioFaderFront",
  "AudioFaderRear",
  "AudioSurroundModeNext",
  "AudioTrebleDown",
  "AudioTrebleUp",
  "AudioVolumeDown",
  "AudioVolumeMute",
  "AudioVolumeUp",
  "MicrophoneToggle",
  "MicrophoneVolumeDown",
  "MicrophoneVolumeMute",
  "MicrophoneVolumeUp",
  "TV",
  "TV3DMode",
  "TVAntennaCable",
  "TVAudioDescription",
];
export { StableBrowser };
