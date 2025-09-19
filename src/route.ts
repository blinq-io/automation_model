import { APIResponse, Route as PWRoute } from "playwright";
import fs from "fs/promises";
import path from "path";
import objectPath from "object-path";
import { tmpdir } from "os";
import createDebug from "debug";
import { existsSync, writeFile } from "fs";
import { replaceWithLocalTestData } from "./utils.js";
const debug = createDebug("automation_model:route");

export interface Route {
  template: string;
  routes: RouteItem[];
}

export interface RouteItem {
  filters: {
    path: string;
    queryParams: Record<string, string> | null;
    method: string | null;
  };
  actions: Action[];
  mandatory: boolean;
  timeout: number;
}

interface StubAction {
  type: "stub_request";
  config: {
    path?: string;
    statusCode?: number;
    contentType?: string;
    body?: string;
  };
}

interface JSONModifyAction {
  type: "json_modify";
  config: {
    path: string;
    modifyValue: any;
  };
}

interface JSONWholeModifyAction {
  type: "json_whole_modify";
  config: any;
}

interface TextModifyAction {
  type: "change_text";
  config: string;
}

interface JSONVerifyAction {
  type: "assert_json";
  config: {
    path: string;
    expectedValue: any;
  };
}

interface JSONWholeVerifyAction {
  type: "assert_whole_json";
  config: { contains: string } | { equals: string };
}
interface TextVerifyAction {
  type: "assert_text";
  config: { contains: string } | { equals: string };
}

interface StatusCodeModifyAction {
  type: "status_code_change";
  config: number;
}

interface StatusCodeVerifyAction {
  type: "status_code_verification";
  config: number;
}

interface AbortAction {
  type: "abort_request";
  config: {
    errorCode: string;
  };
}

export type Action =
  | AbortAction
  | StatusCodeVerifyAction
  | StatusCodeModifyAction
  | TextVerifyAction
  | TextModifyAction
  | JSONModifyAction
  | JSONWholeModifyAction
  | JSONVerifyAction
  | JSONWholeVerifyAction
  | StubAction;

interface InterceptedRoute {
  routeItem: RouteItem;
  url: string;
  completed: boolean;
  timer?: NodeJS.Timeout;
  startedAt: number;
  actionResults?: {
    type: string;
    description: string;
    status: "success" | "fail";
    message: string | null;
  }[];
}

interface RouteContextState {
  matched: InterceptedRoute[];
}

type FulfillOptions = Parameters<PWRoute["fulfill"]>[0];

type ActionResult = NonNullable<InterceptedRoute["actionResults"]>[0];
interface ActionHandlerContext {
  route: PWRoute;
  tracking: InterceptedRoute;
  status: number;
  body: string | Buffer;
  json?: any;
  isBinary: boolean;
  finalBody: any;
  abortActionPerformed: boolean;
}

async function loadRoutes(
  context: { loadedRoutes?: Map<string, Route[]> | null; web?: any },
  template: string
): Promise<Route[]> {
  if (context.loadedRoutes instanceof Map && context.loadedRoutes.has(template)) {
    return context.loadedRoutes.get(template) || [];
  }

  try {
    let dir = path.join(process.cwd(), "data", "routes");
    if (process.env.TEMP_RUN === "true") {
      dir = path.join(tmpdir(), "blinq_temp_routes");
    }

    if (!(await folderExists(dir))) {
      context.loadedRoutes = new Map();
      context.loadedRoutes.set(template, []);
      return context.loadedRoutes.get(template) || [];
    }

    const files = await fs.readdir(dir);
    const jsonFiles = files.filter((f) => f.endsWith(".json"));

    const allRoutes = new Map<string, Route[]>();
    for (const file of jsonFiles) {
      let content = await fs.readFile(path.join(dir, file), "utf-8");
      try {
        const routeObj: Route = JSON.parse(content);
        const template = routeObj.template;
        if (!allRoutes.has(template)) {
          allRoutes.set(template, []);
        }
        allRoutes.get(template)?.push(routeObj);
      } catch (error) {
        debug("Error parsing route file:", error);
        continue;
      }
    }

    context.loadedRoutes = allRoutes;
    debug(`Loaded ${allRoutes.size} route definitions from ${dir}`);
  } catch (error) {
    console.error("Error loading routes:", error);
    context.loadedRoutes = new Map();
  }

  return context.loadedRoutes.get(template) || [];
}

export function pathFilter(savedPath: string, actualPath: string): boolean {
  if (typeof savedPath !== "string") return false;
  if (savedPath.includes("*")) {
    // Escape regex special characters in savedPath
    const escapedPath = savedPath.replace(/[.+?^${}()|[\]\\]/g, "\\$&");
    // Treat it as a wildcard
    const regex = new RegExp(escapedPath.replace(/\*/g, ".*"));
    return regex.test(actualPath);
  } else {
    return savedPath === actualPath;
  }
}

export function queryParamsFilter(
  savedQueryParams: Record<string, string> | null,
  actualQueryParams: URLSearchParams
): boolean {
  if (!savedQueryParams) return true;
  for (const [key, value] of Object.entries(savedQueryParams)) {
    if (value === "*") {
      // If the saved query param is a wildcard, it matches anything
      continue;
    }
    if (actualQueryParams.get(key) !== value) {
      return false;
    }
  }
  return true;
}

export function methodFilter(savedMethod: string | null, actualMethod: string): boolean {
  if (!savedMethod) return true;
  if (savedMethod === "*") {
    const httpMethodRegex = /^(GET|POST|PUT|DELETE|PATCH|OPTIONS|HEAD)$/;
    return httpMethodRegex.test(actualMethod);
  }
  return savedMethod === actualMethod;
}

function matchRoute(routeItem: RouteItem, req: PWRoute): boolean {
  const debug = createDebug("automation_model:route:matchRoute");
  const url = new URL(req.request().url());
  const queryParams = routeItem.filters.queryParams;

  const methodMatch = methodFilter(routeItem.filters.method, req.request().method());
  const pathMatch = pathFilter(routeItem.filters.path, url.pathname);
  debug("Path match", pathMatch, routeItem.filters.path, url.pathname);
  const queryParamsMatch = queryParamsFilter(queryParams, url.searchParams);

  return methodMatch && pathMatch && queryParamsMatch;
}

function handleAbortRequest(action: AbortAction, context: ActionHandlerContext): ActionResult {
  if (context.tracking.timer) clearTimeout(context.tracking.timer);
  const errorCode = action.config?.errorCode ?? "failed";
  console.log(`[abort_request] Aborting with error code: ${errorCode}`);
  context.route.abort(errorCode);
  context.abortActionPerformed = true;
  context.tracking.completed = true;

  return {
    type: action.type,
    description: JSON.stringify(action.config),
    status: "success",
    message: `Request aborted with code: ${errorCode}`,
  };
}

function handleStatusCodeVerification(action: StatusCodeVerifyAction, context: ActionHandlerContext): ActionResult {
  const isSuccess = String(context.status) === String(action.config);
  return {
    type: action.type,
    description: JSON.stringify(action.config),
    status: isSuccess ? "success" : "fail",
    message: `Status code verification ${isSuccess ? "passed" : "failed"}. Expected ${action.config}, got ${context.status}`,
  };
}

function handleJsonModify(action: JSONModifyAction, context: ActionHandlerContext): ActionResult {
  if (!context.json) {
    return {
      type: action.type,
      description: JSON.stringify(action.config),
      status: "fail",
      message: "JSON modification failed. Response is not JSON",
    };
  }

  objectPath.set(context.json, action.config.path, action.config.modifyValue);
  context.finalBody = JSON.parse(JSON.stringify(context.json));

  return {
    type: action.type,
    description: JSON.stringify(action.config),
    status: "success",
    message: `JSON modified at path '${action.config.path}'`,
  };
}

function handleJsonWholeModify(action: JSONWholeModifyAction, context: ActionHandlerContext): ActionResult {
  if (!context.json) {
    return {
      type: action.type,
      description: JSON.stringify(action.config),
      status: "fail",
      message: "JSON modification failed. Response is not JSON",
    };
  }

  try {
    const parsedConfig = typeof action.config === "string" ? JSON.parse(action.config) : action.config;
    context.json = parsedConfig;
    context.finalBody = JSON.parse(JSON.stringify(context.json));
    return {
      type: action.type,
      description: JSON.stringify(action.config),
      status: "success",
      message: "Whole JSON body was replaced.",
    };
  } catch (e: unknown) {
    const message = `JSON modification failed. Invalid JSON in config: ${e instanceof Error ? e.message : String(e)}`;
    return { type: action.type, description: JSON.stringify(action.config), status: "fail", message };
  }
}

function handleStatusCodeChange(action: StatusCodeModifyAction, context: ActionHandlerContext): ActionResult {
  context.status = Number(action.config);
  return {
    type: action.type,
    description: JSON.stringify(action.config),
    status: "success",
    message: `Status code changed to ${context.status}`,
  };
}

function handleChangeText(action: TextModifyAction, context: ActionHandlerContext): ActionResult {
  if (context.isBinary) {
    return {
      type: action.type,
      description: JSON.stringify(action.config),
      status: "fail",
      message: "Change text action failed. Body is not text.",
    };
  }

  context.body = action.config;
  context.finalBody = context.body;

  return {
    type: action.type,
    description: JSON.stringify(action.config),
    status: "success",
    message: "Response body text was replaced.",
  };
}

function handleAssertJson(action: JSONVerifyAction, context: ActionHandlerContext): ActionResult {
  if (!context.json) {
    return {
      type: action.type,
      description: JSON.stringify(action.config),
      status: "fail",
      message: "JSON assertion failed. Response is not JSON.",
    };
  }

  const actual = objectPath.get(context.json, action.config.path);
  const expected = action.config.expectedValue;
  const isSuccess = JSON.stringify(actual) === JSON.stringify(expected);

  return {
    type: action.type,
    description: JSON.stringify(action.config),
    status: isSuccess ? "success" : "fail",
    message: isSuccess
      ? `JSON assertion passed for path '${action.config.path}'.`
      : `JSON assertion failed for path '${action.config.path}': expected ${JSON.stringify(expected)}, got ${JSON.stringify(actual)}`,
  };
}

function handleAssertWholeJson(action: JSONWholeVerifyAction, context: ActionHandlerContext): ActionResult {
  if (!context.json) {
    return {
      type: action.type,
      description: JSON.stringify(action.config),
      status: "fail",
      message: "Whole JSON assertion failed. Response is not JSON.",
    };
  }

  const originalJSON = JSON.stringify(context.json, null, 2);
  let isSuccess = false;
  let message = "";

  if ("contains" in action.config) {
    isSuccess = originalJSON.includes(action.config.contains);
    message = isSuccess
      ? "Whole JSON assertion passed."
      : `Whole JSON assertion failed. Expected to contain: "${action.config.contains}".`;
  } else {
    isSuccess = originalJSON === action.config.equals;
    message = isSuccess
      ? "Whole JSON assertion passed."
      : `Whole JSON assertion failed. Expected exact match: "${action.config.equals}".`;
  }

  return {
    type: action.type,
    description: JSON.stringify(action.config),
    status: isSuccess ? "success" : "fail",
    message,
  };
}

function handleAssertText(action: TextVerifyAction, context: ActionHandlerContext): ActionResult {
  if (typeof context.body !== "string") {
    return {
      type: action.type,
      description: JSON.stringify(action.config),
      status: "fail",
      message: "Text assertion failed. Body is not text.",
    };
  }

  let isSuccess = false;
  let message = "";

  if ("contains" in action.config) {
    isSuccess = context.body.includes(action.config.contains);
    message = isSuccess
      ? "Text assertion passed."
      : `Text assertion failed. Expected to contain: "${action.config.contains}".`;
  } else {
    isSuccess = context.body === action.config.equals;
    message = isSuccess
      ? "Text assertion passed."
      : `Text assertion failed. Expected exact match: "${action.config.equals}".`;
  }

  return {
    type: action.type,
    description: JSON.stringify(action.config),
    status: isSuccess ? "success" : "fail",
    message,
  };
}

function handleStubAction(stubAction: StubAction, route: PWRoute, tracking: InterceptedRoute): boolean {
  let actionStatus: "success" | "fail" = "success";
  const description = JSON.stringify(stubAction.config);
  const request = route.request();
  let stubActionPerformed = false;
  debug(`Stub action found for ${request.url()}. Skipping fetch.`);
  if (tracking.timer) clearTimeout(tracking.timer);
  const fullFillConfig: FulfillOptions = {};
  if (!tracking.actionResults) tracking.actionResults = [];

  if (stubAction.config.path) {
    const filePath = path.join(process.cwd(), "data", "fixtures", stubAction.config.path);
    debug(`Stub action file path: ${filePath}`);
    if (existsSync(filePath)) {
      fullFillConfig.path = filePath;
      debug(`Stub action fulfilled with file: ${filePath}`);
    } else {
      actionStatus = "fail";
      tracking.actionResults.push({
        type: "stub_request",
        description,
        status: actionStatus,
        message: `Stub action failed for ${tracking.url}: File not found at ${filePath}`,
      });
      stubActionPerformed = true;
    }
  }

  if (!fullFillConfig.path) {
    if (stubAction.config.statusCode) {
      fullFillConfig.status = Number(stubAction.config.statusCode);
    }
    if (stubAction.config.contentType) {
      if (stubAction.config.contentType === "application/json") {
        fullFillConfig.contentType = "application/json";
        if (stubAction.config.body) {
          try {
            fullFillConfig.json = JSON.parse(stubAction.config.body);
          } catch (e) {
            debug(
              `Invalid JSON in stub action body: ${stubAction.config.body}, `,
              e instanceof Error ? e.message : String(e)
            );
            debug("Invalid JSON, defaulting to empty object");
            fullFillConfig.json = {};
          }
        }
      } else {
        fullFillConfig.contentType = stubAction.config.contentType;
        fullFillConfig.body = stubAction.config.body || "";
      }
    }
    if (!fullFillConfig.json && !fullFillConfig.body) {
      if (stubAction.config.body) {
        fullFillConfig.body = stubAction.config.body;
      }
    }
  }
  if (actionStatus === "success") {
    try {
      route.fulfill(fullFillConfig);
      stubActionPerformed = true;
      tracking.completed = true;
      tracking.actionResults.push({
        type: "stub_request",
        description,
        status: actionStatus,
        message: `Stub action executed for ${request.url()}`,
      });
    } catch (e) {
      actionStatus = "fail";
      debug(`Failed to fulfill stub request for ${request.url()}`, e);
      tracking.actionResults.push({
        type: "stub_request",
        description,
        status: actionStatus,
        message: `Stub action failed for ${request.url()}: ${e instanceof Error ? e.message : String(e)}`,
      });
    }
  }
  return stubActionPerformed;
}

export async function registerBeforeStepRoutes(context: any, stepName: string, world: any) {
  const debug = createDebug("automation_model:route:registerBeforeStepRoutes");
  const page = context.web.page;
  if (!page) throw new Error("context.web.page is missing");

  const stepTemplate = _stepNameToTemplate(stepName);
  debug("stepTemplate", stepTemplate);
  const routes = await loadRoutes(context, stepTemplate);
  debug("Routes", routes);
  const allRouteItems: RouteItem[] = routes.flatMap((r) => r.routes);
  debug("All route items", allRouteItems);

  if (!context.__routeState) {
    context.__routeState = { matched: [] } as RouteContextState;
  }

  for (let i = 0; i < allRouteItems.length; i++) {
    let item = allRouteItems[i];
    debug(`Setting up mandatory route with timeout ${item.timeout}ms: ${JSON.stringify(item.filters)}`);
    let content = JSON.stringify(item);
    try {
      content = await replaceWithLocalTestData(content, context.web.world, true, false, content, context.web, false);
      allRouteItems[i] = JSON.parse(content); // Modify the original array
      item = allRouteItems[i];
      debug(`After replacing test data: ${JSON.stringify(allRouteItems[i])}`);
    } catch (error) {
      debug("Error replacing test data:", error);
    }
    if (item.mandatory) {
      const path = item.filters.path;
      const queryParams = Object.entries(item.filters.queryParams || {})
        .map(([key, value]) => `${key}=${value}`)
        .join("&");

      const tracking: InterceptedRoute = {
        routeItem: item,
        url: `${path}${queryParams ? `?${queryParams}` : ""}`,
        completed: false,
        startedAt: Date.now(),
        actionResults: [],
      };
      context.__routeState.matched.push(tracking);
    }
  }

  debug("New allrouteItems", JSON.stringify(allRouteItems));

  let message: string | null = null;

  try {
    page.route("**/*", async (route: PWRoute) => {
      const debug = createDebug("automation_model:route:intercept");
      const request = route.request();
      debug(`Intercepting request: ${request.method()} ${request.url()}`);
      debug("All route items", allRouteItems);
      const matchedItem = allRouteItems.find((item) => matchRoute(item, route));
      if (!matchedItem) return route.continue();
      debug(`Matched route item: ${JSON.stringify(matchedItem)}`);
      debug("Initial context route state", JSON.stringify(context.__routeState, null, 2));
      let tracking = context.__routeState.matched.find(
        (t: InterceptedRoute) => JSON.stringify(t.routeItem) === JSON.stringify(matchedItem) && !t.completed
      );

      debug("Tracking", tracking);

      let stubActionPerformed = false;

      if (!tracking) {
        debug("Tracking not found, creating tracking");
        tracking = {
          routeItem: matchedItem,
          url: request.url(),
          completed: false,
          startedAt: Date.now(),
          actionResults: [],
        };
        debug("Created tracking", tracking);
        context.__routeState.matched.push(tracking);
        debug("Current route state", context.__routeState);
      } else {
        tracking.url = request.url();
        debug("Updating tracking", tracking);
      }

      const stubAction = matchedItem.actions.find((a) => a.type === "stub_request");
      if (stubAction) {
        stubActionPerformed = handleStubAction(stubAction, route, tracking);
      }
      if (!stubActionPerformed) {
        let response: APIResponse;
        try {
          response = await route.fetch();
        } catch (e) {
          console.error("Fetch failed for", request.url(), e);
          if (tracking?.timer) clearTimeout(tracking.timer);
          return route.abort();
        }

        const headers = response.headers();
        const isBinary =
          !headers["content-type"]?.includes("application/json") && !headers["content-type"]?.includes("text");
        const body = isBinary ? await response.body() : await response.text();
        let json: any;
        try {
          if (typeof body === "string") json = JSON.parse(body);
        } catch (_) {}

        const actionHandlerContext: ActionHandlerContext = {
          route,
          tracking,
          status: response.status(),
          body,
          json,
          isBinary,
          finalBody: json ?? body,
          abortActionPerformed: false,
        };

        const actionResults: ActionResult[] = [];

        for (const action of matchedItem.actions) {
          let result: ActionResult | undefined;
          switch (action.type) {
            case "abort_request":
              result = handleAbortRequest(action, actionHandlerContext);
              break;
            case "status_code_verification":
              result = handleStatusCodeVerification(action, actionHandlerContext);
              break;
            case "json_modify":
              result = handleJsonModify(action, actionHandlerContext);
              break;
            case "json_whole_modify":
              result = handleJsonWholeModify(action, actionHandlerContext);
              break;
            case "status_code_change":
              result = handleStatusCodeChange(action, actionHandlerContext);
              break;
            case "change_text":
              result = handleChangeText(action, actionHandlerContext);
              break;
            case "assert_json":
              result = handleAssertJson(action, actionHandlerContext);
              break;
            case "assert_whole_json":
              result = handleAssertWholeJson(action, actionHandlerContext);
              break;
            case "assert_text":
              result = handleAssertText(action, actionHandlerContext);
              break;
            default:
              console.warn(`Unknown action type`);
          }
          if (result) actionResults.push(result);
        }

        tracking.completed = true;
        tracking.actionResults = actionResults;
        if (tracking.timer) clearTimeout(tracking.timer);

        if (!actionHandlerContext.abortActionPerformed) {
          try {
            const isJSON = headers["content-type"]?.includes("application/json");
            if (isJSON) {
              await route.fulfill({
                status: actionHandlerContext.status,
                json: actionHandlerContext.finalBody,
                headers,
              });
            } else {
              await route.fulfill({
                status: actionHandlerContext.status,
                body: actionHandlerContext.finalBody as string | Buffer,
                headers,
              });
            }
          } catch (e) {
            console.error("Failed to fulfill route:", e);
          }
        }
      }
    });
  } catch (error) {
    console.log(JSON.stringify(error));
  }
}

export async function registerAfterStepRoutes(context: any, world: any) {
  const state: RouteContextState = context.__routeState;
  debug("state in afterStepRoutes", JSON.stringify(state));
  if (!state) return [];

  const mandatoryRoutes = state.matched.filter((tracked) => tracked.routeItem.mandatory);
  debug("mandatoryRoutes in afterStepRoutes", mandatoryRoutes);
  if (mandatoryRoutes.length === 0) {
    context.__routeState = null;
    return [];
  }

  const maxTimeout = Math.max(...mandatoryRoutes.map((r) => r.routeItem.timeout));
  const startTime = Date.now();

  const mandatoryRouteReached = mandatoryRoutes.map((r) => true);
  debug("mandatoryRouteReached initialized to", mandatoryRouteReached);

  await new Promise<void>((resolve) => {
    const interval = setInterval(() => {
      const now = Date.now();

      const allCompleted = mandatoryRoutes.every((r) => r.completed);
      debug("allCompleted in afterStepRoutes", allCompleted);
      const allTimedOut = mandatoryRoutes.every((r) => r.completed || now - startTime >= r.routeItem.timeout);
      debug("allTimedOut in afterStepRoutes", allTimedOut);

      for (const r of mandatoryRoutes) {
        const elapsed = now - startTime;
        // debug(`Elapsed time for route ${r.url}: ${elapsed}ms`);
        if (!r.completed && elapsed >= r.routeItem.timeout) {
          mandatoryRouteReached[mandatoryRoutes.indexOf(r)] = false;
          debug(`Route ${r.url} timed out after ${elapsed}ms`);
        }
      }

      if (allCompleted || allTimedOut) {
        debug("allCompleted", allCompleted, "allTimedOut", allTimedOut);
        clearInterval(interval);
        resolve();
      }
    }, 100);
  });

  context.results = mandatoryRoutes.map((tracked) => {
    const { routeItem, url, completed, actionResults = [] } = tracked;
    debug("tracked in afterStepRoutes", {
      url,
      completed,
      actionResults,
    });

    const actions = actionResults.map((ar) => {
      let status: "success" | "fail" | "timeout" = ar.status;
      if (!completed) status = "timeout";
      return {
        type: ar.type,
        description: ar.description,
        status,
        message: ar.message || null,
      };
    });

    debug("actions in afterStepRoutes", actions);

    let overallStatus: "success" | "fail" | "timeout";
    if (!completed) {
      overallStatus = "timeout";
    } else if (actions.some((a) => a.status === "fail")) {
      overallStatus = "fail";
    } else {
      overallStatus = "success";
    }

    return {
      url,
      filters: routeItem.filters,
      actions,
      overallStatus,
    };
  });
  try {
    await context.web.page.unroute("**/*");
  } catch (e) {
    console.error("Failed to unroute:", e);
  }
  context.__routeState = null;
  if (context.results && context.results.length > 0) {
    if (world && world.attach) {
      await world.attach(JSON.stringify(context.results), "application/json+intercept-results");
    }
  }

  const hasFailed = context.results.some((r: any) => r.overallStatus === "fail" || r.overallStatus === "timeout");
  if (hasFailed) {
    const errorMessage = context.results
      .filter((r: any) => r.overallStatus === "fail" || r.overallStatus === "timeout")
      .map((r: any) => `Route to ${r.url} failed with status: ${r.overallStatus}`)
      .join("\n");
    throw new Error(`Route verification failed:\n${errorMessage}`);
  }

  const hasTimedOut = context.results.some((r: any) => r.overallStatus === "timeout");
  if (hasTimedOut) {
    const timeoutMessage = context.results
      .filter((r: any) => r.overallStatus === "timeout")
      .map((r: any) => `Mandatory Route to ${r.url} timed out after ${r.actions[0]?.description}`)
      .join("\n");
    throw new Error(`Mandatory Route verification timed out:\n${timeoutMessage}`);
  }

  return context.results;
}

const toCucumberExpression = (text: string) =>
  text.replaceAll("/", "\\\\/").replaceAll("(", "\\\\(").replaceAll("{", "\\\\{");

function extractQuotedText(inputString: string): string[] {
  const regex = /("[^"]*")/g;
  let matches: string[] = [];
  let match;

  const regexInside = /"\/(.*?)\/"/g;
  while ((match = regexInside.exec(inputString)) !== null) {
    matches.push(match[0]);
  }

  while ((match = regex.exec(inputString)) !== null) {
    matches.push(match[1]);
  }

  return matches;
}

export function _stepNameToTemplate(stepName: string): string {
  if (stepName.includes("{string}")) {
    return stepName;
  }
  let result = toCucumberExpression(stepName);
  const texts = extractQuotedText(result);
  texts.forEach((t) => {
    result = result.replace(t, "{string}");
  });
  return result;
}

async function folderExists(path: string): Promise<boolean> {
  try {
    const stat = await fs.stat(path);
    return stat.isDirectory();
  } catch (err) {
    return false;
  }
}
const getValue = (data: any, pattern: string): any => {
  const path = pattern.split(".");
  let lengthExists = false;
  if (path[path.length - 1] === "length") {
    path.pop();
    lengthExists = true;
  }
  const value = objectPath.get(data, pattern);
  if (lengthExists && Array.isArray(value)) {
    return value?.length;
  } else if (hasValue(value)) {
    return value;
  }

  return undefined;
};
const hasValue = (value: any) => {
  return value !== undefined;
};
