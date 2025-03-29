import { initContext } from "../build/auto_page.js";
import { closeBrowser } from "../build/init_browser.js";

const path = "https://github.com/login";
const elements = {
  textbox_username: [
    [{ role: ["textbox", { name: "Username or email address" }] }],
    [
      {
        css: "input[name='login']",
      },
    ],
  ],
  textbox_password: [
    [{ role: ["textbox", { name: "Password" }] }],
    [
      {
        css: "input[name='password']",
      },
    ],
  ],
  button_signin: [
    [{ role: ["button", { name: "Sign in" }] }],
    [
      {
        css: "input[type='submit']",
      },
    ],
  ],
  textbox_repositoryname: [
    [{ role: ["textbox", { name: "Repository name" }] }],
    [
      {
        css: "input[name='repository[name]']",
      },
    ],
  ],
  button_create: [
    [{ role: ["button", { name: "Create repository" }] }],
    [
      {
        css: "button[type='submit']",
      },
    ],
  ],
};
const context = await initContext(path, true, false);
const loginAndCreateRepo = async function () {
  let info = null;
  await context.web.fill(elements.textbox_username, "username");
  await context.web.fill(elements.textbox_password, "password");
  info = await context.web.click(elements.button_signin);
  await context.web.waitForPageLoad();

  await context.web.fill(elements.textbox_repositoryname, "new-repo");
  info = await context.web.click(elements.button_create);
  await context.web.waitForPageLoad();
};
await loginAndCreateRepo();

await new Promise((resolve) => setTimeout(resolve, 1000));
await closeBrowser();
