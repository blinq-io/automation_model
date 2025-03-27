import { time } from "console";
import { initContext, closeContext } from "../build/lib/auto_page.js";

let context = null;

const elements = {
  null_the_message_will_appear_after_35_se: {
    locators: [
      {
        css: 'internal:text="{delayed_message_text}"i',
        priority: 1,
        text: "The message will appear after 35 seconds.",
        climb: 1,
      },
    ],
    element_name: "The message will appear after 35 seconds. Text",
  },
};
describe("contain text timeout", function () {
  beforeEach(async function () {
    context = await initContext("/", true, false);
    let url = "https://main.dldrg2rtamdtd.amplifyapp.com/site/time/index.html";
    console.log(`Navigating to URL ${url}`);
    await context.stable.goto(url);
  });
  afterEach(async function () {
    // console.log("Closing browser");

    await closeContext();
  });

  it("timeout fail", async function () {
    const _delayed_message_text = "Hello! This is your delayed message.";
    const _params = { _delayed_message_text };
    // Verify The message will appear after 35 seconds. Text contains text "_delayed_message_text"
    try {
      await context.stable.containsText(
        elements["null_the_message_will_appear_after_35_se"],
        _delayed_message_text,
        null,
        _params,
        null,
        this
      );
      throw new Error("Expected error");
    } catch (e) {
      console.log("Error: ", e);
    }
  });
  it("timeout added", async function () {
    const _delayed_message_text = "Hello! This is your delayed message.";
    const _params = { _delayed_message_text };
    // Verify The message will appear after 35 seconds. Text contains text "_delayed_message_text"
    await context.stable.containsText(
      elements["null_the_message_will_appear_after_35_se"],
      _delayed_message_text,
      null,
      _params,
      { timeout: 40000 },
      this
    );
  });
});
