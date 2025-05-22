import { all } from "axios";

export async function highlightSnapshot(snapshot: any, scope: any) {
  const lines = snapshot.split("\n");
  const nodes = fromLinesToSnapshotLines(lines);
  // build a SnapshotNode tree
  const root = new SnapshotNode("root", null);
  const stack: SnapshotNode[] = [root];
  const allNodes: SnapshotNode[] = [];
  for (const node of nodes) {
    const newNode = new SnapshotNode(node.key, node.value);
    allNodes.push(newNode);
    newNode.level = node.level;
    newNode.regex = node.regex;
    if (node.level > stack.length - 1) {
      // add to the last node
      stack[stack.length - 1].children.push(newNode);
      newNode.parent = stack[stack.length - 1];
      stack.push(newNode);
    } else {
      // pop the stack until we find the right level
      while (stack.length > node.level + 1) {
        stack.pop();
      }
      // add to the parent
      stack[stack.length - 1].children.push(newNode);
      newNode.parent = stack[stack.length - 1];
      stack.push(newNode);
    }
  }
  // go over all the nodes in the tree and generate an array of full locators
  const locators: string[] = [];
  for (const node of allNodes) {
    const locator = node.getFullLocator();
    locators.push(locator);
  }
  const elements = [];
  // go over all the locators and find the elements
  for (const locator of locators) {
    const l = scope.locator(locator);

    let count = 0;
    try {
      count = await l.count();
    } catch (e) {
      //console.log("Error in locator", locator, e);
      continue;
    }
    for (let i = 0; i < count; i++) {
      const element = l.nth(i);
      elements.push(element);
    }
  }
  // go over all the elements and highlight them
  for (const element of elements) {
    try {
      await element.evaluate((el: any) => {
        if (!el?.style) return;

        const originalOutline = el.style.outline;
        el.__previousOutline = originalOutline;

        el.style.outline = "2px solid red";

        if (window) {
          window.addEventListener("beforeunload", function () {
            el.style.outline = originalOutline;
          });
        }

        setTimeout(() => {
          el.style.outline = originalOutline;
        }, 4000);
      });
    } catch (e) {}
  }
}

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
  public level: number = 0;
  public regex: boolean = false;
  public children: SnapshotNode[] = [];
  public parent: SnapshotNode | null = null;
  constructor(
    public key: string,
    public value: string | null
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
        return `internal:role=${this.role} >> internal:text=${this.name}`;
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
      if (currentNode.role !== "root") {
        locators.unshift(currentNode.generateNodeLocator());
      }
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
  // identify the space count for tabulation
  let previouseLineSpaceCount = -1;
  let foundTabulationCount = -1;
  // look for 2 consecutive lines that have different space counts, the absolute difference is the space count for tabulation
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const trimmedLine = line.trim();
    if (trimmedLine.length === 0) {
      continue;
    }
    // count the number of leading spaces
    const match = line.match(/^ */); // Matches spaces at the beginning
    const count = match ? match[0].length : 0;
    if (previouseLineSpaceCount !== -1 && previouseLineSpaceCount !== count) {
      foundTabulationCount = Math.abs(previouseLineSpaceCount - count);
      break;
    }
    previouseLineSpaceCount = count;
  }
  if (foundTabulationCount === -1) {
    foundTabulationCount = 2;
  }

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
    level = count / foundTabulationCount; // 2 spaces is 1 level
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
      const lastQuote = value.lastIndexOf('"');
      if (lastQuote !== -1) {
        value = value.substring(0, lastQuote + 1);
      }
    }

    // improved regex detection
    const rawValue = value.endsWith(":") ? value.slice(0, -1) : value;
    const regex = rawValue.startsWith("/") && /\/[a-z]*$/.test(rawValue);
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
  // Remove trailing colon from YAML-style key: /pattern/: → /pattern/
  const sanitized = raw.endsWith(":") ? raw.slice(0, -1) : raw;

  if (!sanitized.startsWith("/")) return new RegExp(sanitized);

  const lastSlash = sanitized.lastIndexOf("/");
  const pattern = sanitized.slice(1, lastSlash);
  const flags = sanitized.slice(lastSlash + 1); // i, g, etc.

  return new RegExp(pattern, flags);
}

/**
 * Single-line comparison with fixed regex handling.
 */
function lineMatches(full: SnapshotLine, sub: SnapshotLine): any {
  let status = { status: false };
  if (full.key !== sub.key) return status;

  // We handle level offset outside this function
  if (sub.value === null) {
    status.status = true;
    return status;
  }

  if (sub.regex) {
    status.status = toRegExp(sub.value!).test(full.value ?? "");
  } else if (full.regex) {
    status.status = toRegExp(full.value!).test(sub.value ?? "");
  } else {
    status.status = full.value === sub.value;
  }

  return status;
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
  const parentIdx = sub.map((_, i) => {
    for (let j = i - 1; j >= 0; j--) if (sub[j].level < sub[i].level) return j;
    return -1;
  });

  const fullIdx: number[] = new Array(sub.length);
  const mapping: number[] = new Array(sub.length);
  let failureAt = -1;

  function dfs(s: number, fFrom: number, baseLevelOffset: number | null): boolean {
    if (s === sub.length) return true;

    for (let f = fFrom; f < full.length; f++) {
      let levelMatch = true;
      if (baseLevelOffset !== null) {
        // Must match levels relative to initial offset
        if (full[f].level !== sub[s].level + baseLevelOffset) continue;
      }

      const status = lineMatches(full[f], sub[s]);
      if (!status.status) continue;

      // For first match, set level offset
      const nextBaseOffset = baseLevelOffset !== null ? baseLevelOffset : full[f].level - sub[s].level;

      const pSub = parentIdx[s];
      if (pSub !== -1) {
        let pFull = f - 1;
        while (pFull >= 0 && full[pFull].level >= full[f].level) pFull--;
        if (pFull < 0 || pFull !== fullIdx[pSub]) continue;
      }

      fullIdx[s] = f;
      mapping[s] = full[f].line;
      if (dfs(s + 1, f + 1, nextBaseOffset)) return true;
    }

    if (failureAt === -1) failureAt = s;
    return false;
  }

  const found = dfs(0, 0, null);
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
