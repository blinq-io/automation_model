// @ts-nocheck
import { expect } from "@playwright/test";
import dayjs from "dayjs";
import fs from "fs";
import { Jimp } from "jimp";
import path from "path";
import type { Browser, Page } from "playwright";
import reg_parser from "regex-parser";
import { findDateAlternatives, findNumberAlternatives } from "./analyze_helper.js";
import { getDateTimeValue } from "./date_time.js";
import drawRectangle from "./drawRect.js";
//import { closeUnexpectedPopups } from "./popups.js";
import { getTableCells, getTableData } from "./table_analyze.js";
import objectPath from "object-path";
import { decrypt, maskValue, replaceWithLocalTestData } from "./utils.js";
import csv from "csv-parser";
import { Readable } from "node:stream";
import readline from "readline";
import { getContext } from "./init_browser.js";
import { navigate } from "./auto_page.js";
import { locate_element } from "./locate_element.js";
import { randomUUID } from "crypto";
import {
  _commandError,
  _commandFinally,
  _preCommand,
  _validateSelectors,
  _screenshot,
  _reportToWorld,
} from "./command_common.js";
import { register } from "module";
import { registerDownloadEvent, registerNetworkEvents } from "./network.js";
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
  PRESS: "press_key",
  HOVER: "hover_element",
  CHECK: "check_element",
  UNCHECK: "uncheck_element",
  EXTRACT: "extract_attribute",
  CLOSE_PAGE: "close_page",
  SET_DATE_TIME: "set_date_time",
  SET_VIEWPORT: "set_viewport",
  VERIFY_VISUAL: "verify_visual",
  LOAD_DATA: "load_data",
  SET_INPUT: "set_input",
  WAIT_FOR_TEXT_TO_DISAPPEAR: "wait_for_text_to_disappear",
};
export const apps = {};
class StableBrowser {
  project_path = null;
  webLogFile = null;
  networkLogger = null;
  configuration = null;
  appName = "main";
  tags = null;
  isRecording = false;
  constructor(
    public browser: Browser,
    public page: Page,
    public logger: any = null,
    public context: any = null,
    public world?: any = null
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

    context.pageLoading = { status: false };
    context.pages = [this.page];
    const logFolder = path.join(this.project_path, "logs", "web");
    this.world = world;

    this.registerEventListeners(this.context);
    registerNetworkEvents(this.world, this, this.context, this.page);
    registerDownloadEvent(this.page, this.world, this.context);
  }
  async scrollPageToLoadLazyElements() {
    let lastHeight = await this.page.evaluate(() => document.body.scrollHeight);
    let retry = 0;
    while (true) {
      await this.page.evaluate(() => window.scrollBy(0, window.innerHeight));
      await new Promise((resolve) => setTimeout(resolve, 1000));
      let newHeight = await this.page.evaluate(() => document.body.scrollHeight);
      if (newHeight === lastHeight) {
        break;
      }
      lastHeight = newHeight;
      retry++;
      if (retry > 10) {
        break;
      }
    }

    await this.page.evaluate(() => window.scrollTo(0, 0));
  }
  registerEventListeners(context) {
    this.registerConsoleLogListener(this.page, context);
    this.registerRequestListener(this.page, context, this.webLogFile);
    if (!context.pageLoading) {
      context.pageLoading = { status: false };
    }
    context.playContext.on(
      "page",
      async function (page) {
        if (this.configuration && this.configuration.closePopups === true) {
          console.log("close unexpected popups");
          await page.close();
          return;
        }
        context.pageLoading.status = true;
        this.page = page;
        context.page = page;
        context.pages.push(page);
        registerNetworkEvents(this.world, this, context, this.page);
        registerDownloadEvent(this.page, this.world, context);
        page.on("close", async () => {
          if (this.context && this.context.pages && this.context.pages.length > 1) {
            this.context.pages.pop();
            this.page = this.context.pages[this.context.pages.length - 1];
            this.context.page = this.page;
            try {
              let title = await this.page.title();
              console.log("Switched to page " + title);
            } catch (error) {
              console.error("Error on page close", error);
            }
          }
        });
        try {
          await this.waitForPageLoad();
          console.log("Switch page: " + (await page.title()));
        } catch (e) {
          this.logger.error("error on page load " + e);
        }
        context.pageLoading.status = false;
      }.bind(this)
    );
  }

  async switchApp(appName) {
    // check if the current app (this.appName) is the same as the new app
    if (this.appName === appName) {
      return;
    }
    let newContextCreated = false;
    if (!apps[appName]) {
      let newContext = await getContext(
        null,
        this.context.headless ? this.context.headless : false,
        this,
        this.logger,
        appName,
        false,
        this,
        -1,
        this.context.reportFolder
      );
      newContextCreated = true;
      apps[appName] = {
        context: newContext,
        browser: newContext.browser,
        page: newContext.page,
      };
    }
    const tempContext = {};
    this._copyContext(this, tempContext);
    this._copyContext(apps[appName], this);
    apps[this.appName] = tempContext;
    this.appName = appName;
    if (newContextCreated) {
      this.registerEventListeners(this.context);
      await this.goto(this.context.environment.baseUrl);
      await this.waitForPageLoad();
    }
  }
  _copyContext(from, to) {
    to.browser = from.browser;
    to.page = from.page;
    to.context = from.context;
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
  registerConsoleLogListener(page: Page, context: any) {
    if (!this.context.webLogger) {
      this.context.webLogger = [];
    }
    page.on("console", async (msg) => {
      const obj = {
        type: msg.type(),
        text: msg.text(),
        location: msg.location(),
        time: new Date().toISOString(),
      };
      this.context.webLogger.push(obj);
      if (msg.type() === "error") {
        this.world?.attach(JSON.stringify(obj), { mediaType: "application/json+log" });
      }
    });
  }

  registerRequestListener(page: Page, context: any, logFile: string) {
    if (!this.context.networkLogger) {
      this.context.networkLogger = [];
    }
    page.on("request", async (data) => {
      const startTime = new Date().getTime();
      try {
        const pageUrl = new URL(page.url());
        const requestUrl = new URL(data.url());
        if (pageUrl.hostname === requestUrl.hostname) {
          const method = data.method();
          if (["POST", "GET", "PUT", "DELETE", "PATCH"].includes(method)) {
            const token = await data.headerValue("Authorization");
            if (token) {
              context.authtoken = token;
            }
          }
        }
        const response = await data.response();
        const endTime = new Date().getTime();

        const obj = {
          url: data.url(),
          method: data.method(),
          postData: data.postData(),
          error: data.failure() ? data.failure().errorText : null,
          duration: endTime - startTime,
          startTime,
        };
        context.networkLogger.push(obj);
        this.world?.attach(JSON.stringify(obj), { mediaType: "application/json+network" });
      } catch (error) {
        // console.error("Error in request listener", error);
        context.networkLogger.push({
          error: "not able to listen",
          message: error.message,
          stack: error.stack,
          time: new Date().toISOString(),
        });
        // await fs.promises.writeFile(logFile, JSON.stringify(context.networkLogger, null, 2));
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

  _fixUsingParams(text, _params: Params) {
    if (!_params || typeof text !== "string") {
      return text;
    }
    for (let key in _params) {
      let regValue = key;
      if (key.startsWith("_")) {
        // remove the _ prefix
        regValue = key.substring(1);
      }
      text = text.replaceAll(new RegExp("{" + regValue + "}", "g"), _params[key]);
    }
    return text;
  }
  _fixLocatorUsingParams(locator, _params: Params) {
    // check if not null
    if (!locator) {
      return locator;
    }
    // clone the locator
    locator = JSON.parse(JSON.stringify(locator));
    this.scanAndManipulate(locator, _params);
    return locator;
  }
  _isObject(value) {
    return value && typeof value === "object" && value.constructor === Object;
  }
  scanAndManipulate(currentObj, _params: Params) {
    for (const key in currentObj) {
      if (typeof currentObj[key] === "string") {
        // Perform string manipulation
        currentObj[key] = this._fixUsingParams(currentObj[key], _params);
      } else if (this._isObject(currentObj[key])) {
        // Recursively scan nested objects
        this.scanAndManipulate(currentObj[key], _params);
      }
    }
  }
  _getLocator(locator, scope, _params) {
    locator = this._fixLocatorUsingParams(locator, _params);
    let locatorReturn;
    if (locator.role) {
      if (locator.role[1].nameReg) {
        locator.role[1].name = reg_parser(locator.role[1].nameReg);
        delete locator.role[1].nameReg;
      }
      // if (locator.role[1].name) {
      //   locator.role[1].name = this._fixUsingParams(locator.role[1].name, _params);
      // }

      locatorReturn = scope.getByRole(locator.role[0], locator.role[1]);
    }
    if (locator.css) {
      locatorReturn = scope.locator(locator.css);
    }

    // handle role/name locators
    // locator.selector will be something like: textbox[name="Username"i]

    if (locator.engine === "internal:role") {
      // extract the role, name and the i/s flags using regex
      const match = locator.selector.match(/(.*)\[(.*)="(.*)"(.*)\]/);
      if (match) {
        const role = match[1];
        const name = match[3];
        const flags = match[4];
        locatorReturn = scope.getByRole(role, { name }, { exact: flags === "i" });
      }
    }
    if (locator?.engine) {
      if (locator.engine === "css") {
        locatorReturn = scope.locator(locator.selector);
      } else {
        let selector = locator.selector;
        if (locator.engine === "internal:attr") {
          if (!selector.startsWith("[")) {
            selector = `[${selector}]`;
          }
        }
        locatorReturn = scope.locator(`${locator.engine}=${selector}`);
      }
    }
    if (!locatorReturn) {
      console.error(locator);
      throw new Error("Locator undefined");
    }
    return locatorReturn;
  }
  async _locateElmentByTextClimbCss(scope, text, climb, css, _params: Params) {
    if (css && css.locator) {
      css = css.locator;
    }
    let result = await this._locateElementByText(
      scope,
      this._fixUsingParams(text, _params),
      "*:not(script, style, head)",
      false,
      false,
      _params
    );
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
    return await scope.locator(":root").evaluate(
      (_node, [text, tag, regex, partial]) => {
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
        function getRegex(str) {
          const match = str.match(/^\/(.*?)\/([gimuy]*)$/);
          if (!match) {
            return null;
          }

          let [_, pattern, flags] = match;
          return new RegExp(pattern, flags);
        }
        document.getRegex = getRegex;
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
          tag = "*:not(script, style, head)";
        }
        let regexpSearch = document.getRegex(text);
        if (regexpSearch) {
          regex = true;
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
          if (!regexpSearch) {
            regexpSearch = new RegExp(text, "im");
          }
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
                (element.innerText && element.innerText.toLowerCase().trim().includes(text.toLowerCase())) ||
                (element.value && element.value.toLowerCase().includes(text.toLowerCase()))
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
    if (!info) {
      info = {};
    }
    if (!info.failCause) {
      info.failCause = {};
    }
    if (!info.log) {
      info.log = "";
    }
    let locatorSearch = selectorHierarchy[index];
    try {
      locatorSearch = JSON.parse(this._fixUsingParams(JSON.stringify(locatorSearch), _params));
    } catch (e) {
      console.error(e);
    }
    //info.log += "searching for locator " + JSON.stringify(locatorSearch) + "\n";
    let locator = null;
    if (locatorSearch.climb && locatorSearch.climb >= 0) {
      let locatorString = await this._locateElmentByTextClimbCss(
        scope,
        locatorSearch.text,
        locatorSearch.climb,
        locatorSearch.css,
        _params
      );
      if (!locatorString) {
        info.failCause.textNotFound = true;
        info.failCause.lastError = "failed to locate element by text: " + locatorSearch.text;
        return;
      }
      locator = this._getLocator({ css: locatorString }, scope, _params);
    } else if (locatorSearch.text) {
      let text = this._fixUsingParams(locatorSearch.text, _params);
      let result = await this._locateElementByText(
        scope,
        text,
        locatorSearch.tag,
        false,
        locatorSearch.partial === true,
        _params
      );
      if (result.elementCount === 0) {
        info.failCause.textNotFound = true;
        info.failCause.lastError = "failed to locate element by text: " + text;
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
    if (count > 0 && !info.failCause.count) {
      info.failCause.count = count;
    }
    //info.log += "total elements found " + count + "\n";
    //let visibleCount = 0;
    let visibleLocator = null;
    if (locatorSearch.index && locatorSearch.index < count) {
      foundLocators.push(locator.nth(locatorSearch.index));
      return;
    }

    for (let j = 0; j < count; j++) {
      let visible = await locator.nth(j).isVisible();
      const enabled = await locator.nth(j).isEnabled();
      if (!visibleOnly) {
        visible = true;
      }
      if (visible && enabled) {
        foundLocators.push(locator.nth(j));
      } else {
        info.failCause.visible = visible;
        info.failCause.enabled = enabled;
        if (!info.printMessages) {
          info.printMessages = {};
        }
        if (!info.printMessages[j.toString()]) {
          info.log += "element " + locator + " visible " + visible + " enabled " + enabled + "\n";
          info.printMessages[j.toString()] = true;
        }
      }
    }
  }
  async closeUnexpectedPopups(info, _params) {
    if (!info) {
      info = {};
      info.failCause = {};
      info.log = "";
    }
    if (this.configuration.popupHandlers && this.configuration.popupHandlers.length > 0) {
      if (!info) {
        info = {};
      }
      info.log += "scan for popup handlers" + "\n";
      const handlerGroup = [];
      for (let i = 0; i < this.configuration.popupHandlers.length; i++) {
        handlerGroup.push(this.configuration.popupHandlers[i].locator);
      }
      const scopes = this.page.frames().filter((frame) => frame.url() !== "about:blank");
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
        for (let i = 0; i < scopes.length; i++) {
          result = await this._scanLocatorsGroup(closeHandlerGroup, scopes[i], _params, info, true);
          if (result.foundElements.length > 0) {
            break;
          }
        }
        if (result.foundElements.length > 0) {
          let dialogCloseLocator = result.foundElements[0].locator;

          try {
            await scope?.evaluate(() => {
              window.__isClosingPopups = true;
            });
            await dialogCloseLocator.click();
            // wait for the dialog to close
            await dialogCloseLocator.waitFor({ state: "hidden" });
          } catch (e) {
          } finally {
            await scope?.evaluate(() => {
              window.__isClosingPopups = false;
            });
          }
          return { rerun: true };
        }
      }
    }
    return { rerun: false };
  }
  async _locate(selectors, info, _params?: Params, timeout) {
    if (!timeout) {
      timeout = 30000;
    }
    for (let i = 0; i < 3; i++) {
      info.log += "attempt " + i + ": total locators " + selectors.locators.length + "\n";
      for (let j = 0; j < selectors.locators.length; j++) {
        let selector = selectors.locators[j];
        info.log += "searching for locator " + j + ":" + JSON.stringify(selector) + "\n";
      }
      let element = await this._locate_internal(selectors, info, _params, timeout);
      if (!element.rerun) {
        return element;
      }
    }
    throw new Error("unable to locate element " + JSON.stringify(selectors));
  }
  async _findFrameScope(selectors, timeout = 30000, info) {
    if (!info) {
      info = {};
      info.failCause = {};
      info.log = "";
    }
    let startTime = Date.now();
    let scope = this.page;
    if (selectors.frame) {
      return selectors.frame;
    }
    if (selectors.iframe_src || selectors.frameLocators) {
      const findFrame = async (frame, framescope) => {
        for (let i = 0; i < frame.selectors.length; i++) {
          let frameLocator = frame.selectors[i];
          if (frameLocator.css) {
            let testframescope = framescope.frameLocator(frameLocator.css);
            if (frameLocator.index) {
              testframescope = framescope.nth(frameLocator.index);
            }
            try {
              await testframescope.owner().evaluateHandle(() => true, null, {
                timeout: 5000,
              });
              framescope = testframescope;
              break;
            } catch (error) {
              console.error("frame not found " + frameLocator.css);
            }
          }
        }
        if (frame.children) {
          return await findFrame(frame.children, framescope);
        }
        return framescope;
      };
      while (true) {
        let frameFound = false;
        if (selectors.nestFrmLoc) {
          scope = await findFrame(selectors.nestFrmLoc, scope);
          frameFound = true;
          break;
        }
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
          if (Date.now() - startTime > timeout) {
            info.failCause.iframeNotFound = true;
            info.failCause.lastError = "unable to locate iframe " + selectors.iframe_src;
            throw new Error("unable to locate iframe " + selectors.iframe_src);
          }
          await new Promise((resolve) => setTimeout(resolve, 1000));
        } else {
          break;
        }
      }
    }
    if (!scope) {
      scope = this.page;
    }
    return scope;
  }
  async _getDocumentBody(selectors, timeout = 30000, info) {
    let scope = await this._findFrameScope(selectors, timeout, info);

    return scope.evaluate(() => {
      var bodyContent = document.body.innerHTML;
      return bodyContent;
    });
  }
  async _locate_internal(selectors, info, _params?: Params, timeout = 30000) {
    if (!info) {
      info = {};
      info.failCause = {};
      info.log = "";
    }
    let highPriorityTimeout = 5000;
    let visibleOnlyTimeout = 6000;
    let startTime = Date.now();
    let locatorsCount = 0;
    let lazy_scroll = false;
    //let arrayMode = Array.isArray(selectors);
    let scope = await this._findFrameScope(selectors, timeout, info);
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
      if (result.foundElements.length === 0 && onlyPriority3) {
        result = await this._scanLocatorsGroup(locatorsByPriority["3"], scope, _params, info, visibleOnly);
      } else {
        if (result.foundElements.length === 0 && !highPriorityOnly) {
          result = await this._scanLocatorsGroup(locatorsByPriority["3"], scope, _params, info, visibleOnly);
        }
      }
      let foundElements = result.foundElements;

      if (foundElements.length === 1 && foundElements[0].unique) {
        info.box = foundElements[0].box;
        info.log += "unique element was found, locator: " + foundElements[0].locator + "\n";
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
          info.log += "unique element was found, locator: " + maxCountElement.locator + "\n";
          info.box = await maxCountElement.locator.boundingBox();
          return maxCountElement.locator;
        }
      }
      if (Date.now() - startTime > timeout) {
        break;
      }
      if (Date.now() - startTime > highPriorityTimeout) {
        info.log += "high priority timeout, will try all elements" + "\n";
        highPriorityOnly = false;
        if (this.configuration && this.configuration.load_all_lazy === true && !lazy_scroll) {
          lazy_scroll = true;
          await this.scrollPageToLoadLazyElements();
        }
      }
      if (Date.now() - startTime > visibleOnlyTimeout) {
        info.log += "visible only timeout, will try all elements" + "\n";
        visibleOnly = false;
      }
      await new Promise((resolve) => setTimeout(resolve, 1000));
    }
    this.logger.debug("unable to locate unique element, total elements found " + locatorsCount);
    info.log += "failed to locate unique element, total elements found " + locatorsCount + "\n";
    info.failCause.locatorNotFound = true;
    info.failCause.lastError = "failed to locate unique element";
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
      if (foundLocators.length > 1) {
        info.failCause.foundMultiple = true;
      }
    }
    return result;
  }
  async simpleClick(elementDescription, _params?: Params, options = {}, world = null) {
    const startTime = Date.now();
    let timeout = 30000;
    if (options && options.timeout) {
      timeout = options.timeout;
    }
    while (true) {
      try {
        const result = await locate_element(this.context, elementDescription, "click");
        if (result?.elementNumber >= 0) {
          const selectors = {
            frame: result?.frame,
            locators: [
              {
                css: result?.css,
              },
            ],
          };

          await this.click(selectors, _params, options, world);
          return;
        }
      } catch (e) {
        if (Date.now() - startTime > timeout) {
          // throw e;
          await _commandError({ text: "simpleClick", operation: "simpleClick", elementDescription, info: {} }, e, this);
        }
      }
      await new Promise((resolve) => setTimeout(resolve, 3000));
    }
  }
  async simpleClickType(elementDescription, value, _params?: Params, options = {}, world = null) {
    const startTime = Date.now();
    let timeout = 30000;
    if (options && options.timeout) {
      timeout = options.timeout;
    }
    while (true) {
      try {
        const result = await locate_element(this.context, elementDescription, "fill", value);
        if (result?.elementNumber >= 0) {
          const selectors = {
            frame: result?.frame,
            locators: [
              {
                css: result?.css,
              },
            ],
          };

          await this.clickType(selectors, value, false, _params, options, world);
          return;
        }
      } catch (e) {
        if (Date.now() - startTime > timeout) {
          // throw e;
          await _commandError(
            { text: "simpleClickType", operation: "simpleClickType", value, elementDescription, info: {} },
            e,
            this
          );
        }
      }
      await new Promise((resolve) => setTimeout(resolve, 3000));
    }
  }
  async click(selectors, _params?: Params, options = {}, world = null) {
    const state = {
      selectors,
      _params,
      options,
      world,
      text: "Click element",
      type: Types.CLICK,
      operation: "click",
      log: "***** click on " + selectors.element_name + " *****\n",
    };
    try {
      await _preCommand(state, this);
      if (state.options && state.options.context) {
        state.selectors.locators[0].text = state.options.context;
      }
      try {
        await state.element.click();
        // await new Promise((resolve) => setTimeout(resolve, 1000));
      } catch (e) {
        // await this.closeUnexpectedPopups();
        state.element = await this._locate(selectors, state.info, _params);
        await state.element.dispatchEvent("click");
        // await new Promise((resolve) => setTimeout(resolve, 1000));
      }
      await this.waitForPageLoad();
      return state.info;
    } catch (e) {
      await _commandError(state, e, this);
    } finally {
      _commandFinally(state, this);
    }
  }
  async setCheck(selectors, checked = true, _params?: Params, options = {}, world = null) {
    const state = {
      selectors,
      _params,
      options,
      world,
      type: checked ? Types.CHECK : Types.UNCHECK,
      text: checked ? `Check element` : `Uncheck element`,
      operation: "setCheck",
      log: "***** check " + selectors.element_name + " *****\n",
    };

    try {
      await _preCommand(state, this);
      state.info.checked = checked;
      // let element = await this._locate(selectors, info, _params);

      // ({ screenshotId, screenshotPath } = await this._screenShot(options, world, info));
      try {
        // await this._highlightElements(element);
        await state.element.setChecked(checked);
        await new Promise((resolve) => setTimeout(resolve, 1000));
      } catch (e) {
        if (e.message && e.message.includes("did not change its state")) {
          this.logger.info("element did not change its state, ignoring...");
        } else {
          //await this.closeUnexpectedPopups();
          state.info.log += "setCheck failed, will try again" + "\n";
          state.element = await this._locate(selectors, state.info, _params);
          await state.element.setChecked(checked, { timeout: 5000, force: true });
          await new Promise((resolve) => setTimeout(resolve, 1000));
        }
      }
      await this.waitForPageLoad();
      return state.info;
    } catch (e) {
      await _commandError(state, e, this);
    } finally {
      _commandFinally(state, this);
    }
  }

  async hover(selectors, _params?: Params, options = {}, world = null) {
    const state = {
      selectors,
      _params,
      options,
      world,
      type: Types.HOVER,
      text: `Hover element`,
      operation: "hover",
      log: "***** hover " + selectors.element_name + " *****\n",
    };

    try {
      await _preCommand(state, this);
      try {
        await state.element.hover();
        await new Promise((resolve) => setTimeout(resolve, 1000));
      } catch (e) {
        //await this.closeUnexpectedPopups();
        state.info.log += "hover failed, will try again" + "\n";
        state.element = await this._locate(selectors, state.info, _params);
        await state.element.hover({ timeout: 10000 });
        await new Promise((resolve) => setTimeout(resolve, 1000));
      }
      await _screenshot(state, this);
      await this.waitForPageLoad();
      return state.info;
    } catch (e) {
      await _commandError(state, e, this);
    } finally {
      _commandFinally(state, this);
    }
  }

  async selectOption(selectors, values, _params = null, options = {}, world = null) {
    if (!values) {
      throw new Error("values is null");
    }
    const state = {
      selectors,
      _params,
      options,
      world,
      value: values.toString(),
      type: Types.SELECT,
      text: `Select option: ${values}`,
      operation: "selectOption",
      log: "***** select option " + selectors.element_name + " *****\n",
    };

    try {
      await _preCommand(state, this);
      try {
        await state.element.selectOption(values);
      } catch (e) {
        //await this.closeUnexpectedPopups();
        state.info.log += "selectOption failed, will try force" + "\n";
        await state.element.selectOption(values, { timeout: 10000, force: true });
      }
      await this.waitForPageLoad();
      return state.info;
    } catch (e) {
      await _commandError(state, e, this);
    } finally {
      _commandFinally(state, this);
    }
  }

  async type(_value, _params = null, options = {}, world = null) {
    const state = {
      value: _value,
      _params,
      options,
      world,
      locate: false,
      scroll: false,
      highlight: false,
      type: Types.TYPE_PRESS,
      text: `Type value: ${_value}`,
      operation: "type",
      log: "",
    };
    try {
      await _preCommand(state, this);
      const valueSegment = state.value.split("&&");
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
      return state.info;
    } catch (e) {
      await _commandError(state, e, this);
    } finally {
      _commandFinally(state, this);
    }
  }
  async setInputValue(selectors, value, _params = null, options = {}, world = null) {
    const state = {
      selectors,
      _params,
      value,
      options,
      world,
      type: Types.SET_INPUT,
      text: `Set input value`,
      operation: "setInputValue",
      log: "***** set input value " + selectors.element_name + " *****\n",
    };

    try {
      await _preCommand(state, this);

      let value = await this._replaceWithLocalData(state.value, this);
      try {
        await state.element.evaluateHandle((el, value) => {
          el.value = value;
        }, value);
      } catch (error) {
        this.logger.error("setInputValue failed, will try again");
        await _screenshot(state, this);
        Object.assign(error, { info: state.info });
        await state.element.evaluateHandle((el, value) => {
          el.value = value;
        });
      }
    } catch (e) {
      await _commandError(state, e, this);
    } finally {
      _commandFinally(state, this);
    }
  }
  async setDateTime(selectors, value, format = null, enter = false, _params = null, options = {}, world = null) {
    const state = {
      selectors,
      _params,
      value: await this._replaceWithLocalData(value, this),
      options,
      world,
      type: Types.SET_DATE_TIME,
      text: `Set date time value: ${value}`,
      operation: "setDateTime",
      log: "***** set date time value " + selectors.element_name + " *****\n",
      throwError: false,
    };
    try {
      await _preCommand(state, this);
      try {
        await state.element.click();
        await new Promise((resolve) => setTimeout(resolve, 500));
        if (format) {
          state.value = dayjs(state.value).format(format);
          await state.element.fill(state.value);
        } else {
          const dateTimeValue = await getDateTimeValue({ value: state.value, element: state.element });
          await state.element.evaluateHandle((el, dateTimeValue) => {
            el.value = ""; // clear input
            el.value = dateTimeValue;
          }, dateTimeValue);
        }
        if (enter) {
          await new Promise((resolve) => setTimeout(resolve, 2000));
          await this.page.keyboard.press("Enter");
          await this.waitForPageLoad();
        }
      } catch (err) {
        //await this.closeUnexpectedPopups();
        this.logger.error("setting date time input failed " + JSON.stringify(state.info));
        this.logger.info("Trying again");
        await _screenshot(state, this);
        Object.assign(err, { info: state.info });
        await element.click();
        await new Promise((resolve) => setTimeout(resolve, 500));
        if (format) {
          state.value = dayjs(state.value).format(format);
          await state.element.fill(state.value);
        } else {
          const dateTimeValue = await getDateTimeValue({ value: state.value, element: state.element });
          await state.element.evaluateHandle((el, dateTimeValue) => {
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
    } catch (e) {
      await _commandError(state, e, this);
    } finally {
      _commandFinally(state, this);
    }
  }

  async clickType(selectors, _value, enter = false, _params = null, options = {}, world = null) {
    _value = unEscapeString(_value);
    const newValue = await this._replaceWithLocalData(_value, world);
    const state = {
      selectors,
      _params,
      value: newValue,
      originalValue: _value,
      options,
      world,
      type: Types.FILL,
      text: `Click type input with value: ${_value}`,
      operation: "clickType",
      log: "***** clickType on " + selectors.element_name + " with value " + maskValue(_value) + "*****\n",
    };

    if (newValue !== _value) {
      //this.logger.info(_value + "=" + newValue);
      _value = newValue;
    }
    try {
      await _preCommand(state, this);
      state.info.value = _value;
      if (options === null || options === undefined || !options.press) {
        try {
          let currentValue = await state.element.inputValue();
          if (currentValue) {
            await state.element.fill("");
          }
        } catch (e) {
          this.logger.info("unable to clear input value");
        }
      }
      if (options === null || options === undefined || options.press) {
        try {
          await state.element.click({ timeout: 5000 });
        } catch (e) {
          await state.element.dispatchEvent("click");
        }
      } else {
        try {
          await state.element.focus();
        } catch (e) {
          await state.element.dispatchEvent("focus");
        }
      }
      await new Promise((resolve) => setTimeout(resolve, 500));
      const valueSegment = state.value.split("&&");
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
      await _screenshot(state, this);
      if (enter === true) {
        await new Promise((resolve) => setTimeout(resolve, 2000));
        await this.page.keyboard.press("Enter");
        await this.waitForPageLoad();
      } else if (enter === false) {
        await state.element.dispatchEvent("change");
        //await this.page.keyboard.press("Tab");
      } else {
        if (enter !== "" && enter !== null && enter !== undefined) {
          await this.page.keyboard.press(enter);
          await this.waitForPageLoad();
        }
      }
      return state.info;
    } catch (e) {
      await _commandError(state, e, this);
    } finally {
      _commandFinally(state, this);
    }
  }
  async fill(selectors, value, enter = false, _params = null, options = {}, world = null) {
    const state = {
      selectors,
      _params,
      value: unEscapeString(value),
      options,
      world,
      type: Types.FILL,
      text: `Fill input with value: ${value}`,
      operation: "fill",
      log: "***** fill on " + selectors.element_name + " with value " + value + "*****\n",
    };
    try {
      await _preCommand(state, this);
      await state.element.fill(value);
      await state.element.dispatchEvent("change");
      if (enter) {
        await new Promise((resolve) => setTimeout(resolve, 2000));
        await this.page.keyboard.press("Enter");
      }
      await this.waitForPageLoad();
      return state.info;
    } catch (e) {
      await _commandError(state, e, this);
    } finally {
      _commandFinally(state, this);
    }
  }
  async getText(selectors, _params = null, options = {}, info = {}, world = null) {
    return await this._getText(selectors, 0, _params, options, info, world);
  }
  async _getText(selectors, climb, _params = null, options = {}, info = {}, world = null) {
    _validateSelectors(selectors);
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
    if (!pattern) {
      throw new Error("pattern is null");
    }
    if (!text) {
      throw new Error("text is null");
    }

    const state = {
      selectors,
      _params,
      pattern,
      value: pattern,
      options,
      world,
      locate: false,
      scroll: false,
      screenshot: false,
      highlight: false,
      type: Types.VERIFY_ELEMENT_CONTAINS_TEXT,
      text: `Verify element contains pattern: ${pattern}`,
      operation: "containsPattern",
      log: "***** verify element " + selectors.element_name + " contains pattern " + pattern + " *****\n",
    };

    const newValue = await this._replaceWithLocalData(text, world);
    if (newValue !== text) {
      this.logger.info(text + "=" + newValue);
      text = newValue;
    }

    let foundObj = null;
    try {
      await _preCommand(state, this);
      state.info.pattern = pattern;
      foundObj = await this._getText(selectors, 0, _params, options, state.info, world);
      if (foundObj && foundObj.element) {
        await this.scrollIfNeeded(foundObj.element, state.info);
      }
      await _screenshot(state, this);
      let escapedText = text.replace(/[-[\]{}()*+?.,\\^$|#\s]/g, "\\$&");
      pattern = pattern.replace("{text}", escapedText);
      let regex = new RegExp(pattern, "im");
      if (!regex.test(foundObj?.text) && !foundObj?.value?.includes(text)) {
        state.info.foundText = foundObj?.text;
        throw new Error("element doesn't contain text " + text);
      }
      return state.info;
    } catch (e) {
      this.logger.error("found text " + foundObj?.text + " pattern " + pattern);
      await _commandError(state, e, this);
    } finally {
      _commandFinally(state, this);
    }
  }

  async containsText(selectors, text, climb, _params = null, options = {}, world = null) {
    const state = {
      selectors,
      _params,
      value: text,
      options,
      world,
      locate: false,
      scroll: false,
      screenshot: false,
      highlight: false,
      type: Types.VERIFY_ELEMENT_CONTAINS_TEXT,
      text: `Verify element contains text: ${text}`,
      operation: "containsText",
      log: "***** verify element " + selectors.element_name + " contains text " + text + " *****\n",
    };
    if (!text) {
      throw new Error("text is null");
    }
    text = unEscapeString(text);

    const newValue = await this._replaceWithLocalData(text, world);
    if (newValue !== text) {
      this.logger.info(text + "=" + newValue);
      text = newValue;
    }
    let foundObj = null;
    try {
      await _preCommand(state, this);
      foundObj = await this._getText(selectors, climb, _params, options, state.info, world);
      if (foundObj && foundObj.element) {
        await this.scrollIfNeeded(foundObj.element, state.info);
      }
      await _screenshot(state, this);
      const dateAlternatives = findDateAlternatives(text);
      const numberAlternatives = findNumberAlternatives(text);
      if (dateAlternatives.date) {
        for (let i = 0; i < dateAlternatives.dates.length; i++) {
          if (
            foundObj?.text.includes(dateAlternatives.dates[i]) ||
            foundObj?.value?.includes(dateAlternatives.dates[i])
          ) {
            return state.info;
          }
        }
        throw new Error("element doesn't contain text " + text);
      } else if (numberAlternatives.number) {
        for (let i = 0; i < numberAlternatives.numbers.length; i++) {
          if (
            foundObj?.text.includes(numberAlternatives.numbers[i]) ||
            foundObj?.value?.includes(numberAlternatives.numbers[i])
          ) {
            return state.info;
          }
        }
        throw new Error("element doesn't contain text " + text);
      } else if (!foundObj?.text.includes(text) && !foundObj?.value?.includes(text)) {
        state.info.foundText = foundObj?.text;
        state.info.value = foundObj?.value;
        throw new Error("element doesn't contain text " + text);
      }
      return state.info;
    } catch (e) {
      await _commandError(state, e, this);
    } finally {
      _commandFinally(state, this);
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
  async waitForUserInput(message, world = null) {
    if (!message) {
      message = "# Wait for user input. Press any key to continue";
    } else {
      message = "# Wait for user input. " + message;
    }
    message += "\n";
    const value = await new Promise((resolve) => {
      const rl = readline.createInterface({
        input: process.stdin,
        output: process.stdout,
      });
      rl.question(message, (answer) => {
        rl.close();
        resolve(answer);
      });
    });
    if (value) {
      this.logger.info(`{{userInput}} was set to: ${value}`);
    }
    this.setTestData({ userInput: value }, world);
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
  _getDataFilePath(fileName) {
    let dataFile = path.join(this.project_path, "data", fileName);
    if (fs.existsSync(dataFile)) {
      return dataFile;
    }
    dataFile = path.join(this.project_path, fileName);
    if (fs.existsSync(dataFile)) {
      return dataFile;
    }
    throw new Error("data file not found " + fileName);
  }
  _parseCSVSync(filePath) {
    const data = fs.readFileSync(filePath, "utf8");
    const results = [];

    return new Promise((resolve, reject) => {
      const readableStream = new Readable();
      readableStream._read = () => {}; // _read is required but you can noop it
      readableStream.push(data);
      readableStream.push(null);

      readableStream
        .pipe(csv())
        .on("data", (data) => results.push(data))
        .on("end", () => resolve(results))
        .on("error", (error) => reject(error));
    });
  }
  loadTestData(type: string, dataSelector: string, world = null) {
    switch (type) {
      case "users":
        // get the users.json file path
        let dataFile = this._getDataFilePath("users.json");
        // read the file and return the data
        const users = JSON.parse(fs.readFileSync(dataFile, "utf8"));
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
  async loadTestDataAsync(type: string, dataSelector: string, world = null) {
    switch (type) {
      case "users": {
        // get the users.json file path
        let dataFile = this._getDataFilePath("users.json");
        // read the file and return the data
        const users = JSON.parse(fs.readFileSync(dataFile, "utf8"));
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
      }
      case "csv": {
        // the dataSelector should start with the file name followed by the row number: data.csv:1, if no row number is provided, it will default to 1
        const parts = dataSelector.split(":");
        let rowNumber = 0;
        if (parts.length > 1) {
          rowNumber = parseInt(parts[1]);
        }
        let dataFile = this._getDataFilePath(parts[0]);
        const results = await this._parseCSVSync(dataFile);
        // result stracture:
        // [
        //   { NAME: 'Daffy Duck', AGE: '24' },
        //   { NAME: 'Bugs Bunny', AGE: '22' }
        // ]
        // verify the row number is within the range
        if (rowNumber >= results.length) {
          throw new Error("row number is out of range " + rowNumber);
        }
        const data = results[rowNumber];
        this.setTestData(data, world);
        return data;
      }
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
      // to make sure the path doesn't start with -
      const uuidStr = "id_" + randomUUID();
      const screenshotPath = path.join(world.screenshotPath, uuidStr + ".png");
      try {
        await this.takeScreenshot(screenshotPath);
        // let buffer = await this.page.screenshot({ timeout: 4000 });
        // // save the buffer to the screenshot path asynchrously
        // fs.writeFile(screenshotPath, buffer, (err) => {
        //   if (err) {
        //     this.logger.info("unable to save screenshot " + screenshotPath);
        //   }
        // });
        result.screenshotId = uuidStr;
        result.screenshotPath = screenshotPath;
        if (info && info.box) {
          await drawRectangle(screenshotPath, info.box.x, info.box.y, info.box.width, info.box.height);
        }
      } catch (e) {
        this.logger.info("unable to take screenshot, ignored");
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
    let screenshotBuffer = null;

    if (this.context.browserName === "chromium") {
      const client = await playContext.newCDPSession(this.page);
      const { data } = await client.send("Page.captureScreenshot", {
        format: "png",
        // clip: {
        //   x: 0,
        //   y: 0,
        //   width: viewportWidth,
        //   height: viewportHeight,
        //   scale: 1,
        // },
      });
      await client.detach();
      if (!screenshotPath) {
        return data;
      }
      screenshotBuffer = Buffer.from(data, "base64");
    } else {
      screenshotBuffer = await this.page.screenshot();
    }

    let image = await Jimp.read(screenshotBuffer);

    // Get the image dimensions

    const { width, height } = image.bitmap;
    const resizeRatio = viewportWidth / width;
    // Resize the image to fit within the viewport dimensions without enlarging
    if (width > viewportWidth) {
      image = image.resize({ w: viewportWidth, h: height * resizeRatio }); // Resize the image while maintaining aspect ratio
      await image.write(screenshotPath);
    } else {
      fs.writeFileSync(screenshotPath, screenshotBuffer);
    }
  }
  async verifyElementExistInPage(selectors, _params = null, options = {}, world = null) {
    const state = {
      selectors,
      _params,
      options,
      world,
      type: Types.VERIFY_ELEMENT_CONTAINS_TEXT,
      text: `Verify element exists in page`,
      operation: "verifyElementExistInPage",
      log: "***** verify element " + selectors.element_name + " exists in page *****\n",
    };

    await new Promise((resolve) => setTimeout(resolve, 2000));
    try {
      await _preCommand(state, this);
      await expect(state.element).toHaveCount(1, { timeout: 10000 });
      return state.info;
    } catch (e) {
      await _commandError(state, e, this);
    } finally {
      _commandFinally(state, this);
    }
  }
  async extractAttribute(selectors, attribute, variable, _params = null, options = {}, world = null) {
    const state = {
      selectors,
      _params,
      attribute,
      variable,
      options,
      world,
      type: Types.EXTRACT,
      text: `Extract attribute from element`,
      operation: "extractAttribute",
      log: "***** extract attribute " + attribute + " from " + selectors.element_name + " *****\n",
    };
    await new Promise((resolve) => setTimeout(resolve, 2000));
    try {
      await _preCommand(state, this);
      switch (attribute) {
        case "inner_text":
          state.value = await state.element.innerText();
          break;
        case "href":
          state.value = await state.element.getAttribute("href");
          break;
        case "value":
          state.value = await state.element.inputValue();
          break;
        default:
          state.value = await state.element.getAttribute(attribute);
          break;
      }
      state.info.value = state.value;

      this.setTestData({ [variable]: state.value }, world);
      this.logger.info("set test data: " + variable + "=" + state.value);
      return state.info;
    } catch (e) {
      await _commandError(state, e, this);
    } finally {
      _commandFinally(state, this);
    }
  }
  async extractEmailData(emailAddress, options, world) {
    if (!emailAddress) {
      throw new Error("email address is null");
    }
    // check if address contain @
    if (emailAddress.indexOf("@") === -1) {
      emailAddress = emailAddress + "@blinq-mail.io";
    } else {
      if (!emailAddress.toLowerCase().endsWith("@blinq-mail.io")) {
        throw new Error("email address should end with @blinq-mail.io");
      }
    }
    const startTime = Date.now();
    let timeout = 60000;
    if (options && options.timeout) {
      timeout = options.timeout;
    }
    const serviceUrl = this._getServerUrl() + "/api/mail/createLinkOrCodeFromEmail";

    const request = {
      method: "POST",
      url: serviceUrl,
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${process.env.TOKEN}`,
      },
      data: JSON.stringify({
        email: emailAddress,
      }),
    };
    let errorCount = 0;
    while (true) {
      try {
        let result = await this.context.api.request(request);

        // the response body expected to be the following:
        // {
        //  "status": true,
        //  "content": {
        //    "url": "",
        //    "code": "112112",
        //    "name": "generate_link_or_code"
        //  }
        //}

        if ((result && result.data, result.data.status === true)) {
          let codeOrUrlFound = false;
          let emailCode = null;
          let emailUrl = null;
          // check if a code is returned
          if (result.data.content && result.data.content.code) {
            let code = result.data.content.code;
            this.setTestData({ emailCode: code }, world);
            this.logger.info("set test data: emailCode = " + code);
            emailCode = code;
            codeOrUrlFound = true;
          }
          // check if a url is returned
          if (result.data.content && result.data.content.url) {
            let url = result.data.content.url;
            this.setTestData({ emailUrl: url }, world);
            this.logger.info("set test data: emailUrl = " + url);
            emailUrl = url;
            codeOrUrlFound = true;
          }
          if (codeOrUrlFound) {
            return { emailUrl, emailCode };
          } else {
            this.logger.info("an email received but no code or url found");
          }
        }
      } catch (e) {
        errorCount++;
        if (errorCount > 3) {
          // throw e;
          await _commandError(
            { text: "extractEmailData", operation: "extractEmailData", emailAddress, info: {} },
            e,
            this
          );
        }
        // ignore
      }
      // check if the timeout is reached
      if (Date.now() - startTime > timeout) {
        throw new Error("timeout reached");
      }

      await new Promise((resolve) => setTimeout(resolve, 5000));
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
      // throw e;
      await _commandError({ text: "verifyPagePath", operation: "verifyPagePath", pathPart, info }, e, this);
    } finally {
      const endTime = Date.now();
      _reportToWorld(world, {
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
    text = unEscapeString(text);
    const state = {
      text_search: text,
      options,
      world,
      locate: false,
      scroll: false,
      highlight: false,
      type: Types.VERIFY_ELEMENT_CONTAINS_TEXT,
      text: `Verify text exists in page`,
      operation: "verifyTextExistInPage",
      log: "***** verify text " + text + " exists in page *****\n",
    };

    const timeout = this._getLoadTimeout(options);
    await new Promise((resolve) => setTimeout(resolve, 2000));

    const newValue = await this._replaceWithLocalData(text, world);
    if (newValue !== text) {
      this.logger.info(text + "=" + newValue);
      text = newValue;
    }

    let dateAlternatives = findDateAlternatives(text);
    let numberAlternatives = findNumberAlternatives(text);
    try {
      await _preCommand(state, this);
      state.info.text = text;
      while (true) {
        const frames = this.page.frames();
        let results = [];
        for (let i = 0; i < frames.length; i++) {
          if (dateAlternatives.date) {
            for (let j = 0; j < dateAlternatives.dates.length; j++) {
              const result = await this._locateElementByText(
                frames[i],
                dateAlternatives.dates[j],
                "*:not(script, style, head)",
                true,
                true,
                {}
              );
              result.frame = frames[i];
              results.push(result);
            }
          } else if (numberAlternatives.number) {
            for (let j = 0; j < numberAlternatives.numbers.length; j++) {
              const result = await this._locateElementByText(
                frames[i],
                numberAlternatives.numbers[j],
                "*:not(script, style, head)",
                true,
                true,
                {}
              );
              result.frame = frames[i];
              results.push(result);
            }
          } else {
            const result = await this._locateElementByText(
              frames[i],
              text,
              "*:not(script, style, head)",
              true,
              true,
              {}
            );
            result.frame = frames[i];
            results.push(result);
          }
        }
        state.info.results = results;
        const resultWithElementsFound = results.filter((result) => result.elementCount > 0);

        if (resultWithElementsFound.length === 0) {
          if (Date.now() - state.startTime > timeout) {
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
          if (element) {
            await this.scrollIfNeeded(element, state.info);
            await element.dispatchEvent("bvt_verify_page_contains_text");
          }
        }
        await _screenshot(state, this);
        return state.info;
      }

      // await expect(element).toHaveCount(1, { timeout: 10000 });
    } catch (e) {
      await _commandError(state, e, this);
    } finally {
      _commandFinally(state, this);
    }
  }

  async waitForTextToDisappear(text, options = {}, world = null) {
    text = unEscapeString(text);
    const state = {
      text_search: text,
      options,
      world,
      locate: false,
      scroll: false,
      highlight: false,
      type: Types.WAIT_FOR_TEXT_TO_DISAPPEAR,
      text: `Verify text does not exist in page`,
      operation: "verifyTextNotExistInPage",
      log: "***** verify text " + text + " does not exist in page *****\n",
    };

    const timeout = this._getLoadTimeout(options);
    await new Promise((resolve) => setTimeout(resolve, 2000));

    const newValue = await this._replaceWithLocalData(text, world);
    if (newValue !== text) {
      this.logger.info(text + "=" + newValue);
      text = newValue;
    }

    let dateAlternatives = findDateAlternatives(text);
    let numberAlternatives = findNumberAlternatives(text);
    try {
      await _preCommand(state, this);
      state.info.text = text;
      while (true) {
        const frames = this.page.frames();
        let results = [];
        for (let i = 0; i < frames.length; i++) {
          if (dateAlternatives.date) {
            for (let j = 0; j < dateAlternatives.dates.length; j++) {
              const result = await this._locateElementByText(
                frames[i],
                dateAlternatives.dates[j],
                "*:not(script, style, head)",
                true,
                true,
                {}
              );
              result.frame = frames[i];
              results.push(result);
            }
          } else if (numberAlternatives.number) {
            for (let j = 0; j < numberAlternatives.numbers.length; j++) {
              const result = await this._locateElementByText(
                frames[i],
                numberAlternatives.numbers[j],
                "*:not(script, style, head)",
                true,
                true,
                {}
              );
              result.frame = frames[i];
              results.push(result);
            }
          } else {
            const result = await this._locateElementByText(
              frames[i],
              text,
              "*:not(script, style, head)",
              true,
              true,
              {}
            );
            result.frame = frames[i];
            results.push(result);
          }
        }
        state.info.results = results;
        const resultWithElementsFound = results.filter((result) => result.elementCount > 0);

        if (resultWithElementsFound.length === 0) {
          await _screenshot(state, this);
          return state.info;
        }
        if (Date.now() - state.startTime > timeout) {
          throw new Error(`Text ${text} found in page`);
        }
        await new Promise((resolve) => setTimeout(resolve, 1000));
      }
    } catch (e) {
      await _commandError(state, e, this);
    } finally {
      _commandFinally(state, this);
    }
  }

  _getServerUrl() {
    let serviceUrl = "https://api.blinq.io";
    if (process.env.NODE_ENV_BLINQ === "dev") {
      serviceUrl = "https://dev.api.blinq.io";
    } else if (process.env.NODE_ENV_BLINQ === "stage") {
      serviceUrl = "https://stage.api.blinq.io";
    }
    return serviceUrl;
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
      let serviceUrl = this._getServerUrl();
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
      // throw e;
      await _commandError({ text: "visualVerification", operation: "visualVerification", text, info }, e, this);
    } finally {
      const endTime = Date.now();
      _reportToWorld(world, {
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
    _validateSelectors(selectors);
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
      // throw e;
      await _commandError({ text: "getTableData", operation: "getTableData", selectors, info }, e, this);
    } finally {
      const endTime = Date.now();
      _reportToWorld(world, {
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
    _validateSelectors(selectors);
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
    info.log =
      "***** analyze table " +
      selectors.element_name +
      " query " +
      query +
      " operator " +
      operator +
      " value " +
      value +
      " *****\n";
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
      // throw e;
      await _commandError(
        { text: "analyzeTable", operation: "analyzeTable", selectors, query, operator, value },
        e,
        this
      );
    } finally {
      const endTime = Date.now();
      _reportToWorld(world, {
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
    return await replaceWithLocalTestData(value, world, _decrypt, totpWait, this.context, this);
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
        console.log("waited for the network to be idle timeout");
      } else if (e.label === "load") {
        console.log("waited for the load timeout");
      } else if (e.label === "domcontentloaded") {
        console.log("waited for the domcontent loaded timeout");
      }
      console.log(".");
    } finally {
      await new Promise((resolve) => setTimeout(resolve, 2000));
      ({ screenshotId, screenshotPath } = await this._screenShot(options, world));
      const endTime = Date.now();
      _reportToWorld(world, {
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
    const state = {
      options,
      world,
      locate: false,
      scroll: false,
      highlight: false,
      type: Types.CLOSE_PAGE,
      text: `Close page`,
      operation: "closePage",
      log: "***** close page *****\n",
      throwError: false,
    };

    try {
      await _preCommand(state, this);
      await this.page.close();
    } catch (e) {
      console.log(".");
      await _commandError(state, e, this);
    } finally {
      _commandFinally(state, this);
    }
  }
  saveTestDataAsGlobal(options: any, world: any) {
    const dataFile = this._getDataFile(world);
    process.env.GLOBAL_TEST_DATA_FILE = dataFile;
    this.logger.info("Save the scenario test data as global for the following scenarios.");
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
      await _commandError({ text: "setViewportSize", operation: "setViewportSize", width, hight, info }, e, this);
    } finally {
      await new Promise((resolve) => setTimeout(resolve, 2000));
      ({ screenshotId, screenshotPath } = await this._screenShot(options, world));
      const endTime = Date.now();
      _reportToWorld(world, {
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
      await _commandError({ text: "reloadPage", operation: "reloadPage", info }, e, this);
    } finally {
      await new Promise((resolve) => setTimeout(resolve, 2000));
      ({ screenshotId, screenshotPath } = await this._screenShot(options, world, info));
      const endTime = Date.now();
      _reportToWorld(world, {
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
      await element.scrollIntoViewIfNeeded({
        timeout: 2000,
      });
      await new Promise((resolve) => setTimeout(resolve, 500));
      if (info) {
        info.box = await element.boundingBox({
          timeout: 1000,
        });
      }
    } catch (e) {
      console.log("#-#");
    }
  }

  async beforeStep(world, step) {
    this.stepName = step.pickleStep.text;
    this.logger.info("step: " + this.stepName);
    if (this.stepIndex === undefined) {
      this.stepIndex = 0;
    } else {
      this.stepIndex++;
    }
    if (this.context && this.context.browserObject && this.context.browserObject.trace === true) {
      if (this.context.browserObject.context) {
        await this.context.browserObject.context.tracing.startChunk({ title: this.stepName });
      }
    }
    if (this.tags === null && step && step.pickle && step.pickle.tags) {
      this.tags = step.pickle.tags.map((tag) => tag.name);
      // check if @global_test_data tag is present
      if (this.tags.includes("@global_test_data")) {
        this.saveTestDataAsGlobal({}, world);
      }
    }
  }
  async afterStep(world, step) {
    this.stepName = null;
    if (this.context && this.context.browserObject && this.context.browserObject.trace === true) {
      if (this.context.browserObject.context) {
        await this.context.browserObject.context.tracing.stopChunk({
          path: path.join(this.context.browserObject.traceFolder, `trace-${this.stepIndex}.zip`),
        });
      }
    }
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
export type JsonCommandReport = {
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
function unEscapeString(str: string) {
  const placeholder = "__NEWLINE__";
  str = str.replace(new RegExp(placeholder, "g"), "\n");
  return str;
}
export { StableBrowser };
