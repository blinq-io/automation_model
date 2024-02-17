import { initContext } from "../build/lib/auto_page.js";
import { closeBrowser } from "../build/lib/init_browser.js";

const name = "login";
const path = "/";
const elements = {
  textbox_username: {
    locators: [
      { role: ["textbox", { name: "Username" }], parameterDependent: false },
      { priority: 1, css: "#username" },
      { priority: 1, css: "[name='username']" },
    ],
  },
  textbox_password: {
    locators: [
      { role: ["textbox", { name: "Password" }], parameterDependent: false },
      { priority: 1, css: "#password" },
      { priority: 1, css: "[name='password']" },
    ],
  },
  button_login: {
    locators: [
      { text: "LOGIN", tag: "button" },
      { role: ["button", { name: "LOGIN" }], parameterDependent: false },
      { tagOnly: true, priority: 3, css: "button" },
    ],
  },
  button_: {
    locators: [
      {
        priority: 3,
        css: "#root > div > div > div > div.MuiGrid-root.MuiGrid-item.MuiGrid-grid-xs-1.MuiGrid-grid-lg-4.css-zerdg2 > div > div.MuiBox-root.css-k008qs > button",
      },
    ],
  },
  shop_icon: {
    locators: [{ priority: 1, text: "{item}", climb: 2, css: "button" }],
  },
};
const context = await initContext(path, true, false);
const login = async function () {
  let username = "blinq_user";
  let password = "let_me_in";
  let item = "Urban Backpack - Compact & Durable";
  const _params = { username, password, item };
  await context.stable.goto("https://shop-blinq.io");
  await context.stable.clickType(elements["textbox_username"], username, false, _params, null, this);
  await context.stable.clickType(elements["textbox_password"], password, false, _params, null, this);
  await context.stable.click(elements["button_login"], _params, null, this);
  await context.stable.click(elements["shop_icon"], _params, null, this);
  await context.stable.waitForPageLoad();
};
await login();

await new Promise((resolve) => setTimeout(resolve, 1000));
await closeBrowser();
