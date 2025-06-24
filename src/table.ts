import exp from "constants";
import fs from "fs";
import path from "path";
/*
data/route json example:
{
    "template": "login with {string} and {string}",
    "routes": [
        {
            "filters": {
                "path": "/v1/tgyLfN8E/users/123457",
                "queryParams": [],
                "method": "GET"
            },
            "actions": [
                {
                    "type": "status_code_verification",
                    "config": 200
                },
                {
                    "type": "json_modify",
                    "config": [
                        {
                            "path": "id",
                            "value": "123456"
                        },
                        {
                            "path": "name",
                            "value": "guy"
                        },
                        {
                            "path": "email.0",
                            "value": "guy@gmail.com"
                        }
                    ]
                },
                {
                    "type": "status_code_change",
                    "config": 502
                }
            ],
            "mandatory": true,
            "timeout": 5000
        }
    ]
}
*/
let routes: Route[] | null = null;
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
  config: any; // can be a number, string, or an array of objects
}
export interface Resoulvers {
  routeResolver: Function;
  fetchResolver: Function;
}

export async function registerBoforeStepRoutes(context: any, stepTemplate: string) {
  if (!routes) {
    routes = [];
    // inside data/routes search for all the files that end with .json
    const routesDir = path.join(__dirname, "data", "routes");
    if (!fs.existsSync(routesDir)) {
      return;
    }
    const files = fs.readdirSync(routesDir).filter((file) => file.endsWith(".json"));
    for (const file of files) {
      const filePath = path.join(routesDir, file);
      const content = fs.readFileSync(filePath, "utf8");
      try {
        const routeData = JSON.parse(content);
        if (routeData.template && routeData.routes) {
          routes.push(routeData as Route);
        }
      } catch (error) {
        console.error(`Error parsing JSON from file ${filePath}:`, error);
      }
    }
  }
  if (!routes || routes.length === 0) {
    return;
  }
  const stepRoutes = routes.filter((route) => {
    return route.template && stepTemplate === route.template;
  });
  if (stepRoutes.length === 0) {
    return;
  }
  const resolvers: Resoulvers[] = [];
  for (const routeConfig of stepRoutes) {
    for (const route of routeConfig.routes) {
      const filters = route.filters;
      if (!filters || !filters.path) {
        console.warn("Route filters are not defined or missing path");
        continue;
      }
      const path = filters.path;
      const queryParams = filters.queryParams || [];
      const method = filters.method || null;
      // register the route in the context.web.page (playwright)
      // anything that doesn't match the route will be passed through
      if (context.web && context.web.page) {
        //
      }
    }
  }
}
