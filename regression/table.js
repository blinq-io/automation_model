import { initContext, closeContext } from "../build/lib/auto_page.js";
import fs from "fs";
import path from "path";
import { expect } from "chai";
import { Table } from "../build/lib/table.js";
let context = null;
describe("Actions Tests", function () {
  before(async function () {
    // check if temp directory exists
    if (!fs.existsSync("temp")) {
      fs.mkdirSync("temp");
    }
    console.log("Actions Tests: before");
  });
  beforeEach(async function () {
    context = await initContext("/", true, false);
    await context.stable.goto("https://main.dldrg2rtamdtd.amplifyapp.com/site/tables/table2.html");
  });
  afterEach(async function () {
    await closeContext();
  });

  const locElements = {
    table: {
      locators: [{ priority: 1, css: "table" }],
    },
  };
  it("validate row", async function () {
    let info = {};
    info.log = "";
    const element = await context.stable._locate({ locators: [{ css: "#table2" }] }, info, null, 10000);
    const table = new Table();
    await table.initFromElement(context.stable.page, element);
    let result = table.analyze({
      type: "FIND_ROW",
      cells: ["azul", "bleu", "gorm", "glas"],
    });

    expect(result.status).to.equal(true);
    expect(result.rowIndex).to.equal(3);
    expect(result.cellIndex).to.equal(1);
  });
  it("validate row 2", async function () {
    let info = {};
    info.log = "";
    const element = await context.stable._locate({ locators: [{ css: "#table2" }] }, info, null, 10000);
    const table = new Table();
    await table.initFromElement(context.stable.page, element);
    let result = table.analyze({
      type: "FIND_ROW",
      cells: ["Black", /negr.*/],
    });

    expect(result.status).to.equal(true);
    expect(result.rowIndex).to.equal(4);
    expect(result.cellIndex).to.equal(0);
  });
  it("validate header", async function () {
    let info = {};
    info.log = "";
    const element = await context.stable._locate({ locators: [{ css: "#table2" }] }, info, null, 10000);
    const table = new Table();
    await table.initFromElement(context.stable.page, element);
    let result = table.analyze({
      type: "VALIDATE_HEADER",
      cells: ["French", "Irish", "Welsh"],
    });

    expect(result.status).to.equal(true);
  });
  it("validate grid", async function () {
    let info = {};
    info.log = "";
    const element = await context.stable._locate({ locators: [{ css: "#table2" }] }, info, null, 10000);
    const table = new Table();
    await table.initFromElement(context.stable.page, element);
    let result = table.analyze({
      type: "VALIDATE_HEADER",
      cells: ["French", "Irish", "Welsh"],
    });

    expect(result.status).to.equal(true);
  });
});