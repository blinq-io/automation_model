import { fileURLToPath } from "url";
import path from "path";
import { ElementHandle, Page } from "playwright";
import fs from "fs";
const __filename = fileURLToPath(import.meta.url);
const currentDir = path.dirname(__filename);
interface AnalyzeResult {
  status: boolean;
  cells: any[];
  error: string;
  cellIndex: number;
  rowIndex: number;
}

export class Table {
  private tableData: any;
  constructor() {}
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
  async initFromElement(page: Page, tableElement: ElementHandle) {
    let script = fs.readFileSync(path.join(currentDir, "locator.js"), "utf8");
    // run the script inside the element context (iframe)
    await tableElement.evaluate(script);
    try {
      // @ts-ignore
      this.tableData = await tableElement.evaluate((_node) => {
        // @ts-ignore
        return document.getTableData2(_node as Element);
      });
    } catch (error) {
      throw error;
    }
  }

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
  // define the reault object structure
  analyze(analyzeObject: any): AnalyzeResult {
    let result: AnalyzeResult = {
      status: false,
      cells: [],
      error: "",
      cellIndex: -1,
      rowIndex: -1,
    };
    switch (analyzeObject.type) {
      case "VALIDATE_HEADER":
        result.cellIndex = _searchStringArrayInCellsArray(analyzeObject.cells, this.tableData.columnHeaders);
        result.status = result.cellIndex !== -1;
        if (result.status) {
          result.cells = this.tableData.columnHeaders;
          result.cellIndex = result.cellIndex;
        }
        return result;
      case "FIND_ROW":
        for (let i = 0; i < this.tableData.rows.length; i++) {
          const index = _searchStringArrayInCellsArray(analyzeObject.cells, this.tableData.rows[i].children);
          if (index !== -1) {
            result.status = true;
            result.cells = this.tableData.rows[i];
            result.rowIndex = i;
            result.cellIndex = index;
            return result;
          }
        }
        // ts-ignore
        result.error = "Row not found";
        return result;
      case "VALIDATE_CELL": {
        if (
          //!analyzeObject.column_name ||
          !analyzeObject.row_anchor_value ||
          !analyzeObject.expected_value
        ) {
          result.error = "Missing parameters, expected: row_anchor_value, expected_value";
          return result;
        }
        // find all the rows that contain the row_anchor_value
        let rows = [];
        for (let i = 0; i < this.tableData.rows.length; i++) {
          if (
            _searchStringArrayInCellsArray([analyzeObject.row_anchor_value], this.tableData.rows[i].children) !== -1
          ) {
            rows.push(this.tableData.rows[i]);
          }
        }
        if (rows.length === 0) {
          result.error = "Row containing the anchor value not found";
          return result;
        }
        // within the found rows find a cell with the expected value
        for (let i = 0; i < rows.length; i++) {
          const index = _searchStringArrayInCellsArray([analyzeObject.expected_value], rows[i].children);
          if (index !== -1) {
            result.status = true;
            result.cells = rows[i].children[index];
            result.rowIndex = i;
            result.cellIndex = index;
            return result;
          }
        }
        result.error = "Cell not found";
        return result;
      }
      case "GET_COLUMN_DATA": {
        let columnIndex = -1;
        if (!analyzeObject.column_name && !analyzeObject.column_index) {
          result.error = "Missing parameters, expected: column_name or column_index";
          return result;
        }
        if (analyzeObject.column_index) {
          columnIndex = analyzeObject.column_index;
        } else if (analyzeObject.column_name) {
          columnIndex = _searchStringArrayInCellsArray([analyzeObject.column_name], this.tableData.columnHeaders);
        }
        if (columnIndex === -1) {
          result.error = "Column not found";
          return result;
        }
        for (let i = this.tableData.headerRowsCount; i < this.tableData.rows.length; i++) {
          if (this.tableData.rows[i].children[columnIndex]) {
            result.cells.push(this.tableData.rows[i].children[columnIndex].text);
          }
        }
        result.status = true;
        return result;
      }
      case "VALIDATE_COLUMN_DATA": {
        analyzeObject.type = "GET_COLUMN_DATA"; // reuse the logic of GET_COLUMN_DATA
        const columnDataResult = this.analyze(analyzeObject);
        if (!columnDataResult.status) {
          return columnDataResult; // return the error if column data is not found
        }
        if (analyzeObject.validation === "ascending") {
          for (let i = 0; i < columnDataResult.cells.length - 1; i++) {
            if (columnDataResult.cells[i] >= columnDataResult.cells[i + 1]) {
              result.status = false;
              result.error = `rows ${i} and ${i + 1} are not in ascending order: ${columnDataResult.cells[i]} >= ${columnDataResult.cells[i + 1]}`;
              return result;
            }
          }
          result.status = true;
          return result;
        } else if (analyzeObject.validation === "descending") {
          for (let i = 0; i < columnDataResult.cells.length - 1; i++) {
            if (columnDataResult.cells[i] <= columnDataResult.cells[i + 1]) {
              result.status = false;
              result.error = `rows ${i} and ${i + 1} are not in descending order: ${columnDataResult.cells[i]} <= ${columnDataResult.cells[i + 1]}`;
              return result;
            }
          }
          result.status = true;
          return result;
        } else if (analyzeObject.validation === "check_filter") {
          const filter = analyzeObject.filter_text;
          if (!filter) {
            result.error = "Missing filter parameter";
            return result;
          }
          // if one of the cells does not contain the filter text, return false
          for (let i = 0; i < columnDataResult.cells.length; i++) {
            if (!columnDataResult.cells[i].includes(filter)) {
              result.status = false;
              result.error = `Cell ${i} does not contain the filter text: ${filter}`;
              return result;
            }
          }
          result.status = true;
          return result;
        } else {
          result.error = "Unknown validation type: " + analyzeObject.validation;
          return result;
        }
      }
      default:
        throw new Error("Unknown analyzeObject type: " + analyzeObject.type);
    }
  }
}
const _compareStringArrayWithCellsArray = (stringArray: (string | RegExp)[], cellsArray: any[]) => {
  if (!stringArray || !cellsArray) {
    return -1;
  }
  if (stringArray.length !== cellsArray.length) {
    return -1;
  }
  let i = 0;
  for (; i < stringArray.length; i++) {
    if (stringArray[i] instanceof RegExp) {
      // @ts-ignore
      if (!stringArray[i].test(cellsArray[i].text)) {
        return -1;
      }
    } else {
      if (stringArray[i] !== cellsArray[i].text) {
        return -1;
      }
    }
  }
  return i - stringArray.length;
};
const _searchStringArrayInCellsArray = (stringArray: (string | RegExp)[], cellsArray: any[]) => {
  if (!stringArray || !cellsArray) {
    return -1;
  }
  if (stringArray.length > cellsArray.length) {
    return -1;
  }
  // search using _compareStringArrayWithCellsArray
  for (let i = 0; i < cellsArray.length - stringArray.length + 1; i++) {
    const index = _compareStringArrayWithCellsArray(stringArray, cellsArray.slice(i, i + stringArray.length));
    if (index !== -1) {
      return index + i;
    }
  }
  return -1;
};
