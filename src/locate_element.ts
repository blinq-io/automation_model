import fs, { access } from "fs";
import { get } from "http";
import * as path from "path";
import { fileURLToPath } from "url";

// Get __filename and __dirname in ESM
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export async function locate_element(
  context: any,
  elementDescription: string,
  operation = "click",
  value: string | null = null
) {
  // load the axe-core library to all of the frames in the page
  // read the axe-core library from the file system placed in the same folder as the script file, name axe.mini.js
  // Construct the path to axe.min.js relative to the current file
  let axeMinJsPath = path.join(__dirname, "..", "axe", "axe.mini.js");
  // Check if the file exists
  if (!fs.existsSync(axeMinJsPath)) {
    axeMinJsPath = path.join(__dirname, "axe", "axe.mini.js");
  }

  // Read the content of axe.min.js synchronously
  const axeMinJsContent = fs.readFileSync(axeMinJsPath, "utf-8");
  await Promise.all(context.stable.page.frames().map((frame: any) => frame.evaluate(axeMinJsContent)));

  const frames = await context.stable.page.frames();
  // for each frame create a tree of the accessibility nodes
  const frameDump: any[] = [];
  let iframeIndex = 0;
  let nextFrameIndex = 1;
  let actionableElementIndex = 0;
  const randomToken = Math.random().toString(36).substring(7);
  const actionableElements: any[] = [];
  for (let frame of frames) {
    // @ts-ignore
    let result: any = null;
    try {
      result = await frame.evaluate(
        // @ts-ignore
        ([iframeIndex, nextFrameIndex, actionableElementIndex, randomToken]) => {
          let iframeCount = 1;
          const actionableElements: any[] = [];
          const actionableRoles = [
            "link",
            "button",
            "tab",
            "menuitem",
            "menuitemcheckbox",
            "menuitemradio",
            "checkbox",
            "textbox",
            "combobox",
            "listitem",
            "radio",
            "searchbox",
            "option",
            "Date",
            "row",
            "DateTime",
            "InputTime",
            "treeitem",
          ];

          function isAccessibilityElement(element: any) {
            if (!element) {
              return false;
            }
            // @ts-ignore
            let hidden = axe.commons.dom.isHiddenForEveryone(element);
            if (hidden) {
              return false;
            }
            if (element.tagName === "IFRAME") {
              return true;
            }
            // @ts-ignore
            let roles = axe.commons.aria.getRole(element);
            if (!roles) {
              return false;
            }
            return true;
          }
          function getAttributes(element: any) {
            const attrs = element.attributes;
            const result: any = {};
            for (let i = 0; i < attrs.length; i++) {
              result[attrs[i].name] = attrs[i].value;
              if (attrs[i].name === "class") {
                // clean the spaces
                result[attrs[i].name] = attrs[i].value.replace(/\s+/g, " ").trim();
              }
            }
            return result;
          }
          function createAccessibilityNode(element: any, actionableElements: any) {
            // check if the element is an iframe

            const result = {
              tag: element.tagName,
              // @ts-ignore
              role: axe.commons.aria.getRole(element),
              // @ts-ignore
              visible: axe.commons.dom.isVisible(element),
              // @ts-ignore
              name: axe.commons.text.accessibleText(element),
              attributes: getAttributes(element),
              // @ts-ignore
              frameIndex: iframeIndex,
            };
            if (actionableRoles.includes(result.role)) {
              // @ts-ignore
              result.elementNumber = actionableElementIndex;
              element.setAttribute("data-blinq-id", "blinq-id-" + randomToken + "-" + actionableElementIndex);
              //console.log("attribute set to " + "blinq-id-" + randomToken + "-" + actionableElementIndex);
              actionableElementIndex++;
              actionableElements.push(result);
            }
            if (element.tagName === "IFRAME") {
              // @ts-ignore
              result.targetFrameIndex = nextFrameIndex;
              nextFrameIndex++;
            }

            return result;
          }
          // a function that traverses the DOM tree and builds a tree of accessibility nodes
          function buildAccessibilityTree(node: any, treeRoot: any) {
            //const foundAccessibilityNodes = [];
            if (!treeRoot.children) {
              treeRoot.children = [];
            }
            //console.log(node.tagName + " " + node.children.length);
            for (let child of node.children) {
              if (isAccessibilityElement(child)) {
                const accessibilityNode = createAccessibilityNode(child, actionableElements);
                // @ts-ignore
                // accessibilityNode.children = buildAccessibilityTree(child, accessibilityNode),
                // foundAccessibilityNodes.push(accessibilityNode);
                treeRoot.children.push(accessibilityNode);
                buildAccessibilityTree(child, accessibilityNode);
              } else {
                buildAccessibilityTree(child, treeRoot);
              }
            }
          }
          // @ts-ignore
          axe.utils.getFlattenedTree(document);
          const root = createAccessibilityNode(document.body, actionableElements);
          buildAccessibilityTree(document.body, root);
          return JSON.stringify({ root, nextFrameIndex, actionableElementIndex, actionableElements }, null, 2);
        },
        [iframeIndex, nextFrameIndex, actionableElementIndex, randomToken]
      );
      const resultData = JSON.parse(result);
      nextFrameIndex = resultData.nextFrameIndex;
      actionableElementIndex = resultData.actionableElementIndex;
      frameDump.push(resultData.root);
      actionableElements.push(...resultData.actionableElements);
      iframeIndex++;
    } catch (e) {
      // ignore
    }
  }
  function traverseDFS(node: any) {
    // Recursively traverse each child node
    if (node.children && node.children.length > 0) {
      node.children.forEach((child: any) => {
        if (child.tag === "IFRAME") {
          if (child.targetFrameIndex && frameDump.length >= child.targetFrameIndex) {
            child.children = [frameDump[child.targetFrameIndex]];
          }
        }
        if (child.shadowRoot) {
          traverseDFS(child.shadowRoot);
        } else {
          traverseDFS(child);
        }
      });
    }
  }
  traverseDFS(frameDump[0]);
  let serviceUrl = context.stable._getServerUrl();
  const request = {
    method: "POST",
    url: `${serviceUrl}/api/runs/locate-element/locate`,
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${process.env.TOKEN}`,
    },
    data: JSON.stringify({
      elementDescription: elementDescription,
      operation: operation,
      dump: frameDump[0],
      value: value,
    }),
  };
  let result = await context.api.request(request);
  //console.log(JSON.stringify(frameDump[0]));
  if (result.status !== 200 || !result.data || result.data.status !== true || !result.data.result) {
    console.error("Failed to locate element");
    return null;
  }
  const returnData = {
    reason: result.data.result.reason,
    elementNumber: result.data.result.elementNumber,
    frameIndex: -1,
    frame: null,
    css: "",
  };
  if (result.data.result.elementNumber !== -1) {
    // find the iframe index, the element is in, by identifying the actionable element
    const actionableElement = actionableElements.find(
      (element) => element.elementNumber === result.data.result.elementNumber
    );
    if (actionableElement) {
      returnData.frameIndex = actionableElement.frameIndex;
      returnData.frame = frames[returnData.frameIndex];
      returnData.css = `[data-blinq-id="blinq-id-${randomToken}-${returnData.elementNumber}"]`;
    }
  }
  //console.log(dumpToHtml(frameDump[0]));
  return returnData;
}
