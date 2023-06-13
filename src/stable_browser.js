import { expect } from "@jest/globals";
class StableBrowser {
  constructor(browser, page) {
    this.browser = browser;
    this.page = page;
  }

  async goto(url) {
    await this.page.goto(url, {
      timeout: 60000,
    });
  }
  async _fixLocator(locator) {
    let count = await locator.count();
    if (count > 1) {
      return locator.nth(0);
    }
    return locator;
  }
  async _locate(selector, scope) {
    try {
      if (Array.isArray(selector)) {
        let currentScope = scope;

        for (let i = 0; i < selector.length; i++) {
          currentScope = await this._fixLocator(
            await this._locate(selector[i], currentScope)
          );
        }
        return currentScope;
      }
      if (typeof selector === "object") {
        if (selector.css) {
          return await this._fixLocator(scope.locator(selector.css));
        }
        if (selector.role) {
          return await this._fixLocator(
            scope.getByRole(selector.role[0], selector.role[1])
          );
        }
        if (selector.text) {
          return await this._fixLocator(scope.getByText(selector.text));
        }
      }
      throw new Error(`Unknown locator type ${type}`);
    } catch (e) {
      console.log("invalid locator object, will try to parse as text");
    }

    if (selector.startsWith("TEXT=")) {
      return await this.page.getByText(selector.substring("TEXT=".length));
    } else {
      return await this.page.locator(selector);
    }
  }

  async click(selector) {
    await (await this._locate(selector, this.page)).click();
  }
  async fill(selector, value) {
    let element = await this._locate(selector, this.page);
    await element.fill(value);
    await element.dispatchEvent("change");
  }
  async verifyTextFoundInPage(text) {
    const element = await page.getByText(text);
    await expect(element !== undefined).toBeTruthy();
  }
  async clickInTableRow(textInRow, actionLocator) {
    const row = await page.evaluate(() => {
      function isVisible(elem) {
        if (!(elem instanceof Element)) {
          return false;
        }
        const style = getComputedStyle(elem);
        if (style.display === "none") return false;
        if (style.visibility !== "visible") return false;
        if (style.opacity < 0.1) return false;
        if (
          elem.offsetWidth +
            elem.offsetHeight +
            elem.getBoundingClientRect().height +
            elem.getBoundingClientRect().width ===
          0
        ) {
          return false;
        }
        const elemCenter = {
          x: elem.getBoundingClientRect().left + elem.offsetWidth / 2,
          y: elem.getBoundingClientRect().top + elem.offsetHeight / 2,
        };
        if (elemCenter.x < 0) return false;
        if (
          elemCenter.x >
          (document.documentElement.clientWidth || window.innerWidth)
        )
          return false;
        if (elemCenter.y < 0) return false;
        if (
          elemCenter.y >
          (document.documentElement.clientHeight || window.innerHeight)
        ) {
          return false;
        }
        return true;
      }
      function isBackgrounElement(element) {
        let rec = element.getBoundingClientRect();
        let xCenter = rec.left + rec.width / 2;
        let yCenter = rec.top + rec.height / 2;
        let elementAtPoint = document.elementFromPoint(xCenter, yCenter);
        if (!elementAtPoint) {
          return false;
        }
        if (elementAtPoint.contains(element)) {
          return false;
        }
        // check if the element is the same element or same as parent
        let toCheck = elementAtPoint;
        while (toCheck) {
          if (toCheck === element) {
            return false;
          }
          toCheck = toCheck.parentElement;
        }

        return true;
      }

      const rows = table.querySelectorAll('tr, role="row"');
      let foundRow = null;
      for (let i = 0; i < rows.length; i++) {
        const row = rows[i];
        const rowData = [];
        const cells = row.querySelectorAll(
          "td, th, [role='cell'], [role='columnheader']"
        );
        cells.forEach((cell) => {
          if (!isVisible(cell) || isBackgrounElement(cell)) {
            return;
          }
          const text = getTextFromElement(cell);
          rowData.push(text);
        });
        if (rowData.includes(textInRow)) {
          foundRow = row;
          break;
        }
      }
      return foundRow;
    });
    await foundRow.locator(actionLocator).click();
  }
  async waitForPageLoad() {
    try {
      await Promise.all([
        this.page.waitForLoadState("networkidle"),
        this.page.waitForLoadState("load"),
        this.page.waitForLoadState("domcontentloaded"),
      ]);
    } catch (e) {
      console.log("waitForPageLoad error, ignored");
    }
    await new Promise((resolve) => setTimeout(resolve, 2000));
  }
}
export { StableBrowser };
