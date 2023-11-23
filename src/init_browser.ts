import fs from "node:fs";
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
  for (let i = 0; i < cookies.length; i++) {
    const cookie = cookies[i];
    if (cookie.expires === "undefined") {
      delete cookie.expires;
    }
  }
  const storageState = { cookies, origins };
  let browser = await browserManager.getBrowser(headless, storageState);
  let context = new TestContext();
  context.browser = browser.browser;
  context.playContext = browser.context;
  context.page = browser.page;
  context.environment = environment;

  context.stable = new StableBrowser(context.browser!, context.page!, logger);
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
    const data = fs.readFileSync("env.json", "utf8");
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

export { getContext, closeBrowser };
