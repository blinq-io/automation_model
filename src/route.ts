import { APIResponse, Route as PWRoute } from "playwright";
import fs from "fs/promises";
import path from "path";
import objectPath from "object-path";

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
  }[];
}

interface RouteContextState {
  matched: InterceptedRoute[];
}

let loadedRoutes: Route[] | null = null;

async function loadRoutes(): Promise<Route[]> {
  if (loadedRoutes !== null) return loadedRoutes;

  try {
    const dir = path.join(process.cwd(), "data", "routes");
    if (!(await folderExists(dir))) {
      loadedRoutes = [];
      return loadedRoutes;
    }
    const files = await fs.readdir(dir);
    const jsonFiles = files.filter((f) => f.endsWith(".json"));

    const allRoutes: Route[] = [];
    for (const file of jsonFiles) {
      const content = await fs.readFile(path.join(dir, file), "utf-8");
      const routeObj: Route = JSON.parse(content);
      allRoutes.push(routeObj);
    }

    loadedRoutes = allRoutes;
  } catch (error) {
    console.error("Error loading routes:", error);
    loadedRoutes = [];
  }
  return loadedRoutes;
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
export async function registerBeforeStepRoutes(context: any, stepName: string) {
  const page = context.web.page;
  if (!page) throw new Error("context.web.page is missing");

  const stepTemplate = _stepNameToTemplate(stepName);
  const routes = await loadRoutes();
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
      tracking.timer = setTimeout(() => {
        if (!tracking.completed) {
          console.error(`[MANDATORY] Request to ${item.filters.path} did not complete within ${item.timeout}ms`);
        }
      }, item.timeout);

      context.__routeState.matched.push(tracking);
    }
  }

  page.route("**/*", async (route: any) => {
    const request = route.request();
    // print the url if debug is enabled
    if (debug) {
      console.log(`Intercepting request: ${request.method()} ${request.url()}`);
    }
    const matchedItem = allRouteItems.find((item) => matchRoute(item, route));
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
    let body = await response.text();
    let headers = response.headers();

    let json: any;
    try {
      json = JSON.parse(body);
    } catch (_) {}

    const actionResults: InterceptedRoute["actionResults"] = [];

    for (const action of matchedItem.actions) {
      let actionStatus: "success" | "fail" = "success";
      const description = JSON.stringify(action.config);

      switch (action.type) {
        case "abort_request":
          if (tracking?.timer) clearTimeout(tracking.timer);
          const errorCode = action.config?.errorCode ?? "failed";
          console.log(`[abort_request] Aborting  with error code: ${errorCode}`);
          await route.abort(errorCode);
          tracking.completed = true;
          actionResults.push({
            type: action.type,
            description: JSON.stringify(action.config),
            status: "success",
          });
          return;

        case "status_code_verification":
          if (status !== action.config) {
            console.error(`[status_code_verification] Expected ${action.config}, got ${status}`);
            actionStatus = "fail";
          } else {
            console.log(`[status_code_verification] Passed`);
          }
          break;

        case "json_modify":
          if (!json) {
            console.error(`[json_modify] Response is not JSON`);
            actionStatus = "fail";
          } else {
            for (const mod of action.config) {
              objectPath.set(json, mod.path, mod.value);
              console.log(`[json_modify] Modified path ${mod.path} to ${mod.value}`);
            }
            console.log(`[json_modify] Modified JSON`);
          }
          break;

        case "status_code_change":
          status = action.config;
          console.log(`[status_code_change] Status changed to ${status}`);
          break;
        case "change_text":
          if (!headers["content-type"]?.includes("text/html")) {
            console.error(`[change_text] Content-Type is not text/html`);
            actionStatus = "fail";
          } else {
            body = action.config;
            console.log(`[change_text] HTML body replaced`);
          }
          break;
        case "assert_json":
          if (!json) {
            console.error(`[assert_json] Response is not JSON`);
            actionStatus = "fail";
          } else {
            for (const check of action.config) {
              const actual = getValue(json, check.path);
              const expected = check.expected;
              if (JSON.stringify(actual) !== JSON.stringify(expected)) {
                console.error(`[assert_json] Path ${check.path}: expected ${expected}, got ${actual}`);
                actionStatus = "fail";
              } else {
                console.log(`[assert_json] Assertion passed for path ${check.path}`);
              }
            }
          }
          break;

        case "assert_text":
          if (typeof body !== "string") {
            console.error(`[assert_text] Body is not text`);
            actionStatus = "fail";
          } else {
            if (action.config.contains && !body.includes(action.config.contains)) {
              console.error(`[assert_text] Expected to contain: "${action.config.contains}"`);
              actionStatus = "fail";
            } else if (action.config.equals && body !== action.config.equals) {
              console.error(`[assert_text] Expected exact match`);
              actionStatus = "fail";
            } else {
              console.log(`[assert_text] Assertion passed`);
            }
          }
          break;
        default:
          console.warn(`Unknown action type: ${action.type}`);
      }

      actionResults.push({ type: action.type, description, status: actionStatus });
    }

    tracking.completed = true;
    tracking.actionResults = actionResults;
    if (tracking.timer) clearTimeout(tracking.timer);

    const responseBody = json ? JSON.stringify(json) : body;
    await route.fulfill({ status, body: responseBody, headers });
  });
}

export async function registerAfterStepRoutes(context: any) {
  const state: RouteContextState = context.__routeState;
  if (!state) return [];

  const mandatoryRoutes = state.matched.filter((tracked) => tracked.routeItem.mandatory);
  if (mandatoryRoutes.length === 0) {
    context.__routeState = null;
    return [];
  }

  const maxTimeout = Math.max(...mandatoryRoutes.map((r) => r.routeItem.timeout));
  const startTime = Date.now();

  await new Promise<void>((resolve) => {
    const interval = setInterval(() => {
      const allCompleted = mandatoryRoutes.every((r) => r.completed);
      const elapsed = Date.now() - startTime;

      if (allCompleted || elapsed >= maxTimeout) {
        mandatoryRoutes.forEach((r) => {
          if (!r.completed) {
            console.error(
              `[MANDATORY] Request to ${r.routeItem.filters.path} did not complete within ${r.routeItem.timeout}ms`
            );
          }
        });
        clearInterval(interval);
        resolve();
      }
    }, 100);
  });

  const results = mandatoryRoutes.map((tracked) => {
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
  context.routeResults = results;
  return results;
}

// Helper functions

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

function _stepNameToTemplate(stepName: string): string {
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
