import { stat } from "fs";
import { getHumanReadableErrorMessage } from "./error-messages.js";
import { LocatorLog } from "./locator_log.js";
import { JsonCommandReport } from "./stable_browser.js";
import { _fixUsingParams, maskValue } from "./utils.js";

export async function _preCommand(state: any, stable: any) {
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
  if (state.locate === true) {
    let timeout = null;
    if (state.options && state.options.timeout) {
      timeout = state.options.timeout;
    }
    state.element = await stable._locate(state.selectors, state.info, state._params, timeout, allowDisabled);
  }
  if (state.scroll === true) {
    await stable.scrollIfNeeded(state.element, state.info);
  }
  if (state.screenshot === true) {
    await _screenshot(state, stable);
  }
  if (state.highlight === true) {
    try {
      await stable._highlightElements(state.element);
    } catch (e) {
      // ignore
    }
  }
  state.info.failCause.operationFailed = true;
}
export async function _commandError(state: any, error: any, stable: any) {
  if (!state.info) {
    state.info = {};
  }
  if (!state.info.failCause) {
    state.info.failCause = {};
  }
  stable.logger.error(state.text + " failed");
  if (error && error.message) {
    stable.logger.error(error.message);
  }
  if (state.info.locatorLog) {
    const lines = state.info.locatorLog.toString().split("\n");
    for (let line of lines) {
      stable.logger.error(line);
    }
  }
  const { screenshotId, screenshotPath } = await stable._screenShot(state.options, state.world, state.info);
  state.screenshotId = screenshotId;
  state.screenshotPath = screenshotPath;
  state.info.screenshotPath = screenshotPath;

  // state.info.failCause.error = error;
  state.info.failCause.fail = true;
  const errorClassification = getHumanReadableErrorMessage(error, state.info);
  state.info.errorType = errorClassification.errorType;
  state.info.errorMessage = errorClassification.errorMessage;

  Object.assign(error, { info: state.info });
  state.error = error;
  state.commandError = true;
  if (state.throwError) {
    throw error;
  }
}

export async function _screenshot(state: any, stable: any) {
  const { screenshotId, screenshotPath } = await stable._screenShot(state.options, state.world, state.info);
  state.screenshotId = screenshotId;
  state.screenshotPath = screenshotPath;
}
export function _commandFinally(state: any, stable: any) {
  if (state && !state.commandError === true) {
    state.info.failCause = {};
  }
  state.endTime = Date.now();
  const reportObject = {
    element_name: state.selectors ? state.selectors.element_name : null,
    type: state.type,
    text: state.text,
    value: state.originalValue ? maskValue(state.originalValue) : state.value,
    screenshotId: state.screenshotId,
    result: state.error
      ? {
          status: "FAILED",
          startTime: state.startTime,
          endTime: state.endTime,
          message: state.error?.message,
        }
      : {
          status: "PASSED",
          startTime: state.startTime,
          endTime: state.endTime,
        },
    info: state.info,
    locatorLog: state.info.locatorLog ? state.info.locatorLog.toString() : null,
  };
  if (state.originalValue && state.info) {
    state.info.value = maskValue(state.originalValue);
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
