import fs from "node:fs";
import path from "path";
import { Environment } from "./environment.js";
import { browserManager } from "./browser_manager.js";
import { TestContext } from "./test_context.js";
import { StableBrowser } from "./stable_browser.js";
import { Browser as PlaywrightBrowser } from "playwright";
import { Browser } from "./browser_manager.js";

// let environment = null;

// init browser create context and page, if context and page are not null
const getContext = async function (environment: Environment | null, headless = false, logger?: null) {
  if (environment === null) {
    environment = initEnvironment();
  }
  const { cookies, origins } = environment;
  if (cookies) {
    for (let i = 0; i < cookies.length; i++) {
      const cookie = cookies[i];
      if (cookie.expires === "undefined") {
        delete cookie.expires;
      }
    }
  }
  const extensionPath = environment.extensionPath;
  const storageState = { cookies, origins };
  let browser = await browserManager.getBrowser(headless, storageState, extensionPath);
  let context = new TestContext();
  context.browser = browser.browser;
  context.playContext = browser.context;
  context.page = browser.page;
  context.environment = environment;

  context.stable = new StableBrowser(context.browser!, context.page!, logger, context);
  // await _initCookies(context);
  return context;
};
// const _initCookies = async function (context) {
//   if (context.environment.cookies) {
//     const cookies = [];
//     for (let i = 0; i < context.environment.cookies.length; i++) {
//       const cookie = context.environment.cookies[i];
//       if (cookie.expires && cookie.expires == "undefined") {
//         delete cookie.expires;
//       }
//       cookies.push(cookie);
//     }
//     await context.playContext.addCookies(cookies);
//   }
// };

const closeBrowser = async function (browser?: Browser | PlaywrightBrowser) {
  await browserManager.closeBrowser(browser);
};

const initEnvironment = function () {
  // if (environment === null) {
  const environment = new Environment();
  try {
    let envFile = "";
    const envArgVal = checkForEnvArg();
    if (envArgVal) {
      envFile = envArgVal;
    } else if (process.env.BLINQ_ENV) {
      envFile = process.env.BLINQ_ENV;
    } else if (fs.existsSync(path.join(process.cwd(), "env.json"))) {
      envFile = path.join(process.cwd(), "env.json");
    } else {
      let files = fs.readdirSync(path.join(process.cwd(), "environments"));
      for (let i = 0; i < files.length; i++) {
        let file = files[i];
        if (file.endsWith(".json")) {
          envFile = path.join(process.cwd(), "environments", file);
          break;
        }
      }
    }
    // console.log("envFile: ", envFile);
    const data = fs.readFileSync(envFile, "utf8");
    //console.log("data", data);
    const envObject = JSON.parse(data);
    //console.log("envObject", envObject);
    Object.assign(environment, envObject);
    //console.log("env", environment);
    console.log("Base url: " + environment.baseUrl);
  } catch (err) {
    console.error("Error reading env.json", err);
  }
  // }
  return environment;
};
const checkForEnvArg = function () {
  for (let arg of process.argv.slice(2)) {
    if (arg.startsWith("--")) {
      const [key, value] = arg.split("=");
      if (key.slice(2) === "env") {
        return value;
      }
    }
  }
  return null;
};
export { getContext, closeBrowser };
