import { initContext, closeContext } from "../build/lib/auto_page.js";

let context = null;
describe("Click Tests", function () {
  beforeEach(async function () {
    context = await initContext("/", true, false);
    let url = "https://main.dldrg2rtamdtd.amplifyapp.com/site/automation_model_regression/name_locators/index.html";
    // let url = "http://[::]:8000/site/automation_model_regression/name_locators/"
    console.log(`Navigating to URL ${url}`);
    await context.stable.goto(url);
    //console.log("click_element.test.js: beforeEach");
  });
  afterEach(async function () {
    //console.log("Closing browser");
    await closeContext();
    //console.log("click_element.test.js: afterEach");
  });

  it("Click elements by Role locators", async function () {
    let locElements = {
      button: {
        locators: [{ css: '//*[@role="submitButton"]' }],
      },
      heading: {
        locators: [{ css: '//h1[@role="heading"]' }],
      },
      details: {
        locators: [{ css: '//details[@role="group"]' }],
      },
      p: {
        locators: [{ css: '//*[@role="note"]' }],
      },
      audio: {
        locators: [{ css: '//*[@role="audio"]' }],
      },
      audio: {
        locators: [{ css: '//*[@role="audio"]' }],
      },
      section: {
        locators: [{ css: '//*[@role="region"]' }],
      },
      form: {
        locators: [{ css: '//form[@role="form"]' }],
      },
      resetButton: {
        locators: [{ css: "//input[@type='reset' and @role='button']" }],
      },
      td: {
        locators: [{ css: "//td[@role='cell']" }],
      },
      select: {
        locators: [{ css: "//select[@role='country']" }],
      },
      textarea: {
        locators: [{ css: "//*[@role='textarea']" }],
      },
      footer: {
        locators: [{ css: "//*[@role='footer']" }],
      },
    };

    let info = null;
    for (let key in locElements) {
      console.log(`Click "${key}" element using locator "${locElements[key].locators[0].css}"`);
      info = await context.stable.click(locElements[key]);
      //console.log(info.log);
    }
  });
});
