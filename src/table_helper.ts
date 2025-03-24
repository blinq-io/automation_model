import { Params } from "./utils";

export async function findHighestWithSameInnerText(cssSelector: string, scope: any, web: any) {
  await web._highlightElements(scope, cssSelector);

  const element = await scope.locator(cssSelector).first();
  if (!element) {
    throw new Error("header element not found");
  }
  const innerText = await element.innerText();
  // climb to the parent element until the innerText is changing, get the top element with the same innerText
  let climb = 0;
  let topElement = element;
  let elementCss = cssSelector;
  while (true) {
    climb++;
    // create a climb xpath: 1: .. 2: ../.. etc.
    const climbXpath = "xpath=" + "../".repeat(climb).slice(0, -1);
    const climbCss = elementCss + " >> " + climbXpath;
    const climbElement = await scope.locator(climbCss).first();
    if (!climbElement) {
      break;
    }
    const climbInnerText = await climbElement.innerText();
    if (climbInnerText !== innerText) {
      break;
    }
    topElement = climbElement;
    elementCss = climbCss;
  }
  return { element: topElement, cssSelector: elementCss, climb: climb, innerText: innerText };
}
export async function findCellRectangle(headerResult: any, rowResult: any, web: any, info: any) {
  await web.scrollIfNeeded(rowResult.element, info);
  // find the header cell and the row cell location
  const headerRect = await headerResult.element.boundingBox();
  const rowRect = await rowResult.element.boundingBox();
  if (!headerRect || !rowRect) {
    throw new Error("element not found");
  }
  // found there rectengle of cell that is in the header horizontal and the row vertical
  return {
    x: headerRect.x,
    y: rowRect.y,
    width: headerRect.width,
    height: rowRect.height,
  };
}
export async function _findCellArea(headerText: string, rowText: string, web: any, state: any) {
  const headerFoundElements = await web.findTextInAllFrames({}, {}, headerText, state);
  if (headerFoundElements.length === 0) {
    throw new Error("header not found");
  }
  if (headerFoundElements.length > 1) {
    throw new Error("multiple headers found");
  }
  const rowFoundElements = await web.findTextInAllFrames({}, {}, rowText, state);
  if (rowFoundElements.length === 0) {
    throw new Error("row not found");
  }
  if (rowFoundElements.length > 1) {
    throw new Error("multiple rows found");
  }
  const headerScope = headerFoundElements[0].frame;
  const headerResult = await findHighestWithSameInnerText(
    `[data-blinq-id-${headerFoundElements[0].randomToken}]`,
    headerScope,
    web
  );
  const rowScope = rowFoundElements[0].frame;
  const rowResult = await findHighestWithSameInnerText(
    `[data-blinq-id-${rowFoundElements[0].randomToken}]`,
    rowScope,
    web
  );
  return await findCellRectangle(headerResult, rowResult, web, state.info);
}
export async function findElementsInArea(cssSelector: string, area: any, web: any, options: any) {
  if (!cssSelector) {
    cssSelector = "*";
  }
  const frames = await web.page.frames();
  const elements = [];
  for (const scope of frames) {
    const count = await scope.locator(cssSelector).count();
    for (let i = 0; i < count; i++) {
      const element = await scope.locator(cssSelector).nth(i);
      elements.push(element);
    }
  }
  const foundElements = [];
  let hTollarance = 10;
  let vTollarance = 10;
  if (options && options.hTollarance && options.vTollarance) {
    hTollarance = options.hTollarance;
    vTollarance = options.vTollarance;
  }
  for (const element of elements) {
    const rect = await element.boundingBox();
    if (!rect) {
      continue;
    }
    if (
      rect.x >= area.x - hTollarance &&
      rect.x + rect.width <= area.x + area.width + hTollarance &&
      rect.y >= area.y - vTollarance &&
      rect.y + rect.height <= area.y + area.height + vTollarance
    ) {
      foundElements.push(element);
    }
  }
  return foundElements;
}
