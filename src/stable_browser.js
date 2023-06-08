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
  async _locate(selector) {
    if (typeof selector === "object") {
      try {
        if (selector.css) {
          return await this.page.locator(selector.css);
        }
        if (selector.role) {
          return await this.page.getByRole(selector.role[0], selector.role[1]);
        }
        if (selector.text) {
          return await this.page.getByText(selector.text);
        }
        throw new Error(`Unknown locator type ${type}`);
      } catch (e) {
        console.log("invalid locator object, will try to parse as text");
      }
    }

    if (selector.startsWith("TEXT=")) {
      return await this.page.getByText(selector.substring("TEXT=".length));
    } else {
      return await this.page.locator(selector);
    }
  }

  async click(selector) {
    (await this._locate(selector)).click();
  }
  async fill(selector, value) {
    let element = await this._locate(selector);
    await element.fill(value);
    await element.dispatchEvent("change");
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
