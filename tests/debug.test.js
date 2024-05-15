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
  await context.stable.goto("https://price.com/");
  await context.stable.visualVerification("Nike icon exists");
  await context.stable.verifyTextExistInPage("100000", {});
  await context.stable.goto("https://todaysdate365.com/");
  await context.stable.verifyTextExistInPage("25/04/2024", {});
};
await login();

await new Promise((resolve) => setTimeout(resolve, 1000));
await closeBrowser();
