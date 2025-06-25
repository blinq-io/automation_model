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
  timer?: NodeJS.Timeout; // This stays as the timeout handle
  startedAt: number; // This is the timestamp for elapsed time tracking
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
  const matchedRoutes = routes.filter((r) => r.template === stepTemplate);

  if (!context.__routeState) {
    context.__routeState = { matched: [] } as RouteContextState;
  }

  for (const routeDef of matchedRoutes) {
    for (const routeItem of routeDef.routes) {
      page.route("**/*", async (route: any, request: any) => {
        if (!matchRoute(routeItem, route)) return route.continue();
        console.log(`Matched route: ${routeItem.filters.path} with method ${request.method()}`);
        const fetchPromise = route.fetch();

        const tracking: InterceptedRoute = {
          routeItem,
          url: request.url(),
          completed: false,
          startedAt: Date.now(),
        };
        context.__routeState.matched.push(tracking);

        // Timeout tracking for mandatory
        if (routeItem.mandatory) {
          tracking.timer = setTimeout(() => {
            if (!tracking.completed) {
              console.error(`[MANDATORY] Request to ${tracking.url} did not complete within ${routeItem.timeout}ms`);
            }
          }, routeItem.timeout);
        }

        let response: APIResponse;
        try {
          response = await fetchPromise;
        } catch (e) {
          console.error("Failed to fetch response for", request.url(), e);
          return route.abort();
        }

        let status = response.status();
        let body = await response.text();
        let headers = response.headers();

        let json: any;
        try {
          json = JSON.parse(body);
        } catch (_) {}

        for (const action of routeItem.actions) {
          switch (action.type) {
            case "status_code_verification":
              if (status !== action.config) {
                console.error(`[status_code_verification] Expected ${action.config}, got ${status}`);
              } else {
                console.log(`[status_code_verification] Passed`);
              }
              break;

            case "json_modify":
              if (!json) {
                console.error(`[json_modify] Response not JSON`);
                break;
              }
              for (const mod of action.config) {
                const path = mod.path.split(".");
                let obj = json;
                for (let i = 0; i < path.length - 1; i++) {
                  obj = obj[path[i]];
                  if (!obj) break;
                }
                const lastKey = path[path.length - 1];
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
        }

        const responseBody = json ? JSON.stringify(json) : body;

        await route.fulfill({
          status,
          body: responseBody,
          headers,
        });

        tracking.completed = true;
        if (tracking.timer) clearTimeout(tracking.timer);
      });
    }
  }
}

export async function registerAfterStepRoutes(context: any) {
  const state: RouteContextState = context.__routeState;
  if (!state) return;

  const waitPromises: Promise<void>[] = [];

  for (const tracked of state.matched) {
    if (!tracked.routeItem.mandatory || tracked.completed) continue;

    const elapsed = Date.now() - tracked.startedAt;
    const remaining = tracked.routeItem.timeout - elapsed;
    if (remaining > 0) {
      waitPromises.push(
        new Promise<void>((resolve) => {
          setTimeout(() => {
            if (!tracked.completed) {
              console.error(
                `[MANDATORY] Request to ${tracked.url} did not complete within ${tracked.routeItem.timeout}ms`
              );
            }
            resolve();
          }, remaining);
        })
      );
    } else {
      // Already past timeout
      console.error(`[MANDATORY] Request to ${tracked.url} did not complete (timeout already passed)`);
    }
  }

  await Promise.all(waitPromises);
  context.__routeState = null;
}

const toCucumberExpression = (text: string) =>
  text.replaceAll("/", "\\\\/").replaceAll("(", "\\\\(").replaceAll("{", "\\\\{");
function extractQuotedText(inputString: string): string[] {
  const regex = /("[^"]*")/g;
  let matches = [];
  let match;

  const regexInside = /"\/(.*?)\/"/g;
  while ((match = regexInside.exec(inputString)) !== null) {
    // Replace regex inside input string
    matches.push(match[0]);
  }

  while ((match = regex.exec(inputString)) !== null) {
    // Replace escaped double quotes with regular double quotes
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
