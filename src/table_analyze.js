import fs from "fs";
import path from "path";

function stringifyObject(obj, indentation = 0) {
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
const getTableCells = async (page, element, tableSelector, info = {}) => {
  let script = fs.readFileSync(path.join(currentDir, "locator.js"), "utf8");
  let aiConfigPath = path.join(process.cwd(), "ai_config.json");
  if (fs.existsSync(aiConfigPath)) {
    let aiConfig = JSON.parse(fs.readFileSync(aiConfigPath, "utf8"));
    if (aiConfig.changes) {
      script = script.replace("const selectors = null", "const selectors = " + stringifyObject(aiConfig.changes));
    }
  }
  script = script.replace("const tableSelector = null", "const tableSelector = " + stringifyObject(tableSelector));
  await page.evaluate(script);
  try {
    let result = await element.evaluate((_node) => {
      console.log("tableSelector", document.tableSelector);
      return document.processTableQuary(_node, document.tableSelector);
    });
    info.box = result.rect;
    return result.cells;
  } catch (error) {
    console.log("error", error);
    throw error;
  }
};

export { getTableCells };
