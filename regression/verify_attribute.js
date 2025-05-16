import { initContext, closeContext, navigate } from "../build/lib/auto_page.js";
import { getContext } from "../build/lib/init_browser.js";
import fs from "fs";
import { expect } from "chai";

const elements = {
  combobox_combobox: {
    locators: [{ css: "#dropdown", priority: 3 }, { css: "#dropdown" }],
    element_name: "combobox combobox",
  },
};

let context = null;

describe("verifyAttribute", function () {
  before(async function () {
    // check if temp directory exists
    if (!fs.existsSync("temp")) {
      fs.mkdirSync("temp");
    }
  });
  beforeEach(async function () {
    context = await getContext(null, false, null, null, null, true, null, -1, null);
    await context.web.goto("https://the-internet.herokuapp.com/dropdown");
  });
  afterEach(async function () {
    await closeContext();
  });

  it("verifyAttribute dropdown innerText all", async function () {
    let info = {};
    info.log = "";

    await context.web.verifyAttribute(
      elements["combobox_combobox"],
      "innerText",
      "Please select an option\nOption 1\nOption 2",
      null,
      null,
      this
    );
  });
  it("verifyAttribute dropdown innerText partial 1", async function () {
    let info = {};
    info.log = "";

    await context.web.verifyAttribute(
      elements["combobox_combobox"],
      "innerText",
      "Please select an option\nOption 2",
      null,
      null,
      this
    );
  });
  it("verifyAttribute dropdown innerText partial 2", async function () {
    let info = {};
    info.log = "";

    await await context.web.verifyAttribute(
      elements["combobox_combobox"],
      "innerText",
      "Please select an option\nOption 1",
      null,
      null,
      this
    );
  });
  it("verifyAttribute dropdown innerText regex", async function () {
    let info = {};
    info.log = "";

    await context.web.verifyAttribute(
      elements["combobox_combobox"],
      "innerText",
      "/Please select an option\nOption 1\nOption 2/",
      null,
      null,
      this
    );
  });
  it("verifyAttribute dropdown innerText fail", async function () {
    let info = {};
    info.log = "";
    let ex = null;
    try {
      await context.web.verifyAttribute(
        elements["combobox_combobox"],
        "innerText",
        "Please select an option\nOption 1\nOption 3",
        null,
        null,
        this
      );
    } catch (error) {
      ex = error;
      console.log("error: " + error);
    }
    expect(ex).to.not.be.null;
  });
});
