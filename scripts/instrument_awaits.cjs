/**
 * Instruments every statement-level await in StableBrowser with logEvent timing.
 * Adds before/after logEvent calls and a Date.now() timer around each await.
 */
const fs = require('fs');

const filePath = process.argv[2] || '/Users/madhavp/Documents/GitHub/automation_model/src/stable_browser.ts';
const content = fs.readFileSync(filePath, 'utf8');
const lines = content.split('\n');
const output = [];

// Global state
let inClass = false;
let globalBraceDepth = 0;
let classBraceDepth = -1;
let currentMethod = null;
let awaitCounter = 0;

// Multi-line statement collection state
let collecting = false;
let collectBuffer = [];
let collectIndent = '';
let collectMethod = '';
let collectOpName = '';
let collectTimerVar = '';
let collectParens = 0;
let collectBraces = 0;
let collectBrackets = 0;

/**
 * Count { } ( ) [ ] in a line, skipping string literals and // comments.
 */
function countDelims(line) {
  let braces = 0, parens = 0, brackets = 0;
  let i = 0;
  while (i < line.length) {
    const c = line[i];
    // Single-line comment - stop counting
    if (c === '/' && line[i + 1] === '/') break;
    // String literals - skip content
    if (c === '"' || c === "'" || c === '`') {
      const quote = c;
      i++;
      while (i < line.length) {
        const sc = line[i];
        if (sc === '\\') { i += 2; continue; }
        if (sc === quote) { i++; break; }
        i++;
      }
      continue;
    }
    if (c === '{') braces++;
    else if (c === '}') braces--;
    else if (c === '(') parens++;
    else if (c === ')') parens--;
    else if (c === '[') brackets++;
    else if (c === ']') brackets--;
    i++;
  }
  return { braces, parens, brackets };
}

function getIndent(line) {
  const m = line.match(/^(\s*)/);
  return m ? m[1] : '';
}

/**
 * Extract a readable operation name from what's being awaited.
 */
function extractOpName(trimmed) {
  const m = trimmed.match(/await\s+(new\s+\w+|(?:this\.)?[\w.]+(?:\[['"\w]+\])*)/);
  if (m) return m[1].replace(/^this\./, '');
  return 'operation';
}

/**
 * Returns true if the trimmed line starts a statement-level await.
 * Excludes: object property values (e.g. `key: await ...`),
 *           inline awaits as arguments, etc.
 */
function isStatementAwait(trimmed) {
  if (trimmed.startsWith('//') || trimmed.startsWith('*') || trimmed.startsWith('/*')) return false;
  return (
    trimmed.startsWith('await ') ||
    /^(?:const|let|var)\s+[\w\s,{}:[\]]+\s*=\s*await\s/.test(trimmed) ||
    /^[\w][\w.[\]]*\s*=\s*await\s/.test(trimmed) ||
    /^return\s+await\s/.test(trimmed)
  );
}

/**
 * Returns true if the immediately preceding non-empty output line is already
 * one of our generated timing lines (const _perf_tN = Date.now()).
 * This prevents double-wrapping if the script is re-run on an already-instrumented file.
 */
function alreadyInstrumented() {
  for (let j = output.length - 1; j >= 0; j--) {
    const t = output[j].trim();
    if (t === '') continue;
    return /^const _perf_t\d+ = Date\.now\(\);$/.test(t);
  }
  return false;
}

for (let i = 0; i < lines.length; i++) {
  const line = lines[i];
  const trimmed = line.trim();

  // Detect StableBrowser class start (set classBraceDepth BEFORE counting this line's braces)
  if (!inClass && /^class StableBrowser\b/.test(trimmed)) {
    inClass = true;
    classBraceDepth = globalBraceDepth; // depth before the opening `{` of the class
  }

  const d = countDelims(line);
  const prevBraceDepth = globalBraceDepth;
  globalBraceDepth += d.braces;

  // Detect class end
  if (inClass && globalBraceDepth <= classBraceDepth) {
    inClass = false;
  }

  // Detect method definitions: lines at class body depth (classBraceDepth + 1)
  if (inClass && prevBraceDepth === classBraceDepth + 1) {
    const mm = line.match(/^\s+(?:async\s+)?(\w+)\s*\(/);
    if (mm && mm[1] !== 'if' && mm[1] !== 'for' && mm[1] !== 'while' && mm[1] !== 'switch') {
      currentMethod = mm[1];
    }
  }

  // === Handle multi-line await statement collection ===
  if (collecting) {
    collectBuffer.push(line);
    collectParens += d.parens;
    collectBraces += d.braces;
    collectBrackets += d.brackets;

    const statementDone =
      collectParens <= 0 &&
      collectBraces <= 0 &&
      collectBrackets <= 0 &&
      (trimmed.endsWith(';') || trimmed.endsWith('),'));

    if (statementDone) {
      const indent = collectIndent;
      output.push(`${indent}const ${collectTimerVar} = Date.now();`);
      output.push(`${indent}logEvent("[${collectMethod}] before: ${collectOpName}");`);
      for (const bl of collectBuffer) output.push(bl);
      output.push(`${indent}logEvent(\`[${collectMethod}] after: ${collectOpName} took \${Date.now() - ${collectTimerVar}}ms\`);`);
      collecting = false;
      collectBuffer = [];
    }
    continue;
  }

  // === Check for a statement-level await ===
  if (inClass && currentMethod && isStatementAwait(trimmed) && !alreadyInstrumented()) {
    const indent = getIndent(line);
    const opName = extractOpName(trimmed);
    const timerVar = `_perf_t${awaitCounter++}`;

    // Is it a complete single-line statement?
    const singleLine =
      d.parens <= 0 &&
      d.braces <= 0 &&
      d.brackets <= 0 &&
      trimmed.endsWith(';');

    if (singleLine) {
      output.push(`${indent}const ${timerVar} = Date.now();`);
      output.push(`${indent}logEvent("[${currentMethod}] before: ${opName}");`);
      output.push(line);
      output.push(`${indent}logEvent(\`[${currentMethod}] after: ${opName} took \${Date.now() - ${timerVar}}ms\`);`);
    } else {
      // Start multi-line collection
      collecting = true;
      collectBuffer = [line];
      collectIndent = indent;
      collectMethod = currentMethod;
      collectOpName = opName;
      collectTimerVar = timerVar;
      collectParens = d.parens;
      collectBraces = d.braces;
      collectBrackets = d.brackets;
    }
    continue;
  }

  output.push(line);
}

// Safety: if still collecting when file ends, flush as-is
if (collecting) {
  for (const bl of collectBuffer) output.push(bl);
}

fs.writeFileSync(filePath, output.join('\n'), 'utf8');
console.log(`Done. Instrumented ${awaitCounter} await statements in StableBrowser.`);
