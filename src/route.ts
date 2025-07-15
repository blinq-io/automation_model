import { APIResponse, Route as PWRoute } from "playwright";
import fs from "fs/promises";
import path from "path";
import objectPath from "object-path";
import { tmpdir } from "os";
import { error } from "console";

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

export interface Action {
  type: string;
  config: any;
}

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

async function loadRoutes(context: any): Promise<Route[]> {
  if (context.loadedRoutes !== null) return context.loadedRoutes;

  try {
    let dir = path.join(process.cwd(), "data", "routes");
    if (process.env.TEMP_RUN === "true") {
      dir = path.join(tmpdir(), "blinq_temp_routes");
    }

    if (!(await folderExists(dir))) {
      context.loadedRoutes = [];
      return context.loadedRoutes;
    }
    const files = await fs.readdir(dir);
    const jsonFiles = files.filter((f) => f.endsWith(".json"));

    const allRoutes: Route[] = [];
    for (const file of jsonFiles) {
      const content = await fs.readFile(path.join(dir, file), "utf-8");
      const routeObj: Route = JSON.parse(content);
      allRoutes.push(routeObj);
    }

    context.loadedRoutes = allRoutes;
    console.log(`Loaded ${allRoutes.length} route definitions from ${dir}`);
  } catch (error) {
    console.error("Error loading routes:", error);
    context.loadedRoutes = [];
  }
  return context.loadedRoutes;
}

function matchRoute(routeItem: RouteItem, req: PWRoute): boolean {
  const url = new URL(req.request().url());

  const methodMatch = !routeItem.filters.method || routeItem.filters.method === req.request().method();
  const pathMatch = routeItem.filters.path === url.pathname;

  const queryParams = routeItem.filters.queryParams;
  const queryMatch =
    !queryParams || Object.entries(queryParams).every(([key, value]) => url.searchParams.get(key) === value);

  return methodMatch && pathMatch && queryMatch;
}
let debug = false;
export async function registerBeforeStepRoutes(context: any, stepName: string, world: any) {
  const page = context.web.page;
  if (!page) throw new Error("context.web.page is missing");

  const stepTemplate = _stepNameToTemplate(stepName);
  const routes = await loadRoutes(context);
  const matchedRouteDefs = routes.filter((r) => r.template === stepTemplate);
  const allRouteItems: RouteItem[] = matchedRouteDefs.flatMap((r) => r.routes);

  if (!context.__routeState) {
    context.__routeState = { matched: [] } as RouteContextState;
  }

  // Pre-register all mandatory routes
  for (const item of allRouteItems) {
    if (item.mandatory) {
      const tracking: InterceptedRoute = {
        routeItem: item,
        url: "",
        completed: false,
        startedAt: Date.now(),
        actionResults: [],
      };
      context.__routeState.matched.push(tracking);
    }
  }

  let message: string | null = null;

  page.route("**/*", async (route: any) => {
    const request = route.request();
    // print the url if debug is enabled
    if (debug) {
      console.log(`Intercepting request: ${request.method()} ${request.url()}`);
    }
    const matchedItem = allRouteItems.find((item) => matchRoute(item, route));
    if (debug) {
      console.log("Matched route item:", matchedItem);
    }
    if (!matchedItem) return route.continue();
    if (debug) {
      console.log(`Matched route item: ${JSON.stringify(matchedItem)}`);
    }
    // Find pre-registered tracker
    let tracking = context.__routeState.matched.find(
      (t: InterceptedRoute) => t.routeItem === matchedItem && !t.completed
    );

    // If not mandatory, register dynamically
    if (!tracking) {
      tracking = {
        routeItem: matchedItem,
        url: request.url(),
        completed: false,
        startedAt: Date.now(),
        actionResults: [],
      };
      context.__routeState.matched.push(tracking);
    } else {
      tracking.url = request.url();
    }

    let response: APIResponse;
    try {
      response = await route.fetch();
    } catch (e) {
      console.error("Fetch failed for", request.url(), e);
      if (tracking?.timer) clearTimeout(tracking.timer);
      return route.abort();
    }

    let status = response.status();
    let headers = response.headers();
    const isBinary =
      !headers["content-type"]?.includes("application/json") && !headers["content-type"]?.includes("text");

    let body;
    if (isBinary) {
      body = await response.body(); // returns a Buffer
    } else {
      body = await response.text();
    }

    let json: any;
    try {
      // check if the body is string
      if (typeof body === "string") {
        json = JSON.parse(body);
      }
    } catch (_) {}

    const actionResults: InterceptedRoute["actionResults"] = [];

    let abortActionPerformed = false;

    for (const action of matchedItem.actions) {
      let actionStatus: "success" | "fail" = "success";
      const description = JSON.stringify(action.config);

      switch (action.type) {
        case "abort_request":
          if (tracking?.timer) clearTimeout(tracking.timer);
          const errorCode = action.config?.errorCode ?? "failed";
          console.log(`[abort_request] Aborting  with error code: ${errorCode}`);
          await route.abort(errorCode);
          abortActionPerformed = true;
          tracking.completed = true;
          break;

        case "status_code_verification":
          if (String(status) !== String(action.config)) {
            actionStatus = "fail";
            tracking.actionResults = actionResults;
            message = `Status code verification failed. Expected ${action.config}, got ${status}`;
          } else {
            console.log(`[status_code_verification] Passed`);
            message = `Status code verification passed. Expected ${action.config}, got ${status}`;
          }
          break;

        case "json_modify":
          if (!json) {
            // console.error(`[json_modify] Response is not JSON`);
            actionStatus = "fail";
            tracking.actionResults = actionResults;
            message = "JSON modification failed. Response is not JSON";
          } else {
            for (const [path, modifyValue] of Object.entries(action.config)) {
              objectPath.set(json, path, modifyValue);
              console.log(`[json_modify] Modified path ${path} to ${modifyValue}`);
            }
            console.log(`[json_modify] Modified JSON`);
            message = `JSON modified successfully`;
          }
          break;

        case "status_code_change":
          status = Number(action.config);
          console.log(`[status_code_change] Status changed to ${status}`);
          message = `Status code changed to ${status}`;
          break;

        case "change_text":
          if (!headers["content-type"]?.includes("text/html")) {
            actionStatus = "fail";
            tracking.actionResults = actionResults;
            message = "Change text action failed. Content-Type is not text/html";
          } else {
            body = action.config;
            console.log(`[change_text] HTML body replaced`);
            message = `HTML body replaced successfully`;
          }
          break;
        case "assert_json":
          if (!json) {
            actionStatus = "fail";
            tracking.actionResults = actionResults;
            message = "JSON assertion failed. Response is not JSON";
          } else {
            for (const [path, expectedValue] of Object.entries(action.config)) {
              const actual = objectPath.get(json, path);
              if (JSON.stringify(actual) !== JSON.stringify(expectedValue)) {
                actionStatus = "fail";
                tracking.actionResults = actionResults;
                message = `JSON assertion failed for path ${path}: expected ${JSON.stringify(expectedValue)}, got ${JSON.stringify(actual)}`;
              } else {
                console.log(`[assert_json] Assertion passed for path ${path}`);
                message = `JSON assertion passed for path ${path}`;
              }
            }
          }
          break;

        case "assert_text":
          if (typeof body !== "string") {
            console.error(`[assert_text] Body is not text`);
            actionStatus = "fail";
            tracking.actionResults = actionResults;
            message = "Text assertion failed. Body is not text";
          } else {
            if (action.config.contains && !body.includes(action.config.contains)) {
              actionStatus = "fail";
              tracking.actionResults = actionResults;
              message = `Text assertion failed. Expected to contain: "${action.config.contains}", actual: "${body}"`;
            } else if (action.config.equals && body !== action.config.equals) {
              actionStatus = "fail";
              tracking.actionResults = actionResults;
              message = `Text assertion failed. Expected exact match: "${action.config.equals}", actual: "${body}"`;
            } else {
              console.log(`[assert_text] Assertion passed`);
              message = `Text assertion passed.`;
            }
          }
          break;
        default:
          console.warn(`Unknown action type: ${action.type}`);
      }

      actionResults.push({ type: action.type, description, status: actionStatus, message: message });
    }

    tracking.completed = true;
    tracking.actionResults = actionResults;

    if (tracking.timer) clearTimeout(tracking.timer);

    const responseBody = isBinary ? body : json ? JSON.stringify(json) : body;
    if (!abortActionPerformed) {
      await route.fulfill({ status, body: responseBody, headers });
    }
  });
}

export async function registerAfterStepRoutes(context: any, world: any) {
  const state: RouteContextState = context.__routeState;
  if (!state) return [];

  const mandatoryRoutes = state.matched.filter((tracked) => tracked.routeItem.mandatory);
  if (mandatoryRoutes.length === 0) {
    context.__routeState = null;
    return [];
  }

  const maxTimeout = Math.max(...mandatoryRoutes.map((r) => r.routeItem.timeout));
  const startTime = Date.now();

  const mandatoryRouteReached = mandatoryRoutes.map((r) => true);

  await new Promise<void>((resolve) => {
    const interval = setInterval(() => {
      const now = Date.now();

      const allCompleted = mandatoryRoutes.every((r) => r.completed);
      const allTimedOut = mandatoryRoutes.every((r) => r.completed || now - startTime >= r.routeItem.timeout);

      for (const r of mandatoryRoutes) {
        const elapsed = now - startTime;
        if (!r.completed && elapsed >= r.routeItem.timeout) {
          mandatoryRouteReached[mandatoryRoutes.indexOf(r)] = false;
          // console.error(
          //   `[MANDATORY] Request to ${r.routeItem.filters.path} did not complete within ${r.routeItem.timeout}ms (elapsed: ${elapsed})`
          // );
        }
      }

      if (allCompleted || allTimedOut) {
        clearInterval(interval);
        resolve();
      }
    }, 100);
  });

  context.results = mandatoryRoutes.map((tracked) => {
    const { routeItem, url, completed, actionResults = [] } = tracked;

    const actions = actionResults.map((ar) => {
      let status: "success" | "fail" | "timeout" = ar.status;
      if (!completed) status = "timeout";
      return {
        type: ar.type,
        description: ar.description,
        status,
      };
    });

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
