import { initContext, closeContext } from "../build/lib/auto_page.js";

let context = null;
describe("Click Tests", function () {
  beforeEach(async function () {
    context = await initContext("/", true, false);
    let url = "https://main.dldrg2rtamdtd.amplifyapp.com/site/automation_model_regression/name_locators/index.html";
    // let url = "http://[::]:8000/site/automation_model_regression/name_locators/"
    console.log(`Navigating to URL ${url}`);
    await context.stable.goto(url);
    //console.log("click_element.test1.js: beforeEach");
  });
  afterEach(async function () {
    //console.log("Closing browser");
    await closeContext();
    //console.log("click_element.test1.js: afterEach");
  });

  it("Click elements by Name", async function () {
    let nameLocElements = {
      //input fields
      first_name: {
        locators: [{ css: '[name="first_name"]' }],
      },
      last_name: {
        locators: [{ css: '[name="last_name"]' }],
      },
      email: {
        locators: [{ css: '[name="email"]' }],
      },
      phone: {
        locators: [{ css: '[name="phone"]' }],
      },
      passwordInput: {
        locators: [{ css: '[name="passwordInput"]' }],
      },
      numberInput: {
        locators: [{ css: '[name="numberInput"]' }],
      },
      urlInput: {
        locators: [{ css: '[name="urlInput"]' }],
      },
      searchInput: {
        locators: [{ css: '[name="searchInput"]' }],
      },
      dateInput: {
        locators: [{ css: '[name="dateInput"]' }],
      },
      timeInput: {
        locators: [{ css: '[name="timeInput"]' }],
      },
      colorInput: {
        locators: [{ css: '[name="colorInput"]' }],
      },
      checkboxInput: {
        locators: [{ css: '[name="checkboxInput"]' }],
      },
      radioInput: {
        locators: [{ css: '[name="radioInput"]' }],
      },

      //fieldSet. This fails as name should be unique for an element.
      // language: {
      //     locators: [{ css: '[name="language"]' }],
      // },

      //drodown-select
      country: {
        locators: [{ css: '[name="country"]' }],
      },

      //textarea
      message: {
        locators: [{ css: '[name="message"]' }],
      },
      experience: {
        locators: [{ css: '[name="experience"]' }],
      },
      // This fails, as hidden fields are not supported for click.
      // user_id: {
      //     locators: [{ css: '[name="user_id"]' }],
      // },
      submit: {
        locators: [{ css: '[name="submitButton"]' }],
      },
      reset: {
        locators: [{ css: '[name="resetButton"]' }],
      },
    };

    let info = null;
    for (let key in nameLocElements) {
      console.log(`Click "${key}" element using locator "${nameLocElements[key].locators[0].css}"`);
      info = await context.stable.click(nameLocElements[key]);
      //console.log(info.log);
    }
  });
});
