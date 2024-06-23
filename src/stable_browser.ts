// @ts-nocheck
import { expect } from "@playwright/test";
import dayjs from "dayjs";
import fs from "fs";

import path from "path";
import type { Browser, Page } from "playwright";
import reg_parser from "regex-parser";
import sharp from "sharp";
import { findDateAlternatives, findNumberAlternatives } from "./analyze_helper.js";
import { getDateTimeValue } from "./date_time.js";
import drawRectangle from "./drawRect.js";
//import { closeUnexpectedPopups } from "./popups.js";
import { getTableCells, getTableData } from "./table_analyze.js";
import objectPath from "object-path";
import { decrypt } from "./utils.js";
type Params = Record<string, string>;

const Types = {
  CLICK: "click_element",
  NAVIGATE: "navigate", ///
  FILL: "fill_element",
  EXECUTE: "execute_page_method", //
  OPEN: "open_environment", //
  COMPLETE: "step_complete",
  ASK: "information_needed",
  GET_PAGE_STATUS: "get_page_status", ///
  CLICK_ROW_ACTION: "click_row_action", //
  VERIFY_ELEMENT_CONTAINS_TEXT: "verify_element_contains_text",
  ANALYZE_TABLE: "analyze_table",
  SELECT: "select_combobox", //
  VERIFY_PAGE_PATH: "verify_page_path",
  TYPE_PRESS: "type_press",
  HOVER: "hover_element",
  CHECK: "check_element",
  UNCHECK: "uncheck_element",
  EXTRACT: "extract_attribute",
  CLOSE_PAGE: "close_page",
  SET_DATE_TIME: "set_date_time",
  SET_VIEWPORT: "set_viewport",
  VERIFY_VISUAL: "verify_visual",
};

class StableBrowser {
  project_path = null;
  webLogFile = null;
  configuration = null;
  constructor(
    public browser: Browser,
    public page: Page,
    public logger: any = null,
    public context: any = null
  ) {
    if (!this.logger) {
      this.logger = console;
    }

    if (process.env.PROJECT_PATH) {
      this.project_path = process.env.PROJECT_PATH;
    } else {
      this.project_path = process.cwd();
    }

    try {
      let aiConfigFile = "ai_config.json";
      if (process.env.PROJECT_PATH) {
        aiConfigFile = path.join(process.env.PROJECT_PATH, "ai_config.json");
      }
      if (fs.existsSync(aiConfigFile)) {
        this.configuration = JSON.parse(fs.readFileSync(aiConfigFile, "utf8"));
      } else {
        this.configuration = {};
      }
    } catch (e) {
      this.logger.error("unable to read ai_config.json");
    }

    const logFolder = path.join(this.project_path, "logs", "web");

    this.webLogFile = this.getWebLogFile(logFolder);
    this.registerConsoleLogListener(page, context, this.webLogFile);
    this.registerRequestListener();
    context.pages = [this.page];

    context.pageLoading = { status: false };
    context.playContext.on("page", async function (page) {
      context.pageLoading.status = true;
      this.page = page;
      context.page = page;
      context.pages.push(page);

      this.webLogFile = this.getWebLogFile(logFolder);
      this.registerConsoleLogListener(page, context, this.webLogFile);
      this.registerRequestListener();
      try {
        await this.waitForPageLoad();
        console.log("Switch page: " + (await page.title()));
      } catch (e) {
        this.logger.error("error on page load " + e);
      }
      context.pageLoading.status = false;
    });
  }
  getWebLogFile(logFolder: string) {
    if (!fs.existsSync(logFolder)) {
      fs.mkdirSync(logFolder, { recursive: true });
    }
    let nextIndex = 1;
    while (fs.existsSync(path.join(logFolder, nextIndex.toString() + ".json"))) {
      nextIndex++;
    }
    const fileName = nextIndex + ".json";
    return path.join(logFolder, fileName);
  }
  registerConsoleLogListener(page: Page, context: any, logFile: string) {
    if (!this.context.webLogger) {
      this.context.webLogger = [];
    }
    page.on("console", async (msg) => {
      this.context.webLogger.push({
        type: msg.type(),
        text: msg.text(),
        location: msg.location(),
        time: new Date().toISOString(),
      });
      await fs.promises.writeFile(logFile, JSON.stringify(this.context.webLogger, null, 2));
    });
  }
  registerRequestListener() {
    this.page.on("request", async (data) => {
      try {
        const pageUrl = new URL(this.page.url());
        const requestUrl = new URL(data.url());
        if (pageUrl.hostname === requestUrl.hostname) {
          const method = data.method();
          if (method === "POST" || method === "GET" || method === "PUT" || method === "DELETE" || method === "PATCH") {
            const token = await data.headerValue("Authorization");
            if (token) {
              this.context.authtoken = token;
            }
          }
        }
      } catch (error) {
        console.error("Error in request listener", error);
      }
    });
  }

  // async closeUnexpectedPopups() {
  //   await closeUnexpectedPopups(this.page);
  // }
  async goto(url: string) {
    if (!url.startsWith("http")) {
      url = "https://" + url;
    }
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
            if (
              (element.innerText && regexpSearch.test(element.innerText)) ||
              (element.value && regexpSearch.test(element.value))
            ) {
              foundElements.push(element);
            }
          }
        } else {
          text = text.trim();
          for (let i = 0; i < elements.length; i++) {
            const element = elements[i];
            if (partial) {
              if (
                (element.innerText && element.innerText.trim().includes(text)) ||
                (element.value && element.value.includes(text))
              ) {
                foundElements.push(element);
              }
            } else {
              if (
                (element.innerText && element.innerText.trim() === text) ||
                (element.value && element.value === text)
              ) {
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

  async _collectLocatorInformation(
    selectorHierarchy,
    index = 0,
    scope,
    foundLocators,
    _params: Params,
    info,
    visibleOnly = true
  ) {
    let locatorSearch = selectorHierarchy[index];
    info.log += "searching for locator " + JSON.stringify(locatorSearch) + "\n";
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
    // let cssHref = false;
    // if (locatorSearch.css && locatorSearch.css.includes("href=")) {
    //   cssHref = true;
    // }
    let count = await locator.count();
    info.log += "total elements found " + count + "\n";
    //let visibleCount = 0;
    let visibleLocator = null;
    if (locatorSearch.index && locatorSearch.index < count) {
      foundLocators.push(locator.nth(locatorSearch.index));
      return;
    }

    for (let j = 0; j < count; j++) {
      let visible = await locator.nth(j).isVisible();
      const enabled = await locator.nth(j).isEnabled();
      info.log += "element " + j + " visible " + visible + " enabled " + enabled + "\n";
      if (!visibleOnly) {
        visible = true;
      }
      if (visible && enabled) {
        foundLocators.push(locator.nth(j));

        // if (cssHref) {
        //   info.log += "css href locator found, will ignore all others" + "\n";
        //   break;
        // }
      }
    }
  }
  async closeUnexpectedPopups(info, _params) {
    if (this.configuration.popupHandlers && this.configuration.popupHandlers.length > 0) {
      if (!info) {
        info = {};
      }
      info.log += "scan for popup handlers" + "\n";
      const handlerGroup = [];
      for (let i = 0; i < this.configuration.popupHandlers.length; i++) {
        handlerGroup.push(this.configuration.popupHandlers[i].locator);
      }
      const scopes = [this.page, ...this.page.frames()];
      let result = null;
      let scope = null;
      for (let i = 0; i < scopes.length; i++) {
        result = await this._scanLocatorsGroup(handlerGroup, scopes[i], _params, info, true);
        if (result.foundElements.length > 0) {
          scope = scopes[i];
          break;
        }
      }
      if (result.foundElements.length > 0) {
        // need to handle popup
        const closeHandlerGroup = [];
        closeHandlerGroup.push(this.configuration.popupHandlers[result.locatorIndex].close_dialog_locator);
        for(let i = 0; i < scopes.length; i++) {
            result = await this._scanLocatorsGroup(closeHandlerGroup, scopes[i], _params, info, true);
            if (result.foundElements.length > 0) {
                break;
            }
        }
        if (result.foundElements.length > 0) {
            let dialogCloseLocator = result.foundElements[0].locator;
            await dialogCloseLocator.click();
            return { rerun: true };
        }
      }
    }
    return { rerun: false };
  }
  async _locate(selectors, info, _params?: Params, timeout = 30000) {
    for (let i = 0; i < 3; i++) {
      info.log += "attempt " + i +  ": totoal locators " + selectors.locators.length + "\n";
      let element = await this._locate_internal(selectors, info, _params, timeout);
      if (!element.rerun) {
        return element;
      }
    }
    throw new Error("unable to locate element " + JSON.stringify(selectors));
  }
  async _locate_internal(selectors, info, _params?: Params, timeout = 30000) {
    let highPriorityTimeout = 5000;
    let visibleOnlyTimeout = 6000;
    let startTime = performance.now();
    let locatorsCount = 0;
    //let arrayMode = Array.isArray(selectors);
    let scope = this.page;
    if (selectors.iframe_src || selectors.frameLocators) {
      info.log += "searching for iframe " + selectors.iframe_src + "/" + selectors.frameLocators +  "\n";
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
          info.log += "unable to locate iframe " + selectors.iframe_src + "\n";
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
    selectorsLocators = selectors.locators;
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
    let visibleOnly = true;
    while (true) {
      locatorsCount = 0;
      let result = [];
      let popupResult = await this.closeUnexpectedPopups(info, _params);
      if (popupResult.rerun) {
        return popupResult;
      }
      // info.log += "scanning locators in priority 1" + "\n";
      let onlyPriority3 = selectorsLocators[0].priority === 3;
      result = await this._scanLocatorsGroup(locatorsByPriority["1"], scope, _params, info, visibleOnly);
      if (result.foundElements.length === 0) {
        // info.log += "scanning locators in priority 2" + "\n";
        result = await this._scanLocatorsGroup(locatorsByPriority["2"], scope, _params, info, visibleOnly);
      }
      let shouldNotTestPriority3 = highPriorityOnly && !onlyPriority3;
      if (result.foundElements.length === 0 && shouldTestPriority3) {
        // info.log += "scanning locators in priority 3" + "\n";
        result = await this._scanLocatorsGroup(locatorsByPriority["3"], scope, _params, info, visibleOnly);
      }
      let foundElements = result.foundElements;

      if (foundElements.length === 1 && foundElements[0].unique) {
        info.box = foundElements[0].box;
        return foundElements[0].locator;
      }
      //info.log += "total elements found " + foundElements.length);
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
      if (performance.now() - startTime > visibleOnlyTimeout) {
        visibleOnly = false;
      }
      await new Promise((resolve) => setTimeout(resolve, 1000));
    }
    this.logger.debug("unable to locate unique element, total elements found " + locatorsCount);
    info.log += "failed to locate unique element, total elements found " + locatorsCount + "\n";

    throw new Error("failed to locate first element no elements found, " + info.log);
  }
  async _scanLocatorsGroup(locatorsGroup, scope, _params, info, visibleOnly) {
    let foundElements = [];
    const result = {
      foundElements: foundElements,
    };
    for (let i = 0; i < locatorsGroup.length; i++) {
      let foundLocators = [];
      try {
        await this._collectLocatorInformation(locatorsGroup, i, scope, foundLocators, _params, info, visibleOnly);
      } catch (e) {
        this.logger.debug("unable to use locator " + JSON.stringify(locatorsGroup[i]));
        this.logger.debug(e);
        foundLocators = [];
        try {
          await this._collectLocatorInformation(locatorsGroup, i, this.page, foundLocators, _params, info, visibleOnly);
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
        result.locatorIndex = i;
      }
    }
    return result;
  }

  async click(selectors, _params?: Params, options = {}, world = null) {
    this._validateSelectors(selectors);
    const startTime = Date.now();
    const info = {};
    info.log = "***** click on " + selectors.element_name + " *****\n";
    info.operation = "click";
    info.selectors = selectors;
    let error = null;
    let screenshotId = null;
    let screenshotPath = null;
    try {
      let element = await this._locate(selectors, info, _params);
      await this.scrollIfNeeded(element, info);
      ({ screenshotId, screenshotPath } = await this._screenShot(options, world, info));
      try {
        await this._highlightElements(element);
        await element.click({ timeout: 5000 });
        await new Promise((resolve) => setTimeout(resolve, 1000));
      } catch (e) {
        // await this.closeUnexpectedPopups();
        info.log += "click failed, will try again" + "\n";
        element = await this._locate(selectors, info, _params);
        await element.click({ timeout: 10000, force: true });
        await new Promise((resolve) => setTimeout(resolve, 1000));
      }
      await this.waitForPageLoad();
      return info;
    } catch (e) {
      this.logger.error("click failed " + info.log);
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
        info: info,
      });
    }
  }
  async setCheck(selectors, checked = true, _params?: Params, options = {}, world = null) {
    this._validateSelectors(selectors);
    const startTime = Date.now();
    const info = {};
    info.log = "";
    info.operation = "setCheck";
    info.checked = checked;
    info.selectors = selectors;
    let error = null;
    let screenshotId = null;
    let screenshotPath = null;
    try {
      let element = await this._locate(selectors, info, _params);

      ({ screenshotId, screenshotPath } = await this._screenShot(options, world, info));
      try {
        await this._highlightElements(element);
        await element.setChecked(checked, { timeout: 5000 });
        await new Promise((resolve) => setTimeout(resolve, 1000));
      } catch (e) {
        if (e.message && e.message.includes("did not change its state")) {
          this.logger.info("element did not change its state, ignoring...");
        } else {
          //await this.closeUnexpectedPopups();
          info.log += "setCheck failed, will try again" + "\n";
          element = await this._locate(selectors, info, _params);
          await element.setChecked(checked, { timeout: 5000, force: true });
          await new Promise((resolve) => setTimeout(resolve, 1000));
        }
      }
      await this.waitForPageLoad();
      return info;
    } catch (e) {
      this.logger.error("setCheck failed " + info.log);
      ({ screenshotId, screenshotPath } = await this._screenShot(options, world, info));
      info.screenshotPath = screenshotPath;
      Object.assign(e, { info: info });
      error = e;
      throw e;
    } finally {
      const endTime = Date.now();
      this._reportToWorld(world, {
        element_name: selectors.element_name,
        type: checked ? Types.CHECK : Types.UNCHECK,
        text: checked ? `Check element` : `Uncheck element`,
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
        info: info,
      });
    }
  }

  async hover(selectors, _params?: Params, options = {}, world = null) {
    this._validateSelectors(selectors);
    const startTime = Date.now();
    const info = {};
    info.log = "";
    info.operation = "hover";
    info.selectors = selectors;
    let error = null;
    let screenshotId = null;
    let screenshotPath = null;
    try {
      let element = await this._locate(selectors, info, _params);

      ({ screenshotId, screenshotPath } = await this._screenShot(options, world, info));
      try {
        await this._highlightElements(element);
        await element.hover({ timeout: 10000 });
        await new Promise((resolve) => setTimeout(resolve, 1000));
      } catch (e) {
        //await this.closeUnexpectedPopups();
        info.log += "hover failed, will try again" + "\n";
        element = await this._locate(selectors, info, _params);
        await element.hover({ timeout: 10000 });
        await new Promise((resolve) => setTimeout(resolve, 1000));
      }
      await this.waitForPageLoad();
      return info;
    } catch (e) {
      this.logger.error("hover failed " + info.log);
      ({ screenshotId, screenshotPath } = await this._screenShot(options, world, info));
      info.screenshotPath = screenshotPath;
      Object.assign(e, { info: info });
      error = e;
      throw e;
    } finally {
      const endTime = Date.now();
      this._reportToWorld(world, {
        element_name: selectors.element_name,
        type: Types.HOVER,
        text: `Hover element`,
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
        info: info,
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
    info.log = "";
    info.operation = "selectOptions";
    info.selectors = selectors;

    try {
      let element = await this._locate(selectors, info, _params);

      ({ screenshotId, screenshotPath } = await this._screenShot(options, world, info));
      try {
        await this._highlightElements(element);
        await element.selectOption(values, { timeout: 5000 });
      } catch (e) {
        //await this.closeUnexpectedPopups();
        info.log += "selectOption failed, will try force" + "\n";
        await element.selectOption(values, { timeout: 10000, force: true });
      }
      await this.waitForPageLoad();
      return info;
    } catch (e) {
      this.logger.error("selectOption failed " + info.log);
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
        info: info,
      });
    }
  }
  async type(_value, _params = null, options = {}, world = null) {
    const startTime = Date.now();
    let error = null;
    let screenshotId = null;
    let screenshotPath = null;

    const info = {};
    info.log = "";
    info.operation = "type";
    _value = this._fixUsingParams(_value, _params);
    info.value = _value;
    try {
      ({ screenshotId, screenshotPath } = await this._screenShot(options, world, info));
      const valueSegment = _value.split("&&");
      for (let i = 0; i < valueSegment.length; i++) {
        if (i > 0) {
          await new Promise((resolve) => setTimeout(resolve, 1000));
        }
        let value = valueSegment[i];
        value = await this._replaceWithLocalData(value, this);
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
      }
      return info;
    } catch (e) {
      //await this.closeUnexpectedPopups();
      this.logger.error("type failed " + info.log);
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
        value: _value,
        text: `type value: ${_value}`,
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
        info: info,
      });
    }
  }
  async setDateTime(selectors, value, format = null, enter = false, _params = null, options = {}, world = null) {
    this._validateSelectors(selectors);
    const startTime = Date.now();
    let error = null;
    let screenshotId = null;
    let screenshotPath = null;
    const info = {};
    info.log = "";
    info.operation = Types.SET_DATE_TIME;
    info.selectors = selectors;
    info.value = value;
    try {
      value = await this._replaceWithLocalData(value, this);
      let element = await this._locate(selectors, info, _params);
      //insert red border around the element
      await this.scrollIfNeeded(element, info);
      ({ screenshotId, screenshotPath } = await this._screenShot(options, world, info));
      await this._highlightElements(element);

      try {
        await element.click();
        await new Promise((resolve) => setTimeout(resolve, 500));
        if (format) {
          value = dayjs(value).format(format);
          await element.fill(value);
        } else {
          const dateTimeValue = await getDateTimeValue({ value, element });
          await element.evaluateHandle((el, dateTimeValue) => {
            el.value = ""; // clear input
            el.value = dateTimeValue;
          }, dateTimeValue);
        }
        if (enter) {
          await new Promise((resolve) => setTimeout(resolve, 2000));
          await this.page.keyboard.press("Enter");
          await this.waitForPageLoad();
        }
      } catch (error) {
        //await this.closeUnexpectedPopups();
        this.logger.error("setting date time input failed " + JSON.stringify(info));
        this.logger.info("Trying again")(
          ({ screenshotId, screenshotPath } = await this._screenShot(options, world, info))
        );
        info.screenshotPath = screenshotPath;
        Object.assign(error, { info: info });
        await element.click();
        await new Promise((resolve) => setTimeout(resolve, 500));
        if (format) {
          value = dayjs(value).format(format);
          await element.fill(value);
        } else {
          const dateTimeValue = await getDateTimeValue({ value, element });
          await element.evaluateHandle((el, dateTimeValue) => {
            el.value = ""; // clear input
            el.value = dateTimeValue;
          }, dateTimeValue);
        }
        if (enter) {
          await new Promise((resolve) => setTimeout(resolve, 2000));
          await this.page.keyboard.press("Enter");
          await this.waitForPageLoad();
        }
      }
    } catch (error) {
      error = e;
      throw e;
    } finally {
      const endTime = Date.now();
      this._reportToWorld(world, {
        element_name: selectors.element_name,
        type: Types.SET_DATE_TIME,
        screenshotId,
        value: value,
        text: `setDateTime input with value: ${value}`,
        result: error
          ? {
              status: "FAILED",
              startTime,
              endTime,
              message: error === null || error === void 0 ? void 0 : error.message,
            }
          : {
              status: "PASSED",
              startTime,
              endTime,
            },
        info: info,
      });
    }
  }
  async setDateTime(selectors, value, enter = false, _params = null, options = {}, world = null) {
    this._validateSelectors(selectors);
    const startTime = Date.now();
    let error = null;
    let screenshotId = null;
    let screenshotPath = null;
    const info = {};
    info.log = "";
    info.operation = Types.SET_DATE_TIME;
    info.selectors = selectors;
    info.value = value;
    try {
      let element = await this._locate(selectors, info, _params);
      //insert red border around the element
      await this.scrollIfNeeded(element, info);
      ({ screenshotId, screenshotPath } = await this._screenShot(options, world, info));
      await this._highlightElements(element);

      try {
        await element.click();
        await new Promise((resolve) => setTimeout(resolve, 500));
        const dateTimeValue = await getDateTimeValue({ value, element });
        await element.evaluateHandle((el, dateTimeValue) => {
          el.value = ""; // clear input
          el.value = dateTimeValue;
        }, dateTimeValue);
      } catch (error) {
        //await this.closeUnexpectedPopups();
        this.logger.error("setting date time input failed " + JSON.stringify(info));
        this.logger.info("Trying again")(
          ({ screenshotId, screenshotPath } = await this._screenShot(options, world, info))
        );
        info.screenshotPath = screenshotPath;
        Object.assign(error, { info: info });
        await element.click();
        await new Promise((resolve) => setTimeout(resolve, 500));
        const dateTimeValue = await getDateTimeValue({ value, element });
        await element.evaluateHandle((el, dateTimeValue) => {
          el.value = ""; // clear input
          el.value = dateTimeValue;
        }, dateTimeValue);
      }
    } catch (error) {
      error = e;
      throw e;
    } finally {
      const endTime = Date.now();
      this._reportToWorld(world, {
        element_name: selectors.element_name,
        type: Types.SET_DATE_TIME,
        screenshotId,
        value: value,
        text: `setDateTime input with value: ${value}`,
        result: error
          ? {
              status: "FAILED",
              startTime,
              endTime,
              message: error === null || error === void 0 ? void 0 : error.message,
            }
          : {
              status: "PASSED",
              startTime,
              endTime,
            },
        info: info,
      });
    }
  }
  async clickType(selectors, _value, enter = false, _params = null, options = {}, world = null) {
    this._validateSelectors(selectors);
    const startTime = Date.now();
    let error = null;
    let screenshotId = null;
    let screenshotPath = null;
    const info = {};
    info.log = "***** clickType on " + selectors.element_name + " with value " + _value + "*****\n";
    info.operation = "clickType";
    info.selectors = selectors;
    const newValue = await this._replaceWithLocalData(_value, world);
    if (newValue !== _value) {
      //this.logger.info(_value + "=" + newValue);
      _value = newValue;
    }
    info.value = _value;
    try {
      let element = await this._locate(selectors, info, _params);
      //insert red border around the element
      await this.scrollIfNeeded(element, info);
      ({ screenshotId, screenshotPath } = await this._screenShot(options, world, info));
      await this._highlightElements(element);
      try {
        let currentValue = await element.inputValue();
        if (currentValue) {
          await element.fill("");
        }
      } catch (e) {
        this.logger.info("unable to clear input value");
      }
      try {
        await element.click({ timeout: 5000 });
      } catch (e) {
        await element.dispatchEvent("click");
      }
      await new Promise((resolve) => setTimeout(resolve, 500));
      const valueSegment = _value.split("&&");
      for (let i = 0; i < valueSegment.length; i++) {
        if (i > 0) {
          await new Promise((resolve) => setTimeout(resolve, 1000));
        }
        let value = valueSegment[i];
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
          await new Promise((resolve) => setTimeout(resolve, 500));
        }
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
      //await this.closeUnexpectedPopups();
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
        value: _value,
        text: `clickType input with value: ${_value}`,
        result: error
          ? {
              status: "FAILED",
              startTime,
              endTime,
              message: error === null || error === void 0 ? void 0 : error.message,
            }
          : {
              status: "PASSED",
              startTime,
              endTime,
            },
        info: info,
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
    info.log = "***** fill on " + selectors.element_name + " with value " + value + "*****\n";
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
      //await this.closeUnexpectedPopups();
      this.logger.error("fill failed " + info.log);
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
        info: info,
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
      info.log = "";
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
    let value = null;
    try {
      value = await element.inputValue();
    } catch (e) {
      //ignore
    }
    ({ screenshotId, screenshotPath } = await this._screenShot(options, world, info));
    try {
      await this._highlightElements(element);
      const elementText = await element.innerText();
      return {
        text: elementText,
        screenshotId,
        screenshotPath,
        value: value,
        element: element,
      };
    } catch (e) {
      //await this.closeUnexpectedPopups();
      this.logger.info("no innerText will use textContent");
      const elementText = await element.textContent();
      return { text: elementText, screenshotId, screenshotPath, value: value };
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
    const newValue = await this._replaceWithLocalData(text, world);
    if (newValue !== text) {
      this.logger.info(text + "=" + newValue);
      text = newValue;
    }
    const startTime = Date.now();
    let error = null;
    let screenshotId = null;
    let screenshotPath = null;
    const info = {};
    info.log = "***** verify element " + selectors.element_name + " contains pattern  " + pattern + "/" + text +" *****\n";
    info.operation = "containsPattern";
    info.selectors = selectors;
    info.value = text;
    info.pattern = pattern;
    let foundObj = null;
    try {
      foundObj = await this._getText(selectors, 0, _params, options, info, world);
      if (foundObj && foundObj.element) {
        await this.scrollIfNeeded(foundObj.element, info);
      }
      ({ screenshotId, screenshotPath } = await this._screenShot(options, world, info));
      let escapedText = text.replace(/[-[\]{}()*+?.,\\^$|#\s]/g, "\\$&");
      pattern = pattern.replace("{text}", escapedText);
      let regex = new RegExp(pattern, "im");
      if (!regex.test(foundObj?.text) && !foundObj?.value?.includes(text)) {
        info.foundText = foundObj?.text;
        throw new Error("element doesn't contain text " + text);
      }
      return info;
    } catch (e) {
      //await this.closeUnexpectedPopups();
      this.logger.error("verify element contains text failed " + info.log);
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
        info: info,
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
    info.log = "***** verify element " + selectors.element_name + " contains text " + text + " *****\n";
    info.operation = "containsText";
    info.selectors = selectors;
    const newValue = await this._replaceWithLocalData(text, world);
    if (newValue !== text) {
      this.logger.info(text + "=" + newValue);
      text = newValue;
    }
    info.value = text;
    let foundObj = null;
    try {
      foundObj = await this._getText(selectors, climb, _params, options, info, world);
      if (foundObj && foundObj.element) {
        await this.scrollIfNeeded(foundObj.element, info);
      }
      ({ screenshotId, screenshotPath } = await this._screenShot(options, world, info));
      const dateAlternatives = findDateAlternatives(text);
      const numberAlternatives = findNumberAlternatives(text);
      if (dateAlternatives.date) {
        for (let i = 0; i < dateAlternatives.dates.length; i++) {
          if (
            foundObj?.text.includes(dateAlternatives.dates[i]) ||
            foundObj?.value?.includes(dateAlternatives.dates[i])
          ) {
            return info;
          }
        }
        throw new Error("element doesn't contain text " + text);
      } else if (numberAlternatives.number) {
        for (let i = 0; i < numberAlternatives.numbers.length; i++) {
          if (
            foundObj?.text.includes(numberAlternatives.numbers[i]) ||
            foundObj?.value?.includes(numberAlternatives.numbers[i])
          ) {
            return info;
          }
        }
        throw new Error("element doesn't contain text " + text);
      } else if (!foundObj?.text.includes(text) && !foundObj?.value?.includes(text)) {
        info.foundText = foundObj?.text;
        info.value = foundObj?.value;
        throw new Error("element doesn't contain text " + text);
      }
      return info;
    } catch (e) {
      //await this.closeUnexpectedPopups();
      this.logger.error("verify element contains text failed " + info.log);
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
        info: info,
      });
    }
  }
  _getDataFile(world = null) {
    let dataFile = null;
    if (world && world.reportFolder) {
      dataFile = path.join(world.reportFolder, "data.json");
    } else if (this.reportFolder) {
      dataFile = path.join(this.reportFolder, "data.json");
    } else if (this.context && this.context.reportFolder) {
      dataFile = path.join(this.context.reportFolder, "data.json");
    } else {
      dataFile = "data.json";
    }
    return dataFile;
  }
  setTestData(testData, world = null) {
    if (!testData) {
      return;
    }
    // if data file exists, load it
    const dataFile = this._getDataFile(world);
    let data = this.getTestData(world);
    // merge the testData with the existing data
    Object.assign(data, testData);
    // save the data to the file
    fs.writeFileSync(dataFile, JSON.stringify(data, null, 2));
  }
  loadTestData(type: string, dataSelector: string, world = null) {
    switch (type) {
      case "users":
        // check if file users.json exists
        if (!fs.existsSync(path.join(this.project_path, "users.json"))) {
          throw new Error("users.json file not found");
        }
        // read the file and return the data
        const users = JSON.parse(fs.readFileSync(path.join(this.project_path, "users.json"), "utf8"));
        for (let i = 0; i < users.length; i++) {
          if (users[i].username === dataSelector) {
            const userObj = {
              username: users[i].username,
              password: "secret:" + users[i].password,
              totp: users[i].secretKey ? "totp:" + users[i].secretKey : null,
            };
            this.setTestData(userObj, world);
            return userObj;
          }
        }
        throw new Error("user not found " + dataSelector);
      default:
        throw new Error("unknown type " + type);
    }
  }

  getTestData(world = null) {
    const dataFile = this._getDataFile(world);
    let data = {};
    if (fs.existsSync(dataFile)) {
      data = JSON.parse(fs.readFileSync(dataFile, "utf8"));
    }
    return data;
  }

  async _screenShot(options = {}, world = null, info = null) {
    // collect url/path/title
    if (info) {
      if (!info.title) {
        try {
          info.title = await this.page.title();
        } catch (e) {
          // ignore
        }
      }
      if (!info.url) {
        try {
          info.url = this.page.url();
        } catch (e) {
          // ignore
        }
      }
    }
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
      try {
        await this.takeScreenshot(screenshotPath);
        // let buffer = await this.page.screenshot({ timeout: 4000 });
        // // save the buffer to the screenshot path asynchrously
        // fs.writeFile(screenshotPath, buffer, (err) => {
        //   if (err) {
        //     this.logger.info("unable to save screenshot " + screenshotPath);
        //   }
        // });
      } catch (e) {
        this.logger.info("unable to take screenshot, ignored");
      }
      result.screenshotId = nextIndex;
      result.screenshotPath = screenshotPath;
      if (info && info.box) {
        await drawRectangle(screenshotPath, info.box.x, info.box.y, info.box.width, info.box.height);
      }
    } else if (options && options.screenshot) {
      result.screenshotPath = options.screenshotPath;
      try {
        await this.takeScreenshot(options.screenshotPath);
        // let buffer = await this.page.screenshot({ timeout: 4000 });
        // // save the buffer to the screenshot path asynchrously
        // fs.writeFile(options.screenshotPath, buffer, (err) => {
        //   if (err) {
        //     this.logger.info("unable to save screenshot " + options.screenshotPath);
        //   }
        // });
      } catch (e) {
        this.logger.info("unable to take screenshot, ignored");
      }
      if (info && info.box) {
        await drawRectangle(options.screenshotPath, info.box.x, info.box.y, info.box.width, info.box.height);
      }
    }
    return result;
  }
  async takeScreenshot(screenshotPath) {
    const playContext = this.context.playContext;
    const client = await playContext.newCDPSession(this.page);
    // Using CDP to capture the screenshot
    const viewportWidth = Math.max(
      ...(await this.page.evaluate(() => [
        document.body.scrollWidth,
        document.documentElement.scrollWidth,
        document.body.offsetWidth,
        document.documentElement.offsetWidth,
        document.body.clientWidth,
        document.documentElement.clientWidth,
      ]))
    );
    const viewportHeight = Math.max(
      ...(await this.page.evaluate(() => [
        document.body.scrollHeight,
        document.documentElement.scrollHeight,
        document.body.offsetHeight,
        document.documentElement.offsetHeight,
        document.body.clientHeight,
        document.documentElement.clientHeight,
      ]))
    );
    const { data } = await client.send("Page.captureScreenshot", {
      format: "png",
      clip: {
        x: 0,
        y: 0,
        width: viewportWidth,
        height: viewportHeight,
        scale: 1,
      },
    });
    if (!screenshotPath) {
      return data;
    }
    let screenshotBuffer = Buffer.from(data, "base64");

    const sharpBuffer = sharp(screenshotBuffer);
    const metadata = await sharpBuffer.metadata();
    //check if you are on retina display and reduce the quality of the image
    if (metadata.width > viewportWidth || metadata.height > viewportHeight) {
      screenshotBuffer = await sharpBuffer
        .resize(viewportWidth, viewportHeight, {
          fit: sharp.fit.inside,
          withoutEnlargement: true,
        })
        .toBuffer();
    }
    fs.writeFileSync(screenshotPath, screenshotBuffer);
    await client.detach();
  }
  async verifyElementExistInPage(selectors, _params = null, options = {}, world = null) {
    this._validateSelectors(selectors);
    const startTime = Date.now();
    let error = null;
    let screenshotId = null;
    let screenshotPath = null;
    await new Promise((resolve) => setTimeout(resolve, 2000));
    const info = {};
    info.log = "***** verify element " + selectors.element_name + " exists in page *****\n";
    info.operation = "verify";
    info.selectors = selectors;
    try {
      const element = await this._locate(selectors, info, _params);
      if (element) {
        await this.scrollIfNeeded(element, info);
      }
      await this._highlightElements(element);
      ({ screenshotId, screenshotPath } = await this._screenShot(options, world, info));
      await expect(element).toHaveCount(1, { timeout: 10000 });
      return info;
    } catch (e) {
      //await this.closeUnexpectedPopups();
      this.logger.error("verify failed " + info.log);
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
        info: info,
      });
    }
  }
  async extractAttribute(selectors, attribute, variable, _params = null, options = {}, world = null) {
    this._validateSelectors(selectors);
    const startTime = Date.now();
    let error = null;
    let screenshotId = null;
    let screenshotPath = null;
    await new Promise((resolve) => setTimeout(resolve, 2000));
    const info = {};
    info.log = "***** extract attribute " + attribute + " from " + selectors.element_name + " *****\n";
    info.operation = "extract";
    info.selectors = selectors;
    try {
      const element = await this._locate(selectors, info, _params);
      await this._highlightElements(element);
      ({ screenshotId, screenshotPath } = await this._screenShot(options, world, info));
      switch (attribute) {
        case "inner_text":
          info.value = await element.innerText();
          break;
        case "href":
          info.value = await element.getAttribute("href");
          break;
        case "value":
          info.value = await element.inputValue();
          break;
        default:
          info.value = await element.getAttribute(attribute);
          break;
      }
      this[variable] = info.value;
      if (world) {
        world[variable] = info.value;
      }
      this.logger.info("world." + variable + "=" + info.value);
      return info;
    } catch (e) {
      //await this.closeUnexpectedPopups();
      this.logger.error("extract failed " + info.log);
      ({ screenshotId, screenshotPath } = await this._screenShot(options, world, info));
      info.screenshotPath = screenshotPath;
      Object.assign(e, { info: info });
      error = e;
      throw e;
    } finally {
      const endTime = Date.now();
      this._reportToWorld(world, {
        element_name: selectors.element_name,
        type: Types.EXTRACT_ATTRIBUTE,
        variable: variable,
        value: info.value,
        text: "Extract attribute from element",
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
        info: info,
      });
    }
  }

  async _highlightElements(scope, css) {
    try {
      if (!scope) {
        return;
      }
      if (!css) {
        scope
          .evaluate((node) => {
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
          })
          .then(() => {})
          .catch((e) => {
            // ignore
          });
      } else {
        scope
          .evaluate(
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
          )
          .then(() => {})
          .catch((e) => {
            // ignore
          });
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
    info.log = "***** verify page path " + pathPart + " *****\n";
    info.operation = "verifyPagePath";

    const newValue = await this._replaceWithLocalData(pathPart, world);
    if (newValue !== pathPart) {
      this.logger.info(pathPart + "=" + newValue);
      pathPart = newValue;
    }
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
        ({ screenshotId, screenshotPath } = await this._screenShot(options, world, info));
        return info;
      }
    } catch (e) {
      //await this.closeUnexpectedPopups();
      this.logger.error("verify page path failed " + info.log);
      ({ screenshotId, screenshotPath } = await this._screenShot(options, world, info));
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
        info: info,
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
    info.log = "***** verify text " + text + " exists in page *****\n";
    info.operation = "verifyTextExistInPage";

    const newValue = await this._replaceWithLocalData(text, world);
    if (newValue !== text) {
      this.logger.info(text + "=" + newValue);
      text = newValue;
    }

    info.text = text;
    let dateAlternatives = findDateAlternatives(text);
    let numberAlternatives = findNumberAlternatives(text);
    try {
      while (true) {
        const frames = this.page.frames();
        let results = [];
        for (let i = 0; i < frames.length; i++) {
          if (dateAlternatives.date) {
            for (let j = 0; j < dateAlternatives.dates.length; j++) {
              const result = await this._locateElementByText(frames[i], dateAlternatives.dates[j], "*", true, {});
              result.frame = frames[i];
              results.push(result);
            }
          } else if (numberAlternatives.number) {
            for (let j = 0; j < numberAlternatives.numbers.length; j++) {
              const result = await this._locateElementByText(frames[i], numberAlternatives.numbers[j], "*", true, {});
              result.frame = frames[i];
              results.push(result);
            }
          } else {
            const result = await this._locateElementByText(frames[i], text, "*", true, {});
            result.frame = frames[i];
            results.push(result);
          }
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
          const frame = resultWithElementsFound[0].frame;
          const dataAttribute = `[data-blinq-id="blinq-id-${resultWithElementsFound[0].randomToken}"]`;
          await this._highlightElements(frame, dataAttribute);
          const element = await frame.$(dataAttribute);
          await this.scrollIfNeeded(element, info);
          await element.dispatchEvent("bvt_verify_page_contains_text");
        }
        ({ screenshotId, screenshotPath } = await this._screenShot(options, world, info));
        return info;
      }

      // await expect(element).toHaveCount(1, { timeout: 10000 });
    } catch (e) {
      //await this.closeUnexpectedPopups();
      this.logger.error("verify text exist in page failed " + info.log);
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
        info: info,
      });
    }
  }
  async visualVerification(text, options = {}, world = null) {
    const startTime = Date.now();
    let error = null;
    let screenshotId = null;
    let screenshotPath = null;
    await new Promise((resolve) => setTimeout(resolve, 2000));
    const info = {};
    info.log = "";
    info.operation = "visualVerification";
    info.text = text;
    if (!process.env.TOKEN) {
      throw new Error("TOKEN is not set");
    }
    try {
      let serviceUrl = "https://api.blinq.io";
      if (process.env.NODE_ENV_BLINQ === "dev") {
        serviceUrl = "https://dev.api.blinq.io";
      } else if (process.env.NODE_ENV_BLINQ === "stage") {
        serviceUrl = "https://stage.api.blinq.io";
      }
      ({ screenshotId, screenshotPath } = await this._screenShot(options, world, info));
      info.screenshotPath = screenshotPath;
      const screenshot = await this.takeScreenshot();
      const request = {
        method: "POST",
        url: `${serviceUrl}/api/runs/screenshots/validate-screenshot`,
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${process.env.TOKEN}`,
        },
        data: JSON.stringify({
          validationText: text,
          screenshot: screenshot,
        }),
      };
      let result = await this.context.api.request(request);
      if (result.data.status !== true) {
        throw new Error("Visual validation failed");
      }
      info.reasoning = result.data.result.reasoning;
      if (result.data.result.success === true) {
        return info;
      } else {
        throw Error("Visual validation failed: " + info.reasoning);
      }
      console.log(result);
    } catch (e) {
      //await this.closeUnexpectedPopups();
      this.logger.error("visual verification failed " + info.log);
      ({ screenshotId, screenshotPath } = await this._screenShot(options, world, info));
      info.screenshotPath = screenshotPath;
      Object.assign(e, { info: info });
      error = e;
      throw e;
    } finally {
      const endTime = Date.now();
      this._reportToWorld(world, {
        type: Types.VERIFY_VISUAL,
        text: "Visual verification",
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
        info: info,
      });
    }
  }
  async verifyTableData(selectors, data, _params = null, options = {}, world = null) {
    const tableData = await this.getTableData(selectors, _params, options, world);

    for (let i = 0; i < data.length; i++) {
      const row = data[i];
      const rowText = JSON.stringify(row);
      let found = false;
      for (let j = 0; j < tableData.rows.length; j++) {
        const tableRow = tableData.rows[j];
        const tableRowText = JSON.stringify(tableRow);
        if (tableRowText === rowText) {
          found = true;
          break;
        }
      }
      if (!found) {
        throw new Error(`Row not found in table: ${rowText}`);
      }
    }
    this.logger.info("Table data verified");
  }
  async getTableData(selectors, _params = null, options = {}, world = null) {
    this._validateSelectors(selectors);
    const startTime = Date.now();
    let error = null;
    let screenshotId = null;
    let screenshotPath = null;
    const info = {};
    info.log = "";
    info.operation = "getTableData";
    info.selectors = selectors;
    try {
      let table = await this._locate(selectors, info, _params);
      ({ screenshotId, screenshotPath } = await this._screenShot(options, world, info));
      const tableData = await getTableData(this.page, table);
      return tableData;
    } catch (e) {
      this.logger.error("getTableData failed " + info.log);
      this.logger.error(e);
      ({ screenshotId, screenshotPath } = await this._screenShot(options, world, info));
      info.screenshotPath = screenshotPath;
      Object.assign(e, { info: info });
      error = e;
      throw e;
    } finally {
      const endTime = Date.now();
      this._reportToWorld(world, {
        element_name: selectors.element_name,
        type: Types.GET_TABLE_DATA,
        text: "Get table data",
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
        info: info,
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
    const newValue = await this._replaceWithLocalData(value, world);
    if (newValue !== value) {
      this.logger.info(value + "=" + newValue);
      value = newValue;
    }
    const startTime = Date.now();
    let error = null;
    let screenshotId = null;
    let screenshotPath = null;
    const info = {};
    info.log = "***** analyze table " + selectors.element_name + " query " + query + " operator " + operator + " value " + value + " *****\n";
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
      this.logger.error("analyzeTable failed " + info.log);
      this.logger.error(e);
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
        info: info,
      });
    }
  }
  async _replaceWithLocalData(value, world, _decrypt = true, totpWait = true) {
    if (!value) {
      return value;
    }

    // find all the accurance of {{(.*?)}} and replace with the value
    let regex = /{{(.*?)}}/g;
    let matches = value.match(regex);
    if (matches) {
      const testData = this.getTestData(world);

      for (let i = 0; i < matches.length; i++) {
        let match = matches[i];
        let key = match.substring(2, match.length - 2);

        let newValue = objectPath.get(testData, key, null);

        if (newValue !== null) {
          value = value.replace(match, newValue);
        }
      }
    }
    if ((value.startsWith("secret:") || value.startsWith("totp:")) && _decrypt) {
      return await decrypt(value, null, totpWait);
    }
    return value;
  }
  _getLoadTimeout(options) {
    let timeout = 15000;
    if (this.configuration.page_timeout) {
      timeout = this.configuration.page_timeout;
    }
    if (options && options.page_timeout) {
      timeout = options.page_timeout;
    }
    return timeout;
  }
  async waitForPageLoad(options = {}, world = null) {
    let timeout = this._getLoadTimeout(options);
    const promiseArray = [];
    // let waitForNetworkIdle = true;
    if (!(this.configuration && this.configuration.networkidle === false)) {
      promiseArray.push(
        createTimedPromise(this.page.waitForLoadState("networkidle", { timeout: timeout }), "networkidle")
      );
    }

    if (!(this.configuration && this.configuration.load === false)) {
      promiseArray.push(createTimedPromise(this.page.waitForLoadState("load", { timeout: timeout }), "load"));
    }

    if (!(this.configuration && this.configuration.domcontentloaded === false)) {
      promiseArray.push(
        createTimedPromise(this.page.waitForLoadState("domcontentloaded", { timeout: timeout }), "domcontentloaded")
      );
    }
    const waitOptions = {
      timeout: timeout,
    };
    const startTime = Date.now();
    let error = null;
    let screenshotId = null;
    let screenshotPath = null;

    try {
      await Promise.all(promiseArray);
    } catch (e) {
      if (e.label === "networkidle") {
        console.log("waitted for the network to be idle timeout");
      } else if (e.label === "load") {
        console.log("waitted for the load timeout");
      } else if (e.label === "domcontentloaded") {
        console.log("waitted for the domcontent loaded timeout");
      }
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
  async closePage(options = {}, world = null) {
    const startTime = Date.now();
    let error = null;
    let screenshotId = null;
    let screenshotPath = null;
    const info = {};
    try {
      await this.page.close();
      if (this.context && this.context.pages && this.context.pages.length > 0) {
        this.context.pages.pop();
        this.page = this.context.pages[this.context.pages.length - 1];
        this.context.page = this.page;
        let title = await this.page.title();
        console.log("Switched to page " + title);
      }
    } catch (e) {
      console.log(".");
    } finally {
      await new Promise((resolve) => setTimeout(resolve, 2000));
      ({ screenshotId, screenshotPath } = await this._screenShot(options, world));
      const endTime = Date.now();
      this._reportToWorld(world, {
        type: Types.CLOSE_PAGE,
        text: "close page",
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
        info: info,
      });
    }
  }
  async setViewportSize(width: number, hight: number, options = {}, world = null) {
    const startTime = Date.now();
    let error = null;
    let screenshotId = null;
    let screenshotPath = null;
    const info = {};
    try {
      if (width <= 0) {
        width = 1920;
      }
      if (hight <= 0) {
        hight = 1080;
      }
      await this.page.setViewportSize({ width: width, height: hight });
    } catch (e) {
      console.log(".");
    } finally {
      await new Promise((resolve) => setTimeout(resolve, 2000));
      ({ screenshotId, screenshotPath } = await this._screenShot(options, world));
      const endTime = Date.now();
      this._reportToWorld(world, {
        type: Types.SET_VIEWPORT,
        text: "set viewport size to " + width + "x" + hight,
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
        info: info,
      });
    }
  }
  async reloadPage(options = {}, world = null) {
    const startTime = Date.now();
    let error = null;
    let screenshotId = null;
    let screenshotPath = null;
    const info = {};

    try {
      await this.page.reload();
    } catch (e) {
      console.log(".");
    } finally {
      await new Promise((resolve) => setTimeout(resolve, 2000));
      ({ screenshotId, screenshotPath } = await this._screenShot(options, world, info));
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
        info: info,
      });
    }
  }
  async scrollIfNeeded(element, info) {
    try {
      let didScroll = await element.evaluate((node) => {
        const rect = node.getBoundingClientRect();
        if (
          rect &&
          rect.top >= 0 &&
          rect.left >= 0 &&
          rect.bottom <= (window.innerHeight || document.documentElement.clientHeight) &&
          rect.right <= (window.innerWidth || document.documentElement.clientWidth)
        ) {
          return false;
        } else {
          node.scrollIntoView({
            behavior: "smooth",
            block: "center",
            inline: "center",
          });
          return true;
        }
      });
      if (didScroll) {
        await new Promise((resolve) => setTimeout(resolve, 500));
        if (info) {
          info.box = await element.boundingBox();
        }
      }
    } catch (e) {
      console.log("scroll failed");
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
function createTimedPromise(promise, label) {
  return promise
    .then((result) => ({ status: "fulfilled", label, result }))
    .catch((error) => Promise.reject({ status: "rejected", label, error }));
}
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
