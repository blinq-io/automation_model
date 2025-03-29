import { initContext, closeContext } from "../build/lib/auto_page.js";

let context = null;
describe("Click Tests", function () {
  beforeEach(async function () {
    context = await initContext("/", true, false);
    let url = "https://main.dldrg2rtamdtd.amplifyapp.com/site/automation_model_regression/name_locators/index.html";
    // let url = "http://[::]:8000/site/automation_model_regression/name_locators/"
    console.log(`Navigating to URL ${url}`);
    await context.web.goto(url);
    //console.log("click_element.test3.js: beforeEach");
  });
  afterEach(async function () {
    //console.log("Closing browser");
    await closeContext();
    //console.log("click_element.test3.js: afterEach");
  });

  it("Click elements by Class Name", async function () {
    let classLocElements = {
      h1Heading: {
        locators: [{ css: ".main-heading" }],
      },

      //input fields
      first_name: {
        locators: [{ css: ".fname" }],
      },
      last_name: {
        locators: [{ css: ".lname.new" }],
      },
      email: {
        locators: [{ css: ".ajs-3" }],
      },
      phone: {
        locators: [{ css: ".phoneno" }],
      },
      passwordInput: {
        locators: [{ css: ".passwordip" }],
      },
      numberInput: {
        locators: [{ css: ".numfield" }],
      },
      urlInput: {
        locators: [{ css: ".URL" }],
      },
      searchInput: {
        locators: [{ css: ".searchfield" }],
      },
      dateInput: {
        locators: [{ css: ".dateIp" }],
      },
      timeInput: {
        locators: [{ css: ".timeIP" }],
      },
      colorInput: {
        locators: [{ css: ".blue" }],
      },

      //This fails as result is plural. Move it to negative test later.
      // checkboxInput: {
      //     locators: [{ css: '.lg-43.sksd.fayed' }],
      // },

      // radioInput: {
      //     locators: [{ css: '.lg-43.sksd.fayed.new' }],
      // },

      experience: {
        locators: [{ css: ".lg-43.sksd.fayed.new.range" }],
      },
      inputFrench: {
        locators: [{ css: ".langEnglish" }],
      },
      inputEnglish: {
        locators: [{ css: ".langFr" }],
      },
      inputSpanish: {
        locators: [{ css: ".langSpanish" }],
      },

      //drodown-select
      country: {
        locators: [{ css: ".CountryField" }],
      },

      //drodown-select. This fails, use `select` method to select options. Move later
      // canadaOption: {
      //     locators: [{ css: '.canadaTest' }],
      // },

      //textarea
      message: {
        locators: [{ css: ".textArea.sm-lg" }],
      },
      submit: {
        locators: [{ css: ".abc" }],
      },
      reset: {
        locators: [{ css: ".resetAll" }],
      },
    };

    let info = null;
    for (let key in classLocElements) {
      console.log(`Click "${key}" element using locator "${classLocElements[key].locators[0].css}"`);
      info = await context.web.click(classLocElements[key]);
      //console.log(info.log);
    }
  });
});
