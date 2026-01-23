import { closeContext } from "../build/lib/auto_page.js";
import { getContext } from "../build/lib/init_browser.js";
import { executeBrunoRequest } from "../build/lib/bruno.js";
import fs from "fs";
import { expect } from "chai";
import { getTestDataValue } from "../build/lib/utils.js";

let context = null;

//{"status":true,"result":{"elementNumber":2,"reason":"The element with elementNumber 2 is a button with the name 'Login', which matches the task requirement to click on 'Login button'.","name":"locate_element"}}
describe("bruno", function () {
  before(async function () {
    // check if temp directory exists
    if (!fs.existsSync("temp")) {
      fs.mkdirSync("temp");
    }
  });
  beforeEach(async function () {
    context = await getContext(null, false, null, null, null, true, null, -1, null);
    await context.web.goto("https://shop-blinq.io");
  });
  afterEach(async function () {
    await closeContext();
  });

  it("run request", async function () {
    const result = await executeBrunoRequest(
      "get version",
      {
        brunoFolder: "./regression/bruno",
      },
      context,
      this
    );
    expect(result[0].summary.passedRequests).to.equal(1);
    expect(context.web.getTestData(this).id).to.not.be.null;
    expect(context.web.getTestData(this).ddd).to.equal("liad123121");
  });
  it("create object", async function () {
    try {
      const result = await executeBrunoRequest(
        "Create Object",
        {
          brunoFolder: "./regression/bruno",
        },
        context,
        this
      );
      expect(result[0].summary.passedRequests).to.equal(1);
      expect(context.web.getTestData(this).id).to.not.be.null;
    } catch (e) {
      expect(e.message || e).to.be.equal('Parameter "{{ObjectName}}" is undefined in the test data');
    }
  });
});
