import {
  chromium,
  firefox,
  webkit,
  Browser as PlaywrightBrowser,
  BrowserContext,
  Page,
  BrowserContextOptions,
} from "playwright";
import type { Cookie, LocalStorage } from "./environment.js";
import path from "path";
import { InitScripts } from "./generation_scripts.js";
import { fileURLToPath } from "url";
import crypto from "crypto";
import fs from "fs-extra";
import tmp from "tmp";
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

type StorageState = {
  cookies: Cookie[];
  origins: { origin: string; localStorage: LocalStorage }[];
};
class BrowserManager {
  constructor(public browsers: Browser[] = []) {}

  async closeAll() {
    await Promise.all(this.browsers.map((browser) => browser.close()));
    this.browsers = [];
  }
  async closeBrowser(browser?: PlaywrightBrowser | Browser) {
    if (!browser && this.browsers.length > 0) {
      for (let i = 0; i < this.browsers.length; i++) {
        await this.browsers[i].close();
      }
      this.browsers = [];
    }

    if (browser && !process.env.IGNORE_BROWSER_CLOSE) {
      await browser.close();
      for (let i = 0; i < this.browsers.length; i++) {
        if (this.browsers[i].browser === browser || this.browsers[i] === browser) {
          this.browsers.splice(i, 1);
          i--;
          break;
        }
      }
    }
  }

  async createBrowser(
    headless = false,
    storageState?: StorageState,
    extensionPath?: string,
    userDataDirPath?: string,
    reportFolder?: string,
    userAgent?: string,
    channel?: string,
    aiConfig?: any,
    initScripts: InitScripts | null = null
  ) {
    const browser = new Browser();
    await browser.init(
      headless,
      storageState,
      extensionPath,
      userDataDirPath,
      reportFolder,
      userAgent,
      channel,
      aiConfig,
      initScripts
    );
    this.browsers.push(browser);
    return browser;
  }
}
class Browser {
  browser: PlaywrightBrowser | null;
  context: BrowserContext | null;
  page: Page | null;
  headless: boolean = false;
  reportFolder: string | null = null;
  trace: boolean = false;
  traceFolder: string | null = null;
  constructor() {
    this.browser = null;
    this.context = null;
    this.page = null;
  }

  async init(
    headless = false,
    storageState?: StorageState,
    extensionPath?: string,
    userDataDirPath?: string,
    reportFolder?: string,
    userAgent?: string,
    channel?: string,
    aiConfig?: any,
    initScripts: InitScripts | null = null
  ) {
    if (!aiConfig) {
      aiConfig = {};
    }

    this.headless = headless;
    if (reportFolder) {
      this.reportFolder = reportFolder;
    }
    let viewport = null;
    if (process.env.HEADLESS === "true") {
      headless = true;
      this.headless = true;
    } else if (process.env.HEADLESS === "false") {
      headless = false;
      this.headless = false;
    }
    if (process.env.VIEWPORT) {
      let viewportParts = process.env.VIEWPORT.split(",");
      viewport = { width: parseInt(viewportParts[0]), height: parseInt(viewportParts[1]) };
    } else if (aiConfig.viewport && aiConfig.viewport.width && aiConfig.viewport.height) {
      viewport = { width: parseInt(aiConfig.viewport.width), height: parseInt(aiConfig.viewport.height) };
    } else if (!aiConfig.noViewport) {
      viewport = { width: 1280, height: 800 };
    }

    const args = ["--ignore-https-errors", "--ignore-certificate-errors"];

    if (process.env.CDP_LISTEN_PORT) {
      args.push(`--remote-debugging-port=${process.env.CDP_LISTEN_PORT}`);
    }
    let useSessionFolder = false;
    if (!extensionPath && userDataDirPath) {
      this.context = await chromium.launchPersistentContext(userDataDirPath, {
        headless: false,
        timeout: 0,
        bypassCSP: true,
        args: [
          "--ignore-https-errors",
          "--no-incognito",
          "--ignore-certificate-errors",
          "--use-gtk",
          "--use_ozone=false",
        ],
      });
    } else if (extensionPath) {
      this.context = await chromium.launchPersistentContext(userDataDirPath ?? "", {
        headless: headless,
        timeout: 0,
        bypassCSP: true,
        args: [
          "--ignore-https-errors",
          "--disable-extensions-except=" + extensionPath,
          "--load-extension=" + extensionPath,
          "--no-incognito",
          "--ignore-certificate-errors",
          "--use-gtk",
          "--use_ozone=false",
        ],
      });
    } else {
      if (process.env.BROWSER === "firefox") {
        this.browser = await firefox.launch({
          headless: headless,
          timeout: 0,
          args,
        });
      } else if (process.env.BROWSER === "webkit") {
        this.browser = await webkit.launch({
          headless: headless,
          timeout: 0,
          args,
        });
      } else if (channel) {
        args.push("--use-gtk");
        args.push("--use_ozone=false");
        this.browser = await chromium.launch({
          headless: headless,
          timeout: 0,
          args,
          channel: channel,
        });
      } else {
        if (process.env.CDP_CONNECT_URL) {
          this.browser = await chromium.connectOverCDP(process.env.CDP_CONNECT_URL);
        } else if (process.env.BROWSER_WS_ENDPOINT) {
          this.browser = await chromium.connect(process.env.BROWSER_WS_ENDPOINT);
        } else {
          args.push("--use-gtk");
          args.push("--use_ozone=false");
          if (process.env.BROWSER_FOLDER) {
            useSessionFolder = true;
            const sessionFolder = prepareBrowserFolder(process.env.BROWSER_FOLDER);
            this.context = await chromium.launchPersistentContext(sessionFolder, {
              headless: headless,
              timeout: 0,
              args,
            });
          } else {
            this.browser = await chromium.launch({
              headless: headless,
              timeout: 0,
              args,
            });
          }
        }
      }

      let contextOptions: any = {};
      if (aiConfig.contextOptions) {
        contextOptions = aiConfig.contextOptions;
        console.log("contextOptions: " + JSON.stringify(contextOptions));
      }
      if (!contextOptions["acceptDownloads"]) {
        contextOptions["acceptDownloads"] = true;
      }
      if (storageState && !useSessionFolder) {
        contextOptions.storageState = storageState as unknown as BrowserContextOptions["storageState"];
        contextOptions.bypassCSP = true;
        contextOptions.ignoreHTTPSErrors = true;
      }
      if (viewport) {
        contextOptions.viewport = viewport;
      } else {
        if (!this.headless) {
          contextOptions.viewport = null;
        }
      }

      if (userAgent) {
        contextOptions.userAgent = userAgent;
      }

      if (!this.context && this.browser) {
        if (this.browser.contexts().length > 0) {
          this.context = this.browser.contexts()[this.browser.contexts().length - 1];
        } else {
          this.context = await this.browser.newContext(contextOptions as unknown as BrowserContextOptions);
        }
      }
    }
    // if ((process.env.TRACE === "true" || aiConfig.trace === true) && this.context) {
    //   this.trace = true;
    //   const traceFolder = path.join(this.reportFolder!, "trace");
    //   if (!fs.existsSync(traceFolder)) {
    //     fs.mkdirSync(traceFolder, { recursive: true });
    //   }
    //   this.traceFolder = traceFolder;
    //   await this.context.tracing.start({ screenshots: true, snapshots: true });
    // }

    function createGuid(): string {
      return crypto.randomBytes(16).toString("hex");
    }

    const runtimeGuid = createGuid();

    // Preprocesses any generated script to include the runtime guid.
    function prepareGeneratedScript(source: string) {
      return source
        .replaceAll("$runtime_guid$", runtimeGuid)
        .replace("kUtilityScriptIsUnderTest = false", `kUtilityScriptIsUnderTest = true`);
    }

    const options = {
      sdkLanguage: "javascript",
      testIdAttributeName: "blinq-test-id",
      stableRafCount: 0,
      browserName: this.browser?.browserType().name(),
      inputFileRoleTextbox: false,
      customEngines: [],
    };

    if (initScripts && this.context) {
      if (initScripts.recorderCjs) {
        await this.context.addInitScript({
          content: `
            (() => {
            const module = {};
            ${prepareGeneratedScript(initScripts.recorderCjs)}
            const sss = new (module.exports.InjectedScript())(
              window,
              ${JSON.stringify(options)},
            );
          })();`,
        });
      }
      if (initScripts.scripts) {
        for (let script of initScripts.scripts) {
          await this.context.addInitScript({
            content: script,
          });
        }
      }
    }
    let axeMinJsPath = path.join(__dirname, "..", "scripts", "axe.mini.js");
    if (!fs.existsSync(axeMinJsPath)) {
      axeMinJsPath = path.join(__dirname, "scripts", "axe.mini.js");
    }
    const axeMinJsContent = fs.readFileSync(axeMinJsPath, "utf-8");
    await this.context?.addInitScript({
      content: axeMinJsContent,
    });
    if (this.context && this.context.pages().length > 0) {
      this.page = this.context.pages()[this.context.pages().length - 1];
    } else {
      this.page = await this.context!.newPage();
    }
    if (this.context) {
      this.context.on("close", () => {
        (this.context as any).isClosed = true;
      });
    }
  }

  async close() {
    if (process.env.IGNORE_BROWSER_CLOSE === "true") {
      return;
    }
    if (this.browser !== null) {
      await this.browser.close();
      this.browser = null;
      this.context = null;
      this.page = null;
    } else if (this.context !== null) {
      await this.context.close();
      this.context = null;
    }
  }
}
const browserManager = new BrowserManager();

function prepareBrowserFolder(sessionPath: string) {
  const sessionFolder = path.join("sessions", path.basename(sessionPath));
  // check if the sessionFolder exists
  if (fs.existsSync(sessionFolder)) {
    // generate a temp (using the fs.mkdtempSync) folder and copy the session folder to it
    //const tempFolder = fs.mkdtempSync(path.join(os.tmpdir(), "session-"));
    const { name: tempDir } = tmp.dirSync({ unsafeCleanup: true });
    // copy the entire folder to the temp folder
    fs.copySync(sessionFolder, tempDir);
    // delete SingletonLock if exist in tempDir
    const singletonLockPath = path.join(tempDir, "SingletonLock");
    try {
      fs.unlinkSync(singletonLockPath);
    } catch (err) {
      // handle the error if the file does not exist
    }
    return tempDir;
  }
  return sessionFolder;
}

export { browserManager };
export type { BrowserManager, Browser };
