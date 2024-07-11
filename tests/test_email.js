import { initContext } from "../build/lib/auto_page.js";
import { closeBrowser } from "../build/lib/init_browser.js";

const name = "login";
const path = "/";
process.env.PROJECT_PATH = "./tests";
process.env.NODE_ENV_BLINQ = "dev";
process.env.TOKEN = "9adda740d6a7abebc427b39c0d97f859";
const context = await initContext(path, true, false);
const testData = async function () {
  await context.stable.extractEmailData("guy@blinq-mail.io", { timeout: 120000 });
  console.log(context.stable.getTestData(null));
};
await testData();
await closeBrowser();
