/**
 * Tests for `matchSnapshot`.
 *
 * Assumptions
 * ───────────
 *  - fromLinesToSnapshotLines(lines: string[]) → SnapshotLine[]
 *  - matchSnapshot(full: SnapshotLine[], sub: SnapshotLine[]) → MatchResult
 *
 * The full snapshot used here is the same one in the original example,
 * so the reference line numbers in the assertions line-up with that file.
 */
import exp from "constants";
import { fromLinesToSnapshotLines, matchSnapshot } from "../build/lib/snapshot_validation.js";
import { snapshotValidation } from "../build/lib/snapshot_validation.js";

import { expect } from "chai";

const fullSnapshotTxt = `
- banner:
  - heading "Shop NOW" [level=6]
- text: Log In Username
- textbox "Username"
- text: Password
- textbox "Password"
- button "Login"
- paragraph: "Accepted usernames are:"
- list:
  - listitem:
    - paragraph: blinq_user
  - listitem:
    - paragraph: blinq_admin
- paragraph: "Password for all users:"
- paragraph: let_me_in
`.trim();

const full = fromLinesToSnapshotLines(fullSnapshotTxt.split("\n"));

/* ────────────────────────────────────────────────────────────────── */
/*                        Happy-path matches                         */
/* ────────────────────────────────────────────────────────────────── */
describe("matchSnapshot – happy-path matches", () => {
  it("matches a flat 5-line section in order", () => {
    const subTxt = `
- text: Log In Username
- textbox "Username"
- text: Password
- textbox "Password"
- button "Login"
    `.trim();

    const sub = fromLinesToSnapshotLines(subTxt.split("\n"));
    const res = matchSnapshot(full, sub);

    expect(res.matchingLines).to.deep.equal([2, 3, 4, 5, 6]);
    expect(res.errorLine).to.deep.equal(-1);
  });

  it("matches nested list → listitem → paragraph structure", () => {
    const subTxt = `
- list:
  - listitem:
    - paragraph: blinq_admin
    `.trim();

    const sub = fromLinesToSnapshotLines(subTxt.split("\n"));
    const res = matchSnapshot(full, sub);

    expect(res.matchingLines).to.deep.equal([8, 11, 12]);
    expect(res.errorLine).to.deep.equal(-1);
  });

  it("handles RegExp value matching", () => {
    const subTxt = `
- paragraph: /Password\\s+for\\s+all\\s+users:/
    `.trim();

    const sub = fromLinesToSnapshotLines(subTxt.split("\n"));
    sub[0].regex = true; // mark as RegExp

    const res = matchSnapshot(full, sub);

    expect(res.matchingLines).to.deep.equal([13]);
    expect(res.errorLine).to.deep.equal(-1);
  });
});

/* ────────────────────────────────────────────────────────────────── */
/*                           Failure cases                           */
/* ────────────────────────────────────────────────────────────────── */
describe("matchSnapshot – failure cases", () => {
  it("reports error when order is wrong", () => {
    const subTxt = `
- textbox "Username"
- text: Log In Username   # <- reversed order on purpose
    `.trim();

    const sub = fromLinesToSnapshotLines(subTxt.split("\n"));
    const res = matchSnapshot(full, sub);

    expect(res.errorLine).to.equal(1); // failed on 2nd sub-line
    expect(res.matchingLines).to.deep.equal([3]); // first line *did* match
  });

  it("reports error when hierarchy does not line-up", () => {
    const subTxt = `
- listitem:               # <- missing parent "list" (level 0)
  - paragraph: blinq_user
    `.trim();

    const sub = fromLinesToSnapshotLines(subTxt.split("\n"));
    const res = matchSnapshot(full, sub);

    expect(res.errorLine).to.equal(0); // failed immediately
    expect(res.matchingLines).to.deep.equal([]); // nothing matched
  });
  const reference = `- link "Combination Pliers Combination Pliers $14.15":
  - heading "Combination Pliers" [level=5]
- link "Pliers Pliers $12.01":
  - heading "Pliers" [level=5]
- link "Bolt Cutters Bolt Cutters $48.41":
  - heading "Bolt Cutters" [level=5]
- link "Long Nose Pliers Long Nose Pliers Out of stock $14.24":
  - heading "Long Nose Pliers" [level=5]`;
  const snapshot = `- paragraph:
      - img "Banner"
    - separator
    - heading "Sort" [level=4]
    - separator
    - combobox "sort":
      - option [selected]
      - option "Name (A - Z)"
      - option "Name (Z - A)"
      - option "Price (High - Low)"
      - option "Price (Low - High)"
    - heading "Price Range" [level=4]
    - separator
    - slider "ngx-slider"
    - slider "ngx-slider-max"
    - text: /0 \\d+ 1 \\d+/
    - heading "Search" [level=4]
    - separator
    - text: Search
    - textbox "Search"
    - button "X"
    - button "Search"
    - heading "Filters" [level=4]
    - separator
    - heading "By category:" [level=4]
    - group "Categories":
      - checkbox "Hand Tools"
      - text: Hand Tools
      - list:
        - group "Categories":
          - checkbox "Hammer"
          - checkbox "Hand Saw"
          - checkbox "Wrench"
          - checkbox "Screwdriver"
          - text: Screwdriver
          - checkbox "Pliers"
          - checkbox "Chisels"
          - checkbox "Measures"
      - checkbox "Power Tools"
      - text: Power Tools
      - list:
        - group "Categories":
          - checkbox "Grinder"
          - checkbox "Sander"
          - checkbox "Saw"
          - checkbox "Drill"
      - checkbox "Other"
      - list:
        - group "Categories":
          - checkbox "Tool Belts"
          - text: Tool Belts
          - checkbox "Storage Solutions"
          - text: Storage Solutions
          - checkbox "Workbench"
          - checkbox "Safety Gear"
          - text: Safety Gear
          - checkbox "Fasteners"
    - heading "By brand:" [level=4]
    - group "Brands":
      - checkbox "ForgeFlex Tools"
      - text: ForgeFlex Tools
      - checkbox "MightyCraft Hardware"
      - text: MightyCraft Hardware
    - link /Combination Pliers Combination Pliers \\$\\d+\\.\\d+/:
      - /url: /product/01JVPER5H1WKTM4M8ZNA1RX9E6
      - img "Combination Pliers"
      - heading "Combination Pliers" [level=5]
    - link /Pliers Pliers \\$\\d+\\.\\d+/:
      - /url: /product/01JVPER5H4NAFBHPY9HRMQE3AT
      - img "Pliers"
      - heading "Pliers" [level=5]
    - link /Bolt Cutters Bolt Cutters \\$\\d+\\.\\d+/:
      - /url: /product/01JVPER5H59MCDN6PK3VFFMCHJ
      - img "Bolt Cutters"
      - heading "Bolt Cutters" [level=5]
    - link /Long Nose Pliers Long Nose Pliers Out of stock \\$\\d+\\.\\d+/:
      - /url: /product/01JVPER5H7RH6Y3XMZ1KZ30FJX
      - img "Long Nose Pliers"
      - heading "Long Nose Pliers" [level=5]
    - link /Slip Joint Pliers Slip Joint Pliers \\$\\d+\\.\\d+/:
      - /url: /product/01JVPER5H97RA3W8WS1G46K9BC
      - img "Slip Joint Pliers"
      - heading "Slip Joint Pliers" [level=5]
    - link /Claw Hammer with Shock Reduction Grip Claw Hammer with Shock Reduction Grip \\$\\d+\\.\\d+/:
      - /url: /product/01JVPER5HAB6AJTEWH35SZNZKM
      - img "Claw Hammer with Shock Reduction Grip"
      - heading "Claw Hammer with Shock Reduction Grip" [level=5]
    - link /Hammer Hammer \\$\\d+\\.\\d+/:
      - /url: /product/01JVPER5HBPAYX5DP9D55WPTCA
      - img "Hammer"
      - heading "Hammer" [level=5]
    - link /Claw Hammer Claw Hammer \\$\\d+\\.\\d+/:
      - /url: /product/01JVPER5HDK382XWTMPJ6W8GG8
      - img "Claw Hammer"
      - heading "Claw Hammer" [level=5]
    - link /Thor Hammer Thor Hammer \\$\\d+\\.\\d+/:
      - /url: /product/01JVPER5HEXJV1WXJMX6DNW8QW
      - img "Thor Hammer"
      - heading "Thor Hammer" [level=5]
    - navigation:
      - list:
        - listitem:
          - button "Previous"
        - listitem:
          - button "Page-1"
        - listitem:
          - button "Page-2"
        - listitem:
          - button "Page-3"
        - listitem:
          - button "Page-4"
        - listitem:
          - button "Page-5"
        - listitem:
          - button "Next"`;
  it("snapshot_runtime bug", async function () {
    const result = snapshotValidation(snapshot, reference, "");
    console.log(result);
    expect(result.errorLine).to.equal(-1);
  });
});
