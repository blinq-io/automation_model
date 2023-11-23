import { initContext } from "../build/bin/auto_page.js";
import { closeBrowser } from "../build/bin/init_browser.js";

const name = "login";
const path = "/";
const elements = {
  sign_in: [[{ role: ["link", { name: "{signin}" }] }]],
  username: [[{ css: 'input[name="login"]' }]],
  loginButton: [[{ role: ["button", { name: "Sign in" }] }]],
};
const context = await initContext(path, true, true);
const login = async function () {
  let info = null;
  info = await context.stable.click(elements.sign_in, { signin: "Sign in" });
  console.log("info click sign in", JSON.stringify(info, null, 2));
  info = await context.stable.fill(elements.username, "guy");
  console.log("info fill username", JSON.stringify(info, null, 2));
  info = await context.stable.click(elements.loginButton);
  console.log("info click login", JSON.stringify(info, null, 2));
  info = await context.stable.verifyElementExistInPage([
    [
      {
        text: "Incorrect username or password.",
      },
    ],
  ]);
  console.log("info verify", JSON.stringify(info, null, 2));
};
await login();

await new Promise((resolve) => setTimeout(resolve, 1000));
await closeBrowser();
