// import { initContext, closeContext, navigate } from "../build/lib/auto_page.js";
// import { getContext } from "../build/lib/init_browser.js";
// import fs from "fs";
// import { expect } from "chai";

// let context = null;

// //{"status":true,"result":{"elementNumber":2,"reason":"The element with elementNumber 2 is a button with the name 'Login', which matches the task requirement to click on 'Login button'.","name":"locate_element"}}
// describe("shadow dom", function () {
//   before(async function () {
//     // check if temp directory exists
//     if (!fs.existsSync("temp")) {
//       fs.mkdirSync("temp");
//     }
//   });
//   beforeEach(async function () {
//     context = await getContext(null, false, null, null, null, true, null, -1, null);
//     await context.web.goto("https://books-pwakit.appspot.com/explore?q=catch%2022");
//     await context.web.waitForPageLoad();
//   });
//   afterEach(async function () {
//     await closeContext();
//   });

//   it("verify text exist in page", async function () {
//     let info = {};
//     info.log = "";
//     await context.web.verifyTextExistInPage("Joseph Heller's Catch-22");
//   });
//   it("verify text exist in page regex", async function () {
//     let info = {};
//     info.log = "";
//     await context.web.verifyTextExistInPage("Joseph Heller's /Catch-\\d+/");
//   });
// });
