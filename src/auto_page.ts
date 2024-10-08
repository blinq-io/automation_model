import { browserManager } from "./browser_manager.js";
import { getContext } from "./init_browser.js";
import fs from "fs";
import path from "path";
import type { TestContext } from "./test_context.js";
import { locate_element } from "./locate_element.js";
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
  let nextIndex = 1;
  while (fs.existsSync(path.join(folder, nextIndex.toString()))) {
    nextIndex++;
  }
  return path.join(folder, nextIndex.toString());
};
const initContext = async (path: string, doNavigate = true, headless = false, world: any = null, moveToRight = -1) => {
  if (context) {
    return context;
  }
  if (world && world.context) {
    return world.context;
  }
  context = await getContext(null, headless, world, null, null, true, null, moveToRight);
  if (world) {
    world.context = context;
    world.screenshot = true;
    if (!reportFolder) {
      reportFolder = _findEmptyFolder();
      if (world.attach) {
        world.attach(reportFolder, { mediaType: "text/plain" });
        world.attach(JSON.stringify(context.environment), {
          mediaType: "application/json+env",
        });
      }
    }
    world.screenshotPath = reportFolder + "/screenshots/";
    if (!fs.existsSync(world.screenshotPath)) {
      fs.mkdirSync(world.screenshotPath, { recursive: true });
    }
    world.reportFolder = reportFolder;
    context.reportFolder = reportFolder;
  }

  if (doNavigate) {
    await navigate(path);
  }

  return context;
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
export { initContext, navigate, closeContext };
