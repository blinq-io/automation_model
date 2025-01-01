import { initContext, closeContext } from "../build/lib/auto_page.js";

let context = null;
describe("Click Tests", function () {
  beforeEach(async function () {
    context = await initContext("/", true, false);
    let url = "https://main.dldrg2rtamdtd.amplifyapp.com/site/automation_model_regression/name_locators/index.html";
    // let url = "http://[::]:8000/site/automation_model_regression/name_locators/"
    console.log(`Navigating to URL ${url}`);
    await context.stable.goto(url);
    console.log("click_element.test4.js: beforeEach");
  });
  afterEach(async function () {
    console.log("Closing browser");
    await closeContext();
    console.log("click_element.test4.js: afterEach");
  });

  it("Click elements by Tag Name", async function () {
    let tagLocElements = {
      // html: {
      //   locators: [{ css: "html" }],
      // },
      h1Heading: {
        locators: [{ css: "h1" }],
      },
      h2Heading: {
        locators: [{ css: "h2" }],
      },
      h3Heading: {
        locators: [{ css: "h3" }],
      },
      h4Heading: {
        locators: [{ css: "h4" }],
      },
      h5Heading: {
        locators: [{ css: "h5" }],
      },
      h6Heading: {
        locators: [{ css: "h6" }],
      },
      // footer: {
      //   locators: [{ css: "footer" }],
      // },
      // details: {
      //   locators: [{ css: "details" }],
      // },
      // audio: {
      //   locators: [{ css: "audio" }],
      // },
      // hr: {
      //   locators: [{ css: "hr" }],
      // },
      // // video: {
      // //     locators: [{ css: 'video' }]
      // // },
      // img: {
      //   locators: [{ css: "img" }],
      // },
      a: {
        locators: [{ css: "a" }],
      },
      section: {
        locators: [{ css: "section" }],
      },
      ul: {
        locators: [{ css: "ul" }],
      },
      ol: {
        locators: [{ css: "ol" }],
      },
      // dl: {
      //   locators: [{ css: "dl" }],
      // },
      // strong: {
      //   locators: [{ css: "strong" }],
      // },
      // caption: {
      //   locators: [{ css: "caption" }],
      // },
      table: {
        locators: [{ css: "table" }],
      },
      // thead: {
      //   locators: [{ css: "thead" }],
      // },
      tbody: {
        locators: [{ css: "tbody" }],
      },
      // tfoot: {
      //   locators: [{ css: "tfoot" }],
      // },
    };

    let info = null;
    for (let key in tagLocElements) {
      console.log(`Click "${key}" element using locator "${tagLocElements[key].locators[0].css}"`);
      info = await context.stable.click(tagLocElements[key]);
      console.log(info.log);
    }
  }).timeout(180_000);
});
