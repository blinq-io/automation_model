import { browserManager } from "./browser_manager.js";
import { getContext } from "./init_browser.js";
import fs from "fs";
import path from "path";
import type { TestContext } from "./test_context.js";
let context: TestContext | null = null;
let reportFolder = "";
const navigate = async (path = "") => {
  let url = null;
  if (path === null) {
    url = context!.environment!.baseUrl!;
  } else {
    url = new URL(path, context!.environment!.baseUrl).href;
  }
  await context!.stable!.goto(url);
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
  context = await getContext(null, headless);
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

  if (moveToRight > 0) {
    // move the borwser to the top right corner of the screen
    // create a cdp session
    // Get CDP session
    const playContext: any = context.playContext;
    const client = await playContext.newCDPSession(context.page);

    // Get window ID for the current target
    const { windowId } = await client.send("Browser.getWindowForTarget");
    console.log(windowId);

    // get the window for the current target
    const window = await client.send("Browser.getWindowBounds", {
      windowId,
    });
    console.log(window);
    await client.send("Browser.setWindowBounds", {
      windowId,
      bounds: {
        left: window.bounds.left + moveToRight,
      },
    });
    // close cdp
    await client.detach();
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
