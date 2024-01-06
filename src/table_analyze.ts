import fs from "fs";
import path from "path";
import type { Page, ElementHandle } from "playwright";
// import type {TprocessTableQuery} from "./locator.js"
// type Change = {css:string, changes:{role:string}};
// declare const document: Document & { selectors: Change[] ; tableSelector: string; processTableQuery: TprocessTableQuery };
function stringifyObject(obj: unknown, indentation = 0) {
  let result = "";
  const indent = " ".repeat(indentation);
  if (Array.isArray(obj)) {
    result += "[";
    for (let i = 0; i < obj.length; i++) {
      result += (i > 0 ? ", " : "") + stringifyObject(obj[i], indentation + 2);
    }
    result += "]";
  } else if (typeof obj === "object" && obj !== null) {
    result += "{";
    let first = true;
    for (let key in obj) {
      // eslint-disable-next-line no-prototype-builtins
      if (obj.hasOwnProperty(key)) {
        result +=
          (first ? "\n" : ",\n") +
          indent +
          "  " +
          JSON.stringify(key) +
          ": " +
          // @ts-ignore
          stringifyObject(obj[key], indentation + 2);
        first = false;
      }
    }
    result += "\n" + indent + "}";
  } else {
    result += JSON.stringify(obj);
  }
  return result;
}
const __filename = new URL(import.meta.url).pathname;
const currentDir = path.dirname(__filename);
const getTableCells = async (page: Page, element: ElementHandle, tableSelector: any, info: any = {}) => {
  let script = fs.readFileSync(path.join(currentDir, "locator.js"), "utf8");
  let aiConfigPath = path.join(process.cwd(), "ai_config.json");
  if (fs.existsSync(aiConfigPath)) {
    let aiConfig = JSON.parse(fs.readFileSync(aiConfigPath, "utf8"));
    if (aiConfig.changes) {
      script = script.replace("const selectors = null", "const selectors = " + stringifyObject(aiConfig.changes));
    }
  }
  script = script.replace("const tableSelector = null", "const tableSelector = " + stringifyObject(tableSelector));
  // run the script inside the element context (iframe)
  await element.evaluate(script);
  try {
    // @ts-ignore
    let result = await element.evaluate((_node) => {
      // @ts-ignore
      console.log("tableSelector", document.tableSelector);
      // @ts-ignore
      return document.processTableQuery(_node as Element, document.tableSelector);
    });
    // @ts-ignore
    info.box = result.rect;
    info.cells = result.cells;
    info.error = result.error;
    if (result.error) {
      return { error: result.error };
    }
    return result.cells;
  } catch (error) {
    console.log("error", error);
    throw error;
  }
};

export { getTableCells };
