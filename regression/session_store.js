import { initContext, closeContext } from "../build/lib/auto_page.js";
const elements = {
  textbox_email_honeycomb_testinator_com: {
    locators: [
      { css: 'internal:role=textbox[name="Email Address"i]', priority: 1 },
      { css: 'internal:role=textbox[name="Email Address"s]', priority: 1 },
    ],
    element_name: "Generating label... textbox",
    element_key: "textbox_email_honeycomb_testinator_com",
  },
  textbox_password_login_to_your_broker_ac: {
    locators: [
      { css: 'internal:role=textbox[name="Password"i]', priority: 1 },
      { css: 'internal:role=textbox[name="Password"s]', priority: 1 },
    ],
    element_name: " textbox",
    element_key: "textbox_password_login_to_your_broker_ac",
  },
  button_login: {
    locators: [
      { css: 'internal:text="Login"s', priority: 1 },
      { css: 'button >> internal:has-text="Login"i', priority: 1 },
      { css: "button >> internal:has-text=/^Login$/", priority: 1 },
      { css: 'internal:role=button[name="Login"s]', priority: 1 },
      { css: 'internal:role=button[name="Login"i]', priority: 1 },
    ],
    element_name: "Login button",
    element_key: "button_login",
  },
};

/**
 * The user logs in with email address "<email_address>" and password "<password>"
 * @param {string} _email_address  email address
 * @param {string} _password  password
 * @recorder
 * @path=/signin
 */
async function the_user_logs_in_with_email_address_email_address_and_password_password(_email_address, _password) {
  // source: recorder
  // implemented_at: 2025-09-15T11:55:12.907Z
  const _params = { _email_address, _password };
  // Fill Generating label... textbox with "_email_address"
  await context.web.clickType(
    elements["textbox_email_honeycomb_testinator_com"],
    _email_address,
    false,
    _params,
    null,
    this
  );
  // Fill  textbox with "_password"
  await context.web.clickType(
    elements["textbox_password_login_to_your_broker_ac"],
    _password,
    false,
    _params,
    null,
    this
  );
  // Click on Login button
  await context.web.click(elements["button_login"], _params, null, this);
}

let context = null;
describe("session store", function () {
  beforeEach(async function () {
    context = await initContext("/", true, false);
    //console.log("click_element.test.js: beforeEach");
  });
  afterEach(async function () {
    //console.log("Closing browser");
    await closeContext();
    //console.log("click_element.test.js: afterEach");
  });

  it("login-session", async function () {
    await context.web.restoreSaveState(null, this);
    let url = "https://sandbox-falcon.honeycombinsurance.com/home";
    console.log(`Navigating to URL ${url}`);
    await context.web.goto(url);
    await the_user_logs_in_with_email_address_email_address_and_password_password(
      "tp05_e2e@honeycomb.testinator.com",
      "Pass2023@"
    );
    await context.web.restoreSaveState(null, this);
    console.log(`Navigating to URL ${url}`);
    await context.web.goto(url);
    await new Promise((resolve) => setTimeout(resolve, 10000));
  });
});
