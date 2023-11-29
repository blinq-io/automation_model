import { initContext } from "../build/lib/auto_page.js";
import { closeBrowser } from "../build/lib/init_browser.js";

const name = "login";
const path = "/";
const elements = {
  sign_in: [[{ role: ["link", { name: "{signin}" }] }], [{ css: "a[href='/login']" }]],
  username: {
    locators: [{ css: 'input[name="login"]' }],
  },
  loginButton: [[{ role: ["button", { name: "Sign in" }] }]],
};
const context = await initContext(path, true, false);
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
