import { initContext } from "../src/auto_page.js";
import { closeBrowser } from "../src/init_browser.js";
import { getTableCells } from "../src/table_analyze.js";

const name = "login";
const path = "/";
const elements = {
  textbox_username: [
    [{ role: ["textbox", { name: "Username" }] }],
    [
      {
        css: "[name='loginForm'] > div > div.inputs-container > gb-login-input.username.ng-pristine.ng-invalid.ng-touched > input",
      },
    ],
  ],
  textbox_password: [
    [{ role: ["textbox", { name: "Password" }] }],
    [
      {
        css: "[name='loginForm'] > div > div.inputs-container > gb-login-input.password.ng-invalid.ng-touched.ng-dirty > input",
      },
    ],
  ],
  button_login: [[{ role: ["button", { name: "Login" }] }], [{ css: "[name='loginForm'] > button" }]],
  table: [[{ css: "gb-simple-table" }]],
};
const context = await initContext(path, true, false);
const login = async function () {
  let info = null;
  await context.stable.goto("https://sandbox-ext-6.glassboxcloud.com:8443/webinterface/webui/#/application-summary");
  await context.stable.fill(elements.textbox_username, "BlinqIO");
  await context.stable.fill(elements.textbox_password, "G11assb0x12!");
  info = await context.stable.click(elements.button_login);
  await context.stable.waitForPageLoad();
  await new Promise((resolve) => setTimeout(resolve, 1000));
  await context.stable.analyzeTable(elements.table, "table[*][Availability].text", "equals", "100%");
};
await login();

await new Promise((resolve) => setTimeout(resolve, 1000));
await closeBrowser();
