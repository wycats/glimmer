import { Simple, Option, Opaque } from '@glimmer/interfaces';
import { assert } from '@glimmer/util';
import { Tag, CURRENT_TAG, CONSTANT_TAG } from '@glimmer/reference';

export {};

export function println(s: string): void {
  console.log(s);
}

export interface DOMTree {
  createElement(tag: string): Simple.Element;
  createTextNode(data: string): Simple.Text;
  insertBefore(
    parent: Simple.Element,
    node: Simple.Node,
    reference: Option<Simple.Node>
  ): void;
  setAttribute(element: Simple.Element, name: string, value: string): void;
}

class BrowserDOMTree implements DOMTree {
  constructor(private document: Simple.Document) {}

  createElement(tag: string): Simple.Element {
    return this.document.createElement(tag);
  }

  createTextNode(data: string): Simple.Text {
    return this.document.createTextNode(data);
  }

  insertBefore(
    parent: Simple.Element,
    node: Simple.Node,
    reference: Option<Simple.Node>
  ): void {
    parent.insertBefore(node, reference);
  }

  setAttribute(element: Simple.Element, name: string, value: string): void {
    element.setAttribute(name, value);
  }

  toString(): string {
    return "[object BrowserDOMTree]";
  }
}

export function browserDOMTree(): DOMTree {
  assert(
    typeof document === 'object',
    'BrowserDOMTree only works in a browser environment'
  );

  return new BrowserDOMTree(document);
}

export function createElement(tree: DOMTree, tag: string): Simple.Element {
  return tree.createElement(tag);
}

export function createTextNode(tree: DOMTree, data: string): Simple.Text {
  return tree.createTextNode(data);
}

export function insertBefore(
  tree: DOMTree,
  parent: Simple.Element,
  node: Simple.Node,
  reference: Simple.Node
): void {
  tree.insertBefore(parent, node, reference);
}

export function append(
  tree: DOMTree,
  parent: Simple.Element,
  node: Simple.Node
): void {
  tree.insertBefore(parent, node, null);
}

export function setAttribute(
  tree: DOMTree,
  element: Simple.Element,
  name: string,
  value: string
): void {
  tree.setAttribute(element, name, value);
}

export function get(obj: object, key: string): Opaque {
  console.log(obj, key);
  return obj && obj[key];
}

export function isEqual(a: Opaque, b: Opaque): boolean {
  return a === b;
}

export function toString(a: Opaque): string {
  try {
    return String(a);
  } catch(_) {
    return JSON.stringify(a) || "undefined";
  }
}

export function toBoolean(a: Opaque): boolean {
  return !!a;
}

export function debugElement(e: Simple.Element): string {
  let tag = [e.tagName.toLowerCase()];

  for (let i = 0; i < e.attributes.length; i++) {
    tag.push(`${e.attributes[i].name}=${JSON.stringify(e.attributes[i].value)}`);
  }

  return `<${tag.join(" ")}>`;
}

export function debugNode(e: Simple.Node): string {
  if (e.nodeType === 1) {
    return debugElement(e as Simple.Element);
  } else if (e.nodeType === 3) {
    return `<#text ${e.nodeValue}>`;
  } else {
    return String(e);
  }
}

export function tagValue(tag: Tag): number {
  return tag.value();
}

export function tagValidate(tag: Tag, snapshot: number): boolean {
  return tag.validate(snapshot);
}

export function tagForProperty(parent: Opaque, key: string): Tag {
  return CURRENT_TAG;
}

export function isConst(tag: Tag): boolean {
  return tag === CONSTANT_TAG;
}

export function innerHTML(element: Simple.Element): string {
  if (element instanceof Element) {
    return element.innerHTML;
  } else {
    throw new Error("innerHTML not supported yet on Simple.Element");
  }
}

export function outerHTML(element: Simple.Element): string {
  if (element instanceof Element) {
    return element.outerHTML;
  } else {
    throw new Error("innerHTML not supported yet on Simple.Element");
  }
}

export function stringify(object: Opaque): string {
  let out = JSON.stringify(object);

  if (out === undefined) {
    return "undefined";
  } else {
    return out;
  }
}

export function collapsed(header: string, body: string) {
  console.groupCollapsed(header);
  console.log(body);
  console.groupEnd();
}
