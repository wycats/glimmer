import { Simple, Option, Opaque } from '@glimmer/interfaces';
import { assert } from '@glimmer/util';

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
  return obj && obj[key];
}
