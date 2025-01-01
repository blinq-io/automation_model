/**
 * Find elements by universal selector and check if they match the provided text pattern.
 */
function findMatchingElements(textToMatch, options = {}, root = document) {
  function findLeafElements(elements) {
    const nonLeaf = new Set();
    elements.forEach((el) => {
      elements.forEach((otherEl) => {
        if (el !== otherEl && el.contains(otherEl)) {
          nonLeaf.add(el);
        }
      });
    });
    return elements.filter((el) => !nonLeaf.has(el));
  }

  function escapeRegex(s) {
    return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  }
  function collectAllShadowDomElements(element, result = []) {
    // Check and add the element if it has a shadow root
    if (element instanceof Element && element.shadowRoot) {
      result.push(element);
      // Also search within the shadow root
      collectAllShadowDomElements(element.shadowRoot, result);
    }

    // Iterate over child nodes
    element.childNodes.forEach((child) => {
      // Recursively call the function for each child node
      if (child instanceof Element) {
        collectAllShadowDomElements(child, result);
      }
    });

    return result;
  }
  /**
   * Convert a single snippet into an OR group for:
   *   1) literal text
   *   2) interpreted as a raw regex
   */
  function snippetToAlternatives(snippet) {
    if (snippet.startsWith("/") && snippet.endsWith("/")) {
      return snippet.slice(1, -1);
    }
    const literalPattern = escapeRegex(snippet);
    return literalPattern;
  }

  /**
   * Build a single RegExp that:
   *   - splits the user's text by whitespace
   *   - for each token, matches either literal or regex
   *   - allows arbitrary whitespace between tokens
   */
  function buildLooseRegexFromText(text, options) {
    if (options.singleRegex === true) {
      return new RegExp(text, options.ignoreCase === true ? "i" : "");
    }
    const tokens = text.split(/\s+/);
    let pattern = tokens.map((token) => snippetToAlternatives(token)).join("\\s*");
    if (options.exactMatch === true) {
      pattern = `^${pattern}$`;
    }
    // check if one of the tokens end with /i
    const endWithI = tokens.some((token) => token.endsWith("/i"));
    return new RegExp(pattern, endWithI || options.ignoreCase === true ? "i" : "");
  }
  let tag = options.tag || "*";
  // Build the pattern
  const regex = buildLooseRegexFromText(textToMatch, options);
  // Query all elements
  let elements = Array.from(root.querySelectorAll(tag));

  let shadowHosts = [];
  collectAllShadowDomElements(document, shadowHosts);
  for (let i = 0; i < shadowHosts.length; i++) {
    let shadowElement = shadowHosts[i].shadowRoot;
    if (!shadowElement) {
      continue;
    }
    let shadowElements = Array.from(shadowElement.querySelectorAll(tag));
    elements = elements.concat(shadowElements);
  }

  // filter out elements that are style or script tags
  elements = elements.filter((el) => !["STYLE", "SCRIPT", "HEAD"].includes(el.tagName));
  return findLeafElements(
    elements.filter((el) => {
      // Normalize text content
      let normalized = options.innerText === false || !el.innerText ? el.textContent : el.innerText;
      if (!normalized) {
        normalized = "";
      }
      normalized = normalized.replace(/\s+/g, " ").trim();
      regex.lastIndex = 0; // reset if using 'g'
      return regex.test(normalized);
    })
  );
}
window.findMatchingElements = findMatchingElements;
