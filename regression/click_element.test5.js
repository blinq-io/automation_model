import { initContext, closeContext } from "../build/lib/auto_page.js";

let context = null;
describe("Click Tests", function () {
  beforeEach(async function () {
    context = await initContext("/", true, false);
    let url = "https://main.dldrg2rtamdtd.amplifyapp.com/site/automation_model_regression/name_locators/index.html";
    // let url = "http://[::]:8000/site/automation_model_regression/name_locators/"
    console.log(`Navigating to URL ${url}`);
    await context.stable.goto(url);
    console.log("click_element.test5.js: beforeEach");
  });
  afterEach(async function () {
    console.log("Closing browser");
    await closeContext();
    console.log("click_element.test5.js: afterEach");
  });

  it("Click elements by XPath", async function () {
    let locElements = {
      a1: {
        locators: [{ css: '//a[text()="This is a link"]' }],
      },
      li1: {
        locators: [{ css: '//li[text()="Item 2"]' }],
      },
      h1: {
        locators: [{ css: "//h1[@class='main-heading']" }],
      },
      summary: {
        locators: [{ css: "//details/summary" }],
      },
      details: {
        locators: [{ css: "//details/p" }],
      },
      img: {
        locators: [{ css: "//img[@src='150.png']" }],
      },
      a2: {
        locators: [{ css: '//a[contains(text(),"This")]' }],
      },
      li2: {
        locators: [{ css: '//li[contains(text(),"Item 2")]' }],
      },
      ol1: {
        locators: [{ css: "//ol/li[text()='First item']" }],
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
      footer: {
        locators: [{ css: "//footer/p" }],
      },
      form: {
        locators: [{ css: "//form[@name='testForm']" }],
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
