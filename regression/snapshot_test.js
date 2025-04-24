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
import { fromLinesToSnapshotLines, matchSnapshot } from "../build/lib/snapshot_validation.js";
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

    expect(res).to.deep.equal({
      matchingLines: [2, 3, 4, 5, 6], // indices in the *parsed* full snapshot
      errorLine: -1, // everything matched
    });
  });

  it("matches nested list → listitem → paragraph structure", () => {
    const subTxt = `
- list:
  - listitem:
    - paragraph: blinq_admin
    `.trim();

    const sub = fromLinesToSnapshotLines(subTxt.split("\n"));
    const res = matchSnapshot(full, sub);

    expect(res).to.deep.equal({
      // list ► 8, listitem (second) ► 11, paragraph ► 12
      matchingLines: [8, 11, 12],
      errorLine: -1,
    });
  });

  it("handles RegExp value matching", () => {
    const subTxt = `
- paragraph: /Password\\s+for\\s+all\\s+users:/
    `.trim();

    const sub = fromLinesToSnapshotLines(subTxt.split("\n"));
    sub[0].regex = true; // mark as RegExp

    const res = matchSnapshot(full, sub);

    expect(res).to.deep.equal({
      matchingLines: [13],
      errorLine: -1,
    });
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
});
