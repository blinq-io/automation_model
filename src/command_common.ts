export async function _preCommand(state: any, stable: any) {
  if (!state) {
    return;
  }
  if (state.selectors) {
    _validateSelectors(state.selectors);
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
  state.info = {};
  if (state.value) {
    state.value = stable._fixUsingParams(state.value, state._params);
    state.info.value = state.value;
  }
  state.startTime = Date.now();
  state.info.selectors = state.selectors;
  state.info.log = state.log ? state.log : "";
  state.info.operation = state.operation;
  state.error = null;
  state.screenshotId = null;
  state.screenshotPath = null;
  if (state.locate === true) {
    state.element = await stable._locate(state.selectors, state.info, state._params);
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
}
export async function _commandError(state: any, error: any, stable: any) {
  stable.logger.error(state.text + " failed " + state.info.log);
  const { screenshotId, screenshotPath } = await stable._screenShot(state.options, state.world, state.info);
  state.screenshotId = screenshotId;
  state.screenshotPath = screenshotPath;
  state.info.screenshotPath = screenshotPath;
  Object.assign(error, { info: state.info });
  state.error = error;
  throw error;
}
export async function _screenshot(state: any, stable: any) {
  const { screenshotId, screenshotPath } = await stable._screenShot(state.options, state.world, state.info);
  state.screenshotId = screenshotId;
  state.screenshotPath = screenshotPath;
}
export function _commandFinally(state: any, stable: any) {
  state.endTime = Date.now();
  stable._reportToWorld(state.world, {
    element_name: state.selectors.element_name,
    type: state.type,
    text: state.text,
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
  });
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
