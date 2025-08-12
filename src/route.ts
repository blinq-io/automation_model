import { APIResponse, Route as PWRoute } from "playwright";
import fs from "fs/promises";
import path from "path";
import objectPath from "object-path";
import { tmpdir } from "os";
import createDebug from "debug";
import { existsSync } from "fs";
const debug = createDebug("automation_model:route");
// const debug = console.debug;

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

type FulfillOptions = Parameters<PWRoute["fulfill"]>[0];

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
    debug(`Loaded ${allRoutes.length} route definitions from ${dir}`);
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

  page.route("**/*", async (route: PWRoute) => {
    const request = route.request();
    debug(`Intercepting request: ${request.method()} ${request.url()}`);
    const matchedItem = allRouteItems.find((item) => matchRoute(item, route));
    if (!matchedItem) return route.continue();
    debug(`Matched route item: ${JSON.stringify(matchedItem)}`);
    let tracking = context.__routeState.matched.find(
      (t: InterceptedRoute) => t.routeItem === matchedItem && !t.completed
    );

    let stubActionPerformed = false;

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

    const stubAction = matchedItem.actions.find((a) => a.type === "stub_request");
    if (stubAction) {
      let actionStatus: "success" | "fail" = "success";
      const description = JSON.stringify(stubAction.config);
      debug(`Stub action found for ${request.url()}. Skipping fetch.`);
      if (tracking.timer) clearTimeout(tracking.timer);
      const fullFillConfig: FulfillOptions = {};

      if (stubAction.config.path) {
        const filePath = path.join(process.cwd(), "data", "routes", "fixtures", stubAction.config.path);
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

      let status = response.status();
      let headers = response.headers();
      const isBinary =
        !headers["content-type"]?.includes("application/json") &&
        !headers["content-type"]?.includes("text") &&
        !headers["content-type"]?.includes("application/csv");

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
      let finalBody = body;

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
              actionStatus = "fail";
              tracking.actionResults = actionResults;
              message = "JSON modification failed. Response is not JSON";
            } else {
              if (action.config && action.config.path && action.config.modifyValue) {
                objectPath.set(json, action.config.path, action.config.modifyValue);
                console.log(`[json_modify] Modified path ${action.config.path} to ${action.config.modifyValue}`);
                console.log(`[json_modify] Modified JSON`);
                message = `JSON modified successfully`;
                finalBody = json;
              }
            }
            break;

          case "json_whole_modify":
            if (!json) {
              actionStatus = "fail";
              tracking.actionResults = actionResults;
              message = "JSON modification failed. Response is not JSON";
            } else {
              try {
                const parsedConfig = JSON.parse(action.config);
                json = parsedConfig;
                finalBody = json;
              } catch (e: unknown) {
                actionStatus = "fail";
                tracking.actionResults = actionResults;
                message = `JSON modification failed. Invalid JSON: ${e instanceof Error ? e.message : String(e)}`;
                console.error(`[json_whole_modify] Invalid JSON:`, e);
                break;
              }
              console.log(`[json_whole_modify] Whole JSON replaced`);
              message = `JSON replaced successfully`;
            }
            break;
          case "status_code_change":
            status = Number(action.config);
            console.log(`[status_code_change] Status changed to ${status}`);
            message = `Status code changed to ${status}`;
            break;

          case "change_text":
            if (isBinary) {
              actionStatus = "fail";
              tracking.actionResults = actionResults;
              message = "Change text action failed. Body is not a text";
            } else {
              body = action.config;
              console.log(`[change_text] HTML body replaced`);
              message = `HTML body replaced successfully`;
              finalBody = body;
            }
            break;
          case "assert_json":
            if (!json) {
              actionStatus = "fail";
              tracking.actionResults = actionResults;
              message = "JSON assertion failed. Response is not JSON";
            } else {
              const actual = objectPath.get(json, action.config.path);
              if (typeof actual !== "object") {
                if (JSON.stringify(actual) !== JSON.stringify(action.config.expectedValue)) {
                  actionStatus = "fail";
                  tracking.actionResults = actionResults;
                  message = `JSON assertion failed for path ${action.config.path}: expected ${JSON.stringify(action.config.expectedValue)}, got ${JSON.stringify(actual)}`;
                }
              } else if (JSON.stringify(actual) !== action.config.expectedValue) {
                actionStatus = "fail";
                tracking.actionResults = actionResults;
                message = `JSON assertion failed for path ${action.config.path}: expected ${action.config.expectedValue}, got ${JSON.stringify(actual)}`;
              } else {
                console.log(`[assert_json] Assertion passed for path ${action.config.path}`);
                message = `JSON assertion passed for path ${action.config.path}`;
              }
            }
            break;

          case "assert_whole_json":
            if (!json) {
              actionStatus = "fail";
              tracking.actionResults = actionResults;
              message = "Whole JSON assertion failed. Response is not JSON";
            } else {
              if (action.config.contains) {
                const originalJSON = JSON.stringify(json, null, 2);
                if (!originalJSON.includes(action.config.contains)) {
                  actionStatus = "fail";
                  tracking.actionResults = actionResults;
                  message = `Whole JSON assertion failed. Expected to contain: "${action.config.contains}", actual: "${body}"`;
                }
              } else if (action.config.equals) {
                const originalJSON = JSON.stringify(json, null, 2);
                if (originalJSON !== action.config.equals) {
                  actionStatus = "fail";
                  tracking.actionResults = actionResults;
                  message = `Whole JSON assertion failed. Expected exact match: "${action.config.equals}", actual: "${body}"`;
                }
              } else {
                console.log(`[assert_whole_json] Assertion passed`);
                message = `Whole JSON assertion passed.`;
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

      if (!abortActionPerformed) {
        await route.fulfill({ status, body: finalBody, headers });
      }
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
        message: ar.message || null,
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
