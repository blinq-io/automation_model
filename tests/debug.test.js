import { initContext } from "../build/lib/auto_page.js";
import { closeBrowser } from "../build/lib/init_browser.js";

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
  //await context.stable.reloadPage();
  //await context.stable.verifyTextExistInPage("github", {});
  await context.stable.goto("https://page-app-970.my.salesforce.com/");
  await context.stable.verifyTextExistInPage("Start your free trial", {});
};
await login();

await new Promise((resolve) => setTimeout(resolve, 1000));
await closeBrowser();
