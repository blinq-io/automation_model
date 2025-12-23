import { browserManager } from "./browser_manager.js";
import { getContext } from "./init_browser.js";
import { existsSync, mkdirSync, copyFileSync, readFileSync, writeFileSync } from "fs";
import path from "path";
import type { TestContext } from "./test_context.js";
import { InitScripts } from "./generation_scripts.js";
import { _getDataFile, _getTestData, decrypt, measureAsync } from "./utils.js";
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
  await context!.web!.goto(url);
  context!.navigate = true;
  await context!.web!.waitForPageLoad();
};
const _findEmptyFolder = (folder?: string) => {
  if (process.env.MODE === "executions") {
    return path.join("/tmp", "runs", "0");
  }
  if (process.env.REPORT_FOLDER) {
    return process.env.REPORT_FOLDER;
  }
  if (!folder) {
    folder = "./runs";
  }
  if (process.env.REPORT_ID) {
    return path.join(folder, process.env.REPORT_ID);
  }

  if (!existsSync(folder)) {
    mkdirSync(folder);
  }
  let nextIndex = 1;
  while (existsSync(path.join(folder, nextIndex.toString()))) {
    nextIndex++;
  }
  return path.join(folder, nextIndex.toString());
};

type Attachment = {
  data: any;
  options: any;
};
interface DomyWorld {
  attach: (data: any, options: any) => void;
  attachments: Attachment[] | null;
  [key: string]: any; // Allow other properties to be added dynamically
}
let domyWorld: DomyWorld | null = null;
let foundWold: any = null;
const initContext = async (
  path: string,
  doNavigate = true,
  headless = false,
  world: any = null,
  moveToRight = -1,
  initScript: InitScripts | null = null,
  envName: string | null = null
) => {
  if (world) {
    foundWold = world;
  }
  if (domyWorld && world) {
    // first compy all the fields from domyWorld to world
    for (const key in domyWorld) {
      // check that key is not a function
      if (typeof domyWorld[key] === "function") {
        continue;
      }
      if (Object.prototype.hasOwnProperty.call(domyWorld, key)) {
        world[key] = domyWorld[key];
      }
    }
    if (domyWorld.attachments && world.attach) {
      for (const attachment of domyWorld.attachments) {
        world.attach(attachment.data, attachment.options);
      }
    }
    domyWorld = null; // clear the domyWorld after copying
  }

  if (!world) {
    const myworld: DomyWorld = {
      attach: (data, options) => {
        if (foundWold && foundWold.attach) {
          foundWold.attach(data, options);
        } else if (myworld.attachments) {
          myworld.attachments.push({ data, options });
        }
      },
      attachments: [],
    };
    domyWorld = myworld;
    world = domyWorld;
  }
  if (context && context.playContext && (context.playContext as any).isClosed !== true) {
    if (process.env.TEMP_RUN) {
      if (world && !world.context) {
        world.context = context;
      }
    }
    return context;
  }
  if (world && world.context && world.context.playContext && world.context.playContext.isClosed !== true) {
    return world.context;
  }
  if (!reportFolder) {
    reportFolder = _findEmptyFolder();
    if (world && world.attach) {
      world.attach(reportFolder, { mediaType: "text/plain" });
    }
  }
  if (process.env.MODE === "executions") {
    const globalDataFile = "global_test_data.json";
    if (existsSync(globalDataFile)) {
      process.env.GLOBAL_TEST_DATA_FILE = globalDataFile;
    }
  }
  const globalTestDataFile = process.env.GLOBAL_TEST_DATA_FILE;
  if (globalTestDataFile) {
    // check if file exists
    if (!existsSync(globalTestDataFile)) {
      console.log("GLOBAL_TEST_DATA_FILE not found: " + process.env.GLOBAL_TEST_DATA_FILE);
    } else {
      // if report folder does not exist, create it
      if (!existsSync(reportFolder)) {
        mkdirSync(reportFolder, { recursive: true });
      }
      // copy the test data file to the report folder as data.json
      copyFileSync(globalTestDataFile, reportFolder + "/data.json");
    }
  }
  const screenshotPath = reportFolder + "/screenshots/";
  if (!existsSync(screenshotPath)) {
    mkdirSync(screenshotPath, { recursive: true });
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
      try {
        world.attach(JSON.stringify(context!.environment), {
          mediaType: "application/json+env",
        });
      } catch (error) {
        console.log("Error attaching environment to report: " + error);
      }
    }
  }

  if (doNavigate) {
    await navigate(path);
  }
  if (context) context.reportFolder = reportFolder;
  if (context) {
    const env = getEnv(envName);
    if (env && !process.env.TEMP_RUN) {
      await getTestData(env, world, undefined, undefined, undefined, context);
    }
  }

  if (context && !context.snapshotFolder) {
    context.snapshotFolder = _createSnapshotsFolder("data");
  }

  if (context && !context.fixturesFolder) {
    context.fixturesFolder = _createFixturesFolder();
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
      const content = JSON.parse(readFileSync(env, "utf8"));
      return content.name;
    } catch (e) {
      console.log("Error reading env file: " + e);
      return null;
    }
  }
  return null;
};
const closeContext = async () => {
  if (process.env.TEMP_RUN) {
    return;
  }
  try {
    await browserManager.closeAll();
  } catch (e) {
    // eslint-disable-next-line no-console
    // ignore
  }
  context = null;
  reportFolder = "";
};
type testData = {
  key: string;
  value: string;
  DataType: "string" | "secret" | "totp";
  environment: string;
  feature?: string;
  scenario?: string;
};
const getTestData = async (
  currentEnv: string,
  world: any,
  dataFile?: string,
  feature?: string,
  scenario?: string,
  context?: any
) => {
  // copy the global test data located in data/data.json to the report folder
  let debugData = false;
  let fileContent = "";
  if ((context && context.debugData === true) || process.env.DEBUG_DATA === "true") {
    debugData = true;
  }
  if (debugData) {
    console.log("Loading test data for environment: " + currentEnv);
  }
  try {
    let jsonData = {} as Record<string, Omit<testData, "environment">[]>;
    const filterFeatureScenario = feature || scenario;
    if (existsSync(path.join("data", "data.json"))) {
      fileContent = readFileSync(path.join("data", "data.json"), "utf8");
      jsonData = JSON.parse(fileContent) as Record<string, Omit<testData, "environment">[]>;
    }
    let testData: Record<string, any> = {};
    const allEnvData = jsonData["*"];
    const currentEnvData = jsonData[currentEnv];

    // Process all environment data first as a baseline
    if (allEnvData) {
      for (let i = 0; i < allEnvData.length; i++) {
        const item = allEnvData[i];
        if (process.env[item.key] && item.key.toLowerCase() !== "username" && item.key.toLowerCase() !== "user") {
          testData[item.key] = process.env[item.key]!;
          continue;
        }
        // Filter by feature/scenario if specified
        if (filterFeatureScenario) {
          if (feature && item.feature && item.feature !== feature) {
            continue;
          }
          if (scenario && item.scenario && item.scenario !== scenario) {
            continue;
          }
        } else if (item.feature || item.scenario) {
          // Skip feature/scenario specific items when not filtering
          continue;
        }

        let useValue = item.value;

        if (item.DataType === "secret") {
          testData[item.key] = "secret:" + item.value;
          // decrypt the secret
          useValue = decrypt("secret:" + item.value);
        } else if (item.DataType === "totp") {
          testData[item.key] = "totp:" + item.value;
          useValue = "totp:" + item.value;
        } else {
          testData[item.key] = item.value;
        }
      }
    }

    // Then process currentEnvData to override the base values
    if (currentEnvData) {
      for (let i = 0; i < currentEnvData.length; i++) {
        const item = currentEnvData[i];
        if (process.env[item.key] && item.key.toLowerCase() !== "username" && item.key.toLowerCase() !== "user") {
          testData[item.key] = process.env[item.key]!;
          continue;
        }

        // Filter by feature/scenario if specified
        if (filterFeatureScenario) {
          if (feature && item.feature && item.feature !== feature) {
            continue;
          }
          if (scenario && item.scenario && item.scenario !== scenario) {
            continue;
          }
        } else if (item.feature || item.scenario) {
          // Skip feature/scenario specific items when not filtering
          continue;
        }

        let useValue = item.value;

        if (item.DataType === "secret") {
          testData[item.key] = "secret:" + item.value;
          // decrypt the secret
          useValue = decrypt("secret:" + item.value);
        } else if (item.DataType === "totp") {
          testData[item.key] = "totp:" + item.value;
          useValue = "totp:" + item.value;
        } else {
          testData[item.key] = item.value;
        }
      }
    }
    if (context?.environment) {
      const excludedKeys = new Set(["cookies", "apps", "origins", "extensionPath"]);

      const envData = Object.entries(context.environment)
        .filter(([key]) => !excludedKeys.has(key))
        .reduce<Record<string, any>>((acc, [key, value]) => {
          acc[key] = value;
          return acc;
        }, {});

      if (Object.keys(envData).length > 0) {
        testData.env = {
          ...(testData.env || {}),
          ...envData,
        };
      }
    }
    if (debugData) {
      console.log("Test data loaded: ", testData);
    }
    if (!dataFile) dataFile = _getDataFile(world, context, context?.web);

    // Always ensure directory exists before writing
    if (!existsSync(path.dirname(dataFile))) {
      mkdirSync(path.dirname(dataFile), { recursive: true });
    }

    if (existsSync(dataFile)) {
      try {
        //const content = readFileSync(dataFile, "utf8");
        //const data = JSON.parse(content);
        const data = _getTestData(world, context, context?.web);
        // merge the global test data with the existing data
        testData = Object.assign(testData, data);
      } catch (error) {
        console.log("Error reading data.json file: " + error);
      }
    } else {
      if (debugData) {
        console.log("data.json file does not exist, it will be created at: " + dataFile);
      }
    }
    writeFileSync(dataFile, JSON.stringify(testData, null, 2));
  } catch (e) {
    console.log("Error reading data.json file: " + e);
    console.log("File content: " + fileContent);
  }
};

const resetTestData = async (envPath: string, world: any) => {
  const envName = getEnv(envPath);
  if (envName) {
    const dataFile = _getDataFile(world, context, context?.web);
    if (dataFile && existsSync(dataFile)) {
      writeFileSync(dataFile, "{}");
    }
    getTestData(envName, world, undefined, undefined, undefined, context);
  }
};

const _createSnapshotsFolder = (folder: string) => {
  const snapshotsPath = path.join(folder, "snapshots");
  if (!existsSync(snapshotsPath)) {
    mkdirSync(snapshotsPath, { recursive: true });
  }
  const envName = context?.environment?.name ?? "default";
  const specificPath = path.join(snapshotsPath, envName);
  if (!existsSync(specificPath)) {
    mkdirSync(specificPath, { recursive: true });
  }
  return specificPath;
};

const _createFixturesFolder = () => {
  const fixturesFolderPath = path.join("data", "fixtures");
  if (!existsSync(fixturesFolderPath)) {
    mkdirSync(fixturesFolderPath, { recursive: true });
  }
  return fixturesFolderPath;
};

export { initContext, navigate, closeContext, resetTestData, getTestData, context as TestContext };
