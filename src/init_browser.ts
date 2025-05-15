import fs from "node:fs";
import path from "path";
import { Environment } from "./environment.js";
import { browserManager } from "./browser_manager.js";
import { TestContext } from "./test_context.js";
import { StableBrowser } from "./stable_browser.js";
import { Browser as PlaywrightBrowser } from "playwright";
import { Browser } from "./browser_manager.js";
import { Api } from "./api.js";
import { InitScripts } from "./generation_scripts.js";

// let environment = null;

// init browser create context and page, if context and page are not null
const getContext = async function (
  environment: Environment | null,
  headless = false,
  world: any,
  logger?: null,
  appName?: string | null,
  createStable = true,
  web: StableBrowser | null = null,
  moveToRight = -1,
  reportFolder: string | null = null,
  initScripts: InitScripts | null = null,
  storageState: any | null = null
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
  let userAgent = undefined;
  let aiConfigFile = "ai_config.json";
  let channel = undefined;
  if (process.env.PROJECT_PATH) {
    aiConfigFile = path.join(process.env.PROJECT_PATH, "ai_config.json");
  }
  let configuration: any = {};
  if (fs.existsSync(aiConfigFile)) {
    configuration = JSON.parse(fs.readFileSync(aiConfigFile, "utf8"));
    if (configuration.userDataDirPath) {
      userDataDirPath = configuration.userDataDirPath;
    }
    if (configuration.extensionPath) {
      extensionPath = configuration.extensionPath;
    }

    if (configuration.useGoogleChrome === true) {
      channel = "chrome";
    } else if (configuration.useMicrosoftEdge === true) {
      channel = "msedge";
    }

    if (configuration.overrideUserAgent) {
      userAgent = configuration.overrideUserAgent;
    }
  }
  let usedStorageState = null;
  usedStorageState = { cookies, origins };
  let downloadsPath = "downloads";
  if (reportFolder) {
    downloadsPath = path.join(reportFolder, "downloads");
  } else if (web && web.context && web.context.reportFolder) {
    reportFolder = web.context.reportFolder;
    downloadsPath = path.join(web.context.reportFolder, "downloads");
  }
  if (world) {
    world.downloadsPath = downloadsPath;
  }
  if (web && web.context) {
    web.context.downloadsPath = downloadsPath;
  }
  // check if data.json exists in the report folder
  // and if it contain storageState field, if so, use it
  if (reportFolder) {
    const dataFile = path.join(reportFolder, "data.json");
    if (fs.existsSync(dataFile)) {
      const data = fs.readFileSync(dataFile, "utf8");
      const dataObject = JSON.parse(data);
      if (dataObject.storageState) {
        console.log("Init browser with storage state");
        usedStorageState = dataObject.storageState;
      }
    }
  }
  if (storageState) {
    usedStorageState = storageState;
  }
  let browser = await browserManager.createBrowser(
    headless,
    usedStorageState,
    extensionPath,
    userDataDirPath,
    reportFolder ? reportFolder : ".",
    userAgent,
    channel,
    configuration,
    initScripts
  );
  let context = new TestContext();
  context.browser = browser.browser;
  context.browserObject = browser;
  context.playContext = browser.context;
  context.page = browser.page;
  context.headless = headless;
  context.environment = environment;
  context.browserName = browser.browser ? browser.browser.browserType().name() : "unknown";
  context.reportFolder = reportFolder;
  context.initScripts = initScripts;

  if (process.env.CDP_CONNECT_URL) {
    // settin it to true will not navigate
    context.navigate = true;
  }

  if (createStable) {
    context.stable = new StableBrowser(context.browser!, context.page!, logger, context, world);
    context.web = context.stable;
  } else {
    context.stable = web;
    context.web = web;
  }
  context.api = new Api(logger);
  if (moveToRight > 0 && context.browserName === "chromium") {
    // move the borwser to the top right corner of the screen
    // create a cdp session
    // Get CDP session
    const playContext: any = context.playContext;
    const client = await playContext.newCDPSession(context.page);

    // Get window ID for the current target
    const { windowId } = await client.send("Browser.getWindowForTarget");
    //console.log(windowId);

    // get the window for the current target
    const window = await client.send("Browser.getWindowBounds", {
      windowId,
    });
    //console.log(window);
    await client.send("Browser.setWindowBounds", {
      windowId,
      bounds: {
        left: window.bounds.left + moveToRight,
      },
    });
    // close cdp
    await client.detach();
  }

  // await _initCookies(context);
  return context;
};
const refreshBrowser = async function (web: any, sessionPath: string, world: any) {
  await web.context.browserObject.close();
  web.context.pages = [];

  let storageState = null;
  if (sessionPath) {
    if (!fs.existsSync(sessionPath)) {
      throw new Error("Session path not found: " + sessionPath);
    }
    const data = fs.readFileSync(sessionPath, "utf8");
    storageState = JSON.parse(data).storageState;
  }
  const newContext = await getContext(
    web.context.environment,
    web.context.headless,
    world,
    null,
    web.context.appName,
    false,
    web,
    -1,
    web.context.reportFolder,
    web.context.initScripts,
    storageState
  );
  // clone all the new context properties to the old context
  web.context.browser = newContext.browser;
  web.context.browserObject = newContext.browserObject;
  web.context.playContext = newContext.playContext;
  web.context.page = newContext.page;
  web.page = newContext.page;
  web.context.pages.push(newContext.page);
  web.context.headless = newContext.headless;
  web.context.environment = newContext.environment;
  web.context.browserName = newContext.browserName;
  web.context.reportFolder = newContext.reportFolder;
  web.context.initScripts = newContext.initScripts;
  await web.goto(web.context.environment.baseUrl);
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
    if (process.env.BLINQ_ENV) {
      envFile = process.env.BLINQ_ENV;
    } else if (envArgVal) {
      envFile = envArgVal;
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
    // check if the envFile is not empty and exists
    if (!envFile || !fs.existsSync(envFile)) {
      throw new Error(envFile + " not found");
    }
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
  console.log("Process args: ", process.argv);
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
export { getContext, closeBrowser, refreshBrowser };
