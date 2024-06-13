import type { Bounds, ElementBuilder, SimpleElement, SimpleNode } from '@glimmer/interfaces';
import type { DebugLog, IntoRenderNodeInstance } from '@glimmer/runtime';
import {
  Cursor,
  DynamicTreeBuilder,
  intoRenderNodeInstance,
  StrictRuntime,
} from '@glimmer/runtime';
import { COMMENT_NODE, keys } from '@glimmer/util';

import type { NodesSnapshot } from './snapshot';
import type { TestConstructor } from './test-helpers/module';

import { toHTML, toInnerHTML } from './dom/simple-utils';
import { normalizeSnapshot } from './snapshot';
import { EventRecorder } from './test-helpers/module';

export type DeclaredComponentKind = 'glimmer' | 'curly' | 'dynamic' | 'templateOnly';

export interface ComponentTestMeta {
  kind?: DeclaredComponentKind;
  skip?: boolean | DeclaredComponentKind;
}

export function test(meta: ComponentTestMeta): MethodDecorator;
export function test<T>(
  _target: Object | ComponentTestMeta,
  _name?: string,
  descriptor?: TypedPropertyDescriptor<T>
): TypedPropertyDescriptor<T> | void;
export function test(...args: any[]) {
  if (args.length === 1) {
    let meta: ComponentTestMeta = args[0];
    return (_target: Object, _name: string, descriptor: PropertyDescriptor) => {
      let testFunction = descriptor.value;
      keys(meta).forEach((key) => (testFunction[key] = meta[key]));
      setTestingDescriptor(descriptor);
    };
  }

  let descriptor = args[2];
  setTestingDescriptor(descriptor);
  return descriptor;
}

function setTestingDescriptor(descriptor: PropertyDescriptor): void {
  let testFunction = descriptor.value;
  descriptor.enumerable = true;
  testFunction['isTest'] = true;
}

export const SCENARIO = new WeakSet<Function>();

type ScenarioMethod =
  | ((ctx?: TestContext | undefined) => void | Promise<void>)
  | ((scenario: TestContext) => void | Promise<void>);

export function scenario<S extends ScenarioMethod>(
  _target: Object,
  _name: string,
  descriptor?: TypedPropertyDescriptor<S>
) {
  const testFunction = descriptor?.value;

  if (typeof testFunction === 'function') {
    SCENARIO.add(testFunction);
  }

  return descriptor;
}

export type Scenario = { assert: Assert; events: EventRecorder };
export type ScenarioFn = (options: TestContext) => void | Promise<void>;

export function getScenarios(Class: TestConstructor<unknown>): Record<string, ScenarioFn> {
  const scenarios: Record<string, ScenarioFn> = {};
  let current = Class.prototype;

  while (current) {
    const descs = Object.getOwnPropertyDescriptors(current);
    const entries = Object.entries(descs).flatMap(([key, desc]) => {
      if (typeof desc.value === 'function' && SCENARIO.has(desc.value)) {
        return [[key, desc.value]];
      } else {
        return [];
      }
    });

    for (const [key, value] of entries) {
      scenarios[key] = value;
    }

    current = Object.getPrototypeOf(current);
  }

  return scenarios;
}

export class TestContext {
  readonly ctx: StrictRuntime;
  readonly element: SimpleElement;
  readonly builder: ElementBuilder;
  readonly tree: DynamicTreeBuilder;
  readonly events: EventRecorder = new EventRecorder();
  readonly assert: (typeof QUnit)['assert'];

  constructor(assert: Assert) {
    this.assert = assert;
    const ctx = (this.ctx = StrictRuntime.browser());
    const element = (this.element = ctx.append.createElement('div'));
    const builder = (this.builder = ctx.elements(Cursor({ parent: element }), {
      for: 'initial-render',
    }));

    this.tree = new DynamicTreeBuilder(builder);

    builder.pushSimpleBlock();
  }

  new(): TestContext {
    return new TestContext(this.assert);
  }

  assertStableNodes(
    block: () => void,
    { except: _except }: { except: SimpleNode | SimpleNode[] } = {
      except: [],
    }
  ) {
    const prev = this.#takeSnapshot();

    let except: Array<SimpleNode>;

    if (Array.isArray(_except)) {
      except = uniq(_except);
    } else {
      except = [_except];
    }

    block();

    let { oldSnapshot, newSnapshot } = normalizeSnapshot(prev, this.#takeSnapshot(), except);

    this.assert.deepEqual(oldSnapshot, newSnapshot, 'DOM nodes are stable');
  }

  #takeSnapshot(): NodesSnapshot {
    let snapshot: NodesSnapshot = [];

    let node = this.element.firstChild;
    let upped = false;

    while (node && node !== this.element) {
      if (upped) {
        if (node.nextSibling) {
          node = node.nextSibling;
          upped = false;
        } else {
          snapshot.push('up');
          node = node.parentNode;
        }
      } else {
        if (!isServerMarker(node)) snapshot.push(node);

        if (node.firstChild) {
          snapshot.push('down');
          node = node.firstChild;
        } else if (node.nextSibling) {
          node = node.nextSibling;
        } else {
          snapshot.push('up');
          node = node.parentNode;
          upped = true;
        }
      }
    }

    return snapshot;
  }

  append(node: IntoRenderNodeInstance, options: { expect: string; log?: DebugLog }) {
    const update = this.tree.append(intoRenderNodeInstance(node), {
      log: options.log,
      env: this.ctx.env,
    });
    const result = this.rendered(options.expect);

    const appended = {
      revalidate: (options: { expect: string; stable?: { except: SimpleNode | SimpleNode[] } }) => {
        this.assertStableNodes(() => {
          update?.();
          result.updated(options.expect);
        }, options.stable);

        this.assertStableNodes(() => {
          // no-op rerender
          update?.();
          result.updated(options.expect);
        });
      },
    };

    // no-op rerender
    appended.revalidate(options);

    return appended;
  }

  rendered(content: string) {
    const block = this.builder.popBlock();

    this.assert.ok(true, `Expected content: ${content}`);
    this.assert.strictEqual(
      toInnerHTML(this.element),
      content,
      `The element has the expected content`
    );
    this.assert.strictEqual(boundsToHTML(block), content, `The block has the expected content`);

    // @todo assertStableRerender (it will be a noop in these static tests, but once it works, we
    // need to verify that it's a noop)

    return {
      block,
      updated: (expected: string) => {
        this.assert.ok(true, `Expected content (updated): ${expected}`);
        this.assert.strictEqual(
          toInnerHTML(this.element),
          expected,
          `The element has the expected content`
        );
        this.assert.strictEqual(
          boundsToHTML(block),
          expected,
          `The block has the expected content`
        );
      },
    };
  }
}

function boundsToHTML(bounds: Bounds) {
  const first = bounds.firstNode();
  const last = bounds.lastNode();

  let out = '';
  let current: SimpleNode | null = first;

  while (current && current !== last.nextSibling) {
    out += toHTML(current);
    current = current.nextSibling;
  }

  return out;
}

function uniq<T>(arr: T[]): T[] {
  return arr.reduce((accum: T[], val) => {
    if (accum.indexOf(val) === -1) accum.push(val);
    return accum;
  }, [] as T[]);
}

export function isServerMarker(node: SimpleNode) {
  return node.nodeType === COMMENT_NODE && node.nodeValue.charAt(0) === '%';
}
