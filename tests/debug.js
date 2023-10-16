import { initContext } from "../src/auto_page.js";
import { closeBrowser } from "../src/init_browser.js";

const name = "login";
const path = "/";
const elements = {
  sign_in: [[{ role: ["link", { name: "{signin}" }] }]],
  username: [[{ css: 'input[name="login"]' }]],
  loginButton: [[{ role: ["button", { name: "Sign in" }] }]],
  main: [[{ css: "main" }]],
};
const context = await initContext(path, true, false);
const login = async function () {
  let info = null;
  info = await context.stable.click(elements.sign_in, { signin: "Sign in" });
  console.log("info click sign in", JSON.stringify(info, null, 2));
  await new Promise((resolve) => setTimeout(resolve, 1000));
  await context.stable.containsText(elements.main, "Sign in to GitHub");
};
await login();

await new Promise((resolve) => setTimeout(resolve, 1000));
await closeBrowser();
