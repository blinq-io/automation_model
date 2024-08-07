// @ts-nocheck
type Change = { css: string; changes: { role: string } };
declare const document: Document & {
  selectors: Change[] | null;
  tableSelector: string | null;
  processTableQuery: TprocessTableQuery;
};
const selectors = null;
document.selectors = selectors;
const tableSelector = null;
document.tableSelector = tableSelector;

function getTableData(table: Element) {
  const tableData = {
    rowsCount: 0,
    columnsCount: 0,
    columnNames: [],
    rows: [],
  };
  let columnheader: HTMLElement[] = [];
  //const rowheader = rows[0];
  columnheader = Array.from(table.querySelectorAll("th, [data-blinq-role='columnheader'], [role='columnheader']"));
  console.log("columnheader length", columnheader.length);
  let columnsCount = columnheader.length;
  const columnNames = [];
  for (let i = 0; i < columnheader.length; i++) {
    const cell = columnheader[i];
    const cellText = cell.innerText;
    columnNames.push(cellText);
  }
  tableData.columnNames = columnNames;
  tableData.columnsCount = columnsCount;
  const rows = Array.from(table.querySelectorAll("tr, [data-blinq-role='row'], [role='row']"));
  const rowsCount = rows.length;

  for (let i = 0; i < rows.length; i++) {
    const row = rows[i];
    const cells: HTMLElement[] = Array.from(row.querySelectorAll("td, [data-blinq-role='cell'], [role='cell']"));
    const cellsTexts = [];
    console.log("cells count", cells.length);
    if (cells.length === 0) {
      continue;
    }
    for (let j = 0; j < cells.length; j++) {
      const cell = cells[j];
      const cellText = cell.innerText;
      cellsTexts.push(cellText);
    }
    tableData.rows.push(cellsTexts);
  }
  tableData.rowsCount = rowsCount;
  return tableData;
}
// @ts-ignore
document.getTableData = getTableData;

// locator                        | operator | value
// table.rows                     | >=       | 1
// table[1]["Availability"].text  | equals   | 100%
// table[*][2].text               |not_equals| error

function processTableQuery(table: Element, query: string) {
  if (document.selectors && document.selectors.length > 0) {
    for (let i = 0; i < document.selectors.length; i++) {
      const selector = document.selectors[i];
      const allElementsList = document.querySelectorAll(selector.css);
      const allElements = Array.from(allElementsList);
      for (let j = 0; j < allElements.length; j++) {
        const element = allElements[j];
        element.setAttribute("data-blinq-role", selector.changes.role);
      }
    }
  }

  const rows = Array.from(table.querySelectorAll("tr, [data-blinq-role='row'], [role='row']"));
  const _rows = rows.length;
  const _columnNames = [];
  let _columns: number = 0;
  let columnheader: HTMLElement[] = [];
  if (rows.length > 0) {
    //const rowheader = rows[0];
    columnheader = Array.from(table.querySelectorAll("th, [data-blinq-role='columnheader'], [role='columnheader']"));
    console.log("columnheader length", columnheader.length);
    _columns = columnheader.length;
    for (let i = 0; i < columnheader.length; i++) {
      const cell = columnheader[i];
      const cellText = cell.innerText;
      _columnNames.push(cellText);
    }
  }
  let _rowStartIndex = 0;
  // if (columnheader.length > 0) {
  //   tableData.rowStartIndex = 1;
  // }
  const tableData = {
    rows: _rows,
    columns: _columns,
    columnNames: _columnNames,
    rowStartIndex: _rowStartIndex,
  };
  if (query.startsWith("table.")) {
    const result = [];
    const property = query.substring(6);
    //console.log("property", property);
    // @ts-ignore
    const value = tableData[property];
    //console.log("value", value);
    result.push(value);
    return { cells: result };
  }
  const pattern = /^table\[(.+)\]\[(.+)\]\.(.+)$/;
  const match = query.match(pattern);
  if (!match) {
    return { error: "Invalid quary" };
  }
  const rowSelector = match[1];
  let columnSelector = match[2];
  const property = match[3];
  let selectedRows = [];
  if (rowSelector === "*") {
    selectedRows = rows;
  } else {
    // @ts-ignore
    if (isNaN(rowSelector)) {
      return { error: "Invalid row selector" };
    }
    const rowIndex = parseInt(rowSelector);
    if (rowIndex < 0 || rowIndex >= rows.length) {
      return { error: "Invalid row selector" };
    }
    selectedRows.push(rows[rowIndex]);
  }
  console.log("selectedRows count", selectedRows.length);
  const selectedCells: HTMLElement[] = [];
  // @ts-ignore
  if (isNaN(columnSelector)) {
    if (columnSelector.startsWith('"') && columnSelector.endsWith('"')) {
      columnSelector = columnSelector.substring(1, columnSelector.length - 1);
    } else if (columnSelector.startsWith("'") && columnSelector.endsWith("'")) {
      columnSelector = columnSelector.substring(1, columnSelector.length - 1);
    }

    if (columnheader.length === 0) {
      return { error: "No column header available" };
    }
    let foundHeader = null;
    for (let i = 0; i < columnheader.length; i++) {
      const cell = columnheader[i];
      const cellText = cell.innerText;
      console.log("cellText", cellText);
      if (cellText === columnSelector) {
        foundHeader = cell;
        break;
      }
    }
    if (!foundHeader) {
      for (let i = 0; i < columnheader.length; i++) {
        const cell = columnheader[i];
        const cellText = cell.innerText;
        console.log("cellText", cellText);
        if (cellText.includes(columnSelector)) {
          foundHeader = cell;
          break;
        }
      }
      if (!foundHeader) {
        return { error: "No column header found" };
      }
    }
    const foundHeaderRec = foundHeader.getBoundingClientRect();
    for (let i = 0; i < selectedRows.length; i++) {
      const row = selectedRows[i];
      const cells: HTMLElement[] = Array.from(row.querySelectorAll("td, [data-blinq-role='cell'], [role='cell']"));
      console.log("cells count", cells.length);
      for (let j = 0; j < cells.length; j++) {
        const cell = cells[j];
        const rec = cell.getBoundingClientRect();
        const xCenter = rec.left + rec.width / 2;
        if (foundHeaderRec.left <= xCenter && xCenter <= foundHeaderRec.right) {
          selectedCells.push(cell);
        }
      }
    }
  } else {
    const columnIndex = parseInt(columnSelector);
    if (columnIndex < 0 || columnIndex >= columnheader.length) {
      return { error: "Column index out of bounds" };
    }
    for (let i = 0; i < selectedRows.length; i++) {
      const row = selectedRows[i];
      const cells: HTMLElement[] = Array.from(row.querySelectorAll("td, [data-blinq-role='cell'], [role='cell']"));
      selectedCells.push(cells[columnIndex]);
    }
  }
  let rect: DOMRect | null = null;
  const result = [];
  for (let i = 0; i < selectedCells.length; i++) {
    let added = false;
    if (property === "element") {
      added = true;
      result.push(selectedCells[i]);
    } else {
      if (property === "text" || property === "innerText") {
        added = true;
        result.push(selectedCells[i].innerText);
      } else {
        if (selectedCells[i].hasAttribute(property)) {
          added = true;
          result.push(selectedCells[i].getAttribute(property));
        } else {
          added = true;
          // @ts-ignore
          result.push(selectedCells[i][property]);
        }
      }
      if (added) {
        rect = rect ? merge(rect, selectedCells[i].getBoundingClientRect()) : selectedCells[i].getBoundingClientRect();
      }
    }
  }
  return { cells: result, rect };
}
const merge = (rec1: DOMRect, rec2: DOMRect) => {
  const x = Math.min(rec1.left, rec2.left);
  const y = Math.min(rec1.top, rec2.top);
  const width = Math.max(rec1.right, rec2.right) - x;
  const height = Math.max(rec1.bottom, rec2.bottom) - y;
  return { x, y, width, height } as DOMRect;
};
// @ts-ignore
document.processTableQuery = processTableQuery;
type TprocessTableQuery = typeof processTableQuery;
// export type {TprocessTableQuery}
