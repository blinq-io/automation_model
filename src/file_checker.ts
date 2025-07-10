import * as fs from "fs"; // sync fs
import * as path from "path";
import { promises as fsAsync } from "fs"; // async fs
import { _commandError, _commandFinally, _preCommand } from "./command_common.js";
import { Types } from "./stable_browser.js";

const checkFileAccess = (filePath: string, accessMode: number): Promise<boolean> => {
  return new Promise((resolve) => {
    fs.access(filePath, accessMode, (err) => {
      resolve(!err);
    });
  });
};

const getFileName = (filePath: string): string => {
  const platform = process.platform;
  return platform === "win32" ? filePath.split("\\").pop() || "" : filePath.split("/").pop() || "";
};

// Simplified regex check
function testForRegex(text: string): boolean {
  return text.startsWith("regex:");
}

export const verifyFileExists = async (filePath: string, options: any, context: any, world: any) => {
  if (!options) options = {};
  const fileName = getFileName(filePath);

  let isSoft = false;

  const match = filePath.match(/(soft:)?(regex:|exact:|contains:)(.*)/);

  if (match) {
    isSoft = !!match[1]; // true if 'soft:' is present
  }

  const state = {
    locate: false,
    scroll: false,
    screenshot: false,
    highlight: false,
    throwError: !isSoft, // don't throw error for soft assertions
    operation: "verifyFileExists",
    value: filePath,
    text: `Verify file ${fileName} exists`,
    options,
    type: Types.VERIFY_FILE_EXISTS,
    world,
  };

  await _preCommand(state, context.web);

  try {
    let pathToMatch = filePath;
    if (isSoft) {
      pathToMatch = filePath.replace(/^soft:/, ""); // remove soft: prefix for parsing
    }

    let dir: string;
    let input: string;

    if (pathToMatch.includes("regex:")) {
      const regexIndex = pathToMatch.indexOf("regex:");
      dir = pathToMatch.substring(0, regexIndex - 1); // remove trailing slash
      input = pathToMatch.substring(regexIndex);
    } else {
      const lastSlashIndex = pathToMatch.lastIndexOf("/");
      dir = pathToMatch.substring(0, lastSlashIndex);
      input = pathToMatch.substring(lastSlashIndex + 1);
    }

    if(isSoft) {
        dir = dir.slice(0, -5);
    }

    const files: string[] = await fsAsync.readdir(dir);
    let found = false;

    if (input.startsWith("exact:")) {
      const target = input.replace("exact:", "");
      found = files.includes(target);
    } else if (input.startsWith("contains:")) {
      const target = input.replace("contains:", "");
      found = files.some((f: string) => f.includes(target));
    } else if (input.startsWith("format:")) {
      const extension = input.replace("format:", "");
      found = files.some((f: string) => f.endsWith(`.${extension}`));
    } else if (testForRegex(input)) {
      let raw = input.replace("regex:", "").trim(); // e.g. "/file/i" or "file.*::i"
      let pattern = raw;
      let flags = "";

      if (raw.startsWith("/") && raw.lastIndexOf("/") > 0) {
        const lastSlash = raw.lastIndexOf("/");
        flags = raw.substring(lastSlash + 1);
        pattern = raw.substring(1, lastSlash);
      } else if (raw.includes("::")) {
        [pattern, flags] = raw.split("::");
      }

      console.log(`Regex pattern: ${pattern}, flags: ${flags}`);

      try {
        const regex = new RegExp(pattern, flags);
        found = files.some((f: string) => {
          const matched = regex.test(f);
          return matched;
        });
      } catch (regexError) {
        throw new Error(`Invalid regex pattern: ${pattern}`);
      }
    } else {
      // Fallback to exact path check
      found = await checkFileAccess(pathToMatch, fs.constants.F_OK);
    }

    if (!found) {
      console.log(`📁 Available files in '${dir}':`, files);
      if (!isSoft) {
        throw new Error(`No file matched the pattern: ${filePath}`);
      } else {
        console.warn(`Soft assertion failed for pattern: ${filePath}`);
      }
    } else {
      console.log(`File verification successful for pattern: ${input}`);
    }
  } catch (err) {
    await _commandError(state, err, context.web);
  } finally {
    await _commandFinally(state, context.web);
  }
};
