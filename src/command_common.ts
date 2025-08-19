import { check_performance } from "./check_performance.js";
import { getHumanReadableErrorMessage } from "./error-messages.js";
import { LocatorLog } from "./locator_log.js";
import { _fixUsingParams, maskValue, replaceWithLocalTestData } from "./utils.js";

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

export async function _preCommand(state: any, web: any) {
  if (web && web.getCmdId) {
    state.cmdId = web.getCmdId();
  }
  if (!state) {
    return;
  }

  let allowDisabled = false;
  if (state.allowDisabled) {
    allowDisabled = true;
  }
  if (state.locate !== false) {
    state.locate = true;
  }
  if (state.scroll !== false) {
    state.scroll = true;
  }
  if (state.screenshot !== false) {
    state.screenshot = true;
  }
  if (state.highlight !== false) {
    state.highlight = true;
  }
  if (state.throwError !== false) {
    state.throwError = true;
  }
  state.info = {};
  if (state.value) {
    state.value = _fixUsingParams(state.value, state._params);
    state.info.value = state.value;
  }
  if (state.attribute) {
    state.info.attribute = state.attribute;
  }
  if (state.selectors) {
    _validateSelectors(state.selectors);
    const originalSelectors = state.selectors;
    state.selectors = JSON.parse(JSON.stringify(state.selectors));
    if (originalSelectors.frame) {
      state.selectors.frame = originalSelectors.frame;
    }
  }
  state.startTime = Date.now();
  state.info.selectors = state.selectors;
  state.info.log = state.log ? state.log : "";
  if (state.selectors) {
    state.info.locatorLog = new LocatorLog();
    state.info.locatorLog.mission = state.info.log.trim();
  }

  state.info.operation = state.operation;

  state.info.failCause = {};
  state.error = null;
  state.screenshotId = null;
  state.screenshotPath = null;
  state.onlyFailuresScreenshot = process.env.SCREENSHOT_ON_FAILURE_ONLY === "true";
  if (state.locate === true) {
    let timeout = null;
    if (state.options && state.options.timeout) {
      timeout = state.options.timeout;
    }
    state.element = await web._locate(state.selectors, state.info, state._params, timeout, allowDisabled);
  }
  if (state.scroll === true) {
    await web.scrollIfNeeded(state.element, state.info);
  }
  if (state.screenshot === true /*&& !web.fastMode*/) {
    if (!state.onlyFailuresScreenshot) {
      check_performance("screenshot", web.context, true);
      await _screenshot(state, web);
      check_performance("screenshot", web.context, false);
    }
  }
  if (state.highlight === true) {
    try {
      await web._highlightElements(state.element);
    } catch (e) {
      // ignore
    }
  }
  state.info.failCause.operationFailed = true;
  if (web.pausedCmd && web.pausedCmd.id === state.cmdId) {
    await new Promise((resolve, reject) => {
      web.pausedCmd.resolve = resolve;
      web.pausedCmd.reject = reject;
    });
  }
}
export async function _commandError(state: any, error: any, web: any) {
  if (!state.info) {
    state.info = {};
  }
  if (!state.info.failCause) {
    state.info.failCause = {};
  }
  web.logger.error(state.text + " failed");
  if (error && error.message) {
    web.logger.error(error.message);
  }
  if (state.info.locatorLog) {
    const lines = state.info.locatorLog.toString().split("\n");
    for (let line of lines) {
      web.logger.error(line);
    }
  }
  const { screenshotId, screenshotPath } = await web._screenShot(state.options, state.world, state.info);
  state.screenshotId = screenshotId;
  state.screenshotPath = screenshotPath;
  state.info.screenshotPath = screenshotPath;

  // state.info.failCause.error = error;
  state.info.failCause.fail = true;
  const errorClassification = getHumanReadableErrorMessage(error, state.info);
  state.info.errorType = errorClassification.errorType;
  state.info.errorMessage = errorClassification.errorMessage;
  state.info.errorStack = error.stack;

  Object.assign(error, { info: state.info });
  state.error = error;
  state.commandError = true;
  if (state.throwError) {
    throw error;
  }
}

export async function _screenshot(state: any, web: any, specificElement?: any) {
  // let focusedElement = null;
  // if (specificElement !== undefined) {
  //   focusedElement = specificElement;
  // } else {
  //   focusedElement = state.element;
  // }
  // const { screenshotId, screenshotPath } = await web._screenShot(
  //   state.options,
  //   state.world,
  //   state.info,
  //   focusedElement
  // );
  // ;
  const { screenshotId, screenshotPath } = await web._screenShot(state.options, state.world, state.info);
  state.screenshotId = screenshotId;
  state.screenshotPath = screenshotPath;
}

export async function _commandFinally(state: any, web: any) {
  if (state && !state.commandError === true) {
    state.info.failCause = {};
  }
  state.endTime = Date.now();
  let _value: string = "";
  if (state.originalValue) {
    try {
      if (state.originalValue.startsWith("{{") && state.originalValue.endsWith("}}")) {
        _value = (await replaceWithLocalTestData(
          state.originalValue,
          state.world,
          false,
          true,
          web.context,
          web
        )) as string;
      } else {
        _value = state.originalValue;
      }
    } catch (e) {
      console.error("Error replacing test data value", e);
      _value = state.originalValue;
    }
  }
  const reportObject: {
    element_name: string | null;
    type: string;
    text: string;
    _text: string;
    value: string;
    screenshotId: string | null;
    result: {
      status: string;
      startTime: string;
      endTime: string;
      message?: string;
      stack?: string;
    };
    info: any;
    locatorLog: string | null;
    payload?: any;
    cmdId?: string;
  } = {
    element_name: state.selectors ? state.selectors.element_name : null,
    type: state.type,
    text: state.text,
    _text: state._text,
    value: state.originalValue ? maskValue(_value) : state.value,
    screenshotId: state.screenshotId,
    result: state.error
      ? {
          status: "FAILED",
          startTime: state.startTime,
          endTime: state.endTime,
          message: state?.info?.errorMessage ?? state.error?.message,
          stack: state.error?.stack,
        }
      : {
          status: "PASSED",
          startTime: state.startTime,
          endTime: state.endTime,
        },
    info: state.info,
    locatorLog: state.info.locatorLog ? state.info.locatorLog.toString() : null,
    cmdId: state.cmdId,
  };
  if (state.originalValue && state.info) {
    state.info.value = maskValue(state.originalValue);
  }

  if (state.payload) {
    const payload = state.payload;
    reportObject.payload = payload;
  }
  _reportToWorld(state.world, reportObject);
}
export function _validateSelectors(selectors: any) {
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
export function _reportToWorld(world: any, properties: any) {
  if (!world || !world.attach) {
    return;
  }
  world.attach(JSON.stringify(properties), { mediaType: "application/json" });
}
