import { initContext } from "../build/auto_page.js";
import { closeBrowser } from "../build/init_browser.js";

const path = "https://accounts.google.com/signin/v2/identifier?flowName=GlifWebSignIn&flowEntry=ServiceLogin";
const elements = {
  textbox_username: [
    [{ role: ["textbox", { name: "Email or phone" }] }],
    [
      {
        css: "input[type='email']",
      },
    ],
  ],
  button_next: [[{ role: ["button", { name: "Next" }] }], [{ css: "#identifierNext" }]],
  textbox_password: [
    [{ role: ["textbox", { name: "Enter your password" }] }],
    [
      {
        css: "input[type='password']",
      },
    ],
  ],
  button_login: [[{ role: ["button", { name: "Next" }] }], [{ css: "#passwordNext" }]],
};
const context = await initContext(path, true, false);
const login = async function () {
  let info = null;
  await context.web.fill(elements.textbox_username, "username");
  info = await context.web.click(elements.button_next);
  await context.web.waitForPageLoad();
  await context.web.fill(elements.textbox_password, "password");
  info = await context.web.click(elements.button_login);
  await context.web.waitForPageLoad();
};
await login();

await new Promise((resolve) => setTimeout(resolve, 1000));
await closeBrowser();
