import { initContext } from "../build/lib/auto_page.js";
import { closeBrowser } from "../build/lib/init_browser.js";

const name = "login";
const path = "/";
process.env.PROJECT_PATH = "./tests";
const context = await initContext(path, true, false);
const testData = async function () {
  let data = await context.web.loadTestDataAsync("csv", "data.csv:0");
  console.log(data);
  let d = await context.web._replaceWithLocalData("{{NAME}}");
  console.log(d);
};
await testData();
await closeBrowser();
