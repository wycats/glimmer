import { keys } from '@glimmer/util';

import type { EventRecorder, TestConstructor } from './test-helpers/module';

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
  | ((scenario?: Scenario | undefined) => void | Promise<void>)
  | ((scenario: Scenario) => void | Promise<void>);

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
export type ScenarioFn = (options: Scenario) => void | Promise<void>;

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
