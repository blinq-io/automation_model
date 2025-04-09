import path from "path";
import fs from "fs";
import { spawn } from "child_process";
import { _commandError, _commandFinally, _preCommand } from "./command_common.js";
import { Types } from "./stable_browser.js";

export async function executeBrunoRequest(requestName: string, options: any, context: any, world: any) {
  if (!options) {
    options = {};
  }
  const state = {
    locate: false,
    scroll: false,
    screenshot: false,
    highlight: false,
    throwError: true,
    operation: "bruno",
    text: "bruno " + requestName,
    _text: "bruno " + requestName,
    options: options,
    type: Types.BRUNO,
    world: world,
  };
  await _preCommand(state, context.web);
  try {
    let brunoFolder = options.brunoFolder || path.join(process.cwd(), "bruno");
    if (!options.brunoFolder) {
      throw new Error("brunoFolder is not defined, place your bruno folder in the current working directory.");
    }
    // generate a temporary folder .tmp under the project root
    const runtimeFolder = path.join(process.cwd(), ".tmp");
    if (!fs.existsSync(runtimeFolder)) {
      fs.mkdirSync(runtimeFolder);
    }
    // identify the bruno file
    const brunoFile = path.join(brunoFolder, `${requestName}.bru`);
    // check if the bruno file exists
    if (!fs.existsSync(brunoFile)) {
      throw new Error(`Bruno file not found: ${brunoFile}`);
    }
    const brunoConfigFile = path.join(brunoFolder, "bruno.json");
    // check if the bruno config file exists and copy it to the runtime folder
    if (fs.existsSync(brunoConfigFile)) {
      fs.copyFileSync(brunoConfigFile, path.join(runtimeFolder, "bruno.json"));
    }

    // read the bruno file
    let brunoFileContent = fs.readFileSync(brunoFile, "utf-8");
    // populate runtime variables
    brunoFileContent = await context.web._replaceWithLocalData(brunoFileContent, world);
    // write the bruno file to the runtime folder
    fs.writeFileSync(path.join(runtimeFolder, `${requestName}.bru`), brunoFileContent);
    const outputFile = path.join(runtimeFolder, `bruno_${context.web.stepIndex ? context.web.stepIndex : 0}.json`);
    if (fs.existsSync(outputFile)) {
      // remove the file if it exists
      fs.unlinkSync(outputFile);
    }
    const commandOptions = {
      cwd: runtimeFolder,
      env: {
        ...process.env,
      },
      stdio: "pipe",
      encoding: "utf-8",
    };
    const brunoFilePath = path.join(runtimeFolder, `${requestName}.bru`);
    const args = ["bru", "run", "--reporter-json", outputFile];
    // check if options.brunoArgs is defined
    if (options.brunoArgs) {
      // check if options.brunoArgs is an array
      if (Array.isArray(options.brunoArgs)) {
        // add the args to the command
        args.push(...options.brunoArgs);
      }
    }
    args.push(brunoFilePath);
    const { stdout, stderr } = await runCommand(args, commandOptions);
    // check if the command was successful
    if (!fs.existsSync(outputFile)) {
      if (stderr) {
        console.error(`Error executing Bruno request: ${stderr}`);
      }
      if (stdout) {
        console.log(`Bruno request executed successfully: ${stdout}`);
      }
      throw new Error(`Bruno request failed: ${stderr}`);
    }
    // read the output file
    const result = JSON.parse(fs.readFileSync(outputFile, "utf-8"));

    if (world && world.attach) {
      await world.attach(JSON.stringify(fs.readFileSync(outputFile, "utf-8")), "application/json+bruno");
    }
    if (context.reportFolder) {
      // copy the output file to the report folder
      const reportFile = path.join(
        context.reportFolder,
        `bruno_${context.web.stepIndex ? context.web.stepIndex : 0}.json`
      );
      fs.copyFileSync(outputFile, reportFile);
    }
    // validate result: totlaRequests === passedRequests, totalAssertions === passedAssertions, totalTests === passedTests
    /*
    [
  {
    "iterationIndex": 0,
    "summary": {
      "totalRequests": 1,
      "passedRequests": 1,
      "failedRequests": 0,
      "skippedRequests": 0,
      "totalAssertions": 0,
      "passedAssertions": 0,
      "failedAssertions": 0,
      "totalTests": 1,
      "passedTests": 1,
      "failedTests": 0
    },
    */
    if (!result || !Array.isArray(result) || result.length === 0) {
      throw new Error(`Bruno request failed: ${stderr}`);
    }
    const summary = result[0].summary;
    if (summary.totalRequests !== summary.passedRequests) {
      throw new Error(`Bruno request failed: ${stderr}`);
    }
    if (summary.totalAssertions !== summary.passedAssertions) {
      throw new Error(`Bruno request failed: ${stderr}`);
    }
    if (summary.totalTests !== summary.passedTests) {
      throw new Error(`Bruno request failed: ${stderr}`);
    }
    console.log(requestName + " - request executed successfully");
    console.log(`requests:     ${summary.passedRequests}/${summary.totalRequests}`);
    if (summary.totalAssertions > 0) {
      console.log(`assertions:   ${summary.passedAssertions}/${summary.totalAssertions}`);
    }
    if (summary.totalTests > 0) {
      console.log(`tests:        ${summary.passedTests}/${summary.totalTests}`);
    }
    return result;
  } catch (error) {
    await _commandError(state, error, context.web);
  } finally {
    _commandFinally(state, context.web);
  }
}

const runCommand = async (args: string[], options: any) => {
  return new Promise<{ stdout: string; stderr: string }>((resolve, reject) => {
    const child = spawn("npx", args, options);

    let stdout = "";
    let stderr = "";

    child.stdout?.on("data", (data) => {
      stdout += data.toString();
      //process.stdout.write(data);
    });

    child.stderr?.on("data", (data) => {
      stderr += data.toString();
      process.stderr.write(data);
    });

    child.on("error", (err) => {
      reject(err);
    });

    child.on("close", (code) => {
      if (code !== 0) {
        reject(new Error(`Process exited with code ${code}: ${stderr}`));
      } else {
        resolve({ stdout, stderr });
      }
    });
  });
};
