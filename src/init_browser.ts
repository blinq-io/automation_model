import fs from "node:fs";
import path from "path";
import { Environment } from "./environment.js";
import { browserManager } from "./browser_manager.js";
import { TestContext } from "./test_context.js";
import { StableBrowser } from "./stable_browser.js";
import { Browser as PlaywrightBrowser } from "playwright";
import { Browser } from "./browser_manager.js";
import { Api } from "./api.js";

// let environment = null;

// init browser create context and page, if context and page are not null
const getContext = async function (
  environment: Environment | null,
  headless = false,
  logger?: null,
  appName?: string,
  createStable = true
) {
  if (environment === null) {
    environment = initEnvironment();
  }
  if (appName && !environment.apps && !environment.apps[appName]) {
    throw new Error(`App ${appName} not found in environment`);
  }
  if (appName) {
    environment = environment.apps[appName];
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
  let extensionPath = undefined;
  let userDataDirPath = undefined;
  let aiConfigFile = "ai_config.json";
  if (process.env.PROJECT_PATH) {
    aiConfigFile = path.join(process.env.PROJECT_PATH, "ai_config.json");
  }
  if (fs.existsSync(aiConfigFile)) {
    const configuration = JSON.parse(fs.readFileSync(aiConfigFile, "utf8"));
    if (configuration.userDataDirPath) {
      userDataDirPath = configuration.userDataDirPath;
    }
    if (configuration.extensionPath) {
      extensionPath = configuration.extensionPath;
    }
  }
  const storageState = { cookies, origins };
  let browser = await browserManager.createBrowser(headless, storageState, extensionPath, userDataDirPath);
  let context = new TestContext();
  context.browser = browser.browser;
  context.playContext = browser.context;
  context.page = browser.page;
  context.environment = environment;
  if (createStable) {
    context.stable = new StableBrowser(context.browser!, context.page!, logger, context);
  }
  context.api = new Api(logger);
  // await _initCookies(context);
  return context;
};

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
