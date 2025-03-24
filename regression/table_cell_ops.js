import { initContext, closeContext, navigate } from "../build/lib/auto_page.js";
import fs from "fs";
import { expect } from "chai";

let context = null;

describe("table_cell", function () {
  before(async function () {
    // check if temp directory exists
    if (!fs.existsSync("temp")) {
      fs.mkdirSync("temp");
    }
  });
  beforeEach(async function () {
    context = await initContext(null, false, false, this);
    await context.stable.goto("https://main.dldrg2rtamdtd.amplifyapp.com/site/tables/table3.html");
  });
  afterEach(async function () {
    await closeContext();
  });
  it("find_rec", async function () {
    let info = {};
    info.log = "";
    await context.stable.tableCellOperation("French", "Blue", { operation: "click", css: "td" }, {}, this);
    //console.log(result);
  });
});
