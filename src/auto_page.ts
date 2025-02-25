import { browserManager } from "./browser_manager.js";
import { getContext } from "./init_browser.js";
import fs from "fs";
import path from "path";
import type { TestContext } from "./test_context.js";
import { locate_element } from "./locate_element.js";
import { InitScripts } from "./generation_scripts.js";
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
    const env = envName || getEnv();
    if (env) {
      await getTestData(reportFolder, env);
    }
  }

  return context;
};

const getEnv = () => {
  const env = process.env.BLINQ_ENV;
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
const getTestData = async (rFolder: string, currentEnv: string) => {
  try {
    const data = fs.readFileSync(path.join("data", "data.json"), "utf8");
    const jsonData = JSON.parse(data);
    const testData: Record<string, string>[] = [];
    const allEnvData = jsonData["*"];
    const currentEnvData = jsonData[currentEnv];
    if (allEnvData) {
      for (const key in allEnvData) {
        testData.push({ [key]: allEnvData[key] });
      }
    }
    if (currentEnvData) {
      for (const key in currentEnvData) {
        testData.push({ [key]: currentEnvData[key] });
      }
    }
    if (fs.existsSync(path.join(rFolder, "data.json"))) {
      const content = fs.readFileSync(path.join(rFolder, "data.json"), "utf8");
      try {
        const data = JSON.parse(content);
        for (const key in data) {
          // if key exists in testData, update it
          let found = false;
          for (let i = 0; i < testData.length; i++) {
            if (testData[i][key]) {
              found = true;
              testData[i][key] = data[key];
              break;
            }
          }
        }
      } catch (e) {
        console.error("Failed to merge data.json file: " + e);
      }
    }

    fs.writeFileSync(path.join(rFolder, "data.json"), JSON.stringify(testData, null, 2));
  } catch (e) {
    console.log("Error reading data.json file: " + e);
  }
};

export { initContext, navigate, closeContext };
