import { browserManager } from "./browser_manager.js";
import { getContext } from "./init_browser.js";
import fs from "fs";
import path from "path";
import type { TestContext } from "./test_context.js";
import { locate_element } from "./locate_element.js";
import { InitScripts } from "./generation_scripts.js";
import { _getDataFile } from "./utils.js";
let context: TestContext | null = null;
let reportFolder = "";
const navigate = async (path = "") => {
  if (path === null && context!.navigate === true) {
    return;
  }
  let url = null;
  if (path === null) {
    url = context!.environment!.baseUrl!;
  } else {
    url = new URL(path, context!.environment!.baseUrl).href;
  }
  await context!.stable!.goto(url);
  context!.navigate = true;
  await context!.stable!.waitForPageLoad();
};
const _findEmptyFolder = (folder?: string) => {
  if (!folder) {
    folder = "./runs";
  }
  if (!fs.existsSync(folder)) {
    fs.mkdirSync(folder);
  }
  if (process.env.REPORT_FOLDER) {
    return process.env.REPORT_FOLDER;
  }
  if (process.env.REPORT_ID) {
    return path.join(folder, process.env.REPORT_ID);
  }
  let nextIndex = 1;
  while (fs.existsSync(path.join(folder, nextIndex.toString()))) {
    nextIndex++;
  }
  return path.join(folder, nextIndex.toString());
};
const initContext = async (
  path: string,
  doNavigate = true,
  headless = false,
  world: any = null,
  moveToRight = -1,
  initScript: InitScripts | null = null,
  envName: string | null = null
) => {
  if (context) {
    return context;
  }
  if (world && world.context) {
    return world.context;
  }
  if (!reportFolder) {
    reportFolder = _findEmptyFolder();
    if (world && world.attach) {
      world.attach(reportFolder, { mediaType: "text/plain" });
    }
  }
  const globalTestDataFile = process.env.GLOBAL_TEST_DATA_FILE;
  if (globalTestDataFile) {
    // check if file exists
    if (!fs.existsSync(globalTestDataFile)) {
      console.log("GLOBAL_TEST_DATA_FILE not found: " + process.env.GLOBAL_TEST_DATA_FILE);
    } else {
      // if report folder does not exist, create it
      if (!fs.existsSync(reportFolder)) {
        fs.mkdirSync(reportFolder, { recursive: true });
      }
      // copy the test data file to the report folder as data.json
      fs.copyFileSync(globalTestDataFile, reportFolder + "/data.json");
    }
  }
  const screenshotPath = reportFolder + "/screenshots/";
  if (!fs.existsSync(screenshotPath)) {
    fs.mkdirSync(screenshotPath, { recursive: true });
  }
  if (world) {
    world.reportFolder = reportFolder;
    world.screenshotPath = screenshotPath;
    world.screenshot = true;
  }
  context = await getContext(null, headless, world, null, null, true, null, moveToRight, reportFolder, initScript);
  if (world) {
    world.context = context;
    if (world.attach) {
      world.attach(JSON.stringify(context.environment), {
        mediaType: "application/json+env",
      });
    }
  }
  context.reportFolder = reportFolder;

  if (doNavigate) {
    await navigate(path);
  }
  if (context) {
    const env = getEnv(envName);
    if (env) {
      await getTestData(env, world);
    }
  }

  return context;
};

const getEnv = (envName: string | null) => {
  let env = process.env.BLINQ_ENV;
  if (envName) {
    env = envName;
  }
  if (env) {
    try {
      const content = JSON.parse(fs.readFileSync(env, "utf8"));
      return content.name;
    } catch (e) {
      console.log("Error reading env file: " + e);
      return null;
    }
  }
  return null;
};
const closeContext = async () => {
  try {
    if (context && context.browser) {
      await browserManager.closeBrowser(context.browser);
    }
  } catch (e) {
    // eslint-disable-next-line no-console
    // ignore
  }
  context = null;
};
type testData = {
  key: string;
  value: string;
  DataType: "string" | "secret" | "totp";
  environment: string;
};
const getTestData = async (currentEnv: string, world: any) => {
  try {
    if (fs.existsSync(path.join("data", "data.json"))) {
      const data = fs.readFileSync(path.join("data", "data.json"), "utf8");
      const jsonData = JSON.parse(data) as Record<string, Omit<testData, "environment">[]>;
      const testData: Record<string, string> = {};
      const allEnvData = jsonData["*"];
      const currentEnvData = jsonData[currentEnv];
      if (allEnvData) {
        for (let i = 0; i < allEnvData.length; i++) {
          const item = allEnvData[i];
          if (process.env[item.key]) {
            testData[item.key] = process.env[item.key]!;
            continue;
          }
          if (item.DataType === "secret") {
            testData[item.key] = "secret:" + item.value;
          } else if (item.DataType === "totp") {
            testData[item.key] = "totp:" + item.value;
          } else {
            testData[item.key] = item.value;
          }
        }
      }
      if (currentEnvData) {
        for (let i = 0; i < currentEnvData.length; i++) {
          const item = currentEnvData[i];
          if (
            process.env[item.key] &&
            item.key.toLowerCase() !== "os" &&
            item.key.toLowerCase() !== "username" &&
            item.key.toLowerCase() !== "password" &&
            item.key.toLowerCase() !== "windir" &&
            item.key.toLowerCase() !== "prompt"
          ) {
            testData[item.key] = process.env[item.key]!;
            continue;
          }
          if (item.DataType === "secret") {
            testData[item.key] = "secret:" + item.value;
          } else if (item.DataType === "totp") {
            testData[item.key] = "totp:" + item.value;
          } else {
            testData[item.key] = item.value;
          }
        }
      }
      const dataFile = _getDataFile(world, context, context?.stable);
      fs.writeFileSync(dataFile, JSON.stringify(testData, null, 2));
    }
  } catch (e) {
    console.log("Error reading data.json file: " + e);
  }
};

const resetTestData = async (envPath: string, world: any) => {
  const envName = getEnv(envPath);
  if (envName) {
    getTestData(envName, world);
  }
};
export { initContext, navigate, closeContext, resetTestData };
