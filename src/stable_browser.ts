// @ts-nocheck
import { check_performance } from "./check_performance.js";
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
import errorStackParser, { StackFrame } from "error-stack-parser";
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

import { registerAfterStepRoutes, registerBeforeStepRoutes } from "./route.js";
import { existsSync } from "node:fs";
import { profile } from "./check_performance.js";
import { TAG_CONSTANTS } from "./constants.js";
import _, { cond } from "lodash";

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
  VERIFY_PROPERTY: "verify_element_property",
  VERIFY_PAGE_PATH: "verify_page_path",
  VERIFY_PAGE_TITLE: "verify_page_title",
  TYPE_PRESS: "type_press",
  PRESS: "press_key",
  HOVER: "hover_element",
  CHECK: "check_element",
  UNCHECK: "uncheck_element",
  EXTRACT: "extract_attribute",
  EXTRACT_PROPERTY: "extract_property",
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

const withTimeout = (promise, timeout, defaultValue = null) => {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => {
      if (defaultValue !== null) {
        resolve(defaultValue);
      } else {
        reject(new Error("Operation timed out"));
      }
    }, timeout);

    promise
      .then((value) => {
        clearTimeout(timer);
        resolve(value);
      })
      .catch((err) => {
        clearTimeout(timer);
        reject(err);
      });
  });
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
  onlyFailuresScreenshot = process.env.SCREENSHOT_ON_FAILURE_ONLY === "true";
  // set to true if the step issue a report
  inStepReport = false;
  constructor(
    public browser: Browser,
    public page: Page,
    public logger: any = console,
    public context: any = null,
    public world?: any = null,
    public fastMode: boolean = false,
    public stepTags: string[] = []
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
      // console.log("Fast mode enabled from environment variable");
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
          const _perf_t0 = Date.now();
          logEvent("[registerEventListeners] before: page.close");
          await page.close();
          logEvent(`[registerEventListeners] after: page.close took ${Date.now() - _perf_t0}ms`);
          return;
        }
        context.pageLoading.status = true;
        this.page = page;
        try {
          if (this.configuration && this.configuration.acceptDialog) {
            const _perf_t1 = Date.now();
            logEvent("[registerEventListeners] before: page.on");
            await page.on("dialog", (dialog) => dialog.accept());
            logEvent(`[registerEventListeners] after: page.on took ${Date.now() - _perf_t1}ms`);
          }
        } catch (error) {
          console.error("Error on dialog accept registration", error);
        }
        context.page = page;
        context.pages.push(page);
        registerNetworkEvents(this.world, this, context, this.page);
        registerDownloadEvent(this.page, this.world, context);
        page.on("close", async () => {
          // return if browser context is already closed
          if (this.context && this.context.pages && this.context.pages.length > 1) {
            this.context.pages.pop();
            this.page = this.context.pages[this.context.pages.length - 1];
            this.context.page = this.page;
            try {
              const _perf_t2 = Date.now();
              logEvent("[registerEventListeners] before: page.title");
              let title = await withTimeout(this.page.title(), 2000, "[Unknown Title]");
              logEvent(`[registerEventListeners] after: page.title took ${Date.now() - _perf_t2}ms`);
              console.log("Switched to page " + title);
            } catch (error) {
              if (error?.message?.includes("Target page, context or browser has been closed")) {
                // Ignore this error
              } else {
                console.error("Error on page close", error);
              }
            }
          }
        });
        try {
          const _perf_t3 = Date.now();
          logEvent("[registerEventListeners] before: waitForPageLoad");
          await this.waitForPageLoad();
          logEvent(`[registerEventListeners] after: waitForPageLoad took ${Date.now() - _perf_t3}ms`);
          console.log("Switch page: " + (await withTimeout(page.title(), 2000, "[Unknown Title]")));
        } catch (e) {
          if (e?.message?.includes("Target page, context or browser has been closed")) {
            // Ignore this error
          } else {
            this.logger.error("error on page load " + e);
          }
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
      const _perf_t4 = Date.now();
      logEvent("[switchApp] before: getContext");
      let newContext = await getContext(
        null,
        this.context.headless ? this.context.headless : false,
        this,
        this.logger,
        appName,
        false,
        this,
        -1,
        this.context.reportFolder,
        null,
        null,
        this.tags
      );
      logEvent(`[switchApp] after: getContext took ${Date.now() - _perf_t4}ms`);
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
      const _perf_t5 = Date.now();
      logEvent("[switchApp] before: goto");
      await this.goto(this.context.environment.baseUrl);
      logEvent(`[switchApp] after: goto took ${Date.now() - _perf_t5}ms`);
      if (!this.fastMode && !this.stepTags.includes("fast-mode")) {
        const _perf_t6 = Date.now();
        logEvent("[switchApp] before: waitForPageLoad");
        await this.waitForPageLoad();
        logEvent(`[switchApp] after: waitForPageLoad took ${Date.now() - _perf_t6}ms`);
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
        const _perf_t7 = Date.now();
        logEvent("[switchTab] before: page.bringToFront");
        await this.page.bringToFront();
        logEvent(`[switchTab] after: page.bringToFront took ${Date.now() - _perf_t7}ms`);
        return;
      }
    }
    // if the tabNameOrIndex is a string, find the tab by name
    for (let i = 0; i < this.context.pages.length; i++) {
      let page = this.context.pages[i];
      const _perf_t8 = Date.now();
      logEvent("[switchTab] before: page.title");
      let title = await withTimeout(page.title(), 2000, "[Unknown Title]");
      logEvent(`[switchTab] after: page.title took ${Date.now() - _perf_t8}ms`);
      if (title.includes(tabTitleOrIndex)) {
        this.page = page;
        this.context.page = this.page;
        const _perf_t9 = Date.now();
        logEvent("[switchTab] before: page.bringToFront");
        await this.page.bringToFront();
        logEvent(`[switchTab] after: page.bringToFront took ${Date.now() - _perf_t9}ms`);
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
            const _perf_t10 = Date.now();
            logEvent("[registerRequestListener] before: data.headerValue");
            const token = await data.headerValue("Authorization");
            logEvent(`[registerRequestListener] after: data.headerValue took ${Date.now() - _perf_t10}ms`);
            if (token) {
              context.authtoken = token;
            }
          }
        }
        const _perf_t11 = Date.now();
        logEvent("[registerRequestListener] before: data.response");
        const response = await data.response();
        logEvent(`[registerRequestListener] after: data.response took ${Date.now() - _perf_t11}ms`);
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
  async goto(url: string, world = null, options = {}) {
    if (!url) {
      throw new Error("url is null, verify that the environment file is correct");
    }
    const _perf_t12 = Date.now();
    logEvent("[goto] before: _replaceWithLocalData");
    url = await this._replaceWithLocalData(url, this.world);
    logEvent(`[goto] after: _replaceWithLocalData took ${Date.now() - _perf_t12}ms`);
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
    let timeout = 60000;
    if (this.configuration && this.configuration.page_timeout) {
      timeout = this.configuration.page_timeout;
    }
    if (options && options["timeout"]) {
      timeout = options["timeout"];
    }
    try {
      const _perf_t13 = Date.now();
      logEvent("[goto] before: _preCommand");
      await _preCommand(state, this);
      logEvent(`[goto] after: _preCommand took ${Date.now() - _perf_t13}ms`);
      const _perf_t14 = Date.now();
      logEvent("[goto] before: page.goto");
      await this.page.goto(url, {
        timeout: timeout,
      });
      logEvent(`[goto] after: page.goto took ${Date.now() - _perf_t14}ms`);
      const _perf_t15 = Date.now();
      logEvent("[goto] before: _screenshot");
      await _screenshot(state, this);
      logEvent(`[goto] after: _screenshot took ${Date.now() - _perf_t15}ms`);
    } catch (error) {
      console.error("Error on goto", error);
      const _perf_t16 = Date.now();
      logEvent("[goto] before: _commandError");
      await _commandError(state, error, this);
      logEvent(`[goto] after: _commandError took ${Date.now() - _perf_t16}ms`);
    } finally {
      const _perf_t17 = Date.now();
      logEvent("[goto] before: _commandFinally");
      await _commandFinally(state, this);
      logEvent(`[goto] after: _commandFinally took ${Date.now() - _perf_t17}ms`);
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
      const _perf_t18 = Date.now();
      logEvent("[goBack] before: _preCommand");
      await _preCommand(state, this);
      logEvent(`[goBack] after: _preCommand took ${Date.now() - _perf_t18}ms`);
      const _perf_t19 = Date.now();
      logEvent("[goBack] before: page.goBack");
      await this.page.goBack({
        waitUntil: "load",
      });
      logEvent(`[goBack] after: page.goBack took ${Date.now() - _perf_t19}ms`);
      const _perf_t20 = Date.now();
      logEvent("[goBack] before: _screenshot");
      await _screenshot(state, this);
      logEvent(`[goBack] after: _screenshot took ${Date.now() - _perf_t20}ms`);
    } catch (error) {
      console.error("Error on goBack", error);
      const _perf_t21 = Date.now();
      logEvent("[goBack] before: _commandError");
      await _commandError(state, error, this);
      logEvent(`[goBack] after: _commandError took ${Date.now() - _perf_t21}ms`);
    } finally {
      const _perf_t22 = Date.now();
      logEvent("[goBack] before: _commandFinally");
      await _commandFinally(state, this);
      logEvent(`[goBack] after: _commandFinally took ${Date.now() - _perf_t22}ms`);
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
      const _perf_t23 = Date.now();
      logEvent("[goForward] before: _preCommand");
      await _preCommand(state, this);
      logEvent(`[goForward] after: _preCommand took ${Date.now() - _perf_t23}ms`);
      const _perf_t24 = Date.now();
      logEvent("[goForward] before: page.goForward");
      await this.page.goForward({
        waitUntil: "load",
      });
      logEvent(`[goForward] after: page.goForward took ${Date.now() - _perf_t24}ms`);
      const _perf_t25 = Date.now();
      logEvent("[goForward] before: _screenshot");
      await _screenshot(state, this);
      logEvent(`[goForward] after: _screenshot took ${Date.now() - _perf_t25}ms`);
    } catch (error) {
      console.error("Error on goForward", error);
      const _perf_t26 = Date.now();
      logEvent("[goForward] before: _commandError");
      await _commandError(state, error, this);
      logEvent(`[goForward] after: _commandError took ${Date.now() - _perf_t26}ms`);
    } finally {
      const _perf_t27 = Date.now();
      logEvent("[goForward] before: _commandFinally");
      await _commandFinally(state, this);
      logEvent(`[goForward] after: _commandFinally took ${Date.now() - _perf_t27}ms`);
    }
  }

  async _getLocator(locator, scope, _params) {
    locator = _fixLocatorUsingParams(locator, _params);
    // locator = await this._replaceWithLocalData(locator);
    for (let key in locator) {
      if (typeof locator[key] !== "string") continue;
      if (locator[key].includes("{{") && locator[key].includes("}}")) {
        const _perf_t28 = Date.now();
        logEvent("[_getLocator] before: _replaceWithLocalData");
        locator[key] = await this._replaceWithLocalData(locator[key], this.world);
        logEvent(`[_getLocator] after: _replaceWithLocalData took ${Date.now() - _perf_t28}ms`);
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
    const _perf_t29 = Date.now();
    logEvent("[_locateElmentByTextClimbCss] before: _locateElementByText");
    let result = await this._locateElementByText(
      scope,
      _fixUsingParams(text, _params),
      "*:not(script, style, head)",
      false,
      false,
      true,
      _params
    );
    logEvent(`[_locateElmentByTextClimbCss] after: _locateElementByText took ${Date.now() - _perf_t29}ms`);
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
    logEvent("[_locateElementByText] locating element by text: " + text1 + ", tag: " + tag1 + ", regex: " + regex1);
    const query = `${_convertToRegexQuery(text1, regex1, !partial1, ignoreCase)}`;
    const locator = scope.locator(query);
    const _perf_t30 = Date.now();
    logEvent("[_locateElementByText] before: locator.count");
    const count = await locator.count();
    logEvent(`[_locateElementByText] after: locator.count took ${Date.now() - _perf_t30}ms`);
    if (!tag1) {
      tag1 = "*";
    }
    const randomToken = Math.random().toString(36).substring(7);
    let tagCount = 0;
    for (let i = 0; i < count; i++) {
      const element = locator.nth(i);
      // check if the tag matches
      logEvent("[_locateElementByText] ❓ before: element.evaluate");
      const condition = await element.evaluate(
        (el, [tagToIgnore, randomToken]) => {
          if (!tagToIgnore.startsWith("*")) {
            if (el.tagName.toLowerCase() !== tagToIgnore) {
              return false;
            }
          }
          if (!el.setAttribute) {
            el = el.parentElement;
          }

          el.setAttribute("data-blinq-id-" + randomToken, ""); //? example: waiting for locator('[data-blinq-id-mozaeg]').first()
          return true;
        },
        [tag1, randomToken]
      );
      logEvent(
        `[_locateElementByText] ❓ CONDITION VALUE: ${condition} after: element.evaluate took ${Date.now() - _perf_t30}ms`
      );
      if (!condition) {
        continue;
      }
      tagCount++;
    }
    logEvent(`[_locateElementByText] 🌟 total elements with text ${text1} and tag ${tag1}: ${tagCount}`);
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
      const _perf_t31 = Date.now();
      logEvent("[_collectLocatorInformation] before: _replaceWithLocalData");
      const replacedText = await this._replaceWithLocalData(locatorSearch.text, this.world);
      logEvent(`[_collectLocatorInformation] after: _replaceWithLocalData took ${Date.now() - _perf_t31}ms`);
      const _perf_t32 = Date.now();
      logEvent("[_collectLocatorInformation] before: _locateElmentByTextClimbCss");
      let locatorString = await this._locateElmentByTextClimbCss(
        scope,
        replacedText,
        locatorSearch.climb,
        locatorSearch.css,
        _params
      );
      logEvent(`[_collectLocatorInformation] after: _locateElmentByTextClimbCss took ${Date.now() - _perf_t32}ms`);
      if (!locatorString) {
        info.failCause.textNotFound = true;
        info.failCause.lastError = `failed to locate ${formatElementName(element_name)} by text: ${locatorSearch.text}`;
        return;
      }
      const _perf_t33 = Date.now();
      logEvent("[_collectLocatorInformation] before: _getLocator");
      locator = await this._getLocator({ css: locatorString }, scope, _params);
      logEvent(`[_collectLocatorInformation] after: _getLocator took ${Date.now() - _perf_t33}ms`);
    } else if (locatorSearch.text) {
      let text = _fixUsingParams(locatorSearch.text, _params);
      const _perf_t34 = Date.now();
      logEvent("[_collectLocatorInformation] before: _locateElementByText");
      let result = await this._locateElementByText(
        scope,
        text,
        locatorSearch.tag,
        false,
        locatorSearch.partial === true,
        true,
        _params
      );
      logEvent(`[_collectLocatorInformation] after: _locateElementByText took ${Date.now() - _perf_t34}ms`);
      if (result.elementCount === 0) {
        info.failCause.textNotFound = true;
        info.failCause.lastError = `failed to locate ${formatElementName(element_name)} by text: ${text}`;
        return;
      }
      locatorSearch.css = "[data-blinq-id-" + result.randomToken + "]";
      if (locatorSearch.childCss) {
        locatorSearch.css = locatorSearch.css + " " + locatorSearch.childCss;
      }
      const _perf_t35 = Date.now();
      logEvent("[_collectLocatorInformation] before: _getLocator");
      locator = await this._getLocator(locatorSearch, scope, _params);
      logEvent(`[_collectLocatorInformation] after: _getLocator took ${Date.now() - _perf_t35}ms`);
    } else {
      const _perf_t36 = Date.now();
      logEvent("[_collectLocatorInformation] before: _getLocator");
      locator = await this._getLocator(locatorSearch, scope, _params);
      logEvent(`[_collectLocatorInformation] after: _getLocator took ${Date.now() - _perf_t36}ms`);
    }
    // let cssHref = false;
    // if (locatorSearch.css && locatorSearch.css.includes("href=")) {
    //   cssHref = true;
    // }

    const _perf_t37 = Date.now();
    logEvent("[_collectLocatorInformation] before: locator.count");
    let count = await locator.count();
    logEvent(`[_collectLocatorInformation] after: locator.count took ${Date.now() - _perf_t37}ms`);
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
      const _perf_t38 = Date.now();
      logEvent("[_collectLocatorInformation] before: locator.nth");
      let visible = await locator.nth(j).isVisible();
      logEvent(`[_collectLocatorInformation] after: locator.nth took ${Date.now() - _perf_t38}ms`);
      const _perf_t39 = Date.now();
      logEvent("[_collectLocatorInformation] before: locator.nth");
      const enabled = await locator.nth(j).isEnabled();
      logEvent(`[_collectLocatorInformation] after: locator.nth took ${Date.now() - _perf_t39}ms`);
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
        const _perf_t40 = Date.now();
        logEvent("[closeUnexpectedPopups] before: _scanLocatorsGroup");
        result = await this._scanLocatorsGroup(handlerGroup, scopes[i], _params, info, true);
        logEvent(`[closeUnexpectedPopups] after: _scanLocatorsGroup took ${Date.now() - _perf_t40}ms`);
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
          const _perf_t41 = Date.now();
          logEvent("[closeUnexpectedPopups] before: _scanLocatorsGroup");
          result = await this._scanLocatorsGroup(closeHandlerGroup, scopes[i], _params, info, true);
          logEvent(`[closeUnexpectedPopups] after: _scanLocatorsGroup took ${Date.now() - _perf_t41}ms`);
          if (result.foundElements.length > 0) {
            break;
          }
        }
        if (result.foundElements.length > 0) {
          let dialogCloseLocator = result.foundElements[0].locator;

          try {
            const _perf_t42 = Date.now();
            logEvent("[closeUnexpectedPopups] before: scope");
            await scope?.evaluate(() => {
              window.__isClosingPopups = true;
            });
            logEvent(`[closeUnexpectedPopups] after: scope took ${Date.now() - _perf_t42}ms`);
            const _perf_t43 = Date.now();
            logEvent("[closeUnexpectedPopups] before: dialogCloseLocator.click");
            await dialogCloseLocator.click();
            logEvent(`[closeUnexpectedPopups] after: dialogCloseLocator.click took ${Date.now() - _perf_t43}ms`);
            // wait for the dialog to close
            const _perf_t44 = Date.now();
            logEvent("[closeUnexpectedPopups] before: dialogCloseLocator.waitFor");
            await dialogCloseLocator.waitFor({ state: "hidden" });
            logEvent(`[closeUnexpectedPopups] after: dialogCloseLocator.waitFor took ${Date.now() - _perf_t44}ms`);
          } catch (e) {
          } finally {
            const _perf_t45 = Date.now();
            logEvent("[closeUnexpectedPopups] before: scope");
            await scope?.evaluate(() => {
              window.__isClosingPopups = false;
            });
            logEvent(`[closeUnexpectedPopups] after: scope took ${Date.now() - _perf_t45}ms`);
          }
          return { rerun: true };
        }
      }
    }
    return { rerun: false };
  }
  getFilePath() {
    const stackFrames = errorStackParser.parse(new Error());
    const mjsFrames = stackFrames.filter((frame) => frame.fileName && frame.fileName.endsWith(".mjs"));
    const stackFrame = mjsFrames[mjsFrames.length - 2];

    const filepath = stackFrame?.fileName;
    if (filepath) {
      let jsonFilePath = filepath.replace(".mjs", ".json");
      if (existsSync(jsonFilePath)) {
        return jsonFilePath;
      }
      const config = this.configuration ?? {};
      if (!config?.locatorsMetadataDir) {
        config.locatorsMetadataDir = "features/step_definitions/locators";
      }
      if (config && config.locatorsMetadataDir) {
        jsonFilePath = path.join(config.locatorsMetadataDir, path.basename(jsonFilePath));
      }
      if (existsSync(jsonFilePath)) {
        return jsonFilePath;
      }
      return null;
    }

    return null;
  }
  getFullElementLocators(selectors, filePath) {
    if (!filePath || !existsSync(filePath)) {
      return null;
    }
    const content = fs.readFileSync(filePath, "utf8");
    try {
      const allElements = JSON.parse(content);
      const element_key = selectors?.element_key;
      if (element_key && allElements[element_key]) {
        return allElements[element_key];
      }
      for (const elementKey in allElements) {
        const element = allElements[elementKey];
        let foundStrategy = null;

        for (const key in element) {
          if (key === "strategy") {
            continue;
          }
          const locators = element[key];
          if (!locators || !locators.length) {
            continue;
          }
          for (const locator of locators) {
            delete locator.score;
          }
          if (JSON.stringify(locators) === JSON.stringify(selectors.locators)) {
            foundStrategy = key;
            break;
          }
        }
        if (foundStrategy) {
          return element;
        }
      }
    } catch (error) {
      console.error("Error parsing locators from file: " + filePath, error);
    }
    return null;
  }
  async _locate(selectors, info, _params?: Params, timeout, allowDisabled? = false) {
    if (!timeout) {
      timeout = 30000;
    }
    let element = null;
    let allStrategyLocators = null;
    let selectedStrategy = null;
    if (this.tryAllStrategies) {
      allStrategyLocators = this.getFullElementLocators(selectors, this.getFilePath());
      selectedStrategy = allStrategyLocators?.strategy;
    }

    for (let i = 0; i < 3; i++) {
      info.log += "attempt " + i + ": total locators " + selectors.locators.length + "\n";

      for (let j = 0; j < selectors.locators.length; j++) {
        let selector = selectors.locators[j];
        info.log += "searching for locator " + j + ":" + JSON.stringify(selector) + "\n";
      }
      if (this.tryAllStrategies && selectedStrategy) {
        const strategyLocators = allStrategyLocators[selectedStrategy];
        let err;
        if (strategyLocators && strategyLocators.length) {
          try {
            selectors.locators = strategyLocators;
            const _perf_t46 = Date.now();
            logEvent("[_locate] before: _locate_internal");
            element = await this._locate_internal(selectors, info, _params, 10_000, allowDisabled);
            logEvent(`[_locate] after: _locate_internal took ${Date.now() - _perf_t46}ms`);
            info.selectedStrategy = selectedStrategy;
            info.log += "element found using strategy " + selectedStrategy + "\n";
          } catch (error) {
            err = error;
          }
        }
        if (!element) {
          for (const key in allStrategyLocators) {
            if (key === "strategy" || key === selectedStrategy) {
              continue;
            }
            const strategyLocators = allStrategyLocators[key];
            if (strategyLocators && strategyLocators.length) {
              try {
                info.log += "using strategy " + key + " with locators " + JSON.stringify(strategyLocators) + "\n";
                selectors.locators = strategyLocators;
                const _perf_t47 = Date.now();
                logEvent("[_locate] before: _locate_internal");
                element = await this._locate_internal(selectors, info, _params, 10_000, allowDisabled);
                logEvent(`[_locate] after: _locate_internal took ${Date.now() - _perf_t47}ms`);
                err = null;
                info.selectedStrategy = key;
                info.log += "element found using strategy " + key + "\n";
                break;
              } catch (error) {
                err = error;
              }
            }
          }
        }
        if (err) {
          throw err;
        }
      } else {
        const _perf_t48 = Date.now();
        logEvent("[_locate] before: _locate_internal");
        element = await this._locate_internal(selectors, info, _params, timeout, allowDisabled);
        logEvent(`[_locate] after: _locate_internal took ${Date.now() - _perf_t48}ms`);
      }

      if (!element.rerun) {
        let newElementSelector = "";
        if (this.configuration && this.configuration.stableLocatorStrategy === "csschain") {
          const _perf_t49 = Date.now();
          logEvent("[_locate] before: element.evaluate");
          const cssSelector = await element.evaluate((el) => {
            function getCssSelector(el) {
              if (!el || el.nodeType !== 1 || el === document.body) return el.tagName.toLowerCase();

              const parent = el.parentElement;
              const tag = el.tagName.toLowerCase();

              // Find the index of the element among its siblings of the same tag
              let index = 1;
              for (let sibling = el.previousElementSibling; sibling; sibling = sibling.previousElementSibling) {
                if (sibling.tagName === el.tagName) {
                  index++;
                }
              }

              // Use nth-child if necessary (i.e., if there's more than one of the same tag)
              const siblings = Array.from(parent.children).filter((child) => child.tagName === el.tagName);
              const needsNthChild = siblings.length > 1;

              const selector = needsNthChild ? `${tag}:nth-child(${[...parent.children].indexOf(el) + 1})` : tag;

              return getCssSelector(parent) + " > " + selector;
            }
            const cssSelector = getCssSelector(el);
            return cssSelector;
          });
          logEvent(`[_locate] after: element.evaluate took ${Date.now() - _perf_t49}ms`);
          newElementSelector = cssSelector;
        } else {
          const randomToken = "blinq_" + Math.random().toString(36).substring(7);

          if (this.configuration && this.configuration.stableLocatorStrategy === "data-attribute") {
            const dataAttribute = "data-blinq-id";
            const _perf_t50 = Date.now();
            logEvent("[_locate] before: element.evaluate");
            await element.evaluate(
              (el, [dataAttribute, randomToken]) => {
                el.setAttribute(dataAttribute, randomToken);
              },
              [dataAttribute, randomToken]
            );
            logEvent(`[_locate] after: element.evaluate took ${Date.now() - _perf_t50}ms`);
            newElementSelector = `[${dataAttribute}="${randomToken}"]`;
          } else {
            // the default case just return the located element
            // will not work for click and type if the locator is placeholder and the placeholder change due to the click event
            return element;
          }
        }
        const scope = element._frame ?? element.page();
        let prefixSelector = "";
        const frameControlSelector = " >> internal:control=enter-frame";
        const frameSelectorIndex = element._selector.lastIndexOf(frameControlSelector);
        if (frameSelectorIndex !== -1) {
          // remove everything after the >> internal:control=enter-frame
          const frameSelector = element._selector.substring(0, frameSelectorIndex);
          prefixSelector = frameSelector + " >> internal:control=enter-frame >> ";
        }
        // if (element?._frame?._selector) {
        //   prefixSelector = element._frame._selector + " >> " + prefixSelector;
        // }
        const newSelector = prefixSelector + newElementSelector;

        return scope.locator(newSelector).first();
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
            let testframescope = framescope.frameLocator(`${frameLocator.css} >> visible=true`);
            if (frameLocator.index) {
              testframescope = framescope.nth(frameLocator.index);
            }
            try {
              const _perf_t51 = Date.now();
              logEvent("[_findFrameScope] before: testframescope.owner");
              await testframescope.owner().evaluateHandle(() => true, null, {
                timeout: 5000,
              });
              logEvent(`[_findFrameScope] after: testframescope.owner took ${Date.now() - _perf_t51}ms`);
              framescope = testframescope;
              break;
            } catch (error) {
              // console.error("frame not found " + frameLocator.css);
            }
          }
        }
        if (frame.children) {
          const _perf_t52 = Date.now();
          logEvent("[_findFrameScope] before: findFrame");
          return await findFrame(frame.children, framescope);
          logEvent(`[_findFrameScope] after: findFrame took ${Date.now() - _perf_t52}ms`);
        }
        return framescope;
      };
      let fLocator = null;
      while (true) {
        let frameFound = false;
        if (selectors.nestFrmLoc) {
          fLocator = selectors.nestFrmLoc;
          const _perf_t53 = Date.now();
          logEvent("[_findFrameScope] before: findFrame");
          scope = await findFrame(selectors.nestFrmLoc, scope);
          logEvent(`[_findFrameScope] after: findFrame took ${Date.now() - _perf_t53}ms`);
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
          const _perf_t54 = Date.now();
          logEvent("[_findFrameScope] before: new Promise");
          await new Promise((resolve) => setTimeout(resolve, 1000));
          logEvent(`[_findFrameScope] after: new Promise took ${Date.now() - _perf_t54}ms`);
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
    const _perf_t55 = Date.now();
    logEvent("[_getDocumentBody] before: _findFrameScope");
    let scope = await this._findFrameScope(selectors, timeout, info);
    logEvent(`[_getDocumentBody] after: _findFrameScope took ${Date.now() - _perf_t55}ms`);

    return scope.evaluate(() => {
      var bodyContent = document.body.innerHTML;
      return bodyContent;
    });
  }
  async _locate_internal(selectors, info, _params?: Params, timeout = 30000, allowDisabled? = false) {
    if (selectors.locators && Array.isArray(selectors.locators)) {
      selectors.locators.forEach((locator) => {
        locator.index = locator.index ?? 0;
        locator.visible = locator.visible ?? true;
        if (locator.visible && locator.css && !locator.css.endsWith(">> visible=true")) {
          locator.css = locator.css + " >> visible=true";
        }
      });
    }
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
      const _perf_t56 = Date.now();
      logEvent("[_locate_internal] before: _findFrameScope");
      let scope = await this._findFrameScope(selectors, timeout, info);
      logEvent(`[_locate_internal] after: _findFrameScope took ${Date.now() - _perf_t56}ms`);
      locatorsCount = 0;
      let result = [];
      const _perf_t57 = Date.now();
      logEvent("[_locate_internal] before: closeUnexpectedPopups");
      let popupResult = await this.closeUnexpectedPopups(info, _params);
      logEvent(`[_locate_internal] after: closeUnexpectedPopups took ${Date.now() - _perf_t57}ms`);
      if (popupResult.rerun) {
        return popupResult;
      }
      // info.log += "scanning locators in priority 1" + "\n";
      let onlyPriority3 = selectorsLocators[0].priority === 3;
      const _perf_t58 = Date.now();
      logEvent("[_locate_internal] before: _scanLocatorsGroup");
      result = await this._scanLocatorsGroup(
        locatorsByPriority["1"],
        scope,
        _params,
        info,
        visibleOnly,
        allowDisabled,
        selectors?.element_name
      );
      logEvent(`[_locate_internal] after: _scanLocatorsGroup took ${Date.now() - _perf_t58}ms`);
      if (result.foundElements.length === 0) {
        // info.log += "scanning locators in priority 2" + "\n";
        const _perf_t59 = Date.now();
        logEvent("[_locate_internal] before: _scanLocatorsGroup");
        result = await this._scanLocatorsGroup(
          locatorsByPriority["2"],
          scope,
          _params,
          info,
          visibleOnly,
          allowDisabled,
          selectors?.element_name
        );
        logEvent(`[_locate_internal] after: _scanLocatorsGroup took ${Date.now() - _perf_t59}ms`);
      }
      if (result.foundElements.length === 0 && (onlyPriority3 || !highPriorityOnly)) {
        const _perf_t60 = Date.now();
        logEvent("[_locate_internal] before: _scanLocatorsGroup");
        result = await this._scanLocatorsGroup(
          locatorsByPriority["3"],
          scope,
          _params,
          info,
          visibleOnly,
          allowDisabled,
          selectors?.element_name
        );
        logEvent(`[_locate_internal] after: _scanLocatorsGroup took ${Date.now() - _perf_t60}ms`);
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
          const _perf_t61 = Date.now();
          logEvent("[_locate_internal] before: maxCountElement.locator.boundingBox");
          info.box = await maxCountElement.locator.boundingBox();
          logEvent(`[_locate_internal] after: maxCountElement.locator.boundingBox took ${Date.now() - _perf_t61}ms`);
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
          const _perf_t62 = Date.now();
          logEvent("[_locate_internal] before: scrollPageToLoadLazyElements");
          await scrollPageToLoadLazyElements(this.page);
          logEvent(`[_locate_internal] after: scrollPageToLoadLazyElements took ${Date.now() - _perf_t62}ms`);
        }
      }
      if (Date.now() - startTime > visibleOnlyTimeout) {
        //info.log += "visible only timeout, will try all elements" + "\n";
        visibleOnly = false;
      }
      const _perf_t63 = Date.now();
      logEvent("[_locate_internal] before: new Promise");
      await new Promise((resolve) => setTimeout(resolve, 1000));
      logEvent(`[_locate_internal] after: new Promise took ${Date.now() - _perf_t63}ms`);
      // sheck of more of half of the timeout has passed
      if (Date.now() - startTime > timeout / 2) {
        highPriorityOnly = false;
        visibleOnly = false;
      }
    }
    logEvent("unable to locate unique element, total elements found " + locatorsCount);
    // if (info.locatorLog) {
    //   const lines = info.locatorLog.toString().split("\n");
    //   for (let line of lines) {
    //     logEvent(line);
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
        const _perf_t64 = Date.now();
        logEvent("[_scanLocatorsGroup] before: _collectLocatorInformation");
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
        logEvent(`[_scanLocatorsGroup] after: _collectLocatorInformation took ${Date.now() - _perf_t64}ms`);
      } catch (e) {
        // this call can fail it the browser is navigating
        // logEvent("unable to use locator " + JSON.stringify(locatorsGroup[i]));
        // logEvent(e);
        foundLocators = [];
        try {
          const _perf_t65 = Date.now();
          logEvent("[_scanLocatorsGroup] before: _collectLocatorInformation");
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
          logEvent(`[_scanLocatorsGroup] after: _collectLocatorInformation took ${Date.now() - _perf_t65}ms`);
        } catch (e) {
          if (logErrors) {
            this.logger.info("unable to use locator (second try) " + JSON.stringify(locatorsGroup[i]));
          }
        }
      }
      if (foundLocators.length === 1) {
        let box = null;
        if (!this.onlyFailuresScreenshot) {
          const _perf_t66 = Date.now();
          logEvent("[_scanLocatorsGroup] before: foundLocators[0]");
          box = await foundLocators[0].boundingBox();
          logEvent(`[_scanLocatorsGroup] after: foundLocators[0] took ${Date.now() - _perf_t66}ms`);
        }
        result.foundElements.push({
          locator: foundLocators[0],
          box: box,
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
    const _perf_t67 = Date.now();
    logEvent("[simpleClick] before: _preCommand");
    await _preCommand(state, this);
    logEvent(`[simpleClick] after: _preCommand took ${Date.now() - _perf_t67}ms`);
    const startTime = Date.now();
    let timeout = 30000;
    if (options && options.timeout) {
      timeout = options.timeout;
    }
    while (true) {
      try {
        const _perf_t68 = Date.now();
        logEvent("[simpleClick] before: locate_element");
        const result = await locate_element(this.context, elementDescription, "click");
        logEvent(`[simpleClick] after: locate_element took ${Date.now() - _perf_t68}ms`);
        if (result?.elementNumber >= 0) {
          const selectors = {
            frame: result?.frame,
            locators: [
              {
                css: result?.css,
              },
            ],
          };

          const _perf_t69 = Date.now();
          logEvent("[simpleClick] before: click");
          await this.click(selectors, _params, options, world);
          logEvent(`[simpleClick] after: click took ${Date.now() - _perf_t69}ms`);
          return;
        }
      } catch (e) {
        if (performance.now() - startTime > timeout) {
          // throw e;
          try {
            const _perf_t70 = Date.now();
            logEvent("[simpleClick] before: _commandError");
            await _commandError(state, "timeout looking for " + elementDescription, this);
            logEvent(`[simpleClick] after: _commandError took ${Date.now() - _perf_t70}ms`);
          } finally {
            const _perf_t71 = Date.now();
            logEvent("[simpleClick] before: _commandFinally");
            await _commandFinally(state, this);
            logEvent(`[simpleClick] after: _commandFinally took ${Date.now() - _perf_t71}ms`);
          }
        }
      }
      const _perf_t72 = Date.now();
      logEvent("[simpleClick] before: new Promise");
      await new Promise((resolve) => setTimeout(resolve, 3000));
      logEvent(`[simpleClick] after: new Promise took ${Date.now() - _perf_t72}ms`);
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
    const _perf_t73 = Date.now();
    logEvent("[simpleClickType] before: _preCommand");
    await _preCommand(state, this);
    logEvent(`[simpleClickType] after: _preCommand took ${Date.now() - _perf_t73}ms`);
    const startTime = Date.now();
    let timeout = 30000;
    if (options && options.timeout) {
      timeout = options.timeout;
    }
    while (true) {
      try {
        const _perf_t74 = Date.now();
        logEvent("[simpleClickType] before: locate_element");
        const result = await locate_element(this.context, elementDescription, "fill", value);
        logEvent(`[simpleClickType] after: locate_element took ${Date.now() - _perf_t74}ms`);
        if (result?.elementNumber >= 0) {
          const selectors = {
            frame: result?.frame,
            locators: [
              {
                css: result?.css,
              },
            ],
          };

          const _perf_t75 = Date.now();
          logEvent("[simpleClickType] before: clickType");
          await this.clickType(selectors, value, false, _params, options, world);
          logEvent(`[simpleClickType] after: clickType took ${Date.now() - _perf_t75}ms`);
          return;
        }
      } catch (e) {
        if (performance.now() - startTime > timeout) {
          // throw e;
          try {
            const _perf_t76 = Date.now();
            logEvent("[simpleClickType] before: _commandError");
            await _commandError(state, "timeout looking for " + elementDescription, this);
            logEvent(`[simpleClickType] after: _commandError took ${Date.now() - _perf_t76}ms`);
          } finally {
            const _perf_t77 = Date.now();
            logEvent("[simpleClickType] before: _commandFinally");
            await _commandFinally(state, this);
            logEvent(`[simpleClickType] after: _commandFinally took ${Date.now() - _perf_t77}ms`);
          }
        }
      }
      const _perf_t78 = Date.now();
      logEvent("[simpleClickType] before: new Promise");
      await new Promise((resolve) => setTimeout(resolve, 3000));
      logEvent(`[simpleClickType] after: new Promise took ${Date.now() - _perf_t78}ms`);
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
    check_performance("click_all ***", this.context, true);
    let stepFastMode = this.stepTags.includes("fast-mode");
    if (stepFastMode) {
      state.onlyFailuresScreenshot = true;
      state.scroll = false;
      state.highlight = false;
    }
    try {
      check_performance("click_preCommand", this.context, true);
      const _perf_t79 = Date.now();
      logEvent("[click] before: _preCommand");
      await _preCommand(state, this);
      logEvent(`[click] after: _preCommand took ${Date.now() - _perf_t79}ms`);
      check_performance("click_preCommand", this.context, false);
      const _perf_t80 = Date.now();
      logEvent("[click] before: performAction");
      await performAction("click", state.element, options, this, state, _params);
      logEvent(`[click] after: performAction took ${Date.now() - _perf_t80}ms`);
      if (!this.fastMode && !this.stepTags.includes("fast-mode")) {
        check_performance("click_waitForPageLoad", this.context, true);
        const _perf_t81 = Date.now();
        logEvent("[click] before: waitForPageLoad");
        await this.waitForPageLoad({ noSleep: true });
        logEvent(`[click] after: waitForPageLoad took ${Date.now() - _perf_t81}ms`);
        check_performance("click_waitForPageLoad", this.context, false);
      }
      return state.info;
    } catch (e) {
      const _perf_t82 = Date.now();
      logEvent("[click] before: _commandError");
      await _commandError(state, e, this);
      logEvent(`[click] after: _commandError took ${Date.now() - _perf_t82}ms`);
    } finally {
      check_performance("click_commandFinally", this.context, true);
      const _perf_t83 = Date.now();
      logEvent("[click] before: _commandFinally");
      await _commandFinally(state, this);
      logEvent(`[click] after: _commandFinally took ${Date.now() - _perf_t83}ms`);
      check_performance("click_commandFinally", this.context, false);
      check_performance("click_all ***", this.context, false);
      if (this.context.profile) {
        console.log(JSON.stringify(this.context.profile, null, 2));
      }
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
      const _perf_t84 = Date.now();
      logEvent("[waitForElement] before: _preCommand");
      await _preCommand(state, this);
      logEvent(`[waitForElement] after: _preCommand took ${Date.now() - _perf_t84}ms`);
      // if (state.options && state.options.context) {
      //   state.selectors.locators[0].text = state.options.context;
      // }
      const _perf_t85 = Date.now();
      logEvent("[waitForElement] before: state.element.waitFor");
      await state.element.waitFor({ timeout: timeout });
      logEvent(`[waitForElement] after: state.element.waitFor took ${Date.now() - _perf_t85}ms`);
      found = true;
      // await new Promise((resolve) => setTimeout(resolve, 1000));
    } catch (e) {
      console.error("Error on waitForElement", e);
      // await _commandError(state, e, this);
    } finally {
      const _perf_t86 = Date.now();
      logEvent("[waitForElement] before: _commandFinally");
      await _commandFinally(state, this);
      logEvent(`[waitForElement] after: _commandFinally took ${Date.now() - _perf_t86}ms`);
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
      const _perf_t87 = Date.now();
      logEvent("[setCheck] before: _preCommand");
      await _preCommand(state, this);
      logEvent(`[setCheck] after: _preCommand took ${Date.now() - _perf_t87}ms`);
      state.info.checked = checked;
      // let element = await this._locate(selectors, info, _params);

      // ({ screenshotId, screenshotPath } = await this._screenShot(options, world, info));
      try {
        // if (world && world.screenshot && !world.screenshotPath) {
        // console.log(`Highlighting while running from recorder`);
        const _perf_t88 = Date.now();
        logEvent("[setCheck] before: _highlightElements");
        await this._highlightElements(state.element);
        logEvent(`[setCheck] after: _highlightElements took ${Date.now() - _perf_t88}ms`);
        const _perf_t89 = Date.now();
        logEvent("[setCheck] before: state.element.setChecked");
        await state.element.setChecked(checked, { timeout: 2000 });
        logEvent(`[setCheck] after: state.element.setChecked took ${Date.now() - _perf_t89}ms`);
        const _perf_t90 = Date.now();
        logEvent("[setCheck] before: new Promise");
        await new Promise((resolve) => setTimeout(resolve, 1000));
        logEvent(`[setCheck] after: new Promise took ${Date.now() - _perf_t90}ms`);
        // await this._unHighlightElements(element);
        // }
        // await new Promise((resolve) => setTimeout(resolve, 1000));
        //  await this._unHighlightElements(element);
      } catch (e) {
        if (e.message && e.message.includes("did not change its state")) {
          this.logger.info("element did not change its state, ignoring...");
        } else {
          const _perf_t91 = Date.now();
          logEvent("[setCheck] before: new Promise");
          await new Promise((resolve) => setTimeout(resolve, 1000));
          logEvent(`[setCheck] after: new Promise took ${Date.now() - _perf_t91}ms`);
          //await this.closeUnexpectedPopups();
          state.info.log += "setCheck failed, will try again" + "\n";
          state.element_found = false;
          try {
            const _perf_t92 = Date.now();
            logEvent("[setCheck] before: _locate");
            state.element = await this._locate(selectors, state.info, _params, 100);
            logEvent(`[setCheck] after: _locate took ${Date.now() - _perf_t92}ms`);
            state.element_found = true;
            // check the check state
          } catch (error) {
            // element dismissed
          }
          if (state.element_found) {
            const _perf_t93 = Date.now();
            logEvent("[setCheck] before: state.element.isChecked");
            const isChecked = await state.element.isChecked();
            logEvent(`[setCheck] after: state.element.isChecked took ${Date.now() - _perf_t93}ms`);
            if (isChecked !== checked) {
              // perform click
              const _perf_t94 = Date.now();
              logEvent("[setCheck] before: state.element.click");
              await state.element.click({ timeout: 2000, force: true });
              logEvent(`[setCheck] after: state.element.click took ${Date.now() - _perf_t94}ms`);
            } else {
              this.logger.info(`Element ${selectors.element_name} is already in the desired state (${checked})`);
            }
          }
        }
      }
      //await this.waitForPageLoad();
      return state.info;
    } catch (e) {
      const _perf_t95 = Date.now();
      logEvent("[setCheck] before: _commandError");
      await _commandError(state, e, this);
      logEvent(`[setCheck] after: _commandError took ${Date.now() - _perf_t95}ms`);
    } finally {
      const _perf_t96 = Date.now();
      logEvent("[setCheck] before: _commandFinally");
      await _commandFinally(state, this);
      logEvent(`[setCheck] after: _commandFinally took ${Date.now() - _perf_t96}ms`);
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
      const _perf_t97 = Date.now();
      logEvent("[hover] before: _preCommand");
      await _preCommand(state, this);
      logEvent(`[hover] after: _preCommand took ${Date.now() - _perf_t97}ms`);
      const _perf_t98 = Date.now();
      logEvent("[hover] before: performAction");
      await performAction("hover", state.element, options, this, state, _params);
      logEvent(`[hover] after: performAction took ${Date.now() - _perf_t98}ms`);
      const _perf_t99 = Date.now();
      logEvent("[hover] before: _screenshot");
      await _screenshot(state, this);
      logEvent(`[hover] after: _screenshot took ${Date.now() - _perf_t99}ms`);
      //await this.waitForPageLoad();
      return state.info;
    } catch (e) {
      const _perf_t100 = Date.now();
      logEvent("[hover] before: _commandError");
      await _commandError(state, e, this);
      logEvent(`[hover] after: _commandError took ${Date.now() - _perf_t100}ms`);
    } finally {
      const _perf_t101 = Date.now();
      logEvent("[hover] before: _commandFinally");
      await _commandFinally(state, this);
      logEvent(`[hover] after: _commandFinally took ${Date.now() - _perf_t101}ms`);
    }
  }

  async selectOption(selectors, values, _params = null, options = {}, world = null) {
    // commented out this condition as some select elements have NULL values by default.
    // if (!values) {
    //   throw new Error("values is null");
    // }
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
      const _perf_t102 = Date.now();
      logEvent("[selectOption] before: _preCommand");
      await _preCommand(state, this);
      logEvent(`[selectOption] after: _preCommand took ${Date.now() - _perf_t102}ms`);
      try {
        const _perf_t103 = Date.now();
        logEvent("[selectOption] before: state.element.selectOption");
        await state.element.selectOption(values);
        logEvent(`[selectOption] after: state.element.selectOption took ${Date.now() - _perf_t103}ms`);
      } catch (e) {
        //await this.closeUnexpectedPopups();
        state.info.log += "selectOption failed, will try force" + "\n";
        const _perf_t104 = Date.now();
        logEvent("[selectOption] before: state.element.selectOption");
        await state.element.selectOption(values, { timeout: 10000, force: true });
        logEvent(`[selectOption] after: state.element.selectOption took ${Date.now() - _perf_t104}ms`);
      }
      //await this.waitForPageLoad();
      return state.info;
    } catch (e) {
      const _perf_t105 = Date.now();
      logEvent("[selectOption] before: _commandError");
      await _commandError(state, e, this);
      logEvent(`[selectOption] after: _commandError took ${Date.now() - _perf_t105}ms`);
    } finally {
      const _perf_t106 = Date.now();
      logEvent("[selectOption] before: _commandFinally");
      await _commandFinally(state, this);
      logEvent(`[selectOption] after: _commandFinally took ${Date.now() - _perf_t106}ms`);
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
      const _perf_t107 = Date.now();
      logEvent("[type] before: _preCommand");
      await _preCommand(state, this);
      logEvent(`[type] after: _preCommand took ${Date.now() - _perf_t107}ms`);
      const valueSegment = state.value.split("&&");
      for (let i = 0; i < valueSegment.length; i++) {
        if (i > 0) {
          const _perf_t108 = Date.now();
          logEvent("[type] before: new Promise");
          await new Promise((resolve) => setTimeout(resolve, 1000));
          logEvent(`[type] after: new Promise took ${Date.now() - _perf_t108}ms`);
        }
        let value = valueSegment[i];
        const _perf_t109 = Date.now();
        logEvent("[type] before: _replaceWithLocalData");
        value = await this._replaceWithLocalData(value, this);
        logEvent(`[type] after: _replaceWithLocalData took ${Date.now() - _perf_t109}ms`);
        let keyEvent = false;
        KEYBOARD_EVENTS.forEach((event) => {
          if (value === event || value.startsWith(event + "+")) {
            keyEvent = true;
          }
        });
        if (keyEvent) {
          const _perf_t110 = Date.now();
          logEvent("[type] before: page.keyboard.press");
          await this.page.keyboard.press(value);
          logEvent(`[type] after: page.keyboard.press took ${Date.now() - _perf_t110}ms`);
        } else {
          const _perf_t111 = Date.now();
          logEvent("[type] before: page.keyboard.type");
          await this.page.keyboard.type(value);
          logEvent(`[type] after: page.keyboard.type took ${Date.now() - _perf_t111}ms`);
        }
      }
      return state.info;
    } catch (e) {
      const _perf_t112 = Date.now();
      logEvent("[type] before: _commandError");
      await _commandError(state, e, this);
      logEvent(`[type] after: _commandError took ${Date.now() - _perf_t112}ms`);
    } finally {
      const _perf_t113 = Date.now();
      logEvent("[type] before: _commandFinally");
      await _commandFinally(state, this);
      logEvent(`[type] after: _commandFinally took ${Date.now() - _perf_t113}ms`);
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
      const _perf_t114 = Date.now();
      logEvent("[setInputValue] before: _preCommand");
      await _preCommand(state, this);
      logEvent(`[setInputValue] after: _preCommand took ${Date.now() - _perf_t114}ms`);

      const _perf_t115 = Date.now();
      logEvent("[setInputValue] before: _replaceWithLocalData");
      let value = await this._replaceWithLocalData(state.value, this);
      logEvent(`[setInputValue] after: _replaceWithLocalData took ${Date.now() - _perf_t115}ms`);
      try {
        const _perf_t116 = Date.now();
        logEvent("[setInputValue] before: state.element.evaluateHandle");
        await state.element.evaluateHandle((el, value) => {
          el.value = value;
        }, value);
        logEvent(`[setInputValue] after: state.element.evaluateHandle took ${Date.now() - _perf_t116}ms`);
      } catch (error) {
        this.logger.error("setInputValue failed, will try again");
        const _perf_t117 = Date.now();
        logEvent("[setInputValue] before: _screenshot");
        await _screenshot(state, this);
        logEvent(`[setInputValue] after: _screenshot took ${Date.now() - _perf_t117}ms`);
        Object.assign(error, { info: state.info });
        const _perf_t118 = Date.now();
        logEvent("[setInputValue] before: state.element.evaluateHandle");
        await state.element.evaluateHandle((el, value) => {
          el.value = value;
        });
        logEvent(`[setInputValue] after: state.element.evaluateHandle took ${Date.now() - _perf_t118}ms`);
      }
    } catch (e) {
      const _perf_t119 = Date.now();
      logEvent("[setInputValue] before: _commandError");
      await _commandError(state, e, this);
      logEvent(`[setInputValue] after: _commandError took ${Date.now() - _perf_t119}ms`);
    } finally {
      const _perf_t120 = Date.now();
      logEvent("[setInputValue] before: _commandFinally");
      await _commandFinally(state, this);
      logEvent(`[setInputValue] after: _commandFinally took ${Date.now() - _perf_t120}ms`);
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
      // throwError: false,
    };
    try {
      const _perf_t121 = Date.now();
      logEvent("[setDateTime] before: _preCommand");
      await _preCommand(state, this);
      logEvent(`[setDateTime] after: _preCommand took ${Date.now() - _perf_t121}ms`);
      try {
        const _perf_t122 = Date.now();
        logEvent("[setDateTime] before: performAction");
        await performAction("click", state.element, options, this, state, _params);
        logEvent(`[setDateTime] after: performAction took ${Date.now() - _perf_t122}ms`);
        const _perf_t123 = Date.now();
        logEvent("[setDateTime] before: new Promise");
        await new Promise((resolve) => setTimeout(resolve, 500));
        logEvent(`[setDateTime] after: new Promise took ${Date.now() - _perf_t123}ms`);
        if (format) {
          state.value = dayjs(state.value).format(format);
          const _perf_t124 = Date.now();
          logEvent("[setDateTime] before: state.element.fill");
          await state.element.fill(state.value);
          logEvent(`[setDateTime] after: state.element.fill took ${Date.now() - _perf_t124}ms`);
        } else {
          const _perf_t125 = Date.now();
          logEvent("[setDateTime] before: getDateTimeValue");
          const dateTimeValue = await getDateTimeValue({ value: state.value, element: state.element });
          logEvent(`[setDateTime] after: getDateTimeValue took ${Date.now() - _perf_t125}ms`);
          const _perf_t126 = Date.now();
          logEvent("[setDateTime] before: state.element.evaluateHandle");
          await state.element.evaluateHandle((el, dateTimeValue) => {
            el.value = ""; // clear input
            el.value = dateTimeValue;
          }, dateTimeValue);
          logEvent(`[setDateTime] after: state.element.evaluateHandle took ${Date.now() - _perf_t126}ms`);
        }
        if (enter) {
          const _perf_t127 = Date.now();
          logEvent("[setDateTime] before: new Promise");
          await new Promise((resolve) => setTimeout(resolve, 2000));
          logEvent(`[setDateTime] after: new Promise took ${Date.now() - _perf_t127}ms`);
          const _perf_t128 = Date.now();
          logEvent("[setDateTime] before: page.keyboard.press");
          await this.page.keyboard.press("Enter");
          logEvent(`[setDateTime] after: page.keyboard.press took ${Date.now() - _perf_t128}ms`);
          const _perf_t129 = Date.now();
          logEvent("[setDateTime] before: waitForPageLoad");
          await this.waitForPageLoad();
          logEvent(`[setDateTime] after: waitForPageLoad took ${Date.now() - _perf_t129}ms`);
        }
      } catch (err) {
        //await this.closeUnexpectedPopups();
        this.logger.error("setting date time input failed " + JSON.stringify(state.info));
        this.logger.info("Trying again");
        const _perf_t130 = Date.now();
        logEvent("[setDateTime] before: _screenshot");
        await _screenshot(state, this);
        logEvent(`[setDateTime] after: _screenshot took ${Date.now() - _perf_t130}ms`);
        Object.assign(err, { info: state.info });
        const _perf_t131 = Date.now();
        logEvent("[setDateTime] before: element.click");
        await element.click();
        logEvent(`[setDateTime] after: element.click took ${Date.now() - _perf_t131}ms`);
        const _perf_t132 = Date.now();
        logEvent("[setDateTime] before: new Promise");
        await new Promise((resolve) => setTimeout(resolve, 500));
        logEvent(`[setDateTime] after: new Promise took ${Date.now() - _perf_t132}ms`);
        if (format) {
          state.value = dayjs(state.value).format(format);
          const _perf_t133 = Date.now();
          logEvent("[setDateTime] before: state.element.fill");
          await state.element.fill(state.value);
          logEvent(`[setDateTime] after: state.element.fill took ${Date.now() - _perf_t133}ms`);
        } else {
          const _perf_t134 = Date.now();
          logEvent("[setDateTime] before: getDateTimeValue");
          const dateTimeValue = await getDateTimeValue({ value: state.value, element: state.element });
          logEvent(`[setDateTime] after: getDateTimeValue took ${Date.now() - _perf_t134}ms`);
          const _perf_t135 = Date.now();
          logEvent("[setDateTime] before: state.element.evaluateHandle");
          await state.element.evaluateHandle((el, dateTimeValue) => {
            el.value = ""; // clear input
            el.value = dateTimeValue;
          }, dateTimeValue);
          logEvent(`[setDateTime] after: state.element.evaluateHandle took ${Date.now() - _perf_t135}ms`);
        }
        if (enter) {
          const _perf_t136 = Date.now();
          logEvent("[setDateTime] before: new Promise");
          await new Promise((resolve) => setTimeout(resolve, 2000));
          logEvent(`[setDateTime] after: new Promise took ${Date.now() - _perf_t136}ms`);
          const _perf_t137 = Date.now();
          logEvent("[setDateTime] before: page.keyboard.press");
          await this.page.keyboard.press("Enter");
          logEvent(`[setDateTime] after: page.keyboard.press took ${Date.now() - _perf_t137}ms`);
          const _perf_t138 = Date.now();
          logEvent("[setDateTime] before: waitForPageLoad");
          await this.waitForPageLoad();
          logEvent(`[setDateTime] after: waitForPageLoad took ${Date.now() - _perf_t138}ms`);
        }
      }
    } catch (e) {
      const _perf_t139 = Date.now();
      logEvent("[setDateTime] before: _commandError");
      await _commandError(state, e, this);
      logEvent(`[setDateTime] after: _commandError took ${Date.now() - _perf_t139}ms`);
    } finally {
      const _perf_t140 = Date.now();
      logEvent("[setDateTime] before: _commandFinally");
      await _commandFinally(state, this);
      logEvent(`[setDateTime] after: _commandFinally took ${Date.now() - _perf_t140}ms`);
    }
  }

  async clickType(selectors, _value, enter = false, _params = null, options = {}, world = null) {
    _value = unEscapeString(_value);
    const _perf_t141 = Date.now();
    logEvent("[clickType] before: _replaceWithLocalData");
    const newValue = await this._replaceWithLocalData(_value, world);
    logEvent(`[clickType] after: _replaceWithLocalData took ${Date.now() - _perf_t141}ms`);
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
      const _perf_t142 = Date.now();
      logEvent("[clickType] before: _preCommand");
      await _preCommand(state, this);
      logEvent(`[clickType] after: _preCommand took ${Date.now() - _perf_t142}ms`);
      const randomToken = "blinq_" + Math.random().toString(36).substring(7);
      // tag the element
      const _perf_t143 = Date.now();
      logEvent("[clickType] before: state.element.evaluate");
      let newElementSelector = await state.element.evaluate((el: HTMLElement, token: string) => {
        // use attribute and not id
        const attrName = `data-blinq-id-${token}`;
        el.setAttribute(attrName, "");
        return `[${attrName}]`;
      }, randomToken);
      logEvent(`[clickType] after: state.element.evaluate took ${Date.now() - _perf_t143}ms`);

      state.info.value = _value;
      if (!options.press) {
        try {
          const _perf_t144 = Date.now();
          logEvent("[clickType] before: state.element.inputValue");
          let currentValue = await state.element.inputValue();
          logEvent(`[clickType] after: state.element.inputValue took ${Date.now() - _perf_t144}ms`);
          if (currentValue) {
            const _perf_t145 = Date.now();
            logEvent("[clickType] before: state.element.fill");
            await state.element.fill("");
            logEvent(`[clickType] after: state.element.fill took ${Date.now() - _perf_t145}ms`);
          }
        } catch (e) {
          this.logger.info("unable to clear input value");
        }
      }

      if (options.press) {
        options.timeout = 5000;

        const _perf_t146 = Date.now();
        logEvent("[clickType] before: performAction");
        await performAction("click", state.element, options, this, state, _params);
        logEvent(`[clickType] after: performAction took ${Date.now() - _perf_t146}ms`);
      } else {
        try {
          const _perf_t147 = Date.now();
          logEvent("[clickType] before: state.element.focus");
          await state.element.focus();
          logEvent(`[clickType] after: state.element.focus took ${Date.now() - _perf_t147}ms`);
        } catch (e) {
          const _perf_t148 = Date.now();
          logEvent("[clickType] before: state.element.dispatchEvent");
          await state.element.dispatchEvent("focus");
          logEvent(`[clickType] after: state.element.dispatchEvent took ${Date.now() - _perf_t148}ms`);
        }
      }
      const _perf_t149 = Date.now();
      logEvent("[clickType] before: new Promise");
      await new Promise((resolve) => setTimeout(resolve, 500));
      logEvent(`[clickType] after: new Promise took ${Date.now() - _perf_t149}ms`);
      // check if the element exist after the click (no wait)
      const _perf_t150 = Date.now();
      logEvent("[clickType] before: state.element.count");
      const count = await state.element.count({ timeout: 0 });
      logEvent(`[clickType] after: state.element.count took ${Date.now() - _perf_t150}ms`);
      if (count === 0) {
        // the locator changed after the click (placeholder) we need to locate the element using the data-blinq-id
        const scope = state.element._frame ?? element.page();
        let prefixSelector = "";
        const frameControlSelector = " >> internal:control=enter-frame";
        const frameSelectorIndex = state.element._selector.lastIndexOf(frameControlSelector);
        if (frameSelectorIndex !== -1) {
          // remove everything after the >> internal:control=enter-frame
          const frameSelector = state.element._selector.substring(0, frameSelectorIndex);
          prefixSelector = frameSelector + " >> internal:control=enter-frame >> ";
        }
        // if (element?._frame?._selector) {
        //   prefixSelector = element._frame._selector + " >> " + prefixSelector;
        // }
        const newSelector = prefixSelector + newElementSelector;

        state.element = scope.locator(newSelector).first();
      }

      const valueSegment = state.value.split("&&");
      for (let i = 0; i < valueSegment.length; i++) {
        if (i > 0) {
          const _perf_t151 = Date.now();
          logEvent("[clickType] before: new Promise");
          await new Promise((resolve) => setTimeout(resolve, 1000));
          logEvent(`[clickType] after: new Promise took ${Date.now() - _perf_t151}ms`);
        }
        let value = valueSegment[i];
        let keyEvent = false;
        KEYBOARD_EVENTS.forEach((event) => {
          if (value === event || value.startsWith(event + "+")) {
            keyEvent = true;
          }
        });
        if (keyEvent) {
          const _perf_t152 = Date.now();
          logEvent("[clickType] before: page.keyboard.press");
          await this.page.keyboard.press(value);
          logEvent(`[clickType] after: page.keyboard.press took ${Date.now() - _perf_t152}ms`);
        } else {
          const _perf_t153 = Date.now();
          logEvent("[clickType] before: page.keyboard.type");
          await this.page.keyboard.type(value);
          logEvent(`[clickType] after: page.keyboard.type took ${Date.now() - _perf_t153}ms`);
          const _perf_t154 = Date.now();
          logEvent("[clickType] before: new Promise");
          await new Promise((resolve) => setTimeout(resolve, 500));
          logEvent(`[clickType] after: new Promise took ${Date.now() - _perf_t154}ms`);
        }
      }
      //if (!this.fastMode) {
      const _perf_t155 = Date.now();
      logEvent("[clickType] before: _screenshot");
      await _screenshot(state, this);
      logEvent(`[clickType] after: _screenshot took ${Date.now() - _perf_t155}ms`);
      //}
      if (enter === true) {
        const _perf_t156 = Date.now();
        logEvent("[clickType] before: new Promise");
        await new Promise((resolve) => setTimeout(resolve, 2000));
        logEvent(`[clickType] after: new Promise took ${Date.now() - _perf_t156}ms`);
        const _perf_t157 = Date.now();
        logEvent("[clickType] before: page.keyboard.press");
        await this.page.keyboard.press("Enter");
        logEvent(`[clickType] after: page.keyboard.press took ${Date.now() - _perf_t157}ms`);
        const _perf_t158 = Date.now();
        logEvent("[clickType] before: waitForPageLoad");
        await this.waitForPageLoad();
        logEvent(`[clickType] after: waitForPageLoad took ${Date.now() - _perf_t158}ms`);
      } else if (enter === false) {
        try {
          const _perf_t159 = Date.now();
          logEvent("[clickType] before: state.element.dispatchEvent");
          await state.element.dispatchEvent("change", null, { timeout: 5000 });
          logEvent(`[clickType] after: state.element.dispatchEvent took ${Date.now() - _perf_t159}ms`);
        } catch (e) {
          // ignore
        }
        //await this.page.keyboard.press("Tab");
      } else {
        if (enter !== "" && enter !== null && enter !== undefined) {
          const _perf_t160 = Date.now();
          logEvent("[clickType] before: page.keyboard.press");
          await this.page.keyboard.press(enter);
          logEvent(`[clickType] after: page.keyboard.press took ${Date.now() - _perf_t160}ms`);
          const _perf_t161 = Date.now();
          logEvent("[clickType] before: waitForPageLoad");
          await this.waitForPageLoad();
          logEvent(`[clickType] after: waitForPageLoad took ${Date.now() - _perf_t161}ms`);
        }
      }
      return state.info;
    } catch (e) {
      const _perf_t162 = Date.now();
      logEvent("[clickType] before: _commandError");
      await _commandError(state, e, this);
      logEvent(`[clickType] after: _commandError took ${Date.now() - _perf_t162}ms`);
    } finally {
      const _perf_t163 = Date.now();
      logEvent("[clickType] before: _commandFinally");
      await _commandFinally(state, this);
      logEvent(`[clickType] after: _commandFinally took ${Date.now() - _perf_t163}ms`);
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
      const _perf_t164 = Date.now();
      logEvent("[fill] before: _preCommand");
      await _preCommand(state, this);
      logEvent(`[fill] after: _preCommand took ${Date.now() - _perf_t164}ms`);
      const _perf_t165 = Date.now();
      logEvent("[fill] before: state.element.fill");
      await state.element.fill(value);
      logEvent(`[fill] after: state.element.fill took ${Date.now() - _perf_t165}ms`);
      const _perf_t166 = Date.now();
      logEvent("[fill] before: state.element.dispatchEvent");
      await state.element.dispatchEvent("change");
      logEvent(`[fill] after: state.element.dispatchEvent took ${Date.now() - _perf_t166}ms`);
      if (enter) {
        const _perf_t167 = Date.now();
        logEvent("[fill] before: new Promise");
        await new Promise((resolve) => setTimeout(resolve, 2000));
        logEvent(`[fill] after: new Promise took ${Date.now() - _perf_t167}ms`);
        const _perf_t168 = Date.now();
        logEvent("[fill] before: page.keyboard.press");
        await this.page.keyboard.press("Enter");
        logEvent(`[fill] after: page.keyboard.press took ${Date.now() - _perf_t168}ms`);
        const _perf_t169 = Date.now();
        logEvent("[fill] before: waitForPageLoad");
        await this.waitForPageLoad();
        logEvent(`[fill] after: waitForPageLoad took ${Date.now() - _perf_t169}ms`);
      }
      return state.info;
    } catch (e) {
      const _perf_t170 = Date.now();
      logEvent("[fill] before: _commandError");
      await _commandError(state, e, this);
      logEvent(`[fill] after: _commandError took ${Date.now() - _perf_t170}ms`);
    } finally {
      const _perf_t171 = Date.now();
      logEvent("[fill] before: _commandFinally");
      await _commandFinally(state, this);
      logEvent(`[fill] after: _commandFinally took ${Date.now() - _perf_t171}ms`);
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
      const _perf_t172 = Date.now();
      logEvent("[setInputFiles] before: _preCommand");
      await _preCommand(state, this);
      logEvent(`[setInputFiles] after: _preCommand took ${Date.now() - _perf_t172}ms`);
      for (let i = 0; i < files.length; i++) {
        const file = files[i];
        const filePath = path.join(uploadsFolder, file);
        if (!fs.existsSync(filePath)) {
          throw new Error(`File not found: ${filePath}`);
        }
        state.files[i] = filePath;
      }
      const _perf_t173 = Date.now();
      logEvent("[setInputFiles] before: state.element.setInputFiles");
      await state.element.setInputFiles(files);
      logEvent(`[setInputFiles] after: state.element.setInputFiles took ${Date.now() - _perf_t173}ms`);
      return state.info;
    } catch (e) {
      const _perf_t174 = Date.now();
      logEvent("[setInputFiles] before: _commandError");
      await _commandError(state, e, this);
      logEvent(`[setInputFiles] after: _commandError took ${Date.now() - _perf_t174}ms`);
    } finally {
      const _perf_t175 = Date.now();
      logEvent("[setInputFiles] before: _commandFinally");
      await _commandFinally(state, this);
      logEvent(`[setInputFiles] after: _commandFinally took ${Date.now() - _perf_t175}ms`);
    }
  }
  async getText(selectors, _params = null, options = {}, info = {}, world = null) {
    const _perf_t176 = Date.now();
    logEvent("[getText] before: _getText");
    return await this._getText(selectors, 0, _params, options, info, world);
    logEvent(`[getText] after: _getText took ${Date.now() - _perf_t176}ms`);
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
    const _perf_t177 = Date.now();
    logEvent("[_getText] before: _locate");
    let element = await this._locate(selectors, info, _params, timeout);
    logEvent(`[_getText] after: _locate took ${Date.now() - _perf_t177}ms`);
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
      const _perf_t178 = Date.now();
      logEvent("[_getText] before: element.inputValue");
      value = await element.inputValue();
      logEvent(`[_getText] after: element.inputValue took ${Date.now() - _perf_t178}ms`);
    } catch (e) {
      //ignore
    }
    ({ screenshotId, screenshotPath } = await this._screenShot(options, world, info));
    try {
      const _perf_t179 = Date.now();
      logEvent("[_getText] before: _highlightElements");
      await this._highlightElements(element);
      logEvent(`[_getText] after: _highlightElements took ${Date.now() - _perf_t179}ms`);
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
      const _perf_t180 = Date.now();
      logEvent("[_getText] before: element.innerText");
      const elementText = await element.innerText();
      logEvent(`[_getText] after: element.innerText took ${Date.now() - _perf_t180}ms`);
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
      const _perf_t181 = Date.now();
      logEvent("[_getText] before: element.textContent");
      const elementText = await element.textContent();
      logEvent(`[_getText] after: element.textContent took ${Date.now() - _perf_t181}ms`);
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

    const _perf_t182 = Date.now();
    logEvent("[containsPattern] before: _replaceWithLocalData");
    const newValue = await this._replaceWithLocalData(text, world);
    logEvent(`[containsPattern] after: _replaceWithLocalData took ${Date.now() - _perf_t182}ms`);
    if (newValue !== text) {
      this.logger.info(text + "=" + newValue);
      text = newValue;
    }

    let foundObj = null;
    try {
      const _perf_t183 = Date.now();
      logEvent("[containsPattern] before: _preCommand");
      await _preCommand(state, this);
      logEvent(`[containsPattern] after: _preCommand took ${Date.now() - _perf_t183}ms`);
      state.info.pattern = pattern;
      const _perf_t184 = Date.now();
      logEvent("[containsPattern] before: _getText");
      foundObj = await this._getText(selectors, 0, _params, options, state.info, world);
      logEvent(`[containsPattern] after: _getText took ${Date.now() - _perf_t184}ms`);
      if (foundObj && foundObj.element) {
        const _perf_t185 = Date.now();
        logEvent("[containsPattern] before: scrollIfNeeded");
        await this.scrollIfNeeded(foundObj.element, state.info);
        logEvent(`[containsPattern] after: scrollIfNeeded took ${Date.now() - _perf_t185}ms`);
      }
      const _perf_t186 = Date.now();
      logEvent("[containsPattern] before: _screenshot");
      await _screenshot(state, this);
      logEvent(`[containsPattern] after: _screenshot took ${Date.now() - _perf_t186}ms`);
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
      const _perf_t187 = Date.now();
      logEvent("[containsPattern] before: _commandError");
      await _commandError(state, e, this);
      logEvent(`[containsPattern] after: _commandError took ${Date.now() - _perf_t187}ms`);
    } finally {
      const _perf_t188 = Date.now();
      logEvent("[containsPattern] before: _commandFinally");
      await _commandFinally(state, this);
      logEvent(`[containsPattern] after: _commandFinally took ${Date.now() - _perf_t188}ms`);
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

    const _perf_t189 = Date.now();
    logEvent("[containsText] before: _replaceWithLocalData");
    const newValue = await this._replaceWithLocalData(text, world);
    logEvent(`[containsText] after: _replaceWithLocalData took ${Date.now() - _perf_t189}ms`);
    if (newValue !== text) {
      this.logger.info(text + "=" + newValue);
      text = newValue;
    }

    let foundObj = null;
    try {
      while (Date.now() - startTime < timeout) {
        try {
          const _perf_t190 = Date.now();
          logEvent("[containsText] before: _preCommand");
          await _preCommand(state, this);
          logEvent(`[containsText] after: _preCommand took ${Date.now() - _perf_t190}ms`);
          const _perf_t191 = Date.now();
          logEvent("[containsText] before: _getText");
          foundObj = await this._getText(selectors, climb, _params, { timeout: 3000 }, state.info, world);
          logEvent(`[containsText] after: _getText took ${Date.now() - _perf_t191}ms`);

          if (foundObj && foundObj.element) {
            const _perf_t192 = Date.now();
            logEvent("[containsText] before: scrollIfNeeded");
            await this.scrollIfNeeded(foundObj.element, state.info);
            logEvent(`[containsText] after: scrollIfNeeded took ${Date.now() - _perf_t192}ms`);
          }

          const _perf_t193 = Date.now();
          logEvent("[containsText] before: _screenshot");
          await _screenshot(state, this);
          logEvent(`[containsText] after: _screenshot took ${Date.now() - _perf_t193}ms`);
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
        const _perf_t194 = Date.now();
        logEvent("[containsText] before: new Promise");
        await new Promise((resolve) => setTimeout(resolve, 1000)); // Wait 1 second before retrying
      }

      state.info.foundText = foundObj?.text;
      logEvent(`[containsText] after: new Promise took ${Date.now() - _perf_t194}ms`);
      state.info.value = foundObj?.value;
      throw new Error("element doesn't contain text " + text);
    } catch (e) {
      const _perf_t195 = Date.now();
      logEvent("[containsText] before: _commandError");
      await _commandError(state, e, this);
      logEvent(`[containsText] after: _commandError took ${Date.now() - _perf_t195}ms`);
      throw e;
    } finally {
      const _perf_t196 = Date.now();
      logEvent("[containsText] before: _commandFinally");
      await _commandFinally(state, this);
      logEvent(`[containsText] after: _commandFinally took ${Date.now() - _perf_t196}ms`);
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
    const snapshotsFolder = process.env.BVT_TEMP_SNAPSHOTS_FOLDER ?? this.context.snapshotFolder; //path .join(this.project_path, "data", "snapshots");

    if (fs.existsSync(path.join(snapshotsFolder, referanceSnapshot + ".yml"))) {
      text = fs.readFileSync(path.join(snapshotsFolder, referanceSnapshot + ".yml"), "utf8");
    } else if (fs.existsSync(path.join(snapshotsFolder, referanceSnapshot + ".yaml"))) {
      text = fs.readFileSync(path.join(snapshotsFolder, referanceSnapshot + ".yaml"), "utf8");
    } else if (referanceSnapshot.startsWith("yaml:")) {
      text = referanceSnapshot.substring(5);
    } else {
      throw new Error("referenceSnapshot file not found: " + referanceSnapshot);
    }
    state.text = text;

    const _perf_t197 = Date.now();
    logEvent("[snapshotValidation] before: _replaceWithLocalData");
    const newValue = await this._replaceWithLocalData(text, world);
    logEvent(`[snapshotValidation] after: _replaceWithLocalData took ${Date.now() - _perf_t197}ms`);

    const _perf_t198 = Date.now();
    logEvent("[snapshotValidation] before: _preCommand");
    await _preCommand(state, this);
    logEvent(`[snapshotValidation] after: _preCommand took ${Date.now() - _perf_t198}ms`);

    let foundObj = null;
    try {
      let matchResult = null;
      while (Date.now() - startTime < timeout) {
        try {
          let scope = null;
          if (!frameSelectors) {
            scope = this.page;
          } else {
            const _perf_t199 = Date.now();
            logEvent("[snapshotValidation] before: _findFrameScope");
            scope = await this._findFrameScope(frameSelectors, timeout, state.info);
            logEvent(`[snapshotValidation] after: _findFrameScope took ${Date.now() - _perf_t199}ms`);
          }
          const _perf_t200 = Date.now();
          logEvent("[snapshotValidation] before: scope.locator");
          const snapshot = await scope.locator("body").ariaSnapshot({ timeout });
          logEvent(`[snapshotValidation] after: scope.locator took ${Date.now() - _perf_t200}ms`);

          if (snapshot && snapshot.length <= 10) {
            console.log("Page snapshot length is suspiciously small:", snapshot);
          }

          matchResult = snapshotValidation(snapshot, newValue, referanceSnapshot);
          if (matchResult === undefined) {
            console.log("snapshotValidation returned undefined");
          }

          if (matchResult.errorLine !== -1) {
            throw new Error("Snapshot validation failed at line " + matchResult.errorLineText);
          }
          // highlight and screenshot
          try {
            const _perf_t201 = Date.now();
            logEvent("[snapshotValidation] before: await");
            await await highlightSnapshot(newValue, scope);
            logEvent(`[snapshotValidation] after: await took ${Date.now() - _perf_t201}ms`);
            const _perf_t202 = Date.now();
            logEvent("[snapshotValidation] before: _screenshot");
            await _screenshot(state, this);
            logEvent(`[snapshotValidation] after: _screenshot took ${Date.now() - _perf_t202}ms`);
          } catch (e) {}
          return state.info;
        } catch (e) {
          // Log error but continue retrying until timeout is reached
          //this.logger.warn("Retrying snapshot validation due to: " + e.message);
        }
        const _perf_t203 = Date.now();
        logEvent("[snapshotValidation] before: new Promise");
        await new Promise((resolve) => setTimeout(resolve, 2000)); // Wait 1 second before retrying
      }

      throw new Error("No snapshot match " + matchResult?.errorLineText);
      logEvent(`[snapshotValidation] after: new Promise took ${Date.now() - _perf_t203}ms`);
    } catch (e) {
      const _perf_t204 = Date.now();
      logEvent("[snapshotValidation] before: _commandError");
      await _commandError(state, e, this);
      logEvent(`[snapshotValidation] after: _commandError took ${Date.now() - _perf_t204}ms`);
      throw e;
    } finally {
      const _perf_t205 = Date.now();
      logEvent("[snapshotValidation] before: _commandFinally");
      await _commandFinally(state, this);
      logEvent(`[snapshotValidation] after: _commandFinally took ${Date.now() - _perf_t205}ms`);
    }
  }

  async waitForUserInput(message, world = null) {
    if (!message) {
      message = "# Wait for user input. Press any key to continue";
    } else {
      message = "# Wait for user input. " + message;
    }
    message += "\n";
    const _perf_t206 = Date.now();
    logEvent("[waitForUserInput] before: new Promise");
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
    logEvent(`[waitForUserInput] after: new Promise took ${Date.now() - _perf_t206}ms`);
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
        const _perf_t207 = Date.now();
        logEvent("[loadTestDataAsync] before: _parseCSVSync");
        const results = await this._parseCSVSync(dataFile);
        logEvent(`[loadTestDataAsync] after: _parseCSVSync took ${Date.now() - _perf_t207}ms`);
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
    if (!options) {
      options = {};
    }
    // collect url/path/title
    if (info) {
      if (!info.title) {
        try {
          const _perf_t208 = Date.now();
          logEvent("[_screenShot] before: page.title");
          info.title = await withTimeout(this.page.title(), 2000, "[Unknown title]");
          logEvent(`[_screenShot] after: page.title took ${Date.now() - _perf_t208}ms`);
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
        const _perf_t209 = Date.now();
        logEvent("[_screenShot] before: takeScreenshot");
        await withTimeout(
          this.takeScreenshot(screenshotPath, options.fullPage === true),
          2000,
          "takeScreenshot timeout"
        );
        logEvent(`[_screenShot] after: takeScreenshot took ${Date.now() - _perf_t209}ms`);
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
          const _perf_t210 = Date.now();
          logEvent("[_screenShot] before: drawRectangle");
          await drawRectangle(screenshotPath, info.box.x, info.box.y, info.box.width, info.box.height);
          logEvent(`[_screenShot] after: drawRectangle took ${Date.now() - _perf_t210}ms`);
        }
      } catch (e) {
        this.logger.info("unable to take screenshot, ignored");
      }
    } else if (options && options.screenshot) {
      result.screenshotPath = options.screenshotPath;
      try {
        const _perf_t211 = Date.now();
        logEvent("[_screenShot] before: takeScreenshot");
        await withTimeout(
          this.takeScreenshot(options.screenshotPath, options.fullPage === true),
          2000,
          "takeScreenshot timeout"
        );
        logEvent(`[_screenShot] after: takeScreenshot took ${Date.now() - _perf_t211}ms`);
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
        const _perf_t212 = Date.now();
        logEvent("[_screenShot] before: drawRectangle");
        await drawRectangle(options.screenshotPath, info.box.x, info.box.y, info.box.width, info.box.height);
        logEvent(`[_screenShot] after: drawRectangle took ${Date.now() - _perf_t212}ms`);
      }
    }

    return result;
  }
  async takeScreenshot(screenshotPath, fullPage = false) {
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
      const _perf_t213 = Date.now();
      logEvent("[takeScreenshot] before: playContext.newCDPSession");
      const client = await playContext.newCDPSession(this.page);
      logEvent(`[takeScreenshot] after: playContext.newCDPSession took ${Date.now() - _perf_t213}ms`);
      const _perf_t214 = Date.now();
      logEvent("[takeScreenshot] before: client.send");
      const { data } = await client.send("Page.captureScreenshot", {
        format: "png",
        captureBeyondViewport: fullPage,
      });
      logEvent(`[takeScreenshot] after: client.send took ${Date.now() - _perf_t214}ms`);
      const _perf_t215 = Date.now();
      logEvent("[takeScreenshot] before: client.detach");
      await client.detach();
      logEvent(`[takeScreenshot] after: client.detach took ${Date.now() - _perf_t215}ms`);
      if (!screenshotPath) {
        return data;
      }
      screenshotBuffer = Buffer.from(data, "base64");
    } else {
      const _perf_t216 = Date.now();
      logEvent("[takeScreenshot] before: page.screenshot");
      screenshotBuffer = await this.page.screenshot({ fullPage: fullPage });
      logEvent(`[takeScreenshot] after: page.screenshot took ${Date.now() - _perf_t216}ms`);
    }

    // if (focusedElement) {
    //   // console.log(`Focused element ${JSON.stringify(focusedElement._selector)}`)
    //   await this._unhighlightElements(focusedElement);
    // }

    const _perf_t217 = Date.now();
    logEvent("[takeScreenshot] before: Jimp.read");
    let image = await Jimp.read(screenshotBuffer);
    logEvent(`[takeScreenshot] after: Jimp.read took ${Date.now() - _perf_t217}ms`);

    // Get the image dimensions

    const { width, height } = image.bitmap;
    const resizeRatio = viewportWidth / width;
    // Resize the image to fit within the viewport dimensions without enlarging
    if (width > viewportWidth) {
      image = image.resize({ w: viewportWidth, h: height * resizeRatio }); // Resize the image while maintaining aspect ratio
      const _perf_t218 = Date.now();
      logEvent("[takeScreenshot] before: image.write");
      await image.write(screenshotPath);
      logEvent(`[takeScreenshot] after: image.write took ${Date.now() - _perf_t218}ms`);
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

    const _perf_t219 = Date.now();
    logEvent("[verifyElementExistInPage] before: new Promise");
    await new Promise((resolve) => setTimeout(resolve, 2000));
    logEvent(`[verifyElementExistInPage] after: new Promise took ${Date.now() - _perf_t219}ms`);
    try {
      const _perf_t220 = Date.now();
      logEvent("[verifyElementExistInPage] before: _preCommand");
      await _preCommand(state, this);
      logEvent(`[verifyElementExistInPage] after: _preCommand took ${Date.now() - _perf_t220}ms`);
      const _perf_t221 = Date.now();
      logEvent("[verifyElementExistInPage] before: expect");
      await expect(state.element).toHaveCount(1, { timeout: 10000 });
      logEvent(`[verifyElementExistInPage] after: expect took ${Date.now() - _perf_t221}ms`);
      return state.info;
    } catch (e) {
      const _perf_t222 = Date.now();
      logEvent("[verifyElementExistInPage] before: _commandError");
      await _commandError(state, e, this);
      logEvent(`[verifyElementExistInPage] after: _commandError took ${Date.now() - _perf_t222}ms`);
    } finally {
      const _perf_t223 = Date.now();
      logEvent("[verifyElementExistInPage] before: _commandFinally");
      await _commandFinally(state, this);
      logEvent(`[verifyElementExistInPage] after: _commandFinally took ${Date.now() - _perf_t223}ms`);
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
    const _perf_t224 = Date.now();
    logEvent("[extractAttribute] before: new Promise");
    await new Promise((resolve) => setTimeout(resolve, 2000));
    logEvent(`[extractAttribute] after: new Promise took ${Date.now() - _perf_t224}ms`);
    try {
      const _perf_t225 = Date.now();
      logEvent("[extractAttribute] before: _preCommand");
      await _preCommand(state, this);
      logEvent(`[extractAttribute] after: _preCommand took ${Date.now() - _perf_t225}ms`);
      switch (attribute) {
        case "inner_text":
          const _perf_t226 = Date.now();
          logEvent("[extractAttribute] before: state.element.innerText");
          state.value = await state.element.innerText();
          logEvent(`[extractAttribute] after: state.element.innerText took ${Date.now() - _perf_t226}ms`);
          break;
        case "href":
          const _perf_t227 = Date.now();
          logEvent("[extractAttribute] before: state.element.getAttribute");
          state.value = await state.element.getAttribute("href");
          logEvent(`[extractAttribute] after: state.element.getAttribute took ${Date.now() - _perf_t227}ms`);
          break;
        case "value":
          const _perf_t228 = Date.now();
          logEvent("[extractAttribute] before: state.element.inputValue");
          state.value = await state.element.inputValue();
          logEvent(`[extractAttribute] after: state.element.inputValue took ${Date.now() - _perf_t228}ms`);
          break;
        case "text":
          const _perf_t229 = Date.now();
          logEvent("[extractAttribute] before: state.element.textContent");
          state.value = await state.element.textContent();
          logEvent(`[extractAttribute] after: state.element.textContent took ${Date.now() - _perf_t229}ms`);
          break;
        default:
          const _perf_t230 = Date.now();
          logEvent("[extractAttribute] before: state.element.getAttribute");
          state.value = await state.element.getAttribute(attribute);
          logEvent(`[extractAttribute] after: state.element.getAttribute took ${Date.now() - _perf_t230}ms`);
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

      if (process.env.MODE === "executions") {
        const globalDataFile = "global_test_data.json";
        if (existsSync(globalDataFile)) {
          this.saveTestDataAsGlobal({}, world);
        }
      }
      // await new Promise((resolve) => setTimeout(resolve, 500));
      return state.info;
    } catch (e) {
      const _perf_t231 = Date.now();
      logEvent("[extractAttribute] before: _commandError");
      await _commandError(state, e, this);
      logEvent(`[extractAttribute] after: _commandError took ${Date.now() - _perf_t231}ms`);
    } finally {
      const _perf_t232 = Date.now();
      logEvent("[extractAttribute] before: _commandFinally");
      await _commandFinally(state, this);
      logEvent(`[extractAttribute] after: _commandFinally took ${Date.now() - _perf_t232}ms`);
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
    const _perf_t233 = Date.now();
    logEvent("[extractProperty] before: new Promise");
    await new Promise((resolve) => setTimeout(resolve, 2000));
    logEvent(`[extractProperty] after: new Promise took ${Date.now() - _perf_t233}ms`);
    try {
      const _perf_t234 = Date.now();
      logEvent("[extractProperty] before: _preCommand");
      await _preCommand(state, this);
      logEvent(`[extractProperty] after: _preCommand took ${Date.now() - _perf_t234}ms`);
      switch (property) {
        case "inner_text":
          const _perf_t235 = Date.now();
          logEvent("[extractProperty] before: state.element.innerText");
          state.value = await state.element.innerText();
          logEvent(`[extractProperty] after: state.element.innerText took ${Date.now() - _perf_t235}ms`);
          break;
        case "href":
          const _perf_t236 = Date.now();
          logEvent("[extractProperty] before: state.element.getAttribute");
          state.value = await state.element.getAttribute("href");
          logEvent(`[extractProperty] after: state.element.getAttribute took ${Date.now() - _perf_t236}ms`);
          break;
        case "value":
          const _perf_t237 = Date.now();
          logEvent("[extractProperty] before: state.element.inputValue");
          state.value = await state.element.inputValue();
          logEvent(`[extractProperty] after: state.element.inputValue took ${Date.now() - _perf_t237}ms`);
          break;
        case "text":
          const _perf_t238 = Date.now();
          logEvent("[extractProperty] before: state.element.textContent");
          state.value = await state.element.textContent();
          logEvent(`[extractProperty] after: state.element.textContent took ${Date.now() - _perf_t238}ms`);
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

      if (process.env.MODE === "executions") {
        const globalDataFile = "global_test_data.json";
        if (existsSync(globalDataFile)) {
          this.saveTestDataAsGlobal({}, world);
        }
      }

      // await new Promise((resolve) => setTimeout(resolve, 500));
      return state.info;
    } catch (e) {
      const _perf_t239 = Date.now();
      logEvent("[extractProperty] before: _commandError");
      await _commandError(state, e, this);
      logEvent(`[extractProperty] after: _commandError took ${Date.now() - _perf_t239}ms`);
    } finally {
      const _perf_t240 = Date.now();
      logEvent("[extractProperty] before: _commandFinally");
      await _commandFinally(state, this);
      logEvent(`[extractProperty] after: _commandFinally took ${Date.now() - _perf_t240}ms`);
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
    const _perf_t241 = Date.now();
    logEvent("[verifyAttribute] before: new Promise");
    await new Promise((resolve) => setTimeout(resolve, 2000));
    logEvent(`[verifyAttribute] after: new Promise took ${Date.now() - _perf_t241}ms`);
    let val;
    let expectedValue;
    try {
      const _perf_t242 = Date.now();
      logEvent("[verifyAttribute] before: _preCommand");
      await _preCommand(state, this);
      logEvent(`[verifyAttribute] after: _preCommand took ${Date.now() - _perf_t242}ms`);
      const _perf_t243 = Date.now();
      logEvent("[verifyAttribute] before: replaceWithLocalTestData");
      expectedValue = await replaceWithLocalTestData(state.value, world);
      logEvent(`[verifyAttribute] after: replaceWithLocalTestData took ${Date.now() - _perf_t243}ms`);
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
          const _perf_t244 = Date.now();
          logEvent("[verifyAttribute] before: state.element.isEditable");
          const isEditable = await state.element.isEditable();
          logEvent(`[verifyAttribute] after: state.element.isEditable took ${Date.now() - _perf_t244}ms`);
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
      const _perf_t245 = Date.now();
      logEvent("[verifyAttribute] before: _commandError");
      await _commandError(state, e, this);
      logEvent(`[verifyAttribute] after: _commandError took ${Date.now() - _perf_t245}ms`);
    } finally {
      const _perf_t246 = Date.now();
      logEvent("[verifyAttribute] before: _commandFinally");
      await _commandFinally(state, this);
      logEvent(`[verifyAttribute] after: _commandFinally took ${Date.now() - _perf_t246}ms`);
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
    const _perf_t247 = Date.now();
    logEvent("[verifyProperty] before: new Promise");
    await new Promise((resolve) => setTimeout(resolve, 2000));
    logEvent(`[verifyProperty] after: new Promise took ${Date.now() - _perf_t247}ms`);
    let val;
    let expectedValue;
    try {
      const _perf_t248 = Date.now();
      logEvent("[verifyProperty] before: _preCommand");
      await _preCommand(state, this);
      logEvent(`[verifyProperty] after: _preCommand took ${Date.now() - _perf_t248}ms`);
      const _perf_t249 = Date.now();
      logEvent("[verifyProperty] before: _replaceWithLocalData");
      expectedValue = await this._replaceWithLocalData(value, world);
      logEvent(`[verifyProperty] after: _replaceWithLocalData took ${Date.now() - _perf_t249}ms`);
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
          const _perf_t250 = Date.now();
          logEvent("[verifyProperty] before: state.element.isEditable");
          const isEditable = await state.element.isEditable();
          logEvent(`[verifyProperty] after: state.element.isEditable took ${Date.now() - _perf_t250}ms`);
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
      state.info.value = val;

      const isRegex = expectedValue.startsWith("regex:");
      const isContains = expectedValue.startsWith("contains:");
      const isExact = expectedValue.startsWith("exact:");
      let matchPassed = false;

      if (isRegex) {
        const rawPattern = expectedValue.slice(6); // remove "regex:"
        const lastSlashIndex = rawPattern.lastIndexOf("/");
        if (rawPattern.startsWith("/") && lastSlashIndex > 0) {
          const patternBody = rawPattern.slice(1, lastSlashIndex).replace(/\n/g, ".*");
          const flags = rawPattern.slice(lastSlashIndex + 1) || "gs";
          const regex = new RegExp(patternBody, flags);
          state.info.regex = true;
          matchPassed = regex.test(val);
        } else {
          // Fallback: treat as literal
          const escapedPattern = rawPattern.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
          const regex = new RegExp(escapedPattern, "g");
          matchPassed = regex.test(val);
        }
      } else if (isContains) {
        const containsValue = expectedValue.slice(9); // remove "contains:"
        matchPassed = val.includes(containsValue);
      } else if (isExact) {
        const exactValue = expectedValue.slice(6); // remove "exact:"
        matchPassed = val === exactValue;
      } else if (property === "innerText") {
        // Default innerText logic
        const normalizedExpectedValue = expectedValue.replace(/\\n/g, "\n");
        const valLines = val.split("\n");
        const expectedLines = normalizedExpectedValue.split("\n");
        matchPassed = expectedLines.every((expectedLine) =>
          valLines.some((valLine) => valLine.trim() === expectedLine.trim())
        );
      } else {
        // Fallback exact or loose match
        const escapedPattern = expectedValue.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
        const regex = new RegExp(escapedPattern, "g");
        matchPassed = regex.test(val);
      }

      if (!matchPassed) {
        let errorMessage = `The ${property} property has a value of "${val}", but the expected value is "${expectedValue}"`;
        state.info.failCause.assertionFailed = true;
        state.info.failCause.lastError = errorMessage;
        throw new Error(errorMessage);
      }
      return state.info;
    } catch (e) {
      const _perf_t251 = Date.now();
      logEvent("[verifyProperty] before: _commandError");
      await _commandError(state, e, this);
      logEvent(`[verifyProperty] after: _commandError took ${Date.now() - _perf_t251}ms`);
    } finally {
      const _perf_t252 = Date.now();
      logEvent("[verifyProperty] before: _commandFinally");
      await _commandFinally(state, this);
      logEvent(`[verifyProperty] after: _commandFinally took ${Date.now() - _perf_t252}ms`);
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
    state.options ??= { timeout: timeoutMs };

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
        const _perf_t253 = Date.now();
        logEvent("[conditionalWait] before: _preCommand");
        await _preCommand(state, this);
        logEvent(`[conditionalWait] after: _preCommand took ${Date.now() - _perf_t253}ms`);

        // If _preCommand succeeds, start condition checking
        const checkCondition = async () => {
          try {
            switch (condition.toLowerCase()) {
              case "checked":
                const _perf_t254 = Date.now();
                logEvent("[conditionalWait] before: state.element.isChecked");
                currentValue = await state.element.isChecked();
                logEvent(`[conditionalWait] after: state.element.isChecked took ${Date.now() - _perf_t254}ms`);
                return currentValue === true;
              case "unchecked":
                const _perf_t255 = Date.now();
                logEvent("[conditionalWait] before: state.element.isChecked");
                currentValue = await state.element.isChecked();
                logEvent(`[conditionalWait] after: state.element.isChecked took ${Date.now() - _perf_t255}ms`);
                return currentValue === false;
              case "visible":
                const _perf_t256 = Date.now();
                logEvent("[conditionalWait] before: state.element.isVisible");
                currentValue = await state.element.isVisible();
                logEvent(`[conditionalWait] after: state.element.isVisible took ${Date.now() - _perf_t256}ms`);
                return currentValue === true;
              case "hidden":
                const _perf_t257 = Date.now();
                logEvent("[conditionalWait] before: state.element.isVisible");
                currentValue = await state.element.isVisible();
                logEvent(`[conditionalWait] after: state.element.isVisible took ${Date.now() - _perf_t257}ms`);
                return currentValue === false;
              case "enabled":
                const _perf_t258 = Date.now();
                logEvent("[conditionalWait] before: state.element.isDisabled");
                currentValue = await state.element.isDisabled();
                logEvent(`[conditionalWait] after: state.element.isDisabled took ${Date.now() - _perf_t258}ms`);
                return currentValue === false;
              case "disabled":
                const _perf_t259 = Date.now();
                logEvent("[conditionalWait] before: state.element.isDisabled");
                currentValue = await state.element.isDisabled();
                logEvent(`[conditionalWait] after: state.element.isDisabled took ${Date.now() - _perf_t259}ms`);
                return currentValue === true;
              case "editable":
                // currentValue = await String(await state.element.evaluate((element, prop) => element[prop], "isContentEditable"));
                const _perf_t260 = Date.now();
                logEvent("[conditionalWait] before: state.element.isContentEditable");
                currentValue = await state.element.isContentEditable();
                logEvent(`[conditionalWait] after: state.element.isContentEditable took ${Date.now() - _perf_t260}ms`);
                return currentValue === true;
              default:
                state.info.message = `Unsupported condition: '${condition}'. Supported conditions are: checked, unchecked, visible, hidden, enabled, disabled, editable.`;
                state.info.success = false;
                return false;
            }
          } catch (error) {
            // Don't throw here, just return false to continue retrying
            logEvent(`[conditionalWait] ❌❌ condition check error: ${error.message}`);
            return false;
          }
        };

        // Inner loop for condition checking (once element is located)
        while (Date.now() - startTime < timeoutMs) {
          const currentElapsedTime = Date.now() - startTime;

          const _perf_t261 = Date.now();
          logEvent("[conditionalWait] before: checkCondition");
          conditionMet = await checkCondition();
          logEvent(`[conditionalWait] after: checkCondition took ${Date.now() - _perf_t261}ms`);

          if (conditionMet) {
            break;
          }

          // Check if we still have time for another attempt
          if (Date.now() - startTime + 50 < timeoutMs) {
            const _perf_t262 = Date.now();
            logEvent("[conditionalWait] before: new Promise");
            await new Promise((res) => setTimeout(res, 50));
            logEvent(`[conditionalWait] after: new Promise took ${Date.now() - _perf_t262}ms`);
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
          const _perf_t263 = Date.now();
          logEvent("[conditionalWait] before: new Promise");
          await new Promise((resolve) => setTimeout(resolve, 50));
          logEvent(`[conditionalWait] after: new Promise took ${Date.now() - _perf_t263}ms`);
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
      const _perf_t264 = Date.now();
      logEvent("[conditionalWait] before: _commandFinally");
      await _commandFinally(state, this);
      logEvent(`[conditionalWait] after: _commandFinally took ${Date.now() - _perf_t264}ms`);
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
        const _perf_t265 = Date.now();
        logEvent("[extractEmailData] before: context.api.request");
        let result = await this.context.api.request(request);
        logEvent(`[extractEmailData] after: context.api.request took ${Date.now() - _perf_t265}ms`);

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
          if (process.env.MODE === "executions") {
            const globalDataFile = "global_test_data.json";
            if (existsSync(globalDataFile)) {
              this.saveTestDataAsGlobal({}, world);
            }
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
          const _perf_t266 = Date.now();
          logEvent("[extractEmailData] before: _commandError");
          await _commandError(
            { text: "extractEmailData", operation: "extractEmailData", emailAddress, info: {} },
            e,
            this
          );
          logEvent(`[extractEmailData] after: _commandError took ${Date.now() - _perf_t266}ms`);
        }
        // ignore
      }
      // check if the timeout is reached
      if (Date.now() - startTime > timeout) {
        throw new Error("timeout reached");
      }

      const _perf_t267 = Date.now();
      logEvent("[extractEmailData] before: new Promise");
      await new Promise((resolve) => setTimeout(resolve, 5000));
      logEvent(`[extractEmailData] after: new Promise took ${Date.now() - _perf_t267}ms`);
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
    const _perf_t268 = Date.now();
    logEvent("[verifyPagePath] before: new Promise");
    await new Promise((resolve) => setTimeout(resolve, 2000));
    logEvent(`[verifyPagePath] after: new Promise took ${Date.now() - _perf_t268}ms`);
    const info = {};
    info.log = "***** verify page path " + pathPart + " *****\n";
    info.operation = "verifyPagePath";

    const _perf_t269 = Date.now();
    logEvent("[verifyPagePath] before: _replaceWithLocalData");
    const newValue = await this._replaceWithLocalData(pathPart, world);
    logEvent(`[verifyPagePath] after: _replaceWithLocalData took ${Date.now() - _perf_t269}ms`);
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
      const _perf_t270 = Date.now();
      logEvent("[verifyPagePath] before: _preCommand");
      await _preCommand(state, this);
      logEvent(`[verifyPagePath] after: _preCommand took ${Date.now() - _perf_t270}ms`);
      state.info.text = queryText;
      for (let i = 0; i < 30; i++) {
        const _perf_t271 = Date.now();
        logEvent("[verifyPagePath] before: page.url");
        const url = await this.page.url();
        logEvent(`[verifyPagePath] after: page.url took ${Date.now() - _perf_t271}ms`);
        switch (matcher) {
          case "exact":
            if (url !== queryText) {
              if (i === 29) {
                throw new Error(`Page URL ${url} is not equal to ${queryText}`);
              }
              const _perf_t272 = Date.now();
              logEvent("[verifyPagePath] before: new Promise");
              await new Promise((resolve) => setTimeout(resolve, 1000));
              logEvent(`[verifyPagePath] after: new Promise took ${Date.now() - _perf_t272}ms`);
              continue;
            }
            break;
          case "contains":
            if (!url.includes(queryText)) {
              if (i === 29) {
                throw new Error(`Page URL ${url} doesn't contain ${queryText}`);
              }
              const _perf_t273 = Date.now();
              logEvent("[verifyPagePath] before: new Promise");
              await new Promise((resolve) => setTimeout(resolve, 1000));
              logEvent(`[verifyPagePath] after: new Promise took ${Date.now() - _perf_t273}ms`);
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
                const _perf_t274 = Date.now();
                logEvent("[verifyPagePath] before: new Promise");
                await new Promise((resolve) => setTimeout(resolve, 1000));
                logEvent(`[verifyPagePath] after: new Promise took ${Date.now() - _perf_t274}ms`);
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
                const _perf_t275 = Date.now();
                logEvent("[verifyPagePath] before: new Promise");
                await new Promise((resolve) => setTimeout(resolve, 1000));
                logEvent(`[verifyPagePath] after: new Promise took ${Date.now() - _perf_t275}ms`);
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
              const _perf_t276 = Date.now();
              logEvent("[verifyPagePath] before: new Promise");
              await new Promise((resolve) => setTimeout(resolve, 1000));
              logEvent(`[verifyPagePath] after: new Promise took ${Date.now() - _perf_t276}ms`);
              continue;
            }
            break;
          default:
            console.log("Unknown matching type, defaulting to contains matching");
            if (!url.includes(pathPart)) {
              if (i === 29) {
                throw new Error(`Page URL ${url} does not contain ${pathPart}`);
              }
              const _perf_t277 = Date.now();
              logEvent("[verifyPagePath] before: new Promise");
              await new Promise((resolve) => setTimeout(resolve, 1000));
              logEvent(`[verifyPagePath] after: new Promise took ${Date.now() - _perf_t277}ms`);
              continue;
            }
        }
        const _perf_t278 = Date.now();
        logEvent("[verifyPagePath] before: _screenshot");
        await _screenshot(state, this);
        logEvent(`[verifyPagePath] after: _screenshot took ${Date.now() - _perf_t278}ms`);
        return state.info;
      }
    } catch (e) {
      state.info.failCause.lastError = e.message;
      state.info.failCause.assertionFailed = true;
      const _perf_t279 = Date.now();
      logEvent("[verifyPagePath] before: _commandError");
      await _commandError(state, e, this);
      logEvent(`[verifyPagePath] after: _commandError took ${Date.now() - _perf_t279}ms`);
    } finally {
      const _perf_t280 = Date.now();
      logEvent("[verifyPagePath] before: _commandFinally");
      await _commandFinally(state, this);
      logEvent(`[verifyPagePath] after: _commandFinally took ${Date.now() - _perf_t280}ms`);
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
    const _perf_t281 = Date.now();
    logEvent("[verifyPageTitle] before: new Promise");
    await new Promise((resolve) => setTimeout(resolve, 2000));
    logEvent(`[verifyPageTitle] after: new Promise took ${Date.now() - _perf_t281}ms`);

    const _perf_t282 = Date.now();
    logEvent("[verifyPageTitle] before: _replaceWithLocalData");
    const newValue = await this._replaceWithLocalData(title, world);
    logEvent(`[verifyPageTitle] after: _replaceWithLocalData took ${Date.now() - _perf_t282}ms`);
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
      const _perf_t283 = Date.now();
      logEvent("[verifyPageTitle] before: _preCommand");
      await _preCommand(state, this);
      logEvent(`[verifyPageTitle] after: _preCommand took ${Date.now() - _perf_t283}ms`);
      state.info.text = queryText;
      for (let i = 0; i < 30; i++) {
        const _perf_t284 = Date.now();
        logEvent("[verifyPageTitle] before: page.title");
        const foundTitle = await withTimeout(this.page.title(), 2000, "[Unknown Title]");
        logEvent(`[verifyPageTitle] after: page.title took ${Date.now() - _perf_t284}ms`);
        switch (matcher) {
          case "exact":
            if (foundTitle !== queryText) {
              if (i === 29) {
                throw new Error(`Page Title ${foundTitle} is not equal to ${queryText}`);
              }
              const _perf_t285 = Date.now();
              logEvent("[verifyPageTitle] before: new Promise");
              await new Promise((resolve) => setTimeout(resolve, 1000));
              logEvent(`[verifyPageTitle] after: new Promise took ${Date.now() - _perf_t285}ms`);
              continue;
            }
            break;
          case "contains":
            if (!foundTitle.includes(queryText)) {
              if (i === 29) {
                throw new Error(`Page Title ${foundTitle} doesn't contain ${queryText}`);
              }
              const _perf_t286 = Date.now();
              logEvent("[verifyPageTitle] before: new Promise");
              await new Promise((resolve) => setTimeout(resolve, 1000));
              logEvent(`[verifyPageTitle] after: new Promise took ${Date.now() - _perf_t286}ms`);
              continue;
            }
            break;
          case "starts-with":
            if (!foundTitle.startsWith(queryText)) {
              if (i === 29) {
                throw new Error(`Page title ${foundTitle} doesn't start with ${queryText}`);
              }
              const _perf_t287 = Date.now();
              logEvent("[verifyPageTitle] before: new Promise");
              await new Promise((resolve) => setTimeout(resolve, 1000));
              logEvent(`[verifyPageTitle] after: new Promise took ${Date.now() - _perf_t287}ms`);
              continue;
            }
            break;
          case "ends-with":
            if (!foundTitle.endsWith(queryText)) {
              if (i === 29) {
                throw new Error(`Page Title ${foundTitle} doesn't end with ${queryText}`);
              }
              const _perf_t288 = Date.now();
              logEvent("[verifyPageTitle] before: new Promise");
              await new Promise((resolve) => setTimeout(resolve, 1000));
              logEvent(`[verifyPageTitle] after: new Promise took ${Date.now() - _perf_t288}ms`);
              continue;
            }
            break;
          case "regex":
            const regex = new RegExp(queryText.slice(1, -1), "g");
            if (!regex.test(foundTitle)) {
              if (i === 29) {
                throw new Error(`Page Title ${foundTitle} doesn't match regex ${queryText}`);
              }
              const _perf_t289 = Date.now();
              logEvent("[verifyPageTitle] before: new Promise");
              await new Promise((resolve) => setTimeout(resolve, 1000));
              logEvent(`[verifyPageTitle] after: new Promise took ${Date.now() - _perf_t289}ms`);
              continue;
            }
            break;
          default:
            console.log("Unknown matching type, defaulting to contains matching");
            if (!foundTitle.includes(title)) {
              if (i === 29) {
                throw new Error(`Page Title ${foundTitle} does not contain ${title}`);
              }
              const _perf_t290 = Date.now();
              logEvent("[verifyPageTitle] before: new Promise");
              await new Promise((resolve) => setTimeout(resolve, 1000));
              logEvent(`[verifyPageTitle] after: new Promise took ${Date.now() - _perf_t290}ms`);
              continue;
            }
        }
        const _perf_t291 = Date.now();
        logEvent("[verifyPageTitle] before: _screenshot");
        await _screenshot(state, this);
        logEvent(`[verifyPageTitle] after: _screenshot took ${Date.now() - _perf_t291}ms`);
        return state.info;
      }
    } catch (e) {
      state.info.failCause.lastError = e.message;
      state.info.failCause.assertionFailed = true;
      const _perf_t292 = Date.now();
      logEvent("[verifyPageTitle] before: _commandError");
      await _commandError(state, e, this);
      logEvent(`[verifyPageTitle] after: _commandError took ${Date.now() - _perf_t292}ms`);
    } finally {
      const _perf_t293 = Date.now();
      logEvent("[verifyPageTitle] before: _commandFinally");
      await _commandFinally(state, this);
      logEvent(`[verifyPageTitle] after: _commandFinally took ${Date.now() - _perf_t293}ms`);
    }
  }

  async findTextInAllFrames(dateAlternatives, numberAlternatives, text, state, partial = true, ignoreCase = false) {
    const frames = this.page.frames();
    let results = [];
    // let ignoreCase = false;
    for (let i = 0; i < frames.length; i++) {
      if (dateAlternatives.date) {
        for (let j = 0; j < dateAlternatives.dates.length; j++) {
          const _perf_t294 = Date.now();
          logEvent("[findTextInAllFrames] before: _locateElementByText");
          const result = await this._locateElementByText(
            frames[i],
            dateAlternatives.dates[j],
            "*:not(script, style, head)",
            false,
            partial,
            ignoreCase,
            {}
          );
          logEvent(`[findTextInAllFrames] after: _locateElementByText took ${Date.now() - _perf_t294}ms`);
          result.frame = frames[i];
          results.push(result);
        }
      } else if (numberAlternatives.number) {
        for (let j = 0; j < numberAlternatives.numbers.length; j++) {
          const _perf_t295 = Date.now();
          logEvent("[findTextInAllFrames] before: _locateElementByText");
          const result = await this._locateElementByText(
            frames[i],
            numberAlternatives.numbers[j],
            "*:not(script, style, head)",
            false,
            partial,
            ignoreCase,
            {}
          );
          logEvent(`[findTextInAllFrames] after: _locateElementByText took ${Date.now() - _perf_t295}ms`);
          result.frame = frames[i];
          results.push(result);
        }
      } else {
        const _perf_t296 = Date.now();
        logEvent("[findTextInAllFrames] before: _locateElementByText");
        const result = await this._locateElementByText(
          frames[i],
          text,
          "*:not(script, style, head)",
          false,
          partial,
          ignoreCase,
          {}
        );
        logEvent(`[findTextInAllFrames] after: _locateElementByText took ${Date.now() - _perf_t296}ms`);
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
    //if (!this.fastMode && !this.stepTags.includes("fast-mode")) {
    let stepFastMode = this.stepTags.includes("fast-mode");
    if (!stepFastMode) {
      if (!this.fastMode) {
        const _perf_t297 = Date.now();
        logEvent("[verifyTextExistInPage] before: new Promise");
        await new Promise((resolve) => setTimeout(resolve, 2000));
        logEvent(`[verifyTextExistInPage] after: new Promise took ${Date.now() - _perf_t297}ms`);
      } else {
        const _perf_t298 = Date.now();
        logEvent("[verifyTextExistInPage] before: new Promise");
        await new Promise((resolve) => setTimeout(resolve, 500));
        logEvent(`[verifyTextExistInPage] after: new Promise took ${Date.now() - _perf_t298}ms`);
      }
    }

    const _perf_t299 = Date.now();
    logEvent("[verifyTextExistInPage] before: _replaceWithLocalData");
    const newValue = await this._replaceWithLocalData(text, world);
    logEvent(`[verifyTextExistInPage] after: _replaceWithLocalData took ${Date.now() - _perf_t299}ms`);
    if (newValue !== text) {
      this.logger.info(text + "=" + newValue);
      text = newValue;
    }

    let dateAlternatives = findDateAlternatives(text);
    let numberAlternatives = findNumberAlternatives(text);

    if (stepFastMode) {
      state.onlyFailuresScreenshot = true;
      state.scroll = false;
      state.highlight = false;
    }
    try {
      const _perf_t300 = Date.now();
      logEvent("[verifyTextExistInPage] before: _preCommand");
      await _preCommand(state, this);
      logEvent(`[verifyTextExistInPage] after: _preCommand took ${Date.now() - _perf_t300}ms`);
      state.info.text = text;
      while (true) {
        let resultWithElementsFound = {
          length: 0,
        };
        try {
          const _perf_t301 = Date.now();
          logEvent("[verifyTextExistInPage] before: findTextInAllFrames");
          resultWithElementsFound = await this.findTextInAllFrames(dateAlternatives, numberAlternatives, text, state);
          logEvent(`[verifyTextExistInPage] after: findTextInAllFrames took ${Date.now() - _perf_t301}ms`);
        } catch (error) {
          // ignore
        }
        if (resultWithElementsFound.length === 0) {
          if (Date.now() - state.startTime > timeout) {
            throw new Error(`Text ${text} not found in page`);
          }
          const _perf_t302 = Date.now();
          logEvent("[verifyTextExistInPage] before: new Promise");
          await new Promise((resolve) => setTimeout(resolve, 1000));
          logEvent(`[verifyTextExistInPage] after: new Promise took ${Date.now() - _perf_t302}ms`);
          continue;
        }
        try {
          if (resultWithElementsFound[0].randomToken) {
            const frame = resultWithElementsFound[0].frame;
            const dataAttribute = `[data-blinq-id-${resultWithElementsFound[0].randomToken}]`;

            const _perf_t303 = Date.now();
            logEvent("[verifyTextExistInPage] before: _highlightElements");
            await this._highlightElements(frame, dataAttribute);
            logEvent(`[verifyTextExistInPage] after: _highlightElements took ${Date.now() - _perf_t303}ms`);

            const _perf_t304 = Date.now();
            logEvent("[verifyTextExistInPage] before: frame.locator");
            const element = await frame.locator(dataAttribute).first();
            logEvent(`[verifyTextExistInPage] after: frame.locator took ${Date.now() - _perf_t304}ms`);

            if (element) {
              const _perf_t305 = Date.now();
              logEvent("[verifyTextExistInPage] before: scrollIfNeeded");
              await this.scrollIfNeeded(element, state.info);
              // await element.dispatchEvent("bvt_verify_page_contains_text");
            }
          }
          const _perf_t307 = Date.now();
          logEvent("[verifyTextExistInPage] before: _screenshot");
          await _screenshot(state, this);
          logEvent(`[verifyTextExistInPage] after: _screenshot took ${Date.now() - _perf_t307}ms`);
          return state.info;
        } catch (error) {
          console.error(error);
        }
      }
    } catch (e) {
      const _perf_t308 = Date.now();
      logEvent("[verifyTextExistInPage] before: _commandError");
      await _commandError(state, e, this);
      logEvent(`[verifyTextExistInPage] after: _commandError took ${Date.now() - _perf_t308}ms`);
    } finally {
      const _perf_t309 = Date.now();
      logEvent("[verifyTextExistInPage] before: _commandFinally");
      await _commandFinally(state, this);
      logEvent(`[verifyTextExistInPage] after: _commandFinally took ${Date.now() - _perf_t309}ms`);
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
    const _perf_t310 = Date.now();
    logEvent("[waitForTextToDisappear] before: new Promise");
    await new Promise((resolve) => setTimeout(resolve, 2000));
    logEvent(`[waitForTextToDisappear] after: new Promise took ${Date.now() - _perf_t310}ms`);

    const _perf_t311 = Date.now();
    logEvent("[waitForTextToDisappear] before: _replaceWithLocalData");
    const newValue = await this._replaceWithLocalData(text, world);
    logEvent(`[waitForTextToDisappear] after: _replaceWithLocalData took ${Date.now() - _perf_t311}ms`);
    if (newValue !== text) {
      this.logger.info(text + "=" + newValue);
      text = newValue;
    }

    let dateAlternatives = findDateAlternatives(text);
    let numberAlternatives = findNumberAlternatives(text);
    try {
      const _perf_t312 = Date.now();
      logEvent("[waitForTextToDisappear] before: _preCommand");
      await _preCommand(state, this);
      logEvent(`[waitForTextToDisappear] after: _preCommand took ${Date.now() - _perf_t312}ms`);
      state.info.text = text;
      let resultWithElementsFound = {
        length: null, // initial cannot be 0
      };
      while (true) {
        try {
          const _perf_t313 = Date.now();
          logEvent("[waitForTextToDisappear] before: findTextInAllFrames");
          resultWithElementsFound = await this.findTextInAllFrames(dateAlternatives, numberAlternatives, text, state);
          logEvent(`[waitForTextToDisappear] after: findTextInAllFrames took ${Date.now() - _perf_t313}ms`);
        } catch (error) {
          // ignore
        }
        if (resultWithElementsFound.length === 0) {
          const _perf_t314 = Date.now();
          logEvent("[waitForTextToDisappear] before: _screenshot");
          await _screenshot(state, this);
          logEvent(`[waitForTextToDisappear] after: _screenshot took ${Date.now() - _perf_t314}ms`);
          return state.info;
        }
        if (Date.now() - state.startTime > timeout) {
          throw new Error(`Text ${text} found in page`);
        }
        const _perf_t315 = Date.now();
        logEvent("[waitForTextToDisappear] before: new Promise");
        await new Promise((resolve) => setTimeout(resolve, 1000));
        logEvent(`[waitForTextToDisappear] after: new Promise took ${Date.now() - _perf_t315}ms`);
      }
    } catch (e) {
      const _perf_t316 = Date.now();
      logEvent("[waitForTextToDisappear] before: _commandError");
      await _commandError(state, e, this);
      logEvent(`[waitForTextToDisappear] after: _commandError took ${Date.now() - _perf_t316}ms`);
    } finally {
      const _perf_t317 = Date.now();
      logEvent("[waitForTextToDisappear] before: _commandFinally");
      await _commandFinally(state, this);
      logEvent(`[waitForTextToDisappear] after: _commandFinally took ${Date.now() - _perf_t317}ms`);
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

    const cmdStartTime = Date.now();
    let cmdEndTime = null;

    const timeout = this._getFindElementTimeout(options);
    const _perf_t318 = Date.now();
    logEvent("[verifyTextRelatedToText] before: new Promise");
    await new Promise((resolve) => setTimeout(resolve, 2000));
    logEvent(`[verifyTextRelatedToText] after: new Promise took ${Date.now() - _perf_t318}ms`);

    const _perf_t319 = Date.now();
    logEvent("[verifyTextRelatedToText] before: _replaceWithLocalData");
    let newValue = await this._replaceWithLocalData(textAnchor, world);
    logEvent(`[verifyTextRelatedToText] after: _replaceWithLocalData took ${Date.now() - _perf_t319}ms`);
    if (newValue !== textAnchor) {
      this.logger.info(textAnchor + "=" + newValue);
      textAnchor = newValue;
    }
    const _perf_t320 = Date.now();
    logEvent("[verifyTextRelatedToText] before: _replaceWithLocalData");
    newValue = await this._replaceWithLocalData(textToVerify, world);
    logEvent(`[verifyTextRelatedToText] after: _replaceWithLocalData took ${Date.now() - _perf_t320}ms`);
    if (newValue !== textToVerify) {
      this.logger.info(textToVerify + "=" + newValue);
      textToVerify = newValue;
    }
    let dateAlternatives = findDateAlternatives(textToVerify);
    let numberAlternatives = findNumberAlternatives(textToVerify);
    let foundAncore = false;
    try {
      const _perf_t321 = Date.now();
      logEvent("[verifyTextRelatedToText] before: _preCommand");
      await _preCommand(state, this);
      logEvent(`[verifyTextRelatedToText] after: _preCommand took ${Date.now() - _perf_t321}ms`);
      state.info.text = textToVerify;
      let resultWithElementsFound = {
        length: 0,
      };
      while (true) {
        try {
          const _perf_t322 = Date.now();
          logEvent("[verifyTextRelatedToText] before: findTextInAllFrames");
          resultWithElementsFound = await this.findTextInAllFrames(
            findDateAlternatives(textAnchor),
            findNumberAlternatives(textAnchor),
            textAnchor,
            state,
            false
          );
          logEvent(`[verifyTextRelatedToText] after: findTextInAllFrames took ${Date.now() - _perf_t322}ms`);
        } catch (error) {
          // ignore
        }
        if (resultWithElementsFound.length === 0) {
          if (Date.now() - state.startTime > timeout) {
            throw new Error(`Text ${foundAncore ? textToVerify : textAnchor} not found in page`);
          }
          const _perf_t323 = Date.now();
          logEvent("[verifyTextRelatedToText] before: new Promise");
          await new Promise((resolve) => setTimeout(resolve, 1000));
          logEvent(`[verifyTextRelatedToText] after: new Promise took ${Date.now() - _perf_t323}ms`);
          continue;
        } else {
          cmdEndTime = Date.now();
          if (cmdEndTime - cmdStartTime > 55000) {
            if (foundAncore) {
              throw new Error(`Text ${textToVerify} not found in page`);
            } else {
              throw new Error(`Text ${textAnchor} not found in page`);
            }
          }
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
            if (Number(climb) > 0) {
              css = css + " >> " + climbXpath;
            }
            const _perf_t324 = Date.now();
            logEvent("[verifyTextRelatedToText] before: frame.locator");
            const count = await frame.locator(css).count();
            logEvent(`[verifyTextRelatedToText] after: frame.locator took ${Date.now() - _perf_t324}ms`);
            for (let j = 0; j < count; j++) {
              const _perf_t325 = Date.now();
              logEvent("[verifyTextRelatedToText] before: frame.locator");
              const continer = await frame.locator(css).nth(j);
              logEvent(`[verifyTextRelatedToText] after: frame.locator took ${Date.now() - _perf_t325}ms`);
              const _perf_t326 = Date.now();
              logEvent("[verifyTextRelatedToText] before: _locateElementByText");
              const result = await this._locateElementByText(
                continer,
                textToVerify,
                "*:not(script, style, head)",
                false,
                true,
                true,
                {}
              );
              logEvent(`[verifyTextRelatedToText] after: _locateElementByText took ${Date.now() - _perf_t326}ms`);
              if (result.elementCount > 0) {
                const dataAttribute = "[data-blinq-id-" + result.randomToken + "]";
                const _perf_t327 = Date.now();
                logEvent("[verifyTextRelatedToText] before: _highlightElements");
                await this._highlightElements(frame, dataAttribute);
                logEvent(`[verifyTextRelatedToText] after: _highlightElements took ${Date.now() - _perf_t327}ms`);
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
                const _perf_t328 = Date.now();
                logEvent("[verifyTextRelatedToText] before: frame.locator");
                const element = await frame.locator(dataAttribute).first();
                logEvent(`[verifyTextRelatedToText] after: frame.locator took ${Date.now() - _perf_t328}ms`);
                // await new Promise((resolve) => setTimeout(resolve, 100));
                // await this._unhighlightElements(frame, dataAttribute);
                if (element) {
                  const _perf_t329 = Date.now();
                  logEvent("[verifyTextRelatedToText] before: scrollIfNeeded");
                  await this.scrollIfNeeded(element, state.info);
                  logEvent(`[verifyTextRelatedToText] after: scrollIfNeeded took ${Date.now() - _perf_t329}ms`);
                  const _perf_t330 = Date.now();
                  logEvent("[verifyTextRelatedToText] before: element.dispatchEvent");
                  await element.dispatchEvent("bvt_verify_page_contains_text");
                  logEvent(`[verifyTextRelatedToText] after: element.dispatchEvent took ${Date.now() - _perf_t330}ms`);
                }
                const _perf_t331 = Date.now();
                logEvent("[verifyTextRelatedToText] before: _screenshot");
                await _screenshot(state, this);
                logEvent(`[verifyTextRelatedToText] after: _screenshot took ${Date.now() - _perf_t331}ms`);
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
      const _perf_t332 = Date.now();
      logEvent("[verifyTextRelatedToText] before: _commandError");
      await _commandError(state, e, this);
      logEvent(`[verifyTextRelatedToText] after: _commandError took ${Date.now() - _perf_t332}ms`);
    } finally {
      const _perf_t333 = Date.now();
      logEvent("[verifyTextRelatedToText] before: _commandFinally");
      await _commandFinally(state, this);
      logEvent(`[verifyTextRelatedToText] after: _commandFinally took ${Date.now() - _perf_t333}ms`);
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
      const _perf_t334 = Date.now();
      logEvent("[findRelatedTextInAllFrames] before: _locateElementByText");
      const result = await this._locateElementByText(
        frames[i],
        textAnchor,
        "*:not(script, style, head)",
        false,
        true,
        ignoreCase,
        {}
      );
      logEvent(`[findRelatedTextInAllFrames] after: _locateElementByText took ${Date.now() - _perf_t334}ms`);
      result.frame = frames[i];

      const climbArray = [];
      for (let i = 0; i < climb; i++) {
        climbArray.push("..");
      }
      let climbXpath = "xpath=" + climbArray.join("/");

      const newLocator = `[data-blinq-id-${result.randomToken}] ${climb > 0 ? ">> " + climbXpath : ""} >> internal:text=${testForRegex(textToVerify) ? textToVerify : unEscapeString(textToVerify)}`;

      const _perf_t335 = Date.now();
      logEvent("[findRelatedTextInAllFrames] before: frames[i]");
      const count = await frames[i].locator(newLocator).count();
      logEvent(`[findRelatedTextInAllFrames] after: frames[i] took ${Date.now() - _perf_t335}ms`);
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
    const _perf_t336 = Date.now();
    logEvent("[visualVerification] before: new Promise");
    await new Promise((resolve) => setTimeout(resolve, 2000));
    logEvent(`[visualVerification] after: new Promise took ${Date.now() - _perf_t336}ms`);
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
      const _perf_t337 = Date.now();
      logEvent("[visualVerification] before: takeScreenshot");
      const screenshot = await this.takeScreenshot();
      logEvent(`[visualVerification] after: takeScreenshot took ${Date.now() - _perf_t337}ms`);
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
      const _perf_t338 = Date.now();
      logEvent("[visualVerification] before: axios.request");
      const result = await axios.request(request);
      logEvent(`[visualVerification] after: axios.request took ${Date.now() - _perf_t338}ms`);
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
      const _perf_t339 = Date.now();
      logEvent("[visualVerification] before: _commandError");
      await _commandError({ text: "visualVerification", operation: "visualVerification", info }, e, this);
      logEvent(`[visualVerification] after: _commandError took ${Date.now() - _perf_t339}ms`);
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
    const _perf_t340 = Date.now();
    logEvent("[verifyTableData] before: getTableData");
    const tableData = await this.getTableData(selectors, _params, options, world);
    logEvent(`[verifyTableData] after: getTableData took ${Date.now() - _perf_t340}ms`);

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
      const _perf_t341 = Date.now();
      logEvent("[getTableData] before: _locate");
      let table = await this._locate(selectors, info, _params);
      logEvent(`[getTableData] after: _locate took ${Date.now() - _perf_t341}ms`);
      ({ screenshotId, screenshotPath } = await this._screenShot(options, world, info));
      const _perf_t342 = Date.now();
      logEvent("[getTableData] before: getTableData");
      const tableData = await getTableData(this.page, table);
      logEvent(`[getTableData] after: getTableData took ${Date.now() - _perf_t342}ms`);
      return tableData;
    } catch (e) {
      this.logger.error("getTableData failed " + info.log);
      this.logger.error(e);
      ({ screenshotId, screenshotPath } = await this._screenShot(options, world, info));
      info.screenshotPath = screenshotPath;
      Object.assign(e, { info: info });
      error = e;
      // throw e;
      const _perf_t343 = Date.now();
      logEvent("[getTableData] before: _commandError");
      await _commandError({ text: "getTableData", operation: "getTableData", selectors, info }, e, this);
      logEvent(`[getTableData] after: _commandError took ${Date.now() - _perf_t343}ms`);
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
    const _perf_t344 = Date.now();
    logEvent("[analyzeTable] before: _replaceWithLocalData");
    const newValue = await this._replaceWithLocalData(value, world);
    logEvent(`[analyzeTable] after: _replaceWithLocalData took ${Date.now() - _perf_t344}ms`);
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
      const _perf_t345 = Date.now();
      logEvent("[analyzeTable] before: _locate");
      let table = await this._locate(selectors, info, _params);
      logEvent(`[analyzeTable] after: _locate took ${Date.now() - _perf_t345}ms`);
      ({ screenshotId, screenshotPath } = await this._screenShot(options, world, info));
      const _perf_t346 = Date.now();
      logEvent("[analyzeTable] before: getTableCells");
      const cells = await getTableCells(this.page, table, query, info);
      logEvent(`[analyzeTable] after: getTableCells took ${Date.now() - _perf_t346}ms`);

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
      const _perf_t347 = Date.now();
      logEvent("[analyzeTable] before: _commandError");
      await _commandError(
        { text: "analyzeTable", operation: "analyzeTable", selectors, query, operator, value },
        e,
        this
      );
      logEvent(`[analyzeTable] after: _commandError took ${Date.now() - _perf_t347}ms`);
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
      const _perf_t348 = Date.now();
      logEvent("[sleep] before: _preCommand");
      await _preCommand(state, this);
      logEvent(`[sleep] after: _preCommand took ${Date.now() - _perf_t348}ms`);

      if (duration < 0) {
        throw new Error("Sleep duration cannot be negative");
      }

      const _perf_t349 = Date.now();
      logEvent("[sleep] before: new Promise");
      await new Promise((resolve) => setTimeout(resolve, duration));
      logEvent(`[sleep] after: new Promise took ${Date.now() - _perf_t349}ms`);

      return state.info;
    } catch (e) {
      const _perf_t350 = Date.now();
      logEvent("[sleep] before: _commandError");
      await _commandError(state, e, this);
      logEvent(`[sleep] after: _commandError took ${Date.now() - _perf_t350}ms`);
    } finally {
      const _perf_t351 = Date.now();
      logEvent("[sleep] before: _commandFinally");
      await _commandFinally(state, this);
      logEvent(`[sleep] after: _commandFinally took ${Date.now() - _perf_t351}ms`);
    }
  }
  async _replaceWithLocalData(value, world, _decrypt = true, totpWait = true) {
    try {
      const _perf_t352 = Date.now();
      logEvent("[_replaceWithLocalData] before: replaceWithLocalTestData");
      return await replaceWithLocalTestData(value, world, _decrypt, totpWait, this.context, this);
      logEvent(`[_replaceWithLocalData] after: replaceWithLocalTestData took ${Date.now() - _perf_t352}ms`);
    } catch (error) {
      logEvent(error);
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
    const _perf_t353 = Date.now();
    logEvent("[saveStoreState] before: page.context");
    const storageState = await this.page.context().storageState();
    logEvent(`[saveStoreState] after: page.context took ${Date.now() - _perf_t353}ms`);
    const _perf_t354 = Date.now();
    logEvent("[saveStoreState] before: _replaceWithLocalData");
    path = await this._replaceWithLocalData(path, this.world);
    logEvent(`[saveStoreState] after: _replaceWithLocalData took ${Date.now() - _perf_t354}ms`);
    //const testDataFile = _getDataFile(world, this.context, this);
    if (path) {
      // save { storageState: storageState } into the path
      fs.writeFileSync(path, JSON.stringify({ storageState: storageState }, null, 2));
    } else {
      const _perf_t355 = Date.now();
      logEvent("[saveStoreState] before: setTestData");
      await this.setTestData({ storageState: storageState }, world);
      logEvent(`[saveStoreState] after: setTestData took ${Date.now() - _perf_t355}ms`);
    }
  }
  async restoreSaveState(path: string | null = null, world: any = null) {
    const _perf_t356 = Date.now();
    logEvent("[restoreSaveState] before: _replaceWithLocalData");
    path = await this._replaceWithLocalData(path, this.world);
    logEvent(`[restoreSaveState] after: _replaceWithLocalData took ${Date.now() - _perf_t356}ms`);
    const _perf_t357 = Date.now();
    logEvent("[restoreSaveState] before: refreshBrowser");
    await refreshBrowser(this, path, world);
    logEvent(`[restoreSaveState] after: refreshBrowser took ${Date.now() - _perf_t357}ms`);
    this.registerEventListeners(this.context);
    registerNetworkEvents(this.world, this, this.context, this.page);
    registerDownloadEvent(this.page, this.world, this.context);
    if (this.onRestoreSaveState) {
      const _perf_t358 = Date.now();
      logEvent("[restoreSaveState] before: onRestoreSaveState");
      await this.onRestoreSaveState(path);
      logEvent(`[restoreSaveState] after: onRestoreSaveState took ${Date.now() - _perf_t358}ms`);
    }
  }

  async waitForPageLoad(options = {}, world = null) {
    // try {
    //   let currentPagePath = null;
    //   currentPagePath = new URL(this.page.url()).pathname;
    //   if (this.latestPagePath) {
    //     // get the currect page path and compare with the latest page path
    //     if (this.latestPagePath === currentPagePath) {
    //       // if the page path is the same, do not wait for page load
    //       console.log("No page change: " + currentPagePath);
    //       return;
    //     }
    //   }
    //   this.latestPagePath = currentPagePath;
    // } catch (e) {
    //   console.debug("Error getting current page path: ", e);
    // }
    //console.log("Waiting for page load");

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
      const _perf_t359 = Date.now();
      logEvent("[waitForPageLoad] before: Promise.all");
      await Promise.all(promiseArray);
      logEvent(`[waitForPageLoad] after: Promise.all took ${Date.now() - _perf_t359}ms`);
    } catch (e) {
      if (e.label === "networkidle") {
        console.log("waited for the network to be idle timeout");
      } else if (e.label === "load") {
        console.log("waited for the load timeout");
      } else if (e.label === "domcontentloaded") {
        console.log("waited for the domcontent loaded timeout");
      }
    } finally {
      const _perf_t360 = Date.now();
      logEvent("[waitForPageLoad] before: new Promise");
      await new Promise((resolve) => setTimeout(resolve, 500));
      logEvent(`[waitForPageLoad] after: new Promise took ${Date.now() - _perf_t360}ms`);
      if (options && !options.noSleep) {
        const _perf_t361 = Date.now();
        logEvent("[waitForPageLoad] before: new Promise");
        await new Promise((resolve) => setTimeout(resolve, 1500));
        logEvent(`[waitForPageLoad] after: new Promise took ${Date.now() - _perf_t361}ms`);
      }
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
      // throwError: false,
    };

    try {
      const _perf_t362 = Date.now();
      logEvent("[closePage] before: _preCommand");
      await _preCommand(state, this);
      logEvent(`[closePage] after: _preCommand took ${Date.now() - _perf_t362}ms`);
      const _perf_t363 = Date.now();
      logEvent("[closePage] before: page.close");
      await this.page.close();
      logEvent(`[closePage] after: page.close took ${Date.now() - _perf_t363}ms`);
    } catch (e) {
      const _perf_t364 = Date.now();
      logEvent("[closePage] before: _commandError");
      await _commandError(state, e, this);
      logEvent(`[closePage] after: _commandError took ${Date.now() - _perf_t364}ms`);
    } finally {
      const _perf_t365 = Date.now();
      logEvent("[closePage] before: _commandFinally");
      await _commandFinally(state, this);
      logEvent(`[closePage] after: _commandFinally took ${Date.now() - _perf_t365}ms`);
    }
  }
  async tableCellOperation(headerText: string, rowText: string, options: any, _params: Params, world = null) {
    let operation = null;
    if (!options || !options.operation) {
      throw new Error("operation is not defined");
    }
    operation = options.operation;
    // validate operation is one of the supported operations
    if (operation != "click" && operation != "hover+click" && operation != "hover") {
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
      const _perf_t366 = Date.now();
      logEvent("[tableCellOperation] before: _preCommand");
      await _preCommand(state, this);
      logEvent(`[tableCellOperation] after: _preCommand took ${Date.now() - _perf_t366}ms`);
      const start = Date.now();
      let cellArea = null;
      while (true) {
        try {
          const _perf_t367 = Date.now();
          logEvent("[tableCellOperation] before: _findCellArea");
          cellArea = await _findCellArea(headerText, rowText, this, state);
          logEvent(`[tableCellOperation] after: _findCellArea took ${Date.now() - _perf_t367}ms`);
          if (cellArea) {
            break;
          }
        } catch (e) {
          // ignore
        }
        if (Date.now() - start > timeout) {
          throw new Error(`Cell not found in table`);
        }
        const _perf_t368 = Date.now();
        logEvent("[tableCellOperation] before: new Promise");
        await new Promise((resolve) => setTimeout(resolve, 1000));
        logEvent(`[tableCellOperation] after: new Promise took ${Date.now() - _perf_t368}ms`);
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
            const _perf_t369 = Date.now();
            logEvent("[tableCellOperation] before: page.mouse.click");
            await this.page.mouse.click(
              cellArea.x + cellArea.width / 2 + xOffset,
              cellArea.y + cellArea.height / 2 + yOffset
            );
            logEvent(`[tableCellOperation] after: page.mouse.click took ${Date.now() - _perf_t369}ms`);
          } else {
            const _perf_t370 = Date.now();
            logEvent("[tableCellOperation] before: findElementsInArea");
            const results = await findElementsInArea(options.css, cellArea, this, options);
            logEvent(`[tableCellOperation] after: findElementsInArea took ${Date.now() - _perf_t370}ms`);
            if (results.length === 0) {
              throw new Error(`Element not found in cell area`);
            }
            state.element = results[0];
            const _perf_t371 = Date.now();
            logEvent("[tableCellOperation] before: performAction");
            await performAction("click", state.element, options, this, state, _params);
            logEvent(`[tableCellOperation] after: performAction took ${Date.now() - _perf_t371}ms`);
          }
          break;
        case "hover+click":
          if (!options.css) {
            throw new Error("css is not defined");
          }
          const _perf_t372 = Date.now();
          logEvent("[tableCellOperation] before: findElementsInArea");
          const results = await findElementsInArea(options.css, cellArea, this, options);
          logEvent(`[tableCellOperation] after: findElementsInArea took ${Date.now() - _perf_t372}ms`);
          if (results.length === 0) {
            throw new Error(`Element not found in cell area`);
          }
          state.element = results[0];
          const _perf_t373 = Date.now();
          logEvent("[tableCellOperation] before: performAction");
          await performAction("hover+click", state.element, options, this, state, _params);
          logEvent(`[tableCellOperation] after: performAction took ${Date.now() - _perf_t373}ms`);
          break;
        case "hover":
          if (!options.css) {
            throw new Error("css is not defined");
          }
          const _perf_t374 = Date.now();
          logEvent("[tableCellOperation] before: findElementsInArea");
          const result1 = await findElementsInArea(options.css, cellArea, this, options);
          logEvent(`[tableCellOperation] after: findElementsInArea took ${Date.now() - _perf_t374}ms`);
          if (result1.length === 0) {
            throw new Error(`Element not found in cell area`);
          }
          state.element = result1[0];
          const _perf_t375 = Date.now();
          logEvent("[tableCellOperation] before: performAction");
          await performAction("hover", state.element, options, this, state, _params);
          logEvent(`[tableCellOperation] after: performAction took ${Date.now() - _perf_t375}ms`);
          break;
        default:
          throw new Error("operation is not supported");
      }
    } catch (e) {
      const _perf_t376 = Date.now();
      logEvent("[tableCellOperation] before: _commandError");
      await _commandError(state, e, this);
      logEvent(`[tableCellOperation] after: _commandError took ${Date.now() - _perf_t376}ms`);
    } finally {
      const _perf_t377 = Date.now();
      logEvent("[tableCellOperation] before: _commandFinally");
      await _commandFinally(state, this);
      logEvent(`[tableCellOperation] after: _commandFinally took ${Date.now() - _perf_t377}ms`);
    }
  }

  saveTestDataAsGlobal(options: any, world: any) {
    const dataFile = _getDataFile(world, this.context, this);
    if (process.env.MODE === "executions") {
      const globalDataFile = path.join(this.project_path, "global_test_data.json");

      const dataFileContents = fs.existsSync(dataFile) ? JSON.parse(fs.readFileSync(dataFile)) : {};
      const globalDataFileContents = fs.existsSync(globalDataFile) ? JSON.parse(fs.readFileSync(globalDataFile)) : {};

      const mergedData = JSON.stringify(_.merge({}, dataFileContents, globalDataFileContents), null, 2);

      fs.writeFileSync(dataFile, mergedData);
      fs.writeFileSync(globalDataFile, mergedData);
      this.logger.info("Save the scenario test data to " + dataFile + " as global for the following scenarios.");
      return;
    }
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
      const _perf_t378 = Date.now();
      logEvent("[setViewportSize] before: page.setViewportSize");
      await this.page.setViewportSize({ width: width, height: hight });
      logEvent(`[setViewportSize] after: page.setViewportSize took ${Date.now() - _perf_t378}ms`);
    } catch (e) {
      const _perf_t379 = Date.now();
      logEvent("[setViewportSize] before: _commandError");
      await _commandError({ text: "setViewportSize", operation: "setViewportSize", width, hight, info }, e, this);
      logEvent(`[setViewportSize] after: _commandError took ${Date.now() - _perf_t379}ms`);
    } finally {
      const _perf_t380 = Date.now();
      logEvent("[setViewportSize] before: new Promise");
      await new Promise((resolve) => setTimeout(resolve, 2000));
      logEvent(`[setViewportSize] after: new Promise took ${Date.now() - _perf_t380}ms`);
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
      const _perf_t381 = Date.now();
      logEvent("[reloadPage] before: page.reload");
      await this.page.reload();
      logEvent(`[reloadPage] after: page.reload took ${Date.now() - _perf_t381}ms`);
    } catch (e) {
      const _perf_t382 = Date.now();
      logEvent("[reloadPage] before: _commandError");
      await _commandError({ text: "reloadPage", operation: "reloadPage", info }, e, this);
      logEvent(`[reloadPage] after: _commandError took ${Date.now() - _perf_t382}ms`);
    } finally {
      const _perf_t383 = Date.now();
      logEvent("[reloadPage] before: new Promise");
      await new Promise((resolve) => setTimeout(resolve, 2000));
      logEvent(`[reloadPage] after: new Promise took ${Date.now() - _perf_t383}ms`);
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
      const _perf_t384 = Date.now();
      logEvent("[scrollIfNeeded] before: element.scrollIntoViewIfNeeded");
      await element.scrollIntoViewIfNeeded({
        timeout: 2000,
      });
      logEvent(`[scrollIfNeeded] after: element.scrollIntoViewIfNeeded took ${Date.now() - _perf_t384}ms`);
      const _perf_t385 = Date.now();
      logEvent("[scrollIfNeeded] before: new Promise");
      await new Promise((resolve) => setTimeout(resolve, 500));
      logEvent(`[scrollIfNeeded] after: new Promise took ${Date.now() - _perf_t385}ms`);
      if (info) {
        const _perf_t386 = Date.now();
        logEvent("[scrollIfNeeded] before: element.boundingBox");
        info.box = await element.boundingBox({
          timeout: 1000,
        });
        logEvent(`[scrollIfNeeded] after: element.boundingBox took ${Date.now() - _perf_t386}ms`);
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
      if (this.tags.includes(TAG_CONSTANTS.GLOBAL_TEST_DATA)) {
        this.saveTestDataAsGlobal({}, world);
      }
      if (this.tags.includes(TAG_CONSTANTS.FAST_MODE)) {
        this.fastMode = true;
      }
    }
    // update test data based on feature/scenario
    let envName = null;
    if (this.context && this.context.environment) {
      envName = this.context.environment.name;
    }
    if (!process.env.TEMP_RUN) {
      const _perf_t387 = Date.now();
      logEvent("[beforeScenario] before: getTestData");
      await getTestData(envName, world, undefined, this.featureName, this.scenarioName, this.context);
      logEvent(`[beforeScenario] after: getTestData took ${Date.now() - _perf_t387}ms`);
    }
    const _perf_t388 = Date.now();
    logEvent("[beforeScenario] before: loadBrunoParams");
    await loadBrunoParams(this.context, this.context.environment.name);
    logEvent(`[beforeScenario] after: loadBrunoParams took ${Date.now() - _perf_t388}ms`);

    if ((process.env.TRACE === "true" || this.configuration.trace === true) && this.context) {
      this.trace = true;
      const traceFolder = path.join(this.context.reportFolder!, "trace");
      if (!fs.existsSync(traceFolder)) {
        fs.mkdirSync(traceFolder, { recursive: true });
      }
      this.traceFolder = traceFolder;
      const _perf_t389 = Date.now();
      logEvent("[beforeScenario] before: context.playContext.tracing.start");
      await this.context.playContext.tracing.start({ screenshots: true, snapshots: true });
      logEvent(`[beforeScenario] after: context.playContext.tracing.start took ${Date.now() - _perf_t389}ms`);
    }
  }
  async afterScenario(world, scenario) {
    const id = scenario.testCaseStartedId;
    if (this.trace) {
      const _perf_t390 = Date.now();
      logEvent("[afterScenario] before: context.playContext.tracing.stop");
      await this.context.playContext.tracing.stop({
        path: path.join(this.traceFolder!, `trace-${id}.zip`),
      });
      logEvent(`[afterScenario] after: context.playContext.tracing.stop took ${Date.now() - _perf_t390}ms`);
    }
  }
  getGherkinKeyword(step) {
    if (!step?.type) {
      return "";
    }
    switch (step.type) {
      case "Context":
        return "Given";
      case "Action":
        return "When";
      case "Outcome":
        return "Then";
      case "Conjunction":
        return "And";
      default:
        return "";
    }
  }
  async beforeStep(world, step) {
    if (step?.pickleStep && this.trace) {
      const keyword = this.getGherkinKeyword(step.pickleStep);
      this.traceGroupName = `${keyword} ${step.pickleStep.text}`;
      const _perf_t391 = Date.now();
      logEvent("[beforeStep] before: context.playContext.tracing.group");
      await this.context.playContext.tracing.group(this.traceGroupName);
      logEvent(`[beforeStep] after: context.playContext.tracing.group took ${Date.now() - _perf_t391}ms`);
    }
    this.stepTags = [];
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

      let printableStepName = this.stepName;
      // take the printableStepName and replace quated value with \x1b[33m and \x1b[0m
      printableStepName = printableStepName.replace(/"([^"]*)"/g, (match, p1) => {
        return `\x1b[33m"${p1}"\x1b[0m`;
      });

      this.logger.info("\x1b[38;5;208mstep:\x1b[0m " + printableStepName);
    } else if (step && step.text) {
      this.stepName = step.text;
    } else {
      this.stepName = "step " + this.stepIndex;
    }
    if (this.context && this.context.browserObject && this.context.browserObject.trace === true) {
      if (this.context.browserObject.context) {
        const _perf_t392 = Date.now();
        logEvent("[beforeStep] before: context.browserObject.context.tracing.startChunk");
        await this.context.browserObject.context.tracing.startChunk({ title: this.stepName });
        logEvent(
          `[beforeStep] after: context.browserObject.context.tracing.startChunk took ${Date.now() - _perf_t392}ms`
        );
      }
    }

    if (this.initSnapshotTaken === false) {
      this.initSnapshotTaken = true;
      if (
        world &&
        world.attach &&
        !process.env.DISABLE_SNAPSHOT &&
        (!this.fastMode || this.stepTags.includes("fast-mode"))
      ) {
        const _perf_t393 = Date.now();
        logEvent("[beforeStep] before: getAriaSnapshot");
        const snapshot = await this.getAriaSnapshot();
        logEvent(`[beforeStep] after: getAriaSnapshot took ${Date.now() - _perf_t393}ms`);
        if (snapshot) {
          const _perf_t394 = Date.now();
          logEvent("[beforeStep] before: world.attach");
          await world.attach(JSON.stringify(snapshot), "application/json+snapshot-before");
          logEvent(`[beforeStep] after: world.attach took ${Date.now() - _perf_t394}ms`);
        }
      }
    }
    this.context.routeResults = null;
    this.context.loadedRoutes = null;
    const _perf_t395 = Date.now();
    logEvent("[beforeStep] before: registerBeforeStepRoutes");
    await registerBeforeStepRoutes(this.context, this.stepName, world);
    logEvent(`[beforeStep] after: registerBeforeStepRoutes took ${Date.now() - _perf_t395}ms`);
    networkBeforeStep(this.stepName, this.context);
    this.inStepReport = false;
  }
  setStepTags(tags: string[]) {
    this.stepTags = tags;
  }
  async getAriaSnapshot() {
    return;
    // try {
    //   // find the page url
    //   const url = await this.page.url();

    //   // extract the path from the url
    //   const path = new URL(url).pathname;
    //   // get the page title
    //   const title = await this.page.title();
    //   // go over other frams
    //   const frames = this.page.frames();
    //   const snapshots = [];
    //   const content = [`- path: ${path}`, `- title: ${title}`];
    //   const timeout = this.configuration.ariaSnapshotTimeout ? this.configuration.ariaSnapshotTimeout : 3000;
    //   for (let i = 0; i < frames.length; i++) {
    //     const frame = frames[i];
    //     try {
    //       // Ensure frame is attached and has body
    //       const body = frame.locator("body");
    //       //await body.waitFor({ timeout: 2000 }); // wait explicitly
    //       const snapshot = await body.ariaSnapshot({ timeout });
    //       if (!snapshot) {
    //         continue;
    //       }
    //       content.push(`- frame: ${i}`);
    //       content.push(snapshot);
    //     } catch (innerErr) {
    //       console.warn(`Frame ${i} snapshot failed:`, innerErr);
    //       content.push(`- frame: ${i} - error: ${innerErr.message}`);
    //     }
    //   }

    //   return content.join("\n");
    // } catch (e) {
    //   console.log("Error in getAriaSnapshot");
    //   //console.debug(e);
    // }
    // return null;
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
        throw new Error(commandText);
      }
    } catch (e) {
      await _commandError(state, e, this);
    } finally {
      await _commandFinally(state, this);
    }
  }

  async afterStep(world, step, result) {
    const afterStepStart = Date.now();
    logEvent("[afterStep] started");

    this.stepName = null;

    if (this.context) {
      logEvent("[afterStep] branch: context exists — clearing examplesRow");
      this.context.examplesRow = null;
    } else {
      logEvent("[afterStep] branch: no context — skipping examplesRow clear");
    }

    if (!this.inStepReport) {
      logEvent("[afterStep] branch: not inStepReport — checking step result");
      // check the step result
      if (result && result.status === "FAILED" && world && world.attach) {
        logEvent("[afterStep] branch: step FAILED — attaching failure report");
        const t0 = Date.now();
        await this.addCommandToReport(
          result.message ? result.message : "Step failed",
          "FAILED",
          `${result.message}`,
          { type: "text", screenshot: true },
          world
        );
        logEvent(`[afterStep] addCommandToReport (failure report) took ${Date.now() - t0}ms`);
      } else {
        logEvent(
          `[afterStep] branch: step not FAILED (status=${result?.status}) or world.attach unavailable — skipping failure report`
        );
      }
    } else {
      logEvent("[afterStep] branch: inStepReport=true — skipping failure report check");
    }

    if (
      world &&
      world.attach &&
      !process.env.DISABLE_SNAPSHOT &&
      !this.fastMode &&
      !this.stepTags.includes("fast-mode")
    ) {
      logEvent("[afterStep] branch: snapshot eligible — fetching aria snapshot");
      const t0 = Date.now();
      const snapshot = await this.getAriaSnapshot();
      logEvent(`[afterStep] getAriaSnapshot took ${Date.now() - t0}ms`);
      if (snapshot) {
        logEvent("[afterStep] branch: snapshot returned — attaching to world");
        const obj = {};
        const t1 = Date.now();
        await world.attach(JSON.stringify(snapshot), "application/json+snapshot-after");
        logEvent(`[afterStep] world.attach (aria snapshot) took ${Date.now() - t1}ms`);
      } else {
        logEvent("[afterStep] branch: snapshot was empty/null — skipping attach");
      }
    } else {
      logEvent(
        `[afterStep] branch: snapshot skipped — world=${!!world} world.attach=${!!(world && world.attach)} DISABLE_SNAPSHOT=${!!process.env.DISABLE_SNAPSHOT} fastMode=${this.fastMode} stepTags.fast-mode=${this.stepTags.includes("fast-mode")}`
      );
    }

    const t0 = Date.now();
    this.context.routeResults = await registerAfterStepRoutes(this.context, world);
    logEvent(`[afterStep] registerAfterStepRoutes took ${Date.now() - t0}ms`);

    if (this.context.routeResults) {
      logEvent("[afterStep] branch: routeResults present — checking world.attach");
      if (world && world.attach) {
        logEvent("[afterStep] branch: world.attach available — attaching intercept results");
        const t1 = Date.now();
        await world.attach(JSON.stringify(this.context.routeResults), "application/json+intercept-results");
        logEvent(`[afterStep] world.attach (intercept results) took ${Date.now() - t1}ms`);
      } else {
        logEvent("[afterStep] branch: world.attach unavailable — skipping intercept results attach");
      }
    } else {
      logEvent("[afterStep] branch: no routeResults — skipping intercept results attach");
    }

    if (!process.env.TEMP_RUN) {
      logEvent("[afterStep] branch: TEMP_RUN not set — running step_complete command");
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
        const t1 = Date.now();
        await _preCommand(state, this);
        logEvent(`[afterStep] _preCommand (step_complete) took ${Date.now() - t1}ms`);
      } catch (e) {
        logEvent(`[afterStep] branch: _preCommand threw — running _commandError`);
        const t1 = Date.now();
        await _commandError(state, e, this);
        logEvent(`[afterStep] _commandError took ${Date.now() - t1}ms`);
      } finally {
        const t1 = Date.now();
        await _commandFinally(state, this);
        logEvent(`[afterStep] _commandFinally took ${Date.now() - t1}ms`);
      }
    } else {
      logEvent(`[afterStep] branch: TEMP_RUN=${process.env.TEMP_RUN} — skipping step_complete command`);
    }

    networkAfterStep(this.stepName, this.context);

    if (process.env.TEMP_RUN === "true") {
      logEvent("[afterStep] branch: TEMP_RUN=true — checking fast-mode tag");
      if (!this.stepTags.includes("fast-mode")) {
        logEvent("[afterStep] branch: not fast-mode — sleeping 3000ms");
        const t1 = Date.now();
        await new Promise((resolve) => setTimeout(resolve, 3000));
        logEvent(`[afterStep] TEMP_RUN sleep took ${Date.now() - t1}ms`);
      } else {
        logEvent("[afterStep] branch: fast-mode tag present — skipping TEMP_RUN sleep");
      }
    } else {
      logEvent(`[afterStep] branch: TEMP_RUN !== 'true' (value=${process.env.TEMP_RUN}) — skipping sleep`);
    }

    if (this.trace) {
      logEvent("[afterStep] branch: tracing enabled — closing trace group");
      const t1 = Date.now();
      await this.context.playContext.tracing.groupEnd();
      logEvent(`[afterStep] tracing.groupEnd took ${Date.now() - t1}ms`);
    } else {
      logEvent("[afterStep] branch: tracing disabled — skipping groupEnd");
    }

    logEvent(`[afterStep] total duration: ${Date.now() - afterStepStart}ms`);
  }
}

function createTimedPromise(promise, label) {
  return promise
    .then((result) => ({ status: "fulfilled", label, result }))
    .catch((error) => Promise.reject({ status: "rejected", label, error }));
}
export { StableBrowser };

function logEvent(message) {
  const humanFriendlyTime = new Date().toISOString();
  console.log(`🟧 [${humanFriendlyTime}] ${message}`);
}
