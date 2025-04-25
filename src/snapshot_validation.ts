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
}
function generateNodeLocator(node: SnapshotLine): string {
  let locator = `internal:role=${node.key}`;
  switch (node.key) {
    case "paragraph":
      // internal:role=paragraph >> internal:text='blinq_user'"
      return `internal:role=${node.key} >> internal:text=${JSON.stringify(node.value)}`;
    default:
      // "internal:role=textbox[name=\"Password\"]"
      if (node.value) {
        locator += `[name=${JSON.stringify(node.value)}]`;
      }
      return locator;
  }
}
/**
 * Return the full Playwright locator for the node at `index`.
 *
 * Example
 * ───────
 * const nodes = fromLinesToSnapshotLines(snapshot.split("\n"));
 * const full = buildLocatorPath(nodes, 10);
 * // ➜ internal:role=list … >> internal:role=listitem … >> internal:role=paragraph >> internal:text='blinq_user'
 */
export function buildLocatorPath(nodes: SnapshotLine[], index: number): string {
  if (index < 0 || index >= nodes.length) {
    throw new Error(`index ${index} out of range (0-${nodes.length - 1})`);
  }

  /* walk upwards in the flat list until we reach the root */
  const path: SnapshotLine[] = [];
  let i = index;
  let curLevel = nodes[i].level;

  while (true) {
    path.unshift(nodes[i]); // prepend – root ends up first
    if (curLevel === 0) break; // reached the top of the tree

    // parent = closest previous line whose level is exactly one less
    let j = i - 1;
    while (j >= 0 && nodes[j].level >= curLevel) j--;
    if (j < 0) break; // malformed input: no parent found

    i = j;
    curLevel = nodes[i].level;
  }

  /* convert every node on the path to its individual locator and join them */
  return path.map(generateNodeLocator).join(" >> ");
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
  subLocators: string[];
}
export function snapshotValidation(snapshot: string, referanceSnapshot: string): MatchResult {
  const lines = snapshot.split("\n");
  const nodes = fromLinesToSnapshotLines(lines);
  const subLines = referanceSnapshot.split("\n");
  const subNodes = fromLinesToSnapshotLines(subLines);
  return matchSnapshot(nodes, subNodes);
}
export function matchSnapshot(full: SnapshotLine[], sub: SnapshotLine[]): MatchResult {
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
  const subLocators = sub.map((node) => generateNodeLocator(node));
  return {
    matchingLines: found ? mapping : mapping.slice(0, failureAt),
    errorLine: found ? -1 : failureAt,
    errorLineText: found ? null : sub[failureAt].key + " " + sub[failureAt].value,
    subLocators,
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
