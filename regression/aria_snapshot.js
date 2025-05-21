import { initContext, closeContext, navigate } from "../build/lib/auto_page.js";
import { getContext } from "../build/lib/init_browser.js";
import fs from "fs";
import { expect } from "chai";

let context = null;
describe("getAriaSnapshot", function () {
  before(async function () {
    if (!fs.existsSync("temp")) fs.mkdirSync("temp");
  });
  beforeEach(async function () {
    context = await getContext(null, false, null, null, null, true, null, -1, null);
    await context.web.goto("https://main.dldrg2rtamdtd.amplifyapp.com/site/form/index.html");
  });
  afterEach(async function () {
    await closeContext();
  });

  it("returns a snapshot string with path and title headers", async function () {
    const snapshot = await context.web.getAriaSnapshot();
    expect(snapshot).to.be.a("string");
    // first line should start with “- path: ”
    const firstLine = snapshot.split("\n", 1)[0];
    expect(firstLine).to.match(/^- path:\s*\/site\/form\/index\.html/);
    // must include a “- title:” header somewhere
    expect(snapshot).to.include("\n- title:");
  });
});
