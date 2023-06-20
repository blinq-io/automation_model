import { AutoPage } from "../src/auto_page.js";
import { closeBrowser } from "../src/init_browser.js";

const name = "login";
const path = "/";
const elements = {
  sign_in: [{ role: ["link", { name: "Sign in" }] }],
  username: [{ role: ["textbox", { name: "Username or email address" }] }],
  loginButton: [{ role: ["button", { name: "Sign in" }] }],
};

class LoginPage extends AutoPage {
  constructor() {
    super();
    this.name = name;
    this.path = path;
    this.elements = elements;
  }
  login = async function () {
    //await context.page.pause();
    let info = null;
    info = await this.stable.click(this.elements.sign_in);
    console.log("info click sign in", JSON.stringify(info, null, 2));
    info = await this.stable.fill(this.elements.username, "guy");
    console.log("info fill username", JSON.stringify(info, null, 2));
    info = await this.stable.click(this.elements.loginButton);
    console.log("info click login", JSON.stringify(info, null, 2));
    info = await this.stable.verifyElementExistInPage([
      [
        {
          text: "Incorrect username or password.",
        },
      ],
    ]);
    console.log("info verify", JSON.stringify(info, null, 2));
  };
}

const loginPage = await LoginPage.init(true, true);
await loginPage.login();
await new Promise((resolve) => setTimeout(resolve, 1000));
await closeBrowser();
