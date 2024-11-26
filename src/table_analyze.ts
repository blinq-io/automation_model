import fs from "fs";
import path from "path";
import type { Page, ElementHandle } from "playwright";
import { fileURLToPath } from "url";
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
const __filename = fileURLToPath(import.meta.url);
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
const getTableData = async (page: Page, element: ElementHandle) => {
  let script = fs.readFileSync(path.join(currentDir, "locator.js"), "utf8");
  // run the script inside the element context (iframe)
  await element.evaluate(script);
  try {
    // @ts-ignore
    let result = await element.evaluate((_node) => {
      // @ts-ignore
      return document.getTableData(_node as Element);
    });
    return result;
  } catch (error) {
    console.log("error", error);
    throw error;
  }
};
/* result object looks as follows:
{
  "rowsCount": 5,
  "columnsCount": 8,
  "nodes": [
    {
      "tag": "TR",
      "role": "row",
      "rec": [
        160.1171875,
        726.5234375,
        274.2578125,
        28.5
      ],
      "children": [
        {
          "tag": "TH",
          "role": "columnheader",
          "rec": [
            160.1171875,
            726.5234375,
            54.6171875,
            28.5
          ],
          "children": [],
          "text": "Family"
        },
        ...
*/
const getTableData2 = async (page: Page, element: ElementHandle) => {
  let script = fs.readFileSync(path.join(currentDir, "locator.js"), "utf8");
  // run the script inside the element context (iframe)
  await element.evaluate(script);
  try {
    // @ts-ignore
    let result = await element.evaluate((_node) => {
      // @ts-ignore
      return document.getTableData2(_node as Element);
    });
    return result;
  } catch (error) {
    console.log("error", error);
    throw error;
  }
};
/*
analyzeObject examples:
	{
		type: “VALIDATE_HEADER”,		cells: [“Name”, “Values”]
	},
	{
		type: “FIND_ROW”,
		cells: [/.+/, “AAA”]
	},
	{
		type: “VALIDATE_GRID”,
		grid: [[],[]]
	},
	{
		type: “VALIDATE_CELL”,
		column_name: “Aaa”,
		column_search_name:
		row_search_value
		expected_value
	}
*/
const analyzeTable = async (page: Page, element: ElementHandle, analyzeObject: any) => {
  const tableData = await getTableData(page, element);
  let result = { status: false, cells: null };
  switch (analyzeObject.type) {
    case "VALIDATE_HEADER":
      result.status = _searchStringArrayInCellsArray(analyzeObject.cells, tableData.columnHeaders);
      if (result.status) {
        result.cells = tableData.columnHeaders;
      }
      return result;
    case "FIND_ROW":
      for (let i = 1; i < tableData.rows.length; i++) {
        if (_searchStringArrayInCellsArray(analyzeObject.cells, tableData.rows[i])) {
          result.status = true;
          result.cells = tableData.rows[i];
          break;
        }
      }
      return result;
    case "VALIDATE_GRID":
      if (analyzeObject.grid.length !== tableData.rows.length) {
        return result;
      }
      for (let i = 0; i < analyzeObject.grid.length; i++) {
        if (!_compareStringArrayWithCellsArray(analyzeObject.grid[i], tableData.rows[i])) {
          return result;
        }
      }
      result.status = true;
      result.cells = tableData.rows;
      return result;
    // case "VALIDATE_CELL":
    //   for (let i = 0; i < tableData[0].length; i++) {
    //     if (tableData[0][i] === analyzeObject.column_name) {
    //       for (let j = 1; j < tableData.length; j++) {
    //         if (_compareStringArrayWithCellsArray([analyzeObject.column_search_name], tableData[j])) {
    //           return tableData[j][i] === analyzeObject.expected_value;
    //         }
    //       }
    //     }
    //   }
    //   return false;
    default:
      throw new Error("Unknown analyzeObject type: " + analyzeObject.type);
  }
};
const _compareStringArrayWithCellsArray = (stringArray: (string | RegExp)[], cellsArray: any[]) => {
  if (!stringArray || !cellsArray) {
    return false;
  }
  if (stringArray.length !== cellsArray.length) {
    return false;
  }
  for (let i = 0; i < stringArray.length; i++) {
    if (stringArray[i] instanceof RegExp) {
      // @ts-ignore
      if (!stringArray[i].test(cellsArray[i])) {
        return false;
      }
    } else {
      if (stringArray[i] !== cellsArray[i]) {
        return false;
      }
    }
  }
  return true;
};
const _searchStringArrayInCellsArray = (stringArray: (string | RegExp)[], cellsArray: any[]) => {
  if (!stringArray || !cellsArray) {
    return false;
  }
  if (stringArray.length > cellsArray.length) {
    return false;
  }
  // search using _compareStringArrayWithCellsArray
  for (let i = 0; i < cellsArray.length - stringArray.length + 1; i++) {
    if (_compareStringArrayWithCellsArray(stringArray, cellsArray.slice(i, i + stringArray.length))) {
      return true;
    }
  }
  return false;
};

export { getTableCells, getTableData, getTableData2, analyzeTable };
