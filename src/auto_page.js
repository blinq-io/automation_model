import { browserManager } from "./browser_manager.js";
import { getContext } from "./init_browser.js";
import fs from "fs";
import path from "path";
let context = null;
const navigate = async (path = "") => {
  let url = null;
  if (path === null) {
    url = context.environment.baseUrl;
  } else {
    url = new URL(path, context.environment.baseUrl).href;
  }
  await context.stable.goto(url);
  await context.stable.waitForPageLoad();
};
const _findEmptyFolder = (folder) => {
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
const initContext = async (path, doNavigate = true, headless = false, world = null) => {
  if (context) {
    return context;
  }
  context = await getContext(null, headless);

  if (world) {
    world.screenshot = true;
    const reportFolder = _findEmptyFolder();
    if (world.attach) {
      world.attach(reportFolder, { mediaType: "text/plain" });
    }
    world.screenshotPath = reportFolder;
    context.reportFolder = reportFolder;
  }

  if (doNavigate) {
    await navigate(path);
  }

  return context;
};
const closeContext = async () => {
  if (context && context.browser) {
    await browserManager.closeBrowser(context.browser);
  }
  context = null;
};
export { initContext, navigate, closeContext };
