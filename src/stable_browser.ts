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
import {
  _convertToRegexQuery,
  _copyContext,
  _fixLocatorUsingParams,
  _fixUsingParams,
  _getServerUrl,
  decrypt,
  extractStepExampleParameters,
  KEYBOARD_EVENTS,
  maskValue,
  Params,
  replaceWithLocalTestData,
  scrollPageToLoadLazyElements,
  unEscapeString,
  _getDataFile,
  testForRegex,
  performAction,
  _getTestData,
} from "./utils.js";
import csv from "csv-parser";
import { Readable } from "node:stream";
import readline from "readline";
import { getContext, refreshBrowser } from "./init_browser.js";
import { getTestData, navigate } from "./auto_page.js";
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
import { networkAfterStep, networkBeforeStep, registerDownloadEvent, registerNetworkEvents } from "./network.js";
import { LocatorLog } from "./locator_log.js";
import axios from "axios";
import { _findCellArea, findElementsInArea } from "./table_helper.js";
import { highlightSnapshot, snapshotValidation } from "./snapshot_validation.js";
import { loadBrunoParams } from "./bruno.js";
import { snapshotValidation } from "./snapshot_validation.js";

import { registerAfterStepRoutes, registerBeforeStepRoutes } from "./route.js";
export const Types = {
  CLICK: "click_element",
  WAIT_ELEMENT: "wait_element",
  NAVIGATE: "navigate",
  GO_BACK: "go_back",
  GO_FORWARD: "go_forward",
  FILL: "fill_element",
  EXECUTE: "execute_page_method", //
  OPEN: "open_environment", //
  COMPLETE: "step_complete",
  ASK: "information_needed",
  GET_PAGE_STATUS: "get_page_status", ///
  CLICK_ROW_ACTION: "click_row_action", //
  VERIFY_ELEMENT_CONTAINS_TEXT: "verify_element_contains_text",
  VERIFY_PAGE_CONTAINS_TEXT: "verify_page_contains_text",
  VERIFY_PAGE_CONTAINS_NO_TEXT: "verify_page_contains_no_text",
  ANALYZE_TABLE: "analyze_table",
  SELECT: "select_combobox", //
  VERIFY_PAGE_PATH: "verify_page_path",
  VERIFY_PAGE_TITLE: "verify_page_title",
  TYPE_PRESS: "type_press",
  PRESS: "press_key",
  HOVER: "hover_element",
  CHECK: "check_element",
  UNCHECK: "uncheck_element",
  EXTRACT: "extract_attribute",
  CLOSE_PAGE: "close_page",
  TABLE_OPERATION: "table_operation",
  SET_DATE_TIME: "set_date_time",
  SET_VIEWPORT: "set_viewport",
  VERIFY_VISUAL: "verify_visual",
  LOAD_DATA: "load_data",
  SET_INPUT: "set_input",
  WAIT_FOR_TEXT_TO_DISAPPEAR: "wait_for_text_to_disappear",
  VERIFY_ATTRIBUTE: "verify_element_attribute",
  VERIFY_TEXT_WITH_RELATION: "verify_text_with_relation",
  BRUNO: "bruno",
  VERIFY_FILE_EXISTS: "verify_file_exists",
  SET_INPUT_FILES: "set_input_files",
  SNAPSHOT_VALIDATION: "snapshot_validation",
  REPORT_COMMAND: "report_command",
  STEP_COMPLETE: "step_complete",
  SLEEP: "sleep",
  CONDITIONAL_WAIT: "conditional_wait",
};
export const apps = {};

const formatElementName = (elementName) => {
  return elementName ? JSON.stringify(elementName) : "element";
};
class StableBrowser {
  project_path = null;
  webLogFile = null;
  networkLogger = null;
  configuration = null;
  appName = "main";
  tags = null;
  isRecording = false;
  initSnapshotTaken = false;
  constructor(
    public browser: Browser,
    public page: Page,
    public logger: any = null,
    public context: any = null,
    public world?: any = null,
    public fastMode: boolean = false
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
    if (this.configuration && this.configuration.fastMode === true) {
      this.fastMode = true;
    }
    if (process.env.FAST_MODE === "true") {
      console.log("Fast mode enabled from environment variable");
      this.fastMode = true;
    }
    if (process.env.FAST_MODE === "false") {
      this.fastMode = false;
    }
    if (this.context) {
      this.context.fastMode = this.fastMode;
    }
    this.registerEventListeners(this.context);
    registerNetworkEvents(this.world, this, this.context, this.page);
    registerDownloadEvent(this.page, this.world, this.context);
  }
  registerEventListeners(context) {
    this.registerConsoleLogListener(this.page, context);
    // this.registerRequestListener(this.page, context, this.webLogFile);
    if (!context.pageLoading) {
      context.pageLoading = { status: false };
    }
    if (this.configuration && this.configuration.acceptDialog && this.page) {
      this.page.on("dialog", (dialog) => dialog.accept());
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
        try {
          if (this.configuration && this.configuration.acceptDialog) {
            await page.on("dialog", (dialog) => dialog.accept());
          }
        } catch (error) {
          console.error("Error on dialog accept registration", error);
        }
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
    _copyContext(this, tempContext);
    _copyContext(apps[appName], this);
    apps[this.appName] = tempContext;
    this.appName = appName;
    if (newContextCreated) {
      this.registerEventListeners(this.context);
      await this.goto(this.context.environment.baseUrl);
      if (!this.fastMode) {
        await this.waitForPageLoad();
      }
    }
  }
  async switchTab(tabTitleOrIndex: number | string) {
    // first check if the tabNameOrIndex is a number
    let index = parseInt(tabTitleOrIndex);
    if (!isNaN(index)) {
      if (index >= 0 && index < this.context.pages.length) {
        this.page = this.context.pages[index];
        this.context.page = this.page;
        await this.page.bringToFront();
        return;
      }
    }
    // if the tabNameOrIndex is a string, find the tab by name
    for (let i = 0; i < this.context.pages.length; i++) {
      let page = this.context.pages[i];
      let title = await page.title();
      if (title.includes(tabTitleOrIndex)) {
        this.page = page;
        this.context.page = this.page;
        await this.page.bringToFront();
        return;
      }
    }
    throw new Error("Tab not found: " + tabTitleOrIndex);
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
  async goto(url: string, world = null) {
    if (!url) {
      throw new Error("url is null, verify that the environment file is correct");
    }
    url = await this._replaceWithLocalData(url, this.world);
    if (!url.startsWith("http")) {
      url = "https://" + url;
    }
    const state = {
      value: url,
      world: world,
      type: Types.NAVIGATE,
      text: `Navigate Page to: ${url}`,
      operation: "goto",
      log: "***** navigate page to " + url + " *****\n",
      info: {},
      locate: false,
      scroll: false,
      screenshot: false,
      highlight: false,
    };
    try {
      await _preCommand(state, this);
      await this.page.goto(url, {
        timeout: 60000,
      });
      await _screenshot(state, this);
    } catch (error) {
      console.error("Error on goto", error);
      _commandError(state, error, this);
    } finally {
      await _commandFinally(state, this);
    }
  }

  async goBack(options, world = null) {
    const state = {
      value: "",
      world: world,
      type: Types.GO_BACK,
      text: `Browser navigate back`,
      operation: "goBack",
      log: "***** navigate back *****\n",
      info: {},
      locate: false,
      scroll: false,
      screenshot: false,
      highlight: false,
    };
    try {
      await _preCommand(state, this);
      await this.page.goBack({
        waitUntil: "load",
      });
      await _screenshot(state, this);
    } catch (error) {
      console.error("Error on goBack", error);
      _commandError(state, error, this);
    } finally {
      await _commandFinally(state, this);
    }
  }

  async goForward(options, world = null) {
    const state = {
      value: "",
      world: world,
      type: Types.GO_FORWARD,
      text: `Browser navigate forward`,
      operation: "goForward",
      log: "***** navigate forward *****\n",
      info: {},
      locate: false,
      scroll: false,
      screenshot: false,
      highlight: false,
    };
    try {
      await _preCommand(state, this);
      await this.page.goForward({
        waitUntil: "load",
      });
      await _screenshot(state, this);
    } catch (error) {
      console.error("Error on goForward", error);
      _commandError(state, error, this);
    } finally {
      await _commandFinally(state, this);
    }
  }

  async _getLocator(locator, scope, _params) {
    locator = _fixLocatorUsingParams(locator, _params);
    // locator = await this._replaceWithLocalData(locator);
    for (let key in locator) {
      if (typeof locator[key] !== "string") continue;
      if (locator[key].includes("{{") && locator[key].includes("}}")) {
        locator[key] = await this._replaceWithLocalData(locator[key], this.world);
      }
    }
    let locatorReturn;
    if (locator.role) {
      if (locator.role[1].nameReg) {
        locator.role[1].name = reg_parser(locator.role[1].nameReg);
        delete locator.role[1].nameReg;
      }
      // if (locator.role[1].name) {
      //   locator.role[1].name = _fixUsingParams(locator.role[1].name, _params);
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
      _fixUsingParams(text, _params),
      "*:not(script, style, head)",
      false,
      false,
      true,
      _params
    );
    if (result.elementCount === 0) {
      return;
    }
    let textElementCss = "[data-blinq-id-" + result.randomToken + "]";
    // css climb to parent element
    const climbArray = [];
    for (let i = 0; i < climb; i++) {
      climbArray.push("..");
    }
    let climbXpath = "xpath=" + climbArray.join("/");
    let resultCss = textElementCss + " >> " + climbXpath;
    if (css) {
      resultCss = resultCss + " >> " + css;
    }
    return resultCss;
  }
  async _locateElementByText(scope, text1, tag1, regex1 = false, partial1, ignoreCase = true, _params: Params) {
    const query = `${_convertToRegexQuery(text1, regex1, !partial1, ignoreCase)}`;
    const locator = scope.locator(query);
    const count = await locator.count();
    if (!tag1) {
      tag1 = "*";
    }
    const randomToken = Math.random().toString(36).substring(7);
    let tagCount = 0;
    for (let i = 0; i < count; i++) {
      const element = locator.nth(i);
      // check if the tag matches
      if (
        !(await element.evaluate(
          (el, [tag, randomToken]) => {
            if (!tag.startsWith("*")) {
              if (el.tagName.toLowerCase() !== tag) {
                return false;
              }
            }
            if (!el.setAttribute) {
              el = el.parentElement;
            }
            // remove any attributes start with data-blinq-id
            // for (let i = 0; i < el.attributes.length; i++) {
            //   if (el.attributes[i].name.startsWith("data-blinq-id")) {
            //     el.removeAttribute(el.attributes[i].name);
            //   }
            // }
            el.setAttribute("data-blinq-id-" + randomToken, "");
            return true;
          },
          [tag1, randomToken]
        ))
      ) {
        continue;
      }
      tagCount++;
    }
    return { elementCount: tagCount, randomToken };
  }

  async _collectLocatorInformation(
    selectorHierarchy,
    index = 0,
    scope,
    foundLocators,
    _params: Params,
    info,
    visibleOnly = true,
    allowDisabled? = false,
    element_name = null,
    logErrors? = false
  ) {
    if (!info) {
      info = {};
    }
    if (!info.failCause) {
      info.failCause = {};
    }
    if (!info.log) {
      info.log = "";
      info.locatorLog = new LocatorLog(selectorHierarchy);
    }
    let locatorSearch = selectorHierarchy[index];
    try {
      locatorSearch = _fixLocatorUsingParams(locatorSearch, _params);
    } catch (e) {
      console.error(e);
    }
    let originalLocatorSearch = JSON.stringify(locatorSearch);
    //info.log += "searching for locator " + JSON.stringify(locatorSearch) + "\n";
    let locator = null;
    if (locatorSearch.climb && locatorSearch.climb >= 0) {
      const replacedText = await this._replaceWithLocalData(locatorSearch.text, this.world);
      let locatorString = await this._locateElmentByTextClimbCss(
        scope,
        replacedText,
        locatorSearch.climb,
        locatorSearch.css,
        _params
      );
      if (!locatorString) {
        info.failCause.textNotFound = true;
        info.failCause.lastError = `failed to locate ${formatElementName(element_name)} by text: ${locatorSearch.text}`;
        return;
      }
      locator = await this._getLocator({ css: locatorString }, scope, _params);
    } else if (locatorSearch.text) {
      let text = _fixUsingParams(locatorSearch.text, _params);
      let result = await this._locateElementByText(
        scope,
        text,
        locatorSearch.tag,
        false,
        locatorSearch.partial === true,
        true,
        _params
      );
      if (result.elementCount === 0) {
        info.failCause.textNotFound = true;
        info.failCause.lastError = `failed to locate ${formatElementName(element_name)} by text: ${text}`;
        return;
      }
      locatorSearch.css = "[data-blinq-id-" + result.randomToken + "]";
      if (locatorSearch.childCss) {
        locatorSearch.css = locatorSearch.css + " " + locatorSearch.childCss;
      }
      locator = await this._getLocator(locatorSearch, scope, _params);
    } else {
      locator = await this._getLocator(locatorSearch, scope, _params);
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

    if (typeof locatorSearch.index === "number" && locatorSearch.index < count) {
      foundLocators.push(locator.nth(locatorSearch.index));
      if (info.locatorLog) {
        info.locatorLog.setLocatorSearchStatus(originalLocatorSearch, "FOUND");
      }
      return;
    }

    if (info.locatorLog && count === 0 && logErrors) {
      info.locatorLog.setLocatorSearchStatus(originalLocatorSearch, "NOT_FOUND");
    }
    for (let j = 0; j < count; j++) {
      let visible = await locator.nth(j).isVisible();
      const enabled = await locator.nth(j).isEnabled();
      if (!visibleOnly) {
        visible = true;
      }
      if (visible && (allowDisabled || enabled)) {
        foundLocators.push(locator.nth(j));
        if (info.locatorLog) {
          info.locatorLog.setLocatorSearchStatus(originalLocatorSearch, "FOUND");
        }
      } else if (logErrors) {
        info.failCause.visible = visible;
        info.failCause.enabled = enabled;
        if (!info.printMessages) {
          info.printMessages = {};
        }
        if (info.locatorLog && !visible) {
          info.failCause.lastError = `${formatElementName(element_name)} is not visible, searching for ${originalLocatorSearch}`;
          info.locatorLog.setLocatorSearchStatus(originalLocatorSearch, "FOUND_NOT_VISIBLE");
        }
        if (info.locatorLog && !enabled) {
          info.failCause.lastError = `${formatElementName(element_name)} is disabled, searching for ${originalLocatorSearch}`;
          info.locatorLog.setLocatorSearchStatus(originalLocatorSearch, "FOUND_NOT_ENABLED");
        }
        if (!info.printMessages[j.toString()]) {
          //info.log += "element " + locator + " visible " + visible + " enabled " + enabled + "\n";
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
      //info.log += "scan for popup handlers" + "\n";
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
  async _locate(selectors, info, _params?: Params, timeout, allowDisabled? = false) {
    if (!timeout) {
      timeout = 30000;
    }
    for (let i = 0; i < 3; i++) {
      info.log += "attempt " + i + ": total locators " + selectors.locators.length + "\n";
      for (let j = 0; j < selectors.locators.length; j++) {
        let selector = selectors.locators[j];
        info.log += "searching for locator " + j + ":" + JSON.stringify(selector) + "\n";
      }
      let element = await this._locate_internal(selectors, info, _params, timeout, allowDisabled);

      if (!element.rerun) {
        const randomToken = Math.random().toString(36).substring(7);
        await element.evaluate((el, randomToken) => {
          el.setAttribute("data-blinq-id-" + randomToken, "");
        }, randomToken);
        // if (element._frame) {
        //   return element;
        // }
        const scope = element._frame ?? element.page();
        let newElementSelector = "[data-blinq-id-" + randomToken + "]";
        let prefixSelector = "";
        const frameControlSelector = " >> internal:control=enter-frame";
        const frameSelectorIndex = element._selector.lastIndexOf(frameControlSelector);
        if (frameSelectorIndex !== -1) {
          // remove everything after the >> internal:control=enter-frame
          const frameSelector = element._selector.substring(0, frameSelectorIndex);
          prefixSelector = frameSelector + " >> internal:control=enter-frame >>";
        }
        // if (element?._frame?._selector) {
        //   prefixSelector = element._frame._selector + " >> " + prefixSelector;
        // }
        const newSelector = prefixSelector + newElementSelector;

        return scope.locator(newSelector);
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
              // console.error("frame not found " + frameLocator.css);
            }
          }
        }
        if (frame.children) {
          return await findFrame(frame.children, framescope);
        }
        return framescope;
      };
      let fLocator = null;
      while (true) {
        let frameFound = false;
        if (selectors.nestFrmLoc) {
          fLocator = selectors.nestFrmLoc;
          scope = await findFrame(selectors.nestFrmLoc, scope);
          frameFound = true;
          break;
        }
        if (selectors.frameLocators) {
          for (let i = 0; i < selectors.frameLocators.length; i++) {
            let frameLocator = selectors.frameLocators[i];
            if (frameLocator.css) {
              fLocator = frameLocator.css;
              scope = scope.frameLocator(frameLocator.css);
              frameFound = true;
              break;
            }
          }
        }
        if (!frameFound && selectors.iframe_src) {
          fLocator = selectors.iframe_src;
          scope = this.page.frame({ url: selectors.iframe_src });
        }
        if (!scope) {
          if (info && info.locatorLog) {
            info.locatorLog.setLocatorSearchStatus("frame-" + fLocator, "NOT_FOUND");
          }

          //info.log += "unable to locate iframe " + selectors.iframe_src + "\n";
          if (Date.now() - startTime > timeout) {
            info.failCause.iframeNotFound = true;
            info.failCause.lastError = `unable to locate iframe "${selectors.iframe_src}"`;
            throw new Error("unable to locate iframe " + selectors.iframe_src);
          }
          await new Promise((resolve) => setTimeout(resolve, 1000));
        } else {
          if (info && info.locatorLog) {
            info.locatorLog.setLocatorSearchStatus("frame-" + fLocator, "FOUND");
          }
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
  async _locate_internal(selectors, info, _params?: Params, timeout = 30000, allowDisabled? = false) {
    if (!info) {
      info = {};
      info.failCause = {};
      info.log = "";
      info.locatorLog = new LocatorLog(selectors);
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
      result = await this._scanLocatorsGroup(
        locatorsByPriority["1"],
        scope,
        _params,
        info,
        visibleOnly,
        allowDisabled,
        selectors?.element_name
      );
      if (result.foundElements.length === 0) {
        // info.log += "scanning locators in priority 2" + "\n";
        result = await this._scanLocatorsGroup(
          locatorsByPriority["2"],
          scope,
          _params,
          info,
          visibleOnly,
          allowDisabled,
          selectors?.element_name
        );
      }
      if (result.foundElements.length === 0 && (onlyPriority3 || !highPriorityOnly)) {
        result = await this._scanLocatorsGroup(
          locatorsByPriority["3"],
          scope,
          _params,
          info,
          visibleOnly,
          allowDisabled,
          selectors?.element_name
        );
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
        //info.log += "high priority timeout, will try all elements" + "\n";
        highPriorityOnly = false;
        if (this.configuration && this.configuration.load_all_lazy === true && !lazy_scroll) {
          lazy_scroll = true;
          await scrollPageToLoadLazyElements(this.page);
        }
      }
      if (Date.now() - startTime > visibleOnlyTimeout) {
        //info.log += "visible only timeout, will try all elements" + "\n";
        visibleOnly = false;
      }
      await new Promise((resolve) => setTimeout(resolve, 1000));
      // sheck of more of half of the timeout has passed
      if (Date.now() - startTime > timeout / 2) {
        highPriorityOnly = false;
        visibleOnly = false;
      }
    }
    this.logger.debug("unable to locate unique element, total elements found " + locatorsCount);
    // if (info.locatorLog) {
    //   const lines = info.locatorLog.toString().split("\n");
    //   for (let line of lines) {
    //     this.logger.debug(line);
    //   }
    // }
    //info.log += "failed to locate unique element, total elements found " + locatorsCount + "\n";
    info.failCause.locatorNotFound = true;
    if (!info?.failCause?.lastError) {
      info.failCause.lastError = `failed to locate ${formatElementName(selectors.element_name)}, ${locatorsCount > 0 ? `${locatorsCount} matching elements found` : "no matching elements found"}`;
    }

    throw new Error("failed to locate first element no elements found, " + info.log);
  }
  async _scanLocatorsGroup(
    locatorsGroup,
    scope,
    _params,
    info,
    visibleOnly,
    allowDisabled? = false,
    element_name,
    logErrors? = false
  ) {
    let foundElements = [];
    const result = {
      foundElements: foundElements,
    };
    for (let i = 0; i < locatorsGroup.length; i++) {
      let foundLocators = [];
      try {
        await this._collectLocatorInformation(
          locatorsGroup,
          i,
          scope,
          foundLocators,
          _params,
          info,
          visibleOnly,
          allowDisabled,
          element_name
        );
      } catch (e) {
        // this call can fail it the browser is navigating
        // this.logger.debug("unable to use locator " + JSON.stringify(locatorsGroup[i]));
        // this.logger.debug(e);
        foundLocators = [];
        try {
          await this._collectLocatorInformation(
            locatorsGroup,
            i,
            this.page,
            foundLocators,
            _params,
            info,
            visibleOnly,
            allowDisabled,
            element_name
          );
        } catch (e) {
          if (logErrors) {
            this.logger.info("unable to use locator (second try) " + JSON.stringify(locatorsGroup[i]));
          }
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
        // remove elements that consume the same space with 10 pixels tolerance
        const boxes = [];
        for (let j = 0; j < foundLocators.length; j++) {
          boxes.push({ box: await foundLocators[j].boundingBox(), locator: foundLocators[j] });
        }
        for (let j = 0; j < boxes.length; j++) {
          for (let k = 0; k < boxes.length; k++) {
            if (j === k) {
              continue;
            }
            // check if x, y, width, height are the same with 10 pixels tolerance
            if (
              Math.abs(boxes[j].box.x - boxes[k].box.x) < 10 &&
              Math.abs(boxes[j].box.y - boxes[k].box.y) < 10 &&
              Math.abs(boxes[j].box.width - boxes[k].box.width) < 10 &&
              Math.abs(boxes[j].box.height - boxes[k].box.height) < 10
            ) {
              // as the element is not unique, will remove it
              boxes.splice(k, 1);
              k--;
            }
          }
        }
        if (boxes.length === 1) {
          result.foundElements.push({
            locator: boxes[0].locator.first(),
            box: boxes[0].box,
            unique: true,
          });
          result.locatorIndex = i;
        } else if (logErrors) {
          info.failCause.foundMultiple = true;
          if (info.locatorLog) {
            info.locatorLog.setLocatorSearchStatus(JSON.stringify(locatorsGroup[i]), "FOUND_NOT_UNIQUE");
          }
        }
      }
    }
    return result;
  }
  async simpleClick(elementDescription, _params?: Params, options = {}, world = null) {
    const state = {
      locate: false,
      scroll: false,
      highlight: false,
      _params,
      options,
      world,
      type: Types.CLICK,
      text: "Click element",
      operation: "simpleClick",
      log: "***** click on " + elementDescription + " *****\n",
    };
    _preCommand(state, this);
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
        if (performance.now() - startTime > timeout) {
          // throw e;
          try {
            await _commandError(state, "timeout looking for " + elementDescription, this);
          } finally {
            await _commandFinally(state, this);
          }
        }
      }
      await new Promise((resolve) => setTimeout(resolve, 3000));
    }
  }

  async simpleClickType(elementDescription, value, _params?: Params, options = {}, world = null) {
    const state = {
      locate: false,
      scroll: false,
      highlight: false,
      _params,
      options,
      world,
      type: Types.FILL,
      text: "Fill element",
      operation: "simpleClickType",
      log: "***** click type on " + elementDescription + " *****\n",
    };
    _preCommand(state, this);
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
        if (performance.now() - startTime > timeout) {
          // throw e;
          try {
            await _commandError(state, "timeout looking for " + elementDescription, this);
          } finally {
            await _commandFinally(state, this);
          }
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
      _text: "Click on " + selectors.element_name,
      type: Types.CLICK,
      operation: "click",
      log: "***** click on " + selectors.element_name + " *****\n",
    };
    try {
      await _preCommand(state, this);
      await performAction("click", state.element, options, this, state, _params);
      if (!this.fastMode) {
        await this.waitForPageLoad();
      }
      return state.info;
    } catch (e) {
      await _commandError(state, e, this);
    } finally {
      await _commandFinally(state, this);
    }
  }
  async waitForElement(selectors, _params?: Params, options = {}, world = null) {
    const timeout = this._getFindElementTimeout(options);
    const state = {
      selectors,
      _params,
      options,
      world,
      text: "Wait for element",
      _text: "Wait for " + selectors.element_name,
      type: Types.WAIT_ELEMENT,
      operation: "waitForElement",
      log: "***** wait for " + selectors.element_name + " *****\n",
    };
    let found = false;
    try {
      await _preCommand(state, this);
      // if (state.options && state.options.context) {
      //   state.selectors.locators[0].text = state.options.context;
      // }
      await state.element.waitFor({ timeout: timeout });
      found = true;
      // await new Promise((resolve) => setTimeout(resolve, 1000));
    } catch (e) {
      console.error("Error on waitForElement", e);
      // await _commandError(state, e, this);
    } finally {
      await _commandFinally(state, this);
    }
    return found;
  }
  async setCheck(selectors, checked = true, _params?: Params, options = {}, world = null) {
    const state = {
      selectors,
      _params,
      options,
      world,
      type: checked ? Types.CHECK : Types.UNCHECK,
      text: checked ? `Check element` : `Uncheck element`,
      _text: checked ? `Check ${selectors.element_name}` : `Uncheck ${selectors.element_name}`,
      operation: "setCheck",
      log: "***** check " + selectors.element_name + " *****\n",
    };

    try {
      await _preCommand(state, this);
      state.info.checked = checked;
      // let element = await this._locate(selectors, info, _params);

      // ({ screenshotId, screenshotPath } = await this._screenShot(options, world, info));
      try {
        // if (world && world.screenshot && !world.screenshotPath) {
        // console.log(`Highlighting while running from recorder`);
        await this._highlightElements(state.element);
        await state.element.setChecked(checked, { timeout: 2000 });
        await new Promise((resolve) => setTimeout(resolve, 1000));
        // await this._unHighlightElements(element);
        // }
        // await new Promise((resolve) => setTimeout(resolve, 1000));
        //  await this._unHighlightElements(element);
      } catch (e) {
        if (e.message && e.message.includes("did not change its state")) {
          this.logger.info("element did not change its state, ignoring...");
        } else {
          await new Promise((resolve) => setTimeout(resolve, 1000));
          //await this.closeUnexpectedPopups();
          state.info.log += "setCheck failed, will try again" + "\n";
          state.element_found = false;
          try {
            state.element = await this._locate(selectors, state.info, _params, 100);
            state.element_found = true;
            // check the check state
          } catch (error) {
            // element dismissed
          }
          if (state.element_found) {
            const isChecked = await state.element.isChecked();
            if (isChecked !== checked) {
              // perform click
              await state.element.click({ timeout: 2000, force: true });
            } else {
              this.logger.info(`Element ${selectors.element_name} is already in the desired state (${checked})`);
            }
          }
        }
      }
      await this.waitForPageLoad();
      return state.info;
    } catch (e) {
      await _commandError(state, e, this);
    } finally {
      await _commandFinally(state, this);
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
      _text: `Hover on ${selectors.element_name}`,
      operation: "hover",
      log: "***** hover " + selectors.element_name + " *****\n",
    };

    try {
      await _preCommand(state, this);
      await performAction("hover", state.element, options, this, state, _params);
      await _screenshot(state, this);
      await this.waitForPageLoad();
      return state.info;
    } catch (e) {
      await _commandError(state, e, this);
    } finally {
      await _commandFinally(state, this);
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
      _text: `Select option: ${values} on ${selectors.element_name}`,
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
      await _commandFinally(state, this);
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
      _text: `Type value: ${_value}`,
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
      await _commandFinally(state, this);
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
      await _commandFinally(state, this);
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
      _text: `Set date time value: ${value} on ${selectors.element_name}`,
      operation: "setDateTime",
      log: "***** set date time value " + selectors.element_name + " *****\n",
      throwError: false,
    };
    try {
      await _preCommand(state, this);
      try {
        await performAction("click", state.element, options, this, state, _params);
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
      await _commandFinally(state, this);
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
      _text: "Fill " + selectors.element_name + " with value " + maskValue(_value),
      operation: "clickType",
      log: "***** clickType on " + selectors.element_name + " with value " + maskValue(_value) + "*****\n",
    };
    if (!options) {
      options = {};
    }

    if (newValue !== _value) {
      //this.logger.info(_value + "=" + newValue);
      _value = newValue;
    }
    try {
      await _preCommand(state, this);
      state.info.value = _value;
      if (!options.press) {
        try {
          let currentValue = await state.element.inputValue();
          if (currentValue) {
            await state.element.fill("");
          }
        } catch (e) {
          this.logger.info("unable to clear input value");
        }
      }
      if (options.press) {
        options.timeout = 5000;
        await performAction("click", state.element, options, this, state, _params);
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
      //if (!this.fastMode) {
      await _screenshot(state, this);
      //}
      if (enter === true) {
        await new Promise((resolve) => setTimeout(resolve, 2000));
        await this.page.keyboard.press("Enter");
        await this.waitForPageLoad();
      } else if (enter === false) {
        try {
          await state.element.dispatchEvent("change", null, { timeout: 5000 });
        } catch (e) {
          // ignore
        }
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
      await _commandFinally(state, this);
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
      await _commandFinally(state, this);
    }
  }

  async setInputFiles(selectors, files, _params = null, options = {}, world = null) {
    const state = {
      selectors,
      _params,
      files,
      value: '"' + files.join('", "') + '"',
      options,
      world,
      type: Types.SET_INPUT_FILES,
      text: `Set input files`,
      _text: `Set input files on ${selectors.element_name}`,
      operation: "setInputFiles",
      log: "***** set input files " + selectors.element_name + " *****\n",
    };
    const uploadsFolder = this.configuration.uploadsFolder ?? "data/uploads";

    try {
      await _preCommand(state, this);
      for (let i = 0; i < files.length; i++) {
        const file = files[i];
        const filePath = path.join(uploadsFolder, file);
        if (!fs.existsSync(filePath)) {
          throw new Error(`File not found: ${filePath}`);
        }
        state.files[i] = filePath;
      }
      await state.element.setInputFiles(files);
      return state.info;
    } catch (e) {
      await _commandError(state, e, this);
    } finally {
      await _commandFinally(state, this);
    }
  }
  async getText(selectors, _params = null, options = {}, info = {}, world = null) {
    return await this._getText(selectors, 0, _params, options, info, world);
  }
  async _getText(selectors, climb, _params = null, options = {}, info = {}, world = null) {
    const timeout = this._getFindElementTimeout(options);
    _validateSelectors(selectors);
    let screenshotId = null;
    let screenshotPath = null;
    if (!info.log) {
      info.log = "";
      info.locatorLog = new LocatorLog(selectors);
    }
    info.operation = "getText";
    info.selectors = selectors;
    let element = await this._locate(selectors, info, _params, timeout);
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
      // if (world && world.screenshot && !world.screenshotPath) {
      //   // console.log(`Highlighting for get text while running from recorder`);
      //   this._highlightElements(element)
      //     .then(async () => {
      //       await new Promise((resolve) => setTimeout(resolve, 1000));
      //       this._unhighlightElements(element).then(
      //         () => {}
      //         // console.log(`Unhighlighting vrtr in recorder is successful`)
      //       );
      //     })
      //     .catch(e);
      // }
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
      this.logger.info("no innerText, will use textContent");
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
      _text: "Verify element " + selectors.element_name + " contains pattern " + pattern,
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
      await _commandFinally(state, this);
    }
  }

  async containsText(selectors, text, climb, _params = null, options = {}, world = null) {
    const timeout = this._getFindElementTimeout(options);
    const startTime = Date.now();

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
      while (Date.now() - startTime < timeout) {
        try {
          await _preCommand(state, this);
          foundObj = await this._getText(selectors, climb, _params, { timeout: 3000 }, state.info, world);

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
          } else if (numberAlternatives.number) {
            for (let i = 0; i < numberAlternatives.numbers.length; i++) {
              if (
                foundObj?.text.includes(numberAlternatives.numbers[i]) ||
                foundObj?.value?.includes(numberAlternatives.numbers[i])
              ) {
                return state.info;
              }
            }
          } else if (foundObj?.text.includes(text) || foundObj?.value?.includes(text)) {
            return state.info;
          }
        } catch (e) {
          // Log error but continue retrying until timeout is reached
          this.logger.warn("Retrying containsText due to: " + e.message);
        }
        await new Promise((resolve) => setTimeout(resolve, 1000)); // Wait 1 second before retrying
      }

      state.info.foundText = foundObj?.text;
      state.info.value = foundObj?.value;
      throw new Error("element doesn't contain text " + text);
    } catch (e) {
      await _commandError(state, e, this);
      throw e;
    } finally {
      await _commandFinally(state, this);
    }
  }
  async snapshotValidation(frameSelectors, referanceSnapshot, _params = null, options = {}, world = null) {
    const timeout = this._getFindElementTimeout(options);
    const startTime = Date.now();

    const state = {
      _params,
      value: referanceSnapshot,
      options,
      world,
      locate: false,
      scroll: false,
      screenshot: true,
      highlight: false,
      type: Types.SNAPSHOT_VALIDATION,
      text: `verify snapshot: ${referanceSnapshot}`,
      operation: "snapshotValidation",
      log: "***** verify snapshot *****\n",
    };
    if (!referanceSnapshot) {
      throw new Error("referanceSnapshot is null");
    }
    let text = null;
    if (
      fs.existsSync(
        path.join(this.project_path, "data", "snapshots", this.context.environment.name, referanceSnapshot + ".yml")
      )
    ) {
      text = fs.readFileSync(
        path.join(this.project_path, "data", "snapshots", this.context.environment.name, referanceSnapshot + ".yml"),
        "utf8"
      );
    } else if (
      fs.existsSync(
        path.join(this.project_path, "data", "snapshots", this.context.environment.name, referanceSnapshot + ".yaml")
      )
    ) {
      text = fs.readFileSync(
        path.join(this.project_path, "data", "snapshots", this.context.environment.name, referanceSnapshot + ".yaml"),
        "utf8"
      );
    } else if (referanceSnapshot.startsWith("yaml:")) {
      text = referanceSnapshot.substring(5);
    } else {
      throw new Error("referenceSnapshot file not found: " + referanceSnapshot);
    }
    state.text = text;

    const newValue = await this._replaceWithLocalData(text, world);

    await _preCommand(state, this);

    let foundObj = null;
    try {
      let matchResult = null;
      while (Date.now() - startTime < timeout) {
        try {
          let scope = null;
          if (!frameSelectors) {
            scope = this.page;
          } else {
            scope = await this._findFrameScope(frameSelectors, timeout, state.info);
          }
          const snapshot = await scope.locator("body").ariaSnapshot({ timeout });

          matchResult = snapshotValidation(snapshot, newValue, referanceSnapshot);
          if (matchResult.errorLine !== -1) {
            throw new Error("Snapshot validation failed at line " + matchResult.errorLineText);
          }
          // highlight and screenshot
          try {
            await await highlightSnapshot(newValue, scope);
            await _screenshot(state, this);
          } catch (e) {}
          return state.info;
        } catch (e) {
          // Log error but continue retrying until timeout is reached
          //this.logger.warn("Retrying snapshot validation due to: " + e.message);
        }
        await new Promise((resolve) => setTimeout(resolve, 2000)); // Wait 1 second before retrying
      }

      throw new Error("No snapshot match " + matchResult?.errorLineText);
    } catch (e) {
      await _commandError(state, e, this);
      throw e;
    } finally {
      await _commandFinally(state, this);
    }
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
    const dataFile = _getDataFile(world, this.context, this);
    let data = this.getTestData(world);
    // merge the testData with the existing data
    Object.assign(data, testData);
    // save the data to the file
    fs.writeFileSync(dataFile, JSON.stringify(data, null, 2));
  }
  overwriteTestData(testData, world = null) {
    if (!testData) {
      return;
    }
    // if data file exists, load it
    const dataFile = _getDataFile(world, this.context, this);
    // save the data to the file
    fs.writeFileSync(dataFile, JSON.stringify(testData, null, 2));
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
    return _getTestData(world, this.context, this);
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

    // if (focusedElement) {
    //   // console.log(`Focused element ${JSON.stringify(focusedElement._selector)}`)
    //   await this._unhighlightElements(focusedElement);
    //   await new Promise((resolve) => setTimeout(resolve, 100));
    //   console.log(`Unhighlighted previous element`);
    // }

    // if (focusedElement) {
    //   await this._highlightElements(focusedElement);
    // }

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

    // if (focusedElement) {
    //   // console.log(`Focused element ${JSON.stringify(focusedElement._selector)}`)
    //   await this._unhighlightElements(focusedElement);
    // }

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
    return screenshotBuffer;
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
      await _commandFinally(state, this);
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
      _text: `Extract attribute ${attribute} from ${selectors.element_name}`,
      operation: "extractAttribute",
      log: "***** extract attribute " + attribute + " from " + selectors.element_name + " *****\n",
      allowDisabled: true,
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
        case "text":
          state.value = await state.element.textContent();
          break;
        default:
          state.value = await state.element.getAttribute(attribute);
          break;
      }

      if (options !== null) {
        if (options.regex && options.regex !== "") {
          // Construct a regex pattern from the provided string
          const regex = options.regex.slice(1, -1);
          const regexPattern = new RegExp(regex, "g");
          const matches = state.value.match(regexPattern);
          if (matches) {
            let newValue = "";
            for (const match of matches) {
              newValue += match;
            }
            state.value = newValue;
          }
        }
        if (options.trimSpaces && options.trimSpaces === true) {
          state.value = state.value.trim();
        }
      }

      state.info.value = state.value;

      this.setTestData({ [variable]: state.value }, world);
      this.logger.info("set test data: " + variable + "=" + state.value);
      // await new Promise((resolve) => setTimeout(resolve, 500));
      return state.info;
    } catch (e) {
      await _commandError(state, e, this);
    } finally {
      await _commandFinally(state, this);
    }
  }
  async extractProperty(selectors, property, variable, _params = null, options = {}, world = null) {
    const state = {
      selectors,
      _params,
      property,
      variable,
      options,
      world,
      type: Types.EXTRACT_PROPERTY,
      text: `Extract property from element`,
      _text: `Extract property ${property} from ${selectors.element_name}`,
      operation: "extractProperty",
      log: "***** extract property " + property + " from " + selectors.element_name + " *****\n",
      allowDisabled: true,
    };
    await new Promise((resolve) => setTimeout(resolve, 2000));
    try {
      await _preCommand(state, this);
      switch (property) {
        case "inner_text":
          state.value = await state.element.innerText();
          break;
        case "href":
          state.value = await state.element.getAttribute("href");
          break;
        case "value":
          state.value = await state.element.inputValue();
          break;
        case "text":
          state.value = await state.element.textContent();
          break;
        default:
          if (property.startsWith("dataset.")) {
            const dataAttribute = property.substring(8);
            state.value = String(await state.element.getAttribute(`data-${dataAttribute}`)) || "";
          } else {
            state.value = String(await state.element.evaluate((element, prop) => element[prop], property));
          }
      }

      if (options !== null) {
        if (options.regex && options.regex !== "") {
          // Construct a regex pattern from the provided string
          const regex = options.regex.slice(1, -1);
          const regexPattern = new RegExp(regex, "g");
          const matches = state.value.match(regexPattern);
          if (matches) {
            let newValue = "";
            for (const match of matches) {
              newValue += match;
            }
            state.value = newValue;
          }
        }
        if (options.trimSpaces && options.trimSpaces === true) {
          state.value = state.value.trim();
        }
      }

      state.info.value = state.value;

      this.setTestData({ [variable]: state.value }, world);
      this.logger.info("set test data: " + variable + "=" + state.value);
      // await new Promise((resolve) => setTimeout(resolve, 500));
      return state.info;
    } catch (e) {
      await _commandError(state, e, this);
    } finally {
      await _commandFinally(state, this);
    }
  }
  async verifyAttribute(selectors, attribute, value, _params = null, options = {}, world = null) {
    const state = {
      selectors,
      _params,
      attribute,
      value,
      options,
      world,
      type: Types.VERIFY_ATTRIBUTE,
      highlight: true,
      screenshot: true,
      text: `Verify element attribute`,
      _text: `Verify attribute ${attribute} from ${selectors.element_name} is ${value}`,
      operation: "verifyAttribute",
      log: "***** verify attribute " + attribute + " from " + selectors.element_name + " *****\n",
      allowDisabled: true,
    };
    await new Promise((resolve) => setTimeout(resolve, 2000));
    let val;
    let expectedValue;
    try {
      await _preCommand(state, this);
      expectedValue = await replaceWithLocalTestData(state.value, world);
      state.info.expectedValue = expectedValue;
      switch (attribute) {
        case "innerText":
          val = String(await state.element.innerText());
          break;
        case "text":
          val = String(await state.element.textContent());
          break;
        case "value":
          val = String(await state.element.inputValue());
          break;
        case "checked":
          val = String(await state.element.isChecked());
          break;
        case "disabled":
          val = String(await state.element.isDisabled());
          break;
        case "readOnly":
          const isEditable = await state.element.isEditable();
          val = String(!isEditable);
          break;
        default:
          val = String(await state.element.getAttribute(attribute));
          break;
      }
      state.info.value = val;
      let regex;
      if (expectedValue.startsWith("/") && expectedValue.endsWith("/")) {
        const patternBody = expectedValue.slice(1, -1);
        const processedPattern = patternBody.replace(/\n/g, ".*");
        regex = new RegExp(processedPattern, "gs");
        state.info.regex = true;
      } else {
        const escapedPattern = expectedValue.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
        regex = new RegExp(escapedPattern, "g");
      }
      if (attribute === "innerText") {
        if (state.info.regex) {
          if (!regex.test(val)) {
            let errorMessage = `The ${attribute} attribute has a value of "${val}", but the expected value is "${expectedValue}"`;
            state.info.failCause.assertionFailed = true;
            state.info.failCause.lastError = errorMessage;
            throw new Error(errorMessage);
          }
        } else {
          const valLines = val.split("\n");
          const expectedLines = expectedValue.split("\n");
          const isPart = expectedLines.every((expectedLine) => valLines.some((valLine) => valLine === expectedLine));

          if (!isPart) {
            let errorMessage = `The ${attribute} attribute has a value of "${val}", but the expected value is "${expectedValue}"`;
            state.info.failCause.assertionFailed = true;
            state.info.failCause.lastError = errorMessage;
            throw new Error(errorMessage);
          }
        }
      } else {
        if (!val.match(regex)) {
          let errorMessage = `The ${attribute} attribute has a value of "${val}", but the expected value is "${expectedValue}"`;
          state.info.failCause.assertionFailed = true;
          state.info.failCause.lastError = errorMessage;
          throw new Error(errorMessage);
        }
      }
      return state.info;
    } catch (e) {
      await _commandError(state, e, this);
    } finally {
      await _commandFinally(state, this);
    }
  }
  async verifyProperty(selectors, property, value, _params = null, options = {}, world = null) {
    const state = {
      selectors,
      _params,
      property,
      value,
      options,
      world,
      type: Types.VERIFY_PROPERTY,
      highlight: true,
      screenshot: true,
      text: `Verify element property`,
      _text: `Verify property ${property} from ${selectors.element_name} is ${value}`,
      operation: "verifyProperty",
      log: "***** verify property " + property + " from " + selectors.element_name + " *****\n",
      allowDisabled: true,
    };
    await new Promise((resolve) => setTimeout(resolve, 2000));
    let val;
    let expectedValue;
    try {
      await _preCommand(state, this);
      expectedValue = await replaceWithLocalTestData(state.value, world);
      state.info.expectedValue = expectedValue;
      switch (property) {
        case "innerText":
          val = String(await state.element.innerText());
          break;
        case "text":
          val = String(await state.element.textContent());
          break;
        case "value":
          val = String(await state.element.inputValue());
          break;
        case "checked":
          val = String(await state.element.isChecked());
          break;
        case "disabled":
          val = String(await state.element.isDisabled());
          break;
        case "readOnly":
          const isEditable = await state.element.isEditable();
          val = String(!isEditable);
          break;
        case "innerHTML":
          val = String(await state.element.innerHTML());
          break;
        case "outerHTML":
          val = String(await state.element.evaluate((element) => element.outerHTML));
          break;
        default:
          if (property.startsWith("dataset.")) {
            const dataAttribute = property.substring(8);
            val = String(await state.element.getAttribute(`data-${dataAttribute}`)) || "";
          } else {
            val = String(await state.element.evaluate((element, prop) => element[prop], property));
          }
      }

      // Helper function to remove all style="" attributes
      const removeStyleAttributes = (htmlString) => {
        return htmlString.replace(/\s*style\s*=\s*"[^"]*"/gi, "");
      };

      // Remove style attributes for innerHTML and outerHTML properties
      if (property === "innerHTML" || property === "outerHTML") {
        val = removeStyleAttributes(val);
        expectedValue = removeStyleAttributes(expectedValue);
      }

      state.info.value = val;
      let regex;
      if (expectedValue.startsWith("/") && expectedValue.endsWith("/")) {
        const patternBody = expectedValue.slice(1, -1);
        const processedPattern = patternBody.replace(/\n/g, ".*");
        regex = new RegExp(processedPattern, "gs");
        state.info.regex = true;
      } else {
        const escapedPattern = expectedValue.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
        regex = new RegExp(escapedPattern, "g");
      }
      if (property === "innerText") {
        if (state.info.regex) {
          if (!regex.test(val)) {
            let errorMessage = `The ${property} property has a value of "${val}", but the expected value is "${expectedValue}"`;
            state.info.failCause.assertionFailed = true;
            state.info.failCause.lastError = errorMessage;
            throw new Error(errorMessage);
          }
        } else {
          // Fix: Replace escaped newlines with actual newlines before splitting
          const normalizedExpectedValue = expectedValue.replace(/\\n/g, "\n");
          const valLines = val.split("\n");
          const expectedLines = normalizedExpectedValue.split("\n");

          // Check if all expected lines are present in the actual lines
          const isPart = expectedLines.every((expectedLine) =>
            valLines.some((valLine) => valLine.trim() === expectedLine.trim())
          );

          if (!isPart) {
            let errorMessage = `The ${property} property has a value of "${val}", but the expected value is "${expectedValue}"`;
            state.info.failCause.assertionFailed = true;
            state.info.failCause.lastError = errorMessage;
            throw new Error(errorMessage);
          }
        }
      } else {
        if (!val.match(regex)) {
          let errorMessage = `The ${property} property has a value of "${val}", but the expected value is "${expectedValue}"`;
          state.info.failCause.assertionFailed = true;
          state.info.failCause.lastError = errorMessage;
          throw new Error(errorMessage);
        }
      }
      return state.info;
    } catch (e) {
      await _commandError(state, e, this);
    } finally {
      await _commandFinally(state, this);
    }
  }
  async conditionalWait(selectors, condition, timeout = 1000, _params = null, options = {}, world = null) {
    // Convert timeout from seconds to milliseconds
    const timeoutMs = timeout * 1000;

    const state = {
      selectors,
      _params,
      condition,
      timeout: timeoutMs, // Store as milliseconds for internal use
      options,
      world,
      type: Types.CONDITIONAL_WAIT,
      highlight: true,
      screenshot: true,
      text: `Conditional wait for element`,
      _text: `Wait for ${selectors.element_name} to be ${condition} (timeout: ${timeout}s)`, // Display original seconds
      operation: "conditionalWait",
      log: `***** conditional wait for ${condition} on ${selectors.element_name} *****\n`,
      allowDisabled: true,
      info: {},
    };

    // Initialize startTime outside try block to ensure it's always accessible
    const startTime = Date.now();
    let conditionMet = false;
    let currentValue = null;
    let lastError = null;

    // Main retry loop - continues until timeout or condition is met
    while (Date.now() - startTime < timeoutMs) {
      const elapsedTime = Date.now() - startTime;
      const remainingTime = timeoutMs - elapsedTime;

      try {
        // Try to execute _preCommand (element location)
        await _preCommand(state, this);

        // If _preCommand succeeds, start condition checking
        const checkCondition = async () => {
          try {
            switch (condition.toLowerCase()) {
              case "checked":
                currentValue = await state.element.isChecked();
                return currentValue === true;
              case "unchecked":
                currentValue = await state.element.isChecked();
                return currentValue === false;
              case "visible":
                currentValue = await state.element.isVisible();
                return currentValue === true;
              case "hidden":
                currentValue = await state.element.isVisible();
                return currentValue === false;
              case "enabled":
                currentValue = await state.element.isDisabled();
                return currentValue === false;
              case "disabled":
                currentValue = await state.element.isDisabled();
                return currentValue === true;
              case "editable":
                // currentValue = await String(await state.element.evaluate((element, prop) => element[prop], "isContentEditable"));
                currentValue = await state.element.isContentEditable();
                return currentValue === true;
              default:
                state.info.message = `Unsupported condition: '${condition}'. Supported conditions are: checked, unchecked, visible, hidden, enabled, disabled, editable.`;
                state.info.success = false;
                return false;
            }
          } catch (error) {
            // Don't throw here, just return false to continue retrying
            return false;
          }
        };

        // Inner loop for condition checking (once element is located)
        while (Date.now() - startTime < timeoutMs) {
          const currentElapsedTime = Date.now() - startTime;

          conditionMet = await checkCondition();

          if (conditionMet) {
            break;
          }

          // Check if we still have time for another attempt
          if (Date.now() - startTime + 50 < timeoutMs) {
            await new Promise((res) => setTimeout(res, 50));
          } else {
            break;
          }
        }

        // If we got here and condition is met, break out of main loop
        if (conditionMet) {
          break;
        }

        // If condition not met but no exception, we've timed out
        break;
      } catch (e) {
        lastError = e;
        const currentElapsedTime = Date.now() - startTime;
        const timeLeft = timeoutMs - currentElapsedTime;

        // Check if we have enough time left to retry
        if (timeLeft > 100) {
          await new Promise((resolve) => setTimeout(resolve, 50));
        } else {
          break;
        }
      }
    }

    const actualWaitTime = Date.now() - startTime;

    state.info = {
      success: conditionMet,
      conditionMet,
      actualWaitTime,
      currentValue,
      lastError: lastError?.message || null,
      message: conditionMet
        ? `Condition '${condition}' met after ${(actualWaitTime / 1000).toFixed(2)}s`
        : `Condition '${condition}' not met within ${timeout}s timeout`,
    };

    if (lastError) {
      state.log += `Last error: ${lastError.message}\n`;
    }

    try {
      await _commandFinally(state, this);
    } catch (finallyError) {
      state.log += `Error in _commandFinally: ${finallyError.message}\n`;
    }

    return state.info;
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
    const serviceUrl = _getServerUrl() + "/api/mail/createLinkOrCodeFromEmail";

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
        // console.log(`Scope is not defined`);
        return;
      }
      if (!css) {
        scope
          .evaluate((node) => {
            if (node && node.style) {
              let originalOutline = node.style.outline;
              // console.log(`Original outline was: ${originalOutline}`);
              // node.__previousOutline = originalOutline;
              node.style.outline = "2px solid red";
              // console.log(`New outline is: ${node.style.outline}`);

              if (window) {
                window.addEventListener("beforeunload", function (e) {
                  node.style.outline = originalOutline;
                });
              }
              setTimeout(function () {
                node.style.outline = originalOutline;
              }, 2000);
            }
          })
          .then(() => {})
          .catch((e) => {
            // ignore
            // console.error(`Could not highlight node : ${e}`);
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
                let originalOutline = element.style.outline;
                element.__previousOutline = originalOutline;
                // Set the new border to be red and 2px solid
                element.style.outline = "2px solid red";
                if (window) {
                  window.addEventListener("beforeunload", function (e) {
                    element.style.outline = originalOutline;
                  });
                }
                // Set a timeout to revert to the original border after 2 seconds
                setTimeout(function () {
                  element.style.outline = originalOutline;
                }, 2000);
              }
              return;
            },
            [css]
          )
          .then(() => {})
          .catch((e) => {
            // ignore
            // console.error(`Could not highlight css: ${e}`);
          });
      }
    } catch (error) {
      console.debug(error);
    }
  }

  _matcher(text) {
    if (!text) {
      return { matcher: "contains", queryText: "" };
    }
    if (text.length < 2) {
      return { matcher: "contains", queryText: text };
    }
    const split = text.split(":");
    const matcher = split[0].toLowerCase();
    const queryText = split.slice(1).join(":").trim();
    return { matcher, queryText };
  }

  _getDomain(url: string) {
    if (url.length === 0 || (!url.startsWith("http://") && !url.startsWith("https://"))) {
      return "";
    }

    let hostnameFragments = url.split("/")[2].split(".");

    if (hostnameFragments.some((fragment) => fragment.includes(":"))) {
      return hostnameFragments.join("-").split(":").join("-");
    }

    let n = hostnameFragments.length;
    let fragments = [...hostnameFragments];
    while (n > 0 && hostnameFragments[n - 1].length <= 3) {
      hostnameFragments.pop();
      n = hostnameFragments.length;
    }
    if (n == 0) {
      if (fragments[0] === "www") fragments = fragments.slice(1);
      return fragments.length > 1 ? fragments.slice(0, fragments.length - 1).join("-") : fragments.join("-");
    }
    if (hostnameFragments[0] === "www") hostnameFragments = hostnameFragments.slice(1);
    return hostnameFragments.join(".");
  }

  /**
   * Verify the page path matches the given path.
   * @param {string} pathPart - The path to verify.
   * @param {object} options - Options for verification.
   * @param {object} world - The world context.
   * @returns {Promise<object>} - The state info after verification.
   */

  async verifyPagePath(pathPart: string, options: object = {}, world: object = null): Promise<object> {
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

    const { matcher, queryText } = this._matcher(pathPart);

    const state = {
      text_search: queryText,
      options,
      world,
      locate: false,
      scroll: false,
      highlight: false,
      type: Types.VERIFY_PAGE_PATH,
      text: `Verify the page url is ${queryText}`,
      _text: `Verify the page url is ${queryText}`,
      operation: "verifyPagePath",
      log: "***** verify page url is " + queryText + " *****\n",
    };

    try {
      await _preCommand(state, this);
      state.info.text = queryText;
      for (let i = 0; i < 30; i++) {
        const url = await this.page.url();
        switch (matcher) {
          case "exact":
            if (url !== queryText) {
              if (i === 29) {
                throw new Error(`Page URL ${url} is not equal to ${queryText}`);
              }
              await new Promise((resolve) => setTimeout(resolve, 1000));
              continue;
            }
            break;
          case "contains":
            if (!url.includes(queryText)) {
              if (i === 29) {
                throw new Error(`Page URL ${url} doesn't contain ${queryText}`);
              }
              await new Promise((resolve) => setTimeout(resolve, 1000));
              continue;
            }
            break;
          case "starts-with":
            {
              const domain = this._getDomain(url);
              if (domain.length > 0 && domain !== queryText) {
                if (i === 29) {
                  throw new Error(`Page URL ${url} doesn't start with ${queryText}`);
                }
                await new Promise((resolve) => setTimeout(resolve, 1000));
                continue;
              }
            }
            break;
          case "ends-with":
            {
              const urlObj = new URL(url);
              let route = "/";
              if (urlObj.pathname !== "/") {
                route = urlObj.pathname.split("/").slice(-1)[0].trim();
              } else {
                route = "/";
              }
              if (route !== queryText) {
                if (i === 29) {
                  throw new Error(`Page URL ${url} doesn't end with ${queryText}`);
                }
                await new Promise((resolve) => setTimeout(resolve, 1000));
                continue;
              }
            }
            break;
          case "regex":
            const regex = new RegExp(queryText.slice(1, -1), "g");
            if (!regex.test(url)) {
              if (i === 29) {
                throw new Error(`Page URL ${url} doesn't match regex ${queryText}`);
              }
              await new Promise((resolve) => setTimeout(resolve, 1000));
              continue;
            }
            break;
          default:
            console.log("Unknown matching type, defaulting to contains matching");
            if (!url.includes(pathPart)) {
              if (i === 29) {
                throw new Error(`Page URL ${url} does not contain ${pathPart}`);
              }
              await new Promise((resolve) => setTimeout(resolve, 1000));
              continue;
            }
        }
        await _screenshot(state, this);
        return state.info;
      }
    } catch (e) {
      state.info.failCause.lastError = e.message;
      state.info.failCause.assertionFailed = true;
      await _commandError(state, e, this);
    } finally {
      await _commandFinally(state, this);
    }
  }

  /**
   * Verify the page title matches the given title.
   * @param {string} title - The title to verify.
   * @param {object} options - Options for verification.
   * @param {object} world - The world context.
   * @returns {Promise<object>} - The state info after verification.
   */

  async verifyPageTitle(title: string, options: object = {}, world: object = null): Promise<object> {
    let error = null;
    let screenshotId = null;
    let screenshotPath = null;
    await new Promise((resolve) => setTimeout(resolve, 2000));

    const newValue = await this._replaceWithLocalData(title, world);
    if (newValue !== title) {
      this.logger.info(title + "=" + newValue);
      title = newValue;
    }

    const { matcher, queryText } = this._matcher(title);

    const state = {
      text_search: queryText,
      options,
      world,
      locate: false,
      scroll: false,
      highlight: false,
      type: Types.VERIFY_PAGE_TITLE,
      text: `Verify the page title is ${queryText}`,
      _text: `Verify the page title is ${queryText}`,
      operation: "verifyPageTitle",
      log: "***** verify page title is " + queryText + " *****\n",
    };

    try {
      await _preCommand(state, this);
      state.info.text = queryText;
      for (let i = 0; i < 30; i++) {
        const foundTitle = await this.page.title();
        switch (matcher) {
          case "exact":
            if (foundTitle !== queryText) {
              if (i === 29) {
                throw new Error(`Page Title ${foundTitle} is not equal to ${queryText}`);
              }
              await new Promise((resolve) => setTimeout(resolve, 1000));
              continue;
            }
            break;
          case "contains":
            if (!foundTitle.includes(queryText)) {
              if (i === 29) {
                throw new Error(`Page Title ${foundTitle} doesn't contain ${queryText}`);
              }
              await new Promise((resolve) => setTimeout(resolve, 1000));
              continue;
            }
            break;
          case "starts-with":
            if (!foundTitle.startsWith(queryText)) {
              if (i === 29) {
                throw new Error(`Page title ${foundTitle} doesn't start with ${queryText}`);
              }
              await new Promise((resolve) => setTimeout(resolve, 1000));
              continue;
            }
            break;
          case "ends-with":
            if (!foundTitle.endsWith(queryText)) {
              if (i === 29) {
                throw new Error(`Page Title ${foundTitle} doesn't end with ${queryText}`);
              }
              await new Promise((resolve) => setTimeout(resolve, 1000));
              continue;
            }
            break;
          case "regex":
            const regex = new RegExp(queryText.slice(1, -1), "g");
            if (!regex.test(foundTitle)) {
              if (i === 29) {
                throw new Error(`Page Title ${foundTitle} doesn't match regex ${queryText}`);
              }
              await new Promise((resolve) => setTimeout(resolve, 1000));
              continue;
            }
            break;
          default:
            console.log("Unknown matching type, defaulting to contains matching");
            if (!foundTitle.includes(title)) {
              if (i === 29) {
                throw new Error(`Page Title ${foundTitle} does not contain ${title}`);
              }
              await new Promise((resolve) => setTimeout(resolve, 1000));
              continue;
            }
        }
        await _screenshot(state, this);
        return state.info;
      }
    } catch (e) {
      state.info.failCause.lastError = e.message;
      state.info.failCause.assertionFailed = true;
      await _commandError(state, e, this);
    } finally {
      await _commandFinally(state, this);
    }
  }

  async findTextInAllFrames(dateAlternatives, numberAlternatives, text, state, partial = true, ignoreCase = false) {
    const frames = this.page.frames();
    let results = [];
    // let ignoreCase = false;
    for (let i = 0; i < frames.length; i++) {
      if (dateAlternatives.date) {
        for (let j = 0; j < dateAlternatives.dates.length; j++) {
          const result = await this._locateElementByText(
            frames[i],
            dateAlternatives.dates[j],
            "*:not(script, style, head)",
            false,
            partial,
            ignoreCase,
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
            false,
            partial,
            ignoreCase,
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
          false,
          partial,
          ignoreCase,
          {}
        );
        result.frame = frames[i];
        results.push(result);
      }
    }
    state.info.results = results;
    const resultWithElementsFound = results.filter((result) => result.elementCount > 0);
    return resultWithElementsFound;
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
      type: Types.VERIFY_PAGE_CONTAINS_TEXT,
      text: `Verify the text '${maskValue(text)}' exists in page`,
      _text: `Verify the text '${text}' exists in page`,
      operation: "verifyTextExistInPage",
      log: "***** verify text " + text + " exists in page *****\n",
    };

    if (testForRegex(text)) {
      text = text.replace(/\\"/g, '"');
    }

    const timeout = this._getFindElementTimeout(options);
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
        let resultWithElementsFound = {
          length: 0,
        };
        try {
          resultWithElementsFound = await this.findTextInAllFrames(dateAlternatives, numberAlternatives, text, state);
        } catch (error) {
          // ignore
        }
        if (resultWithElementsFound.length === 0) {
          if (Date.now() - state.startTime > timeout) {
            throw new Error(`Text ${text} not found in page`);
          }
          await new Promise((resolve) => setTimeout(resolve, 1000));
          continue;
        }
        try {
          if (resultWithElementsFound[0].randomToken) {
            const frame = resultWithElementsFound[0].frame;
            const dataAttribute = `[data-blinq-id-${resultWithElementsFound[0].randomToken}]`;

            await this._highlightElements(frame, dataAttribute);

            const element = await frame.locator(dataAttribute).first();

            if (element) {
              await this.scrollIfNeeded(element, state.info);
              await element.dispatchEvent("bvt_verify_page_contains_text");
            }
          }
          await _screenshot(state, this);
          return state.info;
        } catch (error) {
          console.error(error);
        }
      }
    } catch (e) {
      await _commandError(state, e, this);
    } finally {
      await _commandFinally(state, this);
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
      text: `Verify the text '${maskValue(text)}' does not exist in page`,
      _text: `Verify the text '${text}' does not exist in page`,
      operation: "verifyTextNotExistInPage",
      log: "***** verify text " + text + " does not exist in page *****\n",
    };

    if (testForRegex(text)) {
      text = text.replace(/\\"/g, '"');
    }

    const timeout = this._getFindElementTimeout(options);
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
      let resultWithElementsFound = {
        length: null, // initial cannot be 0
      };
      while (true) {
        try {
          resultWithElementsFound = await this.findTextInAllFrames(dateAlternatives, numberAlternatives, text, state);
        } catch (error) {
          // ignore
        }
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
      await _commandFinally(state, this);
    }
  }
  async verifyTextRelatedToText(
    textAnchor: string,
    climb: number,
    textToVerify: string,
    options = {},
    world: any = null
  ) {
    textAnchor = unEscapeString(textAnchor);
    textToVerify = unEscapeString(textToVerify);
    const state = {
      text_search: textToVerify,
      options,
      world,
      locate: false,
      scroll: false,
      highlight: false,
      type: Types.VERIFY_TEXT_WITH_RELATION,
      text: `Verify text with relation to another text`,
      _text: "Search for " + textAnchor + " climb " + climb + " and verify " + textToVerify + " found",
      operation: "verify_text_with_relation",
      log: "***** search for " + textAnchor + " climb " + climb + " and verify " + textToVerify + " found *****\n",
    };

    const timeout = this._getFindElementTimeout(options);
    await new Promise((resolve) => setTimeout(resolve, 2000));

    let newValue = await this._replaceWithLocalData(textAnchor, world);
    if (newValue !== textAnchor) {
      this.logger.info(textAnchor + "=" + newValue);
      textAnchor = newValue;
    }
    newValue = await this._replaceWithLocalData(textToVerify, world);
    if (newValue !== textToVerify) {
      this.logger.info(textToVerify + "=" + newValue);
      textToVerify = newValue;
    }
    let dateAlternatives = findDateAlternatives(textToVerify);
    let numberAlternatives = findNumberAlternatives(textToVerify);
    let foundAncore = false;
    try {
      await _preCommand(state, this);
      state.info.text = textToVerify;
      let resultWithElementsFound = {
        length: 0,
      };
      while (true) {
        try {
          resultWithElementsFound = await this.findTextInAllFrames(
            findDateAlternatives(textAnchor),
            findNumberAlternatives(textAnchor),
            textAnchor,
            state,
            false
          );
        } catch (error) {
          // ignore
        }
        if (resultWithElementsFound.length === 0) {
          if (Date.now() - state.startTime > timeout) {
            throw new Error(`Text ${foundAncore ? textToVerify : textAnchor} not found in page`);
          }
          await new Promise((resolve) => setTimeout(resolve, 1000));
          continue;
        }
        try {
          for (let i = 0; i < resultWithElementsFound.length; i++) {
            foundAncore = true;
            const result = resultWithElementsFound[i];
            const token = result.randomToken;
            const frame = result.frame;
            let css = `[data-blinq-id-${token}]`;
            const climbArray1 = [];
            for (let i = 0; i < climb; i++) {
              climbArray1.push("..");
            }
            let climbXpath = "xpath=" + climbArray1.join("/");
            css = css + " >> " + climbXpath;
            const count = await frame.locator(css).count();
            for (let j = 0; j < count; j++) {
              const continer = await frame.locator(css).nth(j);
              const result = await this._locateElementByText(
                continer,
                textToVerify,
                "*:not(script, style, head)",
                false,
                true,
                true,
                {}
              );
              if (result.elementCount > 0) {
                const dataAttribute = "[data-blinq-id-" + result.randomToken + "]";
                await this._highlightElements(frame, dataAttribute);
                //const cssAnchor = `[data-blinq-id="blinq-id-${token}-anchor"]`;
                // if (world && world.screenshot && !world.screenshotPath) {
                // console.log(`Highlighting for vtrt while running from recorder`);
                // this._highlightElements(frame, dataAttribute)
                // .then(async () => {
                // await new Promise((resolve) => setTimeout(resolve, 1000));
                // this._unhighlightElements(frame, dataAttribute).then(
                // () => {}
                // console.log(`Unhighlighting vrtr in recorder is successful`)
                // );
                // })
                // .catch(e);
                // }
                //await this._highlightElements(frame, cssAnchor);
                const element = await frame.locator(dataAttribute).first();
                // await new Promise((resolve) => setTimeout(resolve, 100));
                // await this._unhighlightElements(frame, dataAttribute);
                if (element) {
                  await this.scrollIfNeeded(element, state.info);
                  await element.dispatchEvent("bvt_verify_page_contains_text");
                }
                await _screenshot(state, this);
                return state.info;
              }
            }
          }
        } catch (error) {
          console.error(error);
        }
      }
      // await expect(element).toHaveCount(1, { timeout: 10000 });
    } catch (e) {
      await _commandError(state, e, this);
    } finally {
      await _commandFinally(state, this);
    }
  }

  async findRelatedTextInAllFrames(
    textAnchor: string,
    climb: number,
    textToVerify: string,
    params?: Params = {},
    options = {},
    world: any = null
  ) {
    const frames = this.page.frames();
    let results = [];
    let ignoreCase = false;
    for (let i = 0; i < frames.length; i++) {
      const result = await this._locateElementByText(
        frames[i],
        textAnchor,
        "*:not(script, style, head)",
        false,
        true,
        ignoreCase,
        {}
      );
      result.frame = frames[i];

      const climbArray = [];
      for (let i = 0; i < climb; i++) {
        climbArray.push("..");
      }
      let climbXpath = "xpath=" + climbArray.join("/");

      const newLocator = `[data-blinq-id-${result.randomToken}] ${climb > 0 ? ">> " + climbXpath : ""} >> internal:text=${testForRegex(textToVerify) ? textToVerify : unEscapeString(textToVerify)}`;

      const count = await frames[i].locator(newLocator).count();
      if (count > 0) {
        result.elementCount = count;
        result.locator = newLocator;
        results.push(result);
      }
    }
    // state.info.results = results;
    const resultWithElementsFound = results.filter((result) => result.elementCount > 0);

    return resultWithElementsFound;
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
      let serviceUrl = _getServerUrl();
      ({ screenshotId, screenshotPath } = await this._screenShot(options, world, info));
      info.screenshotPath = screenshotPath;
      const screenshot = await this.takeScreenshot();
      let request = {
        method: "post",
        maxBodyLength: Infinity,
        url: `${serviceUrl}/api/runs/screenshots/validate-screenshot`,
        headers: {
          "x-bvt-project-id": path.basename(this.project_path),
          "x-source": "aaa",
          "Content-Type": "application/json",
          Authorization: `Bearer ${process.env.TOKEN}`,
        },
        data: JSON.stringify({
          validationText: text,
          screenshot: screenshot,
        }),
      };
      const result = await axios.request(request);
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
        _text: "Visual verification of " + text,
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
    info.locatorLog = new LocatorLog(selectors);

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
    query = _fixUsingParams(query, _params);
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
  /**
   * Explicit wait/sleep function that pauses execution for a specified duration
   * @param duration - Duration to sleep in milliseconds (default: 1000ms)
   * @param options - Optional configuration object
   * @param world - Optional world context
   * @returns Promise that resolves after the specified duration
   */
  async sleep(duration: number = 1000, options = {}, world = null) {
    const state = {
      duration,
      options,
      world,
      locate: false,
      scroll: false,
      screenshot: false,
      highlight: false,
      type: Types.SLEEP,
      text: `Sleep for ${duration} ms`,
      _text: `Sleep for ${duration} ms`,
      operation: "sleep",
      log: `***** Sleep for ${duration} ms *****\n`,
    };

    try {
      await _preCommand(state, this);

      if (duration < 0) {
        throw new Error("Sleep duration cannot be negative");
      }

      await new Promise((resolve) => setTimeout(resolve, duration));

      return state.info;
    } catch (e) {
      await _commandError(state, e, this);
    } finally {
      await _commandFinally(state, this);
    }
  }
  async _replaceWithLocalData(value, world, _decrypt = true, totpWait = true) {
    try {
      return await replaceWithLocalTestData(value, world, _decrypt, totpWait, this.context, this);
    } catch (error) {
      this.logger.debug(error);
      throw error;
    }
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
  _getFindElementTimeout(options) {
    if (options && options.timeout) {
      return options.timeout;
    }
    if (this.configuration.find_element_timeout) {
      return this.configuration.find_element_timeout;
    }
    return 30000;
  }
  async saveStoreState(path: string | null = null, world: any = null) {
    const storageState = await this.page.context().storageState();
    path = await this._replaceWithLocalData(path, this.world);
    //const testDataFile = _getDataFile(world, this.context, this);
    if (path) {
      // save { storageState: storageState } into the path
      fs.writeFileSync(path, JSON.stringify({ storageState: storageState }, null, 2));
    } else {
      await this.setTestData({ storageState: storageState }, world);
    }
  }
  async restoreSaveState(path: string | null = null, world: any = null) {
    path = await this._replaceWithLocalData(path, this.world);
    await refreshBrowser(this, path, world);
    this.registerEventListeners(this.context);
    registerNetworkEvents(this.world, this, this.context, this.page);
    registerDownloadEvent(this.page, this.world, this.context);
    if (this.onRestoreSaveState) {
      this.onRestoreSaveState(path);
    }
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
      _text: `Close the page`,
      operation: "closePage",
      log: "***** close page *****\n",
      throwError: false,
    };

    try {
      await _preCommand(state, this);
      await this.page.close();
    } catch (e) {
      await _commandError(state, e, this);
    } finally {
      await _commandFinally(state, this);
    }
  }
  async tableCellOperation(headerText: string, rowText: string, options: any, _params: Params, world = null) {
    let operation = null;
    if (!options || !options.operation) {
      throw new Error("operation is not defined");
    }
    operation = options.operation;
    // validate operation is one of the supported operations
    if (operation != "click" && operation != "hover+click") {
      throw new Error("operation is not supported");
    }
    const state = {
      options,
      world,
      locate: false,
      scroll: false,
      highlight: false,
      type: Types.TABLE_OPERATION,
      text: `Table operation`,
      _text: `Table ${operation} operation`,
      operation: operation,
      log: "***** Table operation *****\n",
    };
    const timeout = this._getFindElementTimeout(options);
    try {
      await _preCommand(state, this);
      const start = Date.now();
      let cellArea = null;
      while (true) {
        try {
          cellArea = await _findCellArea(headerText, rowText, this, state);
          if (cellArea) {
            break;
          }
        } catch (e) {
          // ignore
        }
        if (Date.now() - start > timeout) {
          throw new Error(`Cell not found in table`);
        }
        await new Promise((resolve) => setTimeout(resolve, 1000));
      }

      switch (operation) {
        case "click":
          if (!options.css) {
            // will click in the center of the cell
            let xOffset = 0;
            let yOffset = 0;
            if (options.xOffset) {
              xOffset = options.xOffset;
            }
            if (options.yOffset) {
              yOffset = options.yOffset;
            }
            await this.page.mouse.click(
              cellArea.x + cellArea.width / 2 + xOffset,
              cellArea.y + cellArea.height / 2 + yOffset
            );
          } else {
            const results = await findElementsInArea(options.css, cellArea, this, options);
            if (results.length === 0) {
              throw new Error(`Element not found in cell area`);
            }
            state.element = results[0];
            await performAction("click", state.element, options, this, state, _params);
          }
          break;
        case "hover+click":
          if (!options.css) {
            throw new Error("css is not defined");
          }
          const results = await findElementsInArea(options.css, cellArea, this, options);
          if (results.length === 0) {
            throw new Error(`Element not found in cell area`);
          }
          state.element = results[0];
          await performAction("hover+click", state.element, options, this, state, _params);
          break;
        default:
          throw new Error("operation is not supported");
      }
    } catch (e) {
      await _commandError(state, e, this);
    } finally {
      await _commandFinally(state, this);
    }
  }

  saveTestDataAsGlobal(options: any, world: any) {
    const dataFile = _getDataFile(world, this.context, this);
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
      await _commandError({ text: "setViewportSize", operation: "setViewportSize", width, hight, info }, e, this);
    } finally {
      await new Promise((resolve) => setTimeout(resolve, 2000));
      ({ screenshotId, screenshotPath } = await this._screenShot(options, world));
      const endTime = Date.now();
      _reportToWorld(world, {
        type: Types.SET_VIEWPORT,
        text: "set viewport size to " + width + "x" + hight,
        _text: "Set the viewport size to " + width + "x" + hight,
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
  async beforeScenario(world, scenario) {
    if (world && world.attach) {
      world.attach(this.context.reportFolder, { mediaType: "text/plain" });
    }
    this.context.loadedRoutes = null;
    this.beforeScenarioCalled = true;
    if (scenario && scenario.pickle && scenario.pickle.name) {
      this.scenarioName = scenario.pickle.name;
    }
    if (scenario && scenario.gherkinDocument && scenario.gherkinDocument.feature) {
      this.featureName = scenario.gherkinDocument.feature.name;
    }
    if (this.context) {
      this.context.examplesRow = extractStepExampleParameters(scenario);
    }
    if (this.tags === null && scenario && scenario.pickle && scenario.pickle.tags) {
      this.tags = scenario.pickle.tags.map((tag) => tag.name);
      // check if @global_test_data tag is present
      if (this.tags.includes("@global_test_data")) {
        this.saveTestDataAsGlobal({}, world);
      }
    }
    // update test data based on feature/scenario
    let envName = null;
    if (this.context && this.context.environment) {
      envName = this.context.environment.name;
    }
    if (!process.env.TEMP_RUN) {
      await getTestData(envName, world, undefined, this.featureName, this.scenarioName, this.context);
    }
    await loadBrunoParams(this.context, this.context.environment.name);
  }
  async afterScenario(world, scenario) {}
  async beforeStep(world, step) {
    if (!this.beforeScenarioCalled) {
      this.beforeScenario(world, step);
      this.context.loadedRoutes = null;
    }
    if (this.stepIndex === undefined) {
      this.stepIndex = 0;
    } else {
      this.stepIndex++;
    }
    if (step && step.pickleStep && step.pickleStep.text) {
      this.stepName = step.pickleStep.text;
      this.logger.info("step: " + this.stepName);
    } else if (step && step.text) {
      this.stepName = step.text;
    } else {
      this.stepName = "step " + this.stepIndex;
    }
    if (this.context && this.context.browserObject && this.context.browserObject.trace === true) {
      if (this.context.browserObject.context) {
        await this.context.browserObject.context.tracing.startChunk({ title: this.stepName });
      }
    }

    if (this.initSnapshotTaken === false) {
      this.initSnapshotTaken = true;
      if (world && world.attach && !process.env.DISABLE_SNAPSHOT && !this.fastMode) {
        const snapshot = await this.getAriaSnapshot();
        if (snapshot) {
          await world.attach(JSON.stringify(snapshot), "application/json+snapshot-before");
        }
      }
    }
    this.context.routeResults = null;
    await registerBeforeStepRoutes(this.context, this.stepName);
    networkBeforeStep(this.stepName);
  }
  async getAriaSnapshot() {
    try {
      // find the page url
      const url = await this.page.url();

      // extract the path from the url
      const path = new URL(url).pathname;
      // get the page title
      const title = await this.page.title();
      // go over other frams
      const frames = this.page.frames();
      const snapshots = [];
      const content = [`- path: ${path}`, `- title: ${title}`];
      const timeout = this.configuration.ariaSnapshotTimeout ? this.configuration.ariaSnapshotTimeout : 3000;
      for (let i = 0; i < frames.length; i++) {
        const frame = frames[i];
        try {
          // Ensure frame is attached and has body
          const body = frame.locator("body");
          //await body.waitFor({ timeout: 2000 }); // wait explicitly
          const snapshot = await body.ariaSnapshot({ timeout });
          if (!snapshot) {
            continue;
          }
          content.push(`- frame: ${i}`);
          content.push(snapshot);
        } catch (innerErr) {
          console.warn(`Frame ${i} snapshot failed:`, innerErr);
          content.push(`- frame: ${i} - error: ${innerErr.message}`);
        }
      }

      return content.join("\n");
    } catch (e) {
      console.log("Error in getAriaSnapshot");
      //console.debug(e);
    }
    return null;
  }

  /**
   * Sends command with custom payload to report.
   * @param commandText - Title of the command to be shown in the report.
   * @param commandStatus - Status of the command (e.g. "PASSED", "FAILED").
   * @param content - Content of the command to be shown in the report.
   * @param options - Options for the command. Example: { type: "json", screenshot: true }
   * @param world - Optional world context.
   * @public
   */

  async addCommandToReport(
    commandText: string,
    commandStatus: "PASSED" | "FAILED",
    content: string,
    options: any = {},
    world: any = null
  ) {
    const state = {
      options,
      world,
      locate: false,
      scroll: false,
      screenshot: options.screenshot ?? false,
      highlight: options.highlight ?? false,
      type: Types.REPORT_COMMAND,
      text: commandText,
      _text: commandText,
      operation: "report_command",
      log: "***** " + commandText + " *****\n",
    };

    try {
      await _preCommand(state, this);
      const payload = {
        type: options.type ?? "text",
        content: content,
        screenshotId: null,
      };
      state.payload = payload;
      if (commandStatus === "FAILED") {
        state.throwError = true;
        throw new Error("Command failed");
      }
    } catch (e) {
      await _commandError(state, e, this);
    } finally {
      await _commandFinally(state, this);
    }
  }

  async afterStep(world, step) {
    this.stepName = null;
    if (this.context && this.context.browserObject && this.context.browserObject.trace === true) {
      if (this.context.browserObject.context) {
        await this.context.browserObject.context.tracing.stopChunk({
          path: path.join(this.context.browserObject.traceFolder, `trace-${this.stepIndex}.zip`),
        });
        if (world && world.attach) {
          await world.attach(
            JSON.stringify({
              type: "trace",
              traceFilePath: `trace-${this.stepIndex}.zip`,
            }),
            "application/json+trace"
          );
        }
        // console.log("trace file created", `trace-${this.stepIndex}.zip`);
      }
    }
    if (this.context) {
      this.context.examplesRow = null;
    }
    if (world && world.attach && !process.env.DISABLE_SNAPSHOT) {
      const snapshot = await this.getAriaSnapshot();
      if (snapshot) {
        const obj = {};
        await world.attach(JSON.stringify(snapshot), "application/json+snapshot-after");
      }
    }
    this.context.routeResults = await registerAfterStepRoutes(this.context, world);

    if (this.context.routeResults) {
      if (world && world.attach) {
        await world.attach(JSON.stringify(this.context.routeResults), "application/json+intercept-results");
      }
    }

    if (!process.env.TEMP_RUN) {
      const state = {
        world,
        locate: false,
        scroll: false,
        screenshot: true,
        highlight: true,
        type: Types.STEP_COMPLETE,
        text: "end of scenario",
        _text: "end of scenario",
        operation: "step_complete",
        log: "***** " + "end of scenario" + " *****\n",
      };
      try {
        await _preCommand(state, this);
      } catch (e) {
        await _commandError(state, e, this);
      } finally {
        await _commandFinally(state, this);
      }
    }
    networkAfterStep(this.stepName);
  }
}

function createTimedPromise(promise, label) {
  return promise
    .then((result) => ({ status: "fulfilled", label, result }))
    .catch((error) => Promise.reject({ status: "rejected", label, error }));
}
export { StableBrowser };
