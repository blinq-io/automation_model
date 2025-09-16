import * as fs from "fs"; // sync fs
import * as path from "path";
import { promises as fsAsync } from "fs"; // async fs
import { _commandError, _commandFinally, _preCommand } from "./command_common.js";
import { Types } from "./stable_browser.js";
import { replaceWithLocalTestData } from "./utils.js";

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
    filePath = (await replaceWithLocalTestData(filePath, world, true, false, context, context.web, false)) as string;
  } catch (err) {
    // Ignore error
  }

  try {
    let pathToMatch = filePath;
    if (isSoft) {
      pathToMatch = filePath.replace(/^soft:/, ""); // remove soft: prefix for parsing
    }

    let dir: string;
    let input: string;
    console.log("pathSeparator", path.sep);
    if (pathToMatch.includes("regex:")) {
      const regexIndex = pathToMatch.indexOf("regex:");
      // Handle both forward slashes and backslashes before regex:
      let dirPart = pathToMatch.substring(0, regexIndex);
      // Remove trailing slash/backslash
      if (dirPart.endsWith("/") || dirPart.endsWith("\\")) {
        dirPart = dirPart.slice(0, -1);
      }
      dir = dirPart;
      input = pathToMatch.substring(regexIndex);
    } else {
      // Use path.sep to handle both forward and backward slashes
      const pathSeparator = path.sep;
      const lastSlashIndex = pathToMatch.lastIndexOf(pathSeparator);

      // If no separator found, try the other separator (for mixed paths)
      if (lastSlashIndex === -1) {
        const alternativeSeparator = pathSeparator === "/" ? "\\" : "/";
        const altLastSlashIndex = pathToMatch.lastIndexOf(alternativeSeparator);
        if (altLastSlashIndex !== -1) {
          dir = pathToMatch.substring(0, altLastSlashIndex);
          input = pathToMatch.substring(altLastSlashIndex + 1);
        } else {
          // No separator found, assume current directory
          dir = ".";
          input = pathToMatch;
        }
      } else {
        dir = pathToMatch.substring(0, lastSlashIndex);
        input = pathToMatch.substring(lastSlashIndex + 1);
      }
    }

    if (isSoft) {
      dir = dir.slice(0, -5);
    }

    console.log(`Directory to check: ${dir}`);
    console.log(`Input pattern: ${input}`);

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

      // Normalize delimiters: convert backslash delimiters to forward slash delimiters
      // This preserves the regex pattern while standardizing the delimiter format
      if (raw.startsWith("\\") && raw.lastIndexOf("\\") > 0) {
        // Convert \pattern\flags to /pattern/flags format
        const lastBackslash = raw.lastIndexOf("\\");
        const patternPart = raw.substring(1, lastBackslash);
        const flagsPart = raw.substring(lastBackslash + 1);
        raw = `/${patternPart}/${flagsPart}`;
      }

      // Now handle the standardized format
      if (raw.startsWith("/") && raw.lastIndexOf("/") > 0) {
        // Standard regex format: /pattern/flags
        const lastSlash = raw.lastIndexOf("/");
        flags = raw.substring(lastSlash + 1);
        pattern = raw.substring(1, lastSlash);
      } else if (raw.includes("::")) {
        // Alternative format: pattern::flags
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
      console.log(`Available files in '${dir}':`, files);
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
