import { initContext } from "../build/lib/auto_page.js";
import { closeBrowser } from "../build/lib/init_browser.js";

const name = "login";
const path = "/";
const elements = {
  loginButton: {
    locators: [{ role: ["button", { name: "{signin}" }] }, { css: "button", priority: 3 }],
  },
  username: {
    locators: [{ css: 'input[name="username"]' }],
  },
  password: {
    locators: [{ css: "#password" }],
  },
};
const context = await initContext(path, true, true);
const login = async function () {
  let info = null;
  // info = await context.web.verifyTextExistInPage("Accepted usernames are:", {});
  // console.log(info.log);
  info = await context.web.click(elements.loginButton, { signin: "Login" });
  console.log(info.locatorLog.toString());
  //console.log("info click sign in", JSON.stringify(info, null, 2));
  info = await context.web.fill(elements.username, "guy");
  console.log(info.log);
  //console.log("info fill username", JSON.stringify(info, null, 2));
  info = await context.web.fill(elements.password, "guy");
  console.log(info.log);
  //console.log("info fill password", JSON.stringify(info, null, 2));
  info = await context.web.click(elements.loginButton, { signin: "Login" });
  console.log(info.log);
  //console.log("info click login", JSON.stringify(info, null, 2));
  info = await context.web.verifyElementExistInPage({
    locators: [
      {
        text: "Invalid username or password",
      },
    ],
  });
  console.log(info.log);
};
try {
  await login();
} catch (e) {
  try {
    const html = await context.web.page.content();
    console.log("html", html);
  } catch (e) {
    console.log(e);
    console.log("unable to get html content");
  }
  const buffer = await context.web.page.screenshot({ timeout: 4000 });
  const base64 = buffer.toString("base64");
  console.log("screenshot", base64);
  throw e;
}

await new Promise((resolve) => setTimeout(resolve, 1000));
await closeBrowser();
