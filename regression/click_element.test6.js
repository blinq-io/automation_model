import { initContext, closeContext } from "../build/lib/auto_page.js";

let context = null;
describe("Click Tests", function () {
  beforeEach(async function () {
    context = await initContext("/", true, false);
    let url = "https://main.dldrg2rtamdtd.amplifyapp.com/site/automation_model_regression/name_locators/index.html";
    // let url = "http://[::]:8000/site/automation_model_regression/name_locators/"
    console.log(`Navigating to URL ${url}`);
    await context.stable.goto(url);
    console.log("click_element.test6.js: beforeEach");
  });
  afterEach(async function () {
    console.log("Closing browser");
    await closeContext();
    console.log("click_element.test6.js: afterEach");
  });

  it("Click elements by CSS Locators", async function () {
    let locElements = {
      h1: {
        locators: [{ css: "h1.main-heading" }],
      },
      details: {
        locators: [{ css: "details > summary" }],
      },
      details_p: {
        locators: [{ css: "details > p" }],
      },
      img_src: {
        locators: [{ css: "img[src='150.png']" }],
      },
      a_href: {
        locators: [{ css: "a[href='#']" }],
      },
      //Ordered list item First item
      ol_first_item: {
        locators: [{ css: "ol > li:nth-of-type(1)" }],
      },
      input_with_class: {
        locators: [{ css: ".emailfield.ajs-3" }],
      },
      input_type_value: {
        locators: [{ css: "input[type='submit'][value='Submit']" }],
      },
      //Table cell containing text Data 3:
      table_cell: {
        locators: [{ css: "body > table > tbody > tr:nth-child(1) > td:nth-child(1)" }],
      },
      input_with_id: {
        locators: [{ css: "//input[@id='first_name']" }],
      },
      input_with_class: {
        locators: [{ css: "//input[@class='emailfield ajs-3']" }],
      },
      submit: {
        locators: [{ css: "//input[@type='submit' and @value='Submit']" }],
      },
      select: {
        locators: [{ css: "//select[@id='country']" }],
      },
      td_cell: {
        locators: [{ css: "//td[text()='Data 3']" }],
      },
    };

    let info = null;
    for (let key in locElements) {
      console.log(`Click "${key}" element using locator "${locElements[key].locators[0].css}"`);
      info = await context.stable.click(locElements[key]);
      console.log(info.log);
    }
  });
});
