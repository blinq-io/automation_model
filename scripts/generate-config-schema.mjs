#!/usr/bin/env node
import fs from "fs";
import path from "path";
import { parse } from "@babel/parser";
import traverseModule from "@babel/traverse";
import * as t from "@babel/types";

const traverse = traverseModule.default ?? traverseModule;

const args = process.argv.slice(2);
const options = {
  root: "src",
  out: null,
  configNames: ["configuration", "aiConfig"],
};
for (let i = 0; i < args.length; i++) {
  const key = args[i];
  const val = args[i + 1];
  if (key === "--root" && val) {
    options.root = val;
    i++;
  }
  if (key === "--out" && val) {
    options.out = val;
    i++;
  }
  if (key === "--config-name" && val) {
    options.configNames = [val];
    i++;
  }
  if (key === "--config-names" && val) {
    options.configNames = val
      .split(",")
      .map((s) => s.trim())
      .filter(Boolean);
    i++;
  }
}

const isSource = (file) => [".ts", ".tsx", ".js", ".mjs", ".cjs"].includes(path.extname(file));
const files = [];
const walk = (dir) => {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    if (entry.name === "node_modules" || entry.name.startsWith(".")) continue;
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      walk(full);
    } else if (isSource(full)) {
      files.push(full);
    }
  }
};
walk(path.resolve(options.root));

const makeNode = (name) => ({ name, children: new Map(), types: new Set() });
const root = makeNode("<root>");

const propName = (node) => {
  const prop = node.property;
  if (!node.computed) {
    if (t.isIdentifier(prop)) return prop.name;
    if (t.isStringLiteral(prop)) return prop.value;
    return null;
  }
  if (t.isStringLiteral(prop) || t.isNumericLiteral(prop)) return String(prop.value);
  return "*";
};

const extractPath = (memberPath) => {
  const segments = [];
  let current = memberPath;
  while (current && (current.isMemberExpression() || current.isOptionalMemberExpression())) {
    const name = propName(current.node);
    if (!name) break;
    segments.unshift(name);
    const obj = current.get("object");
    const objNode = obj.node;
    if (t.isIdentifier(objNode) && options.configNames.includes(objNode.name)) return segments;
    if (t.isThisExpression(objNode) && options.configNames.includes(name)) return segments.slice(1);
    if (t.isMemberExpression(objNode) || t.isOptionalMemberExpression(objNode)) {
      current = obj;
      continue;
    }
    if ((t.isIdentifier(objNode) || t.isThisExpression(objNode)) && options.configNames.includes(name)) {
      return segments.slice(1);
    }
    break;
  }
  return null;
};

const inferTypes = (node, memberPath, prop) => {
  const parent = memberPath.parentPath;
  const hints = new Set();
  if (parent?.isUnaryExpression({ operator: "!" }) || parent?.isLogicalExpression()) {
    hints.add("boolean");
  }
  if (parent?.isBinaryExpression()) {
    const { operator, left, right } = parent.node;
    if (["==", "===", "!=", "!=="].includes(operator)) {
      if (t.isBooleanLiteral(left) || t.isBooleanLiteral(right)) hints.add("boolean");
      if (t.isStringLiteral(left) || t.isStringLiteral(right)) hints.add("string");
      if (t.isNumericLiteral(left) || t.isNumericLiteral(right)) hints.add("number");
    }
  }
  const lower = prop.toLowerCase();
  if (/(timeout|delay|ms|time|count|limit)$/.test(lower)) hints.add("number");
  if (/(path|dir|folder|file|url|agent)$/i.test(prop)) hints.add("string");
  if (/^(is|has|use|enable|disable|allow|close|fast)/i.test(prop) || /mode$/i.test(prop)) {
    hints.add("boolean");
  }
  hints.forEach((tpe) => node.types.add(tpe));
};

const addPath = (segments, memberPath) => {
  let node = root;
  for (let i = 0; i < segments.length; i++) {
    let seg = segments[i];
    if (seg === "length" && i > 0) {
      node.types.add("array");
      break;
    }
    if (seg === "*" || /^\d+$/.test(seg)) {
      node.types.add("array");
      seg = "*";
    }
    if (!node.children.has(seg)) node.children.set(seg, makeNode(seg));
    node = node.children.get(seg);
    if (i === segments.length - 1) inferTypes(node, memberPath, seg);
  }
};

const toSchema = (node) => {
  const schema = {};
  const childSchemas = {};
  for (const [key, child] of node.children) {
    if (key !== "*") childSchemas[key] = toSchema(child);
  }
  const hasArray = node.types.has("array");
  const nonArray = [...node.types].filter((tpe) => tpe !== "array");
  if (hasArray) {
    const itemsNode = node.children.get("*");
    const itemsSchema =
      itemsNode?.children.size || itemsNode?.types.size
        ? toSchema(itemsNode)
        : Object.keys(childSchemas).length
          ? { type: "object", properties: childSchemas }
          : {};
    schema.type = "array";
    if (Object.keys(itemsSchema).length) schema.items = itemsSchema;
    return schema;
  }
  if (nonArray.length === 1) schema.type = nonArray[0];
  else if (nonArray.length > 1) schema.type = nonArray;
  else if (node.children.size > 0) schema.type = "object";
  if (Object.keys(childSchemas).length) schema.properties = childSchemas;
  return schema;
};

for (const file of files) {
  const code = fs.readFileSync(file, "utf8");
  let ast;
  try {
    ast = parse(code, {
      sourceType: "module",
      plugins: [
        "typescript",
        "jsx",
        "classProperties",
        "classPrivateProperties",
        "classPrivateMethods",
        "decorators-legacy",
        "dynamicImport",
        "importMeta",
        "optionalChaining",
        "objectRestSpread",
        "topLevelAwait",
      ],
    });
  } catch (err) {
    console.error(`Skipping ${file}: ${err.message}`);
    continue;
  }
  traverse(ast, {
    MemberExpression(path) {
      const segments = extractPath(path);
      if (segments) addPath(segments, path);
    },
    OptionalMemberExpression(path) {
      const segments = extractPath(path);
      if (segments) addPath(segments, path);
    },
  });
}

const properties = {};
for (const [key, child] of root.children) {
  properties[key] = toSchema(child);
}
const schema = {
  $schema: "http://json-schema.org/draft-07/schema#",
  title: `${options.configNames.join(", ")} schema`,
  type: "object",
  additionalProperties: true,
  properties,
};
const output = JSON.stringify(schema, null, 2);
if (options.out) {
  fs.writeFileSync(options.out, output);
  console.log(`Schema written to ${options.out}`);
} else {
  console.log(output);
}
