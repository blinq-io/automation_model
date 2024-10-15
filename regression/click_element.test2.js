import { initContext, closeContext } from "../build/lib/auto_page.js";

let context = null;
describe("Click Tests", function () {
  beforeEach(async function () {
    context = await initContext("/", true, false);
    let url = "https://main.dldrg2rtamdtd.amplifyapp.com/site/automation_model_regression/name_locators/index.html";
    // let url = "http://[::]:8000/site/automation_model_regression/name_locators/"
    console.log(`Navigating to URL ${url}`);
    await context.stable.goto(url);
    console.log("click_element.test2.js: beforeEach");
  });
  afterEach(async function () {
    console.log("Closing browser");
    await closeContext();
    console.log("click_element.test2.js: afterEach");
  });

  it("Click elements by ID", async function () {
    let idLocElements = {
      //input fields
      first_name: {
        locators: [{ css: "#first_name" }],
      },
      last_name: {
        locators: [{ css: "#last_name" }],
      },
      email: {
        locators: [{ css: "#email" }],
      },
      phone: {
        locators: [{ css: "#phone" }],
      },
      passwordInput: {
        locators: [{ css: "#password" }],
      },
      numberInput: {
        locators: [{ css: "#number" }],
      },
      urlInput: {
        locators: [{ css: "#urlInput" }],
      },
      searchInput: {
        locators: [{ css: "#searchInput" }],
      },
      dateInput: {
        locators: [{ css: "#dateInput" }],
      },
      timeInput: {
        locators: [{ css: "#timeInput" }],
      },
      colorInput: {
        locators: [{ css: "#colorInput" }],
      },
      checkboxInput: {
        locators: [{ css: "#checkboxInput" }],
      },
      radioInput: {
        locators: [{ css: "#radioInput" }],
      },

      inputFrench: {
        locators: [{ css: "#french" }],
      },
      inputEnglish: {
        locators: [{ css: "input#english" }],
      },
      inputSpanish: {
        locators: [{ css: "input#spanish" }],
      },

      //drodown-select
      country: {
        locators: [{ css: "#country" }],
      },

      //textarea
      message: {
        locators: [{ css: "#message" }],
      },
      experience: {
        locators: [{ css: "#experience" }],
      },
      // This fails, as hidden fields are not supported for click.
      // user_id: {
      //     locators: [{ css: '#user_id' }],
      // },
      submit: {
        locators: [{ css: "#submit" }],
      },
      reset: {
        locators: [{ css: "#reset" }],
      },
    };

    let info = null;
    for (let key in idLocElements) {
      console.log(`Click "${key}" element using locator "${idLocElements[key].locators[0].css}"`);
      info = await context.stable.click(idLocElements[key]);
      console.log(info.log);
    }
  });
});
