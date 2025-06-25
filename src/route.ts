import { APIResponse, Route as PWRoute } from "playwright";
import fs from "fs/promises";
import path from "path";

export interface Route {
  template: string;
  routes: RouteItem[];
}

export interface RouteItem {
  filters: {
    path: string;
    queryParams: string[] | null;
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

  const dir = path.join(process.cwd(), "data", "routes");
  const files = await fs.readdir(dir);
  const jsonFiles = files.filter((f) => f.endsWith(".json"));

  const allRoutes: Route[] = [];
  for (const file of jsonFiles) {
    const content = await fs.readFile(path.join(dir, file), "utf-8");
    const routeObj: Route = JSON.parse(content);
    allRoutes.push(routeObj);
  }

  loadedRoutes = allRoutes;
  return loadedRoutes;
}

function matchRoute(routeItem: RouteItem, req: PWRoute): boolean {
  const url = new URL(req.request().url());

  const methodMatch = !routeItem.filters.method || routeItem.filters.method === req.request().method();
  const pathMatch = routeItem.filters.path === url.pathname;
  const queryMatch =
    !routeItem.filters.queryParams || routeItem.filters.queryParams.every((p) => url.searchParams.has(p));

  return methodMatch && pathMatch && queryMatch;
}

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

  page.route("**/*", async (route: any) => {
    const request = route.request();
    const matchedItem = allRouteItems.find((item) => matchRoute(item, route));
    if (!matchedItem) return route.continue();

    console.log(`Matched route: ${matchedItem.filters.path} with method ${request.method()}`);
    const fetchPromise = route.fetch();

    const tracking: InterceptedRoute = {
      routeItem: matchedItem,
      url: request.url(),
      completed: false,
      startedAt: Date.now(),
    };
    context.__routeState.matched.push(tracking);

    if (matchedItem.mandatory) {
      tracking.timer = setTimeout(() => {
        if (!tracking.completed) {
          console.error(`[MANDATORY] Request to ${tracking.url} did not complete within ${matchedItem.timeout}ms`);
        }
      }, matchedItem.timeout);
    }

    let response: APIResponse;
    try {
      response = await fetchPromise;
    } catch (e) {
      console.error("Failed to fetch response for", request.url(), e);
      if (tracking.timer) clearTimeout(tracking.timer);
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
            console.error(`[json_modify] Response not JSON`);
            actionStatus = "fail";
            break;
          }
          for (const mod of action.config) {
            const pathParts = mod.path.split(".");
            let obj = json;
            for (let i = 0; i < pathParts.length - 1; i++) {
              obj = obj?.[pathParts[i]];
              if (!obj) break;
            }
            const lastKey = pathParts[pathParts.length - 1];
            if (obj) obj[lastKey] = mod.value;
          }
          console.log(`[json_modify] Modified JSON`);
          break;

        case "status_code_change":
          status = action.config;
          console.log(`[status_code_change] Status changed to ${status}`);
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

    await route.fulfill({
      status,
      body: responseBody,
      headers,
    });
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

      if (allCompleted) {
        clearInterval(interval);
        resolve();
      } else if (elapsed >= maxTimeout) {
        mandatoryRoutes.forEach((r) => {
          if (!r.completed) {
            console.error(`[MANDATORY] Request to ${r.url} did not complete within ${r.routeItem.timeout}ms`);
          }
        });
        clearInterval(interval);
        resolve();
      }
    }, 100);
  });

  const results = mandatoryRoutes.map((tracked) => {
    const { routeItem, url, completed } = tracked;

    const actionResults =
      tracked.actionResults?.map((ar) => {
        let status: "success" | "fail" | "timeout" = ar.status;
        if (!completed) status = "timeout";
        return {
          type: ar.type,
          description: ar.description,
          status,
        };
      }) || [];

    let overallStatus: "fulfill" | "timeout" | "fail";
    if (!completed) {
      overallStatus = "timeout";
    } else if (actionResults.some((a) => a.status === "fail")) {
      overallStatus = "fail";
    } else {
      overallStatus = "fulfill";
    }

    return {
      url,
      filters: routeItem.filters,
      actions: actionResults,
      overallStatus,
    };
  });

  context.__routeState = null;
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
