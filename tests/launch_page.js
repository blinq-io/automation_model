import AutoPage from "../src/auto_page.js";
import { closeBrowser } from "../src/init_browser.js";

const name = "login";
const path = "/login";
const elements = {
  username: "input[name='username']",
  password: "input[name='password']",
  loginButton: "button[data-auto='action main']",
};

class LoginPage extends AutoPage {
  constructor() {
    super();
    this.name = name;
    this.path = path;
    this.elements = elements;
  }
  login = async function (user, password) {
    //await context.page.pause();
    await this.page.fill(this.elements.username, user);
    await this.page.fill(this.elements.password, password);
    //await this.context.page.pause();
    //await this.context.page.getByRole("button").dblclick();
    //click(this.elements.loginButton, { force: true });
    await this.page.locator(this.elements.loginButton).hover();
    await this.page.click(this.elements.loginButton);
    await this.page.click(this.elements.loginButton);
  };
}

const loginPage = await LoginPage.init();
await loginPage.login("guy", "Guy12345");
await new Promise((resolve) => setTimeout(resolve, 1000));
await closeBrowser();
