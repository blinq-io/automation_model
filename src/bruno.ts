import path from "path";
import fs from "fs";
import { spawn } from "child_process";
import { _commandError, _commandFinally, _preCommand } from "./command_common.js";
import { Types } from "./stable_browser.js";
//@ts-ignore
import { bruToEnvJsonV2 } from "@usebruno/lang";
import objectPath from "object-path";
import { replaceWithLocalTestData } from "./utils.js";
// import { decrypt } from "./utils.js";

interface BrunoConfig {
  version: string;
  name: string;
  type: string;
  ignore: string[];
  scripts?: {
    filesystemAccess: {
      allow: boolean;
    };
  };
}

export async function loadBrunoParams(context: any, environmentName: any) {
  // check if bruno/environment folder exists
  // if exists find an environment that matches the current environment
  const brunoEnvironmentsFolder = path.join(process.cwd(), "bruno", "environments");
  if (!fs.existsSync(brunoEnvironmentsFolder)) {
    return;
  }

  const envFiles = fs.readdirSync(brunoEnvironmentsFolder);
  for (const envFile of envFiles) {
    if (envFile.endsWith(".bru")) {
      //rename it to end with .bruEnv
      fs.renameSync(
        path.join(brunoEnvironmentsFolder, envFile),
        path.join(brunoEnvironmentsFolder, envFile.replace(".bru", ".bruEnv"))
      );
    }
  }

  const envFile = path.join(brunoEnvironmentsFolder, `${environmentName}.bruEnv`);
  if (!fs.existsSync(envFile)) {
    return;
  }

  const envFileContent = fs.readFileSync(envFile, "utf-8");
  try {
    const envJson = bruToEnvJsonV2(envFileContent);
    if (!envJson) {
      return;
    }
    const variables = envJson.variables;
    for (const variable of variables) {
      if (variable.enabled && variable.value) {
        context.web.setTestData({ [variable.name]: variable.value }, context.web);
      }
    }
  } catch (e) {
    console.error("Error parsing Bruno environment file", e);
  }
}

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
  const filesToDelete = [];
  try {
    let brunoFolder = options.brunoFolder || path.join(process.cwd(), "bruno");
    if (!brunoFolder) {
      throw new Error("brunoFolder is not defined, place your bruno folder in the current working directory.");
    }
    // generate a temporary folder .tmp under the project root
    const resultFolder = path.join(process.cwd(), ".tmp");
    if (!fs.existsSync(resultFolder)) {
      fs.mkdirSync(resultFolder);
    }

    const runtimeFolder = process.cwd();
    // link node_modules to the runtime folder
    //const nodeModulesFolder = path.join(process.cwd(), "node_modules");
    // if (fs.existsSync(nodeModulesFolder)) {
    //   // check if the node_modules folder exists
    //   const runtimeNodeModulesFolder = path.join(runtimeFolder, "node_modules");
    //   if (!fs.existsSync(runtimeNodeModulesFolder)) {
    //     // create a symbolic link to the node_modules folder
    //     fs.symlinkSync(nodeModulesFolder, runtimeNodeModulesFolder, "dir");
    //   }
    // }

    // identify the bruno file
    const brunoFile = path.join(brunoFolder, `${requestName}.bru`);
    // check if the bruno file exists
    if (!fs.existsSync(brunoFile)) {
      throw new Error(`Bruno file not found: ${brunoFile}`);
    }
    const brunoConfigFile = path.join(brunoFolder, "bruno.json");
    let brunoConfig: BrunoConfig = {
      version: "1",
      name: "blinq",
      type: "collection",
      ignore: ["node_modules", ".git"],
    };
    // check if the bruno config file exists and copy it to the runtime folder
    if (fs.existsSync(brunoConfigFile)) {
      // read the bruno config file
      brunoConfig = JSON.parse(fs.readFileSync(brunoConfigFile, "utf-8"));
      if (!brunoConfig.scripts) {
        brunoConfig.scripts = {
          filesystemAccess: {
            allow: true,
          },
        };
      }
    }
    const brunoConfigFileName = path.join(runtimeFolder, "bruno.json");
    const brunoConfigFileBackup = path.join(resultFolder, "bruno.json");
    filesToDelete.push(brunoConfigFileName);
    fs.writeFileSync(brunoConfigFileName, JSON.stringify(brunoConfig, null, 2));
    fs.writeFileSync(brunoConfigFileBackup, JSON.stringify(brunoConfig, null, 2));

    let expectRuntime = false;
    // read the bruno file
    let brunoFileContent = fs.readFileSync(brunoFile, "utf-8");
    // populate runtime variables
    //brunoFileContent = await context.web._replaceWithLocalData(brunoFileContent, world);
    brunoFileContent = await replaceWithLocalTestData(brunoFileContent, world, true, true, context, context.web, false);

    // inject code to extract runtime variables
    // first find the script:post-response
    const scriptPostResponse = brunoFileContent.indexOf("script:post-response {");
    if (scriptPostResponse !== -1) {
      // need to search a new line follow by }
      // find the end of the script
      const scriptEnd = brunoFileContent.indexOf("\n}", scriptPostResponse);
      // extract the script
      const script = brunoFileContent.substring(scriptPostResponse, scriptEnd + 2);
      // extract all the variables key names: bru.setVar("key", value)
      const variables: string[] = [];
      const regex = /bru\.setVar\("([^"]+)",/g;
      let match;
      while ((match = regex.exec(script)) !== null) {
        // check if the variable is already in the list
        if (!variables.includes(match[1])) {
          variables.push(match[1]);
        }
      }
      const regex1 = /bru\.setEnvVar\("([^"]+)",/g;
      while ((match = regex.exec(script)) !== null) {
        // check if the variable is already in the list
        if (!variables.includes(match[1])) {
          variables.push(match[1]);
        }
      }
      // check if the variables are not empty
      if (variables.length > 0) {
        expectRuntime = true;
        let scriptVariables = "const runtimeVariables = {};\n";
        // iterate over the variables and create a script to extract them
        for (const variable of variables) {
          scriptVariables += `  runtimeVariables["${variable}"] = bru.getVar("${variable}");\n`;
        }
        const fsRqureExists = script.indexOf("fs = require('fs');") !== -1;
        // check if the variable is not empty
        // replace the script with the modified one
        brunoFileContent = brunoFileContent.replace(
          script,
          `script:post-response {
  ${fsRqureExists ? "" : "const fs = require('fs')"};
  // inject code to extract runtime variables
  ${script.substring(script.indexOf("{") + 1, script.lastIndexOf("}"))}
  // write the runtime variables to a file
  ${scriptVariables}
  fs.writeFileSync("${path.join(runtimeFolder, "runtime.json")}", JSON.stringify(runtimeVariables, null, 2));
}`
        );
      }
    }

    // write the bruno file to the runtime folder
    const executeBruFile = path.join(runtimeFolder, `${requestName}.bru`);
    const executeBruFileBackup = path.join(resultFolder, `${requestName}.bru`);
    filesToDelete.push(executeBruFile);
    fs.writeFileSync(executeBruFile, brunoFileContent);
    fs.writeFileSync(executeBruFileBackup, brunoFileContent);
    const outputFile = path.join(resultFolder, `bruno_${context.web.stepIndex ? context.web.stepIndex : 0}.json`);
    if (fs.existsSync(outputFile)) {
      // remove the file if it exists
      fs.unlinkSync(outputFile);
    }
    // if the runtime.json file exists, remove it
    const runtimeFile = path.join(runtimeFolder, "runtime.json");
    filesToDelete.push(runtimeFile);
    if (fs.existsSync(runtimeFile)) {
      // remove the file if it exists
      fs.unlinkSync(runtimeFile);
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
    if (
      result &&
      result.length > 0 &&
      result[0] &&
      result[0].results &&
      result[0].results.length > 0 &&
      result[0].results[0].error
    ) {
      console.error(`Error executing Bruno request: ${result[0].results[0].error}`);
      throw new Error(`Bruno request failed: ${result[0].results[0].error}`);
    }
    if (!result || !Array.isArray(result) || result.length === 0) {
      throw new Error(`Bruno request failed: ${stderr}`);
    }
    const summary = result[0].summary;
    if (summary.totalRequests !== summary.passedRequests) {
      throw new Error(`Bruno request failed: ${stderr}`);
    }
    if (summary.totalAssertions !== summary.passedAssertions) {
      let assertionError = "";
      if (result[0].results && result[0].results.length > 0 && result[0].results[0].assertionResults) {
        for (const assertion of result[0].results[0].assertionResults) {
          if (assertion.error) {
            assertionError += assertion.error + "\n";
          }
        }
      }
      throw new Error(`Bruno request failed: ${assertionError}`);
    }
    let testsError = "";
    if (summary.totalTests !== summary.passedTests) {
      testsError = "";
      if (result[0].results && result[0].results.length > 0 && result[0].results[0].testResults) {
        for (const testResult of result[0].results[0].testResults) {
          if (testResult.error) {
            testsError += testResult.error + "\n";
          }
        }
      }
      throw new Error(`Bruno tests failed: ${testsError}`);
    }
    console.log(requestName + " - request executed successfully");
    console.log(`requests:     ${summary.passedRequests}/${summary.totalRequests}`);
    if (summary.totalAssertions > 0) {
      console.log(`assertions:   ${summary.passedAssertions}/${summary.totalAssertions}`);
    }
    if (summary.totalTests > 0) {
      console.log(`tests:        ${summary.passedTests}/${summary.totalTests}`);
    }
    if (!options.brunoScope) {
      options.brunoScope = "bruno";
    }
    const data: Record<string, any> = {};
    let scope = options.brunoScope;
    data[scope] = result[0].results[0];
    // check for vars:post-response {
    const varsPostResponse = brunoFileContent.indexOf("vars:post-response {");
    if (varsPostResponse !== -1) {
      // need to search a new line follow by }
      const varsEnd = brunoFileContent.indexOf("\n}", varsPostResponse);
      // extract the script remove the open { and the close }
      const script = brunoFileContent.substring(varsPostResponse + 20, varsEnd);
      // the result loolks like this:
      // aaaa: res.body.data.guid
      // bbbb: res.body.data.guid2
      const lines = script.split("\n");
      for (const line of lines) {
        const trimmedLine = line.trim();
        if (trimmedLine.length === 0) {
          continue;
        }
        // split the line by :
        const parts = trimmedLine.split(":");
        if (parts.length !== 2) {
          continue;
        }
        const key = parts[0].trim();
        let opath = parts[1].trim();
        // check if the value is a variable
        let path = opath.replace(/res\.body\./g, "response.data.").split(".");
        const value = objectPath.get(result[0].results[0], path);
        if (value) {
          data[key] = value;
        }
      }
    }

    context.web.setTestData(data, world);
    // if the expectRuntime is true, read the runtime.json file
    if (expectRuntime) {
      // check if the runtime.json file exists
      if (fs.existsSync(runtimeFile)) {
        // read the runtime.json file
        const runtimeData = JSON.parse(fs.readFileSync(runtimeFile, "utf-8"));
        // set test data
        context.web.setTestData(runtimeData, world);
      }
    }
    return result;
  } catch (error) {
    await _commandError(state, error, context.web);
  } finally {

    // delete the files to delete
    for (const file of filesToDelete) {
      if (fs.existsSync(file)) {
        fs.unlinkSync(file);
      }
    }
    await _commandFinally(state, context.web);
  }
}

const runCommand = async (args: string[], options: any) => {
  return new Promise<{ stdout: string; stderr: string }>((resolve, reject) => {
    const _cmd = process.platform === "win32" ? "npx.cmd" : "npx";
    const _options = process.platform === "win32" ? { ...options, shell: true } : options;
    const child = spawn(_cmd, args, _options);

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
      // if (code !== 0) {
      //   reject(new Error(`Process exited with code ${code}: ${stderr}`));
      // } else {
      resolve({ stdout, stderr });
      //}
    });
  });
};
