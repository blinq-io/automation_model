type ErrorClassification = {
  errorType: string;
  errorMessage: string;
};

function classifyPlaywrightError(error: Error): ErrorClassification {
  const errorMessage = error.message.toLowerCase();

  // Timeout Errors
  if (error.name === "TimeoutError" || errorMessage.includes("timeout")) {
    return {
      errorType: "TimeoutError",
      errorMessage: error.message,
    };
  }

  // Network Errors
  if (
    errorMessage.includes("connect econnrefused") ||
    errorMessage.includes("net::") ||
    errorMessage.includes("network") ||
    errorMessage.includes("connection refused") ||
    errorMessage.includes("failed to fetch")
  ) {
    return {
      errorType: "NetworkError",
      errorMessage: error.message,
    };
  }

  // Selector Errors
  if (
    errorMessage.includes("no element matches selector") ||
    errorMessage.includes("no node found for selector") ||
    errorMessage.includes("resolved to") ||
    errorMessage.includes("element not found")
  ) {
    return {
      errorType: "SelectorError",
      errorMessage: error.message,
    };
  }

  // Frame Errors
  if (
    errorMessage.includes("frame was detached") ||
    errorMessage.includes("frame not found") ||
    errorMessage.includes("execution context was destroyed")
  ) {
    return {
      errorType: "FrameError",
      errorMessage: error.message,
    };
  }

  // Element State Errors
  if (
    errorMessage.includes("element is not clickable") ||
    errorMessage.includes("element is outside of viewport") ||
    errorMessage.includes("element is not visible") ||
    errorMessage.includes("element is disabled")
  ) {
    return {
      errorType: "ElementStateError",
      errorMessage: error.message,
    };
  }

  // Browser Context Errors
  if (
    errorMessage.includes("target closed") ||
    errorMessage.includes("browser has been closed") ||
    errorMessage.includes("connection closed")
  ) {
    return {
      errorType: "BrowserContextError",
      errorMessage: error.message,
    };
  }

  // Screenshot Errors
  if (
    errorMessage.includes("failed to save screenshot") ||
    errorMessage.includes("screenshot") ||
    (errorMessage.includes("enoent") && errorMessage.includes("screenshots"))
  ) {
    return {
      errorType: "ScreenshotError",
      errorMessage: error.message,
    };
  }

  // Type Errors
  if (
    errorMessage.includes("cannot type") ||
    errorMessage.includes("element is not an <input>") ||
    errorMessage.includes("element is not focusable")
  ) {
    return {
      errorType: "TypeError",
      errorMessage: error.message,
    };
  }

  // Evaluation Errors
  if (
    errorMessage.includes("evaluation failed") ||
    errorMessage.includes("execution context was destroyed") ||
    errorMessage.includes("cannot execute in detached frame")
  ) {
    return {
      errorType: "EvaluationError",
      errorMessage: error.message,
    };
  }

  // Assertion Errors
  if (error.name === "AssertionError" || errorMessage.includes("expect(") || errorMessage.includes("assertion")) {
    return {
      errorType: "AssertionError",
      errorMessage: error.message,
    };
  }

  // Default case for unrecognized errors
  return {
    errorType: "UnknownError",
    errorMessage: error.message,
  };
}
function classifyJSError(error: Error): ErrorClassification {
  const errorMessage = error.message.toLowerCase();

  // Syntax Errors
  if (error.name === "SyntaxError" || errorMessage.includes("syntax error")) {
    return {
      errorType: "SyntaxError",
      errorMessage: error.message,
    };
  }

  // Reference Errors
  if (error.name === "ReferenceError" || errorMessage.includes("reference error")) {
    return {
      errorType: "ReferenceError",
      errorMessage: error.message,
    };
  }

  // Type Errors
  if (error.name === "TypeError" || errorMessage.includes("type error")) {
    return {
      errorType: "TypeError",
      errorMessage: error.message,
    };
  }

  // Range Errors
  if (error.name === "RangeError" || errorMessage.includes("range error")) {
    return {
      errorType: "RangeError",
      errorMessage: error.message,
    };
  }

  // Default case for unrecognized errors
  return {
    errorType: "UnknownError",
    errorMessage: error.message,
  };
}
const classifyErrorFromInfo = (error: Error, info: any): ErrorClassification => {
  const failCause = info?.failCause;
  if (!failCause) {
    return {
      errorType: "UnknownError",
      errorMessage: error.message,
    };
  }
  if (failCause.enabled === false) {
    return {
      errorType: "ElementDisabled",
      errorMessage: failCause.lastError,
    };
  }
  if (failCause.visible === false) {
    return {
      errorType: "ElementNotVisible",
      errorMessage: failCause.lastError,
    };
  }
  if (failCause.textNotFound) {
    return {
      errorType: "TextNotFoundError",
      errorMessage: failCause.lastError,
    };
  }
  if (failCause.iframeNotFound) {
    return {
      errorType: "IframeNotFoundError",
      errorMessage: failCause.lastError,
    };
  }
  if (failCause.locatorNotFound) {
    return {
      errorType: "ElementNotFoundError",
      errorMessage: failCause.lastError,
    };
  }
  if (failCause.foundMultiple) {
    return {
      errorType: "MultipleElementsFoundError",
      errorMessage: failCause.lastError ?? `Found ${failCause.count} elements`,
    };
  }
  if (failCause.assertionFailed) {
    return {
      errorType: "AssertionError",
      errorMessage: failCause.lastError,
    };
  }
  return {
    errorType: "UnknownError",
    errorMessage: error.message,
  };
};
const getHumanReadableErrorMessage = (error: Error, info: any): ErrorClassification => {
  // @ts-ignore
  if (error.errors && error.errors.length > 0) {
    // @ts-ignore
    return getHumanReadableErrorMessage(error.errors[0], info);
  }
  let errorClassification = classifyErrorFromInfo(error, info);
  if (errorClassification.errorType === "UnknownError") {
    errorClassification = classifyPlaywrightError(error);
  }
  if (errorClassification.errorType === "UnknownError") {
    errorClassification = classifyJSError(error);
  }
  return errorClassification;
};
export { getHumanReadableErrorMessage };
