import fs, { access } from "fs";
import * as path from "path";
import { fileURLToPath } from "url";

// Get __filename and __dirname in ESM
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export async function locate_element(context: any, elementDescription: string) {
  // load the axe-core library to all of the frames in the page
  // read the axe-core library from the file system placed in the same folder as the script file, name axe.mini.js
  // Construct the path to axe.min.js relative to the current file
  const axeMinJsPath = path.join(__dirname, "..", "axe", "axe.mini.js");

  // Read the content of axe.min.js synchronously
  const axeMinJsContent = fs.readFileSync(axeMinJsPath, "utf-8");
  await Promise.all(context.stable.page.frames().map((frame: any) => frame.evaluate(axeMinJsContent)));

  const frames = await context.stable.page.frames();
  // for each frame create a tree of the accessibility nodes
  for(let frame of frames) {
    const result = await frame.evaluate(() => {
        function isAccessibilityElement(element: any) {
          if(!element) {
            return false;
          }
          // @ts-ignore
          let hidden = axe.commons.dom.isHidden(element);
          if(hidden) {
            return false;
          }
          // @ts-ignore
          let roles = axe.commons.aria.getRoles(element);
            if(roles.length === 0) {
                return false;
            }
        }
        function createAccessibilityNode(element: any) {
            return {
                tag: element.tagName,
                // @ts-ignore
                roles: axe.commons.aria.getRoles(element),
                // @ts-ignore
                visible: axe.commons.dom.isVisible(element),
                // @ts-ignore
                name: axe.commons.aria.getName(element),
                attributes: element.attributes,
            };
        }
        // a function that traverses the DOM tree and builds a tree of accessibility nodes
        function buildAccessibilityTree(node: any, treeRoot: any) {
            const foundAccessibilityNodes = [];
            for(let child of node.children){
                if(isAccessibilityElement(child)) {
                    const accessibilityNode = createAccessibilityNode(child);
                    // @ts-ignore
                    accessibilityNode.children = buildAccessibilityTree(child, accessibilityNode),
                    foundAccessibilityNodes.push(accessibilityNode);
                } else {

                }

            }

        }
    });

  // let roles = axe.commons.aria.getRoles(node);
  // let hidden = axe.commons.dom.isHidden(element);
  //let visible = axe.commons.dom.isVisible(element);
  //let sanitizedText = axe.commons.text.sanitize(rawText);
}
