import { initContext, closeContext } from "../build/lib/auto_page.js";
import { expect } from "chai";
import fs from "fs";
import os from "os";
import path from "path";
import { pathToFileURL } from "url";

const makeTmpFileUrl = () => {
  const filePath = path.join(process.cwd(), "regression", "file_protocol_block.test.js");
  return pathToFileURL(filePath).href;
};

describe("file protocol blocking", function () {
  let originalRemoteRecorder;
  let fileUrl;

  beforeEach(function () {
    originalRemoteRecorder = process.env.REMOTE_RECORDER;
    fileUrl = makeTmpFileUrl();
  });

  afterEach(async function () {
    if (originalRemoteRecorder === undefined) {
      delete process.env.REMOTE_RECORDER;
    } else {
      process.env.REMOTE_RECORDER = originalRemoteRecorder;
    }
    await closeContext();
  });

  it("blocks file:// navigations when REMOTE_RECORDER=true", async function () {
    process.env.REMOTE_RECORDER = "true";
    const ctx = await initContext("", false, true);
    await new Promise((resolve) => setTimeout(resolve, 250)); // Wait for any initial navigations to complete
    const navError = await ctx.page.goto(fileUrl).catch((err) => err);

    await new Promise((resolve) => setTimeout(resolve, 5000)); // Wait for any navigation attempts to complete
    expect(navError).to.be.instanceOf(Error);
    expect(ctx.page.url()).to.not.match(/^file:\/\//);
  });

  it("allows file:// navigations when REMOTE_RECORDER is not true", async function () {
    delete process.env.REMOTE_RECORDER;
    const ctx = await initContext("", false, true);

    const response = await ctx.page.goto(fileUrl);

    expect(response?.ok()).to.equal(true);
    expect(ctx.page.url()).to.equal(fileUrl);
  });

  it("kicks back to about:blank on in-page file:// redirect", async function () {
    process.env.REMOTE_RECORDER = "true";
    const ctx = await initContext("", false, true);

    await ctx.page.setContent("<p>start</p>");
    await ctx.page.evaluate((url) => {
      window.location.href = url;
    }, fileUrl);

    await ctx.page.waitForTimeout(250);
    expect(ctx.page.url()).to.equal("about:blank");
  });
});
