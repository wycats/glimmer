import type { Nullable } from '../core.js';
import type { Bounds } from './bounds.js';
import type { Namespace, SimpleComment, SimpleElement, SimpleNode, SimpleText } from './simple.js';

export interface GlimmerDOMOperations {
  createElement(tag: string, context?: SimpleElement): SimpleElement;
  insertBefore(parent: SimpleElement, node: SimpleNode, reference: Nullable<SimpleNode>): void;
  insertHTMLBefore(parent: SimpleElement, nextSibling: Nullable<SimpleNode>, html: string): Bounds;
  createTextNode(text: string): SimpleText;
  createComment(data: string): SimpleComment;
}

export interface GlimmerTreeChanges extends GlimmerDOMOperations {
  setAttribute(element: SimpleElement, name: string, value: string): void;
  removeAttribute(element: SimpleElement, name: string): void;
  setProperty(element: SimpleElement, name: string, value: unknown): void;
  insertAfter(element: SimpleElement, node: SimpleNode, reference: SimpleNode): void;
}

export interface GlimmerTreeConstruction extends GlimmerDOMOperations {
  setAttribute(
    element: SimpleElement,
    name: string,
    value: string,
    namespace?: Nullable<Namespace>
  ): void;
}
