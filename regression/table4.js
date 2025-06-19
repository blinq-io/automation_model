import { initContext, closeContext } from "../build/lib/auto_page.js";
import fs from "fs";
import path from "path";
import { expect } from "chai";
import { Table } from "../build/lib/table.js";
describe("Actions Tests", function () {
  let context = null;
  before(async function () {
    // check if temp directory exists
    if (!fs.existsSync("temp")) {
      fs.mkdirSync("temp");
    }
    //console.log("Actions Tests: before");
    context = await initContext(null, false, false, this);

    //context = await initContext("/", true, false);
    await context.web.goto("https://main.dldrg2rtamdtd.amplifyapp.com/site/tables/table4.html");
    await context.web.waitForPageLoad();
  });
  after(async function () {
    await closeContext();
  });

  const locElements = {
    table: {
      locators: [{ priority: 1, css: "table" }],
    },
  };
  it("column order", async function () {
    let info = {};
    info.log = "";
    info.failCause = {};
    const element = await context.web._locate({ locators: [{ css: "table" }] }, info, null, 10000);
    const table = new Table();
    await table.initFromElement(context.web.page, element);
    let result = table.analyze({
      type: "GET_COLUMN_DATA",
      column_index: 1, // 0-based index for the second column
    });

    expect(result.cells.length).to.equal(20);
  });
  it("column ascending", async function () {
    let info = {};
    info.log = "";
    info.failCause = {};
    const element = await context.web._locate({ locators: [{ css: "table" }] }, info, null, 10000);
    const table = new Table();
    await table.initFromElement(context.web.page, element);
    let result = table.analyze({
      type: "VALIDATE_COLUMN_DATA",
      column_index: 1, // 0-based index for the second column
      validation: "ascending",
    });

    expect(result.status).to.equal(true);
  });
  it("column filter", async function () {
    let info = {};
    info.log = "";
    info.failCause = {};
    const element = await context.web._locate({ locators: [{ css: "table" }] }, info, null, 10000);
    const table = new Table();
    await table.initFromElement(context.web.page, element);
    let result = table.analyze({
      type: "VALIDATE_COLUMN_DATA",
      column_index: 3, // 0-based index for the second column
      validation: "check_filter",
      filter_text: "1965",
    });

    expect(result.status).to.equal(true);
  });
});
