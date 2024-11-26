import { fileURLToPath } from "url";
import path from "path";
import { ElementHandle, Page } from "playwright";
import fs from "fs";
const __filename = fileURLToPath(import.meta.url);
const currentDir = path.dirname(__filename);
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

  analyze(analyzeObject: any) {
    let result = { status: false, cells: null, error: "", cellIndex: -1, rowIndex: -1 };
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
        for (let i = 1; i < this.tableData.rows.length; i++) {
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
      case "VALIDATE_GRID": {
        // const rowResult = this.analyze({
        //   type: "FIND_ROW",
        //   cells: analyzeObject.grid[0],
        // });
        // if (!rowResult.status) {
        //   result.error = "First row not found";
        //   return result;
        // }
        // if (analyzeObject.grid.length !== this.tableData.rows.length) {
        //   return result;
        // }
        // for (let i = 0; i < analyzeObject.grid.length; i++) {
        //   if (i === 0) {
        //     const index = _searchStringArrayInCellsArray(analyzeObject.grid[i], this.tableData.rows[i].children);

        //     if (!_searchStringArrayInCellsArray(analyzeObject.grid[i], this.tableData.rows[i].children)) {
        //       return result;
        //     }
        //   }
        //   result.status = true;
        //   result.cells = this.tableData.rows;
        return result;
      }

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
