export async function highlightSnapshot(snapshot: any, scope: any) {}

/*
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
*/
class SnapshotNode {
  public role: string;
  public name: string | null;
  public children: SnapshotNode[] = [];
  public parent: SnapshotNode | null = null;
  constructor(
    public key: string,
    public value: string
  ) {
    if (!key) {
      throw new Error("Key cannot be null or undefined");
    }
    this.role = key.split(" ")[0];
    if (this.value) {
      this.name = this.value;
    } else {
      // the value will be from the first " to the last "
      const start = key.indexOf('"') + 1;
      const end = key.lastIndexOf('"');
      if (start > -1 && end > -1 && start < end) {
        this.name = key.substring(start, end);
      } else {
        this.name = null;
      }
    }
  }
  generateNodeLocator(): string {
    let locator = `internal:role=${this.role}`;
    switch (this.role) {
      case "paragraph":
        // internal:role=paragraph >> internal:text='blinq_user'"
        return `internal:role=${this.role} >> internal:text='${this.name}'`;
      default:
        // "internal:role=textbox[name=\"Password\"]"
        if (this.name) {
          locator += `[name="${this.name}"]`;
        }
        return locator;
    }
  }
  getFullLocator(): string {
    // create an array of all the parents and current node locators
    const locators: string[] = [];
    let currentNode: SnapshotNode | null = this;
    while (currentNode) {
      locators.unshift(currentNode.generateNodeLocator());
      currentNode = currentNode.parent;
    }
    // join the locators with " >> "
    return locators.join(" >> ");
  }
}
/**
 * One flattened line of an ARIA snapshot
 */
interface SnapshotLine {
  /** original 0-based line number in the file that was parsed */
  line: number;
  /** the ARIA role / node name: “text”, “button”, “listitem”…   */
  key: string;
  /** the textual value after the role, or null */
  value: string | null;
  /** indentation depth (0 = root, 1 = child of the previous level, …) */
  level: number;
  /** validation / parsing flags */
  error: string | null;
  /** interpret `value` as a RegExp instead of literal text */
  regex: boolean;
  /** the original line text */
  line_text: string;
}
export function fromLinesToSnapshotLines(lines: string[]): SnapshotLine[] {
  // the input is yaml text split into lines, 2 spaces is 1 level
  const nodes: SnapshotLine[] = [];
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const trimmedLine = line.trim();
    if (trimmedLine.length === 0) {
      continue;
    }
    // count the number of leading spaces
    let level = 0;
    const match = line.match(/^ */); // Matches spaces at the beginning
    const count = match ? match[0].length : 0;
    level = count / 2; // 2 spaces is 1 level
    // find the start of the line: - and space
    const start = line.indexOf("- ") + 2;
    if (start === -1) {
      // no - found, set it to error
      nodes.push({
        line: i,
        line_text: line,
        key: line,
        value: null,
        level,
        error: "No - found",
        regex: false,
      });
      continue;
    }
    // first we need to extract the role, we should find the first space or : after the start
    const end = line.indexOf(" ", start);
    const end2 = line.indexOf(":", start);
    if (end === -1 && end2 === -1) {
      // no space or : found, set it to error
      nodes.push({
        line: i,
        line_text: line,
        key: line,
        value: null,
        level,
        error: "No space or : found",
        regex: false,
      });
      continue;
    }
    const endIndex = end === -1 ? end2 : end2 === -1 ? end : Math.min(end, end2);
    const key = line.substring(start, endIndex).trim();
    // define value is string or null
    let value = line.substring(endIndex + 1).trim();
    if (value.startsWith('"')) {
      // find the last " in the value
      const lastQuote = value.lastIndexOf('"');
      if (lastQuote !== -1) {
        value = value.substring(0, lastQuote + 1);
      }
    }
    // check if the value start with / and end with / or / + regex options
    const regex = value.startsWith("/") && (value.endsWith("/") || value.endsWith("/i") || value.endsWith("/g"));
    nodes.push({
      line: i,
      line_text: line,
      key,
      value: value.length > 0 ? value : null,
      level,
      error: null,
      regex,
    });
  }
  return nodes;
}

/**
 * Turn a “/pattern/flags” string into a real RegExp.
 */
function toRegExp(raw: string): RegExp {
  if (!raw.startsWith("/")) return new RegExp(raw); // plain text
  const lastSlash = raw.lastIndexOf("/");
  const pattern = raw.slice(1, lastSlash); // between the //
  const flags = raw.slice(lastSlash + 1); // i, g, …
  return new RegExp(pattern, flags);
}

/**
 * Single-line comparison with fixed regex handling.
 */
function lineMatches(full: SnapshotLine, sub: SnapshotLine): boolean {
  if (full.key !== sub.key) return false;
  if (full.level !== sub.level) return false;

  if (sub.value === null) return true; // “match anything”
  return sub.regex ? toRegExp(sub.value).test(full.value ?? "") : full.value === sub.value;
}

/* ────────────────────────────────────────────────────────────────── */

/**
 * Successful-/error-report returned by `matchSnapshot`.
 *
 *  ─ matchingLines … full-snapshot **original** line numbers that correspond
 *                    to every line in the sub-snapshot (same order & length).
 *  ─ errorLine …..  first sub-snapshot index that could **not** be matched,
 *                    or -1 when the whole sub-snapshot was found.
 */
export interface MatchResult {
  matchingLines: number[];
  errorLine: number;
  errorLineText: string | null;
}
export function snapshotValidation(snapshot: string, referanceSnapshot: string, snapshotName: string): MatchResult {
  const lines = snapshot.split("\n");
  const nodes = fromLinesToSnapshotLines(lines);
  const subLines = referanceSnapshot.split("\n");
  const subNodes = fromLinesToSnapshotLines(subLines);
  return matchSnapshot(nodes, subNodes, snapshotName);
}
export function matchSnapshot(full: SnapshotLine[], sub: SnapshotLine[], snapshotName: string): MatchResult {
  /* nearest ancestor of every sub-line (–1 for roots) */
  const parentIdx = sub.map((_, i) => {
    for (let j = i - 1; j >= 0; j--) if (sub[j].level < sub[i].level) return j;
    return -1;
  });

  const fullIdx: number[] = new Array(sub.length); // indices in `full`
  const mapping: number[] = new Array(sub.length); // original line #s
  let failureAt = -1; // first unmatched line

  /**
   * Depth-first search with back-tracking.
   * @param s     index in `sub`
   * @param fFrom first index in `full` we may try for this `sub[s]`
   */
  function dfs(s: number, fFrom: number): boolean {
    if (s === sub.length) return true; // ✅ all lines matched!

    for (let f = fFrom; f < full.length; f++) {
      if (!lineMatches(full[f], sub[s])) continue;

      /* parent relationship must stay intact */
      const pSub = parentIdx[s];
      if (pSub !== -1) {
        let pFull = f - 1;
        while (pFull >= 0 && full[pFull].level >= full[f].level) pFull--;
        if (pFull < 0 || pFull !== fullIdx[pSub]) continue; // wrong parent
      }

      /* remember this choice and try deeper */
      fullIdx[s] = f;
      mapping[s] = full[f].line;
      if (dfs(s + 1, f + 1)) return true;
    }

    /* could not satisfy sub[s] → remember where we failed */
    if (failureAt === -1) failureAt = s;
    return false; // back-track
  }

  /* kick off the search */
  const found = dfs(0, 0);
  let error = null;
  if (!found) {
    error = `Snapshot file: ${snapshotName}\nLine no.: ${sub[failureAt].line}\nLine: ${sub[failureAt].line_text}`;
  }
  return {
    matchingLines: found ? mapping : mapping.slice(0, failureAt),
    errorLine: found ? -1 : failureAt,
    errorLineText: error,
  };
}
// let ttt = `- banner:
//   - heading "Shop NOW" [level=6]
// - text: Log In Username
// - textbox "Username"
// - text: Password
// - textbox "Password"
// - button "Login"
// - paragraph: "Accepted usernames are:"
// - list:
//   - listitem:
//     - paragraph: blinq_user
//   - listitem:
//     - paragraph: blinq_admin
// - paragraph: "Password for all users:"
// - paragraph: let_me_in`;
// const lines = ttt.split("\n");
// const nodes = fromLinesToSnapshotLines(lines);
// console.log("nodes", nodes);
