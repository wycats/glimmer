import { Maybe } from '@glimmer/interfaces';
import intern from './intern';

export type Factory<T> = new (...args: unknown[]) => T;

export const HAS_NATIVE_PROXY = typeof Proxy === 'function';

export const HAS_NATIVE_SYMBOL = (function () {
  if (typeof Symbol !== 'function') {
    return false;
  }

  // eslint-disable-next-line symbol-description
  return typeof Symbol() === 'symbol';
})();

export function keys<T>(obj: T): Array<keyof T> {
  return Object.keys(obj) as Array<keyof T>;
}

export function unwrapped<T>(val: Maybe<T>): T {
  if (val === null || val === undefined) throw new Error(`Expected value to be present`);
  return val as T;
}

export function unwrap<T>(val: Maybe<T>): asserts val is T {
  unwrapped(val);
}

type PresenceOptions = string | { variable: string } | { method: [string, ...string[]] };

export function existing<T>(val: Maybe<T>, options: PresenceOptions): T {
  if (val === null || val === undefined) throw Error(message(options));
  return val as T;
}

function message(options: PresenceOptions) {
  if (typeof options === 'string') {
    return options;
  }

  if ('variable' in options) {
    return `Expected ${options.variable} to be present`;
  } else if ('method' in options) {
    return `Expected a call to ${options.method.join('.')}() to be present`;
  } else {
    exhausted(options);
  }
}

export function exists<T>(
  val: T | null | undefined | void,
  options: PresenceOptions
): asserts val is T {
  existing(val, options);
}

export function unreachable(message = 'unreachable'): Error {
  return new Error(message);
}

export function exhausted(value: never): never {
  throw new Error(`Exhausted ${value}`);
}

export type Lit = string | number | boolean | undefined | null | void | {};

export const tuple = <T extends Lit[]>(...args: T) => args;

export function enumerableSymbol(key: string): any {
  return intern(`__${key}${Math.floor(Math.random() * Date.now())}__`);
}

export const symbol = HAS_NATIVE_SYMBOL ? Symbol : enumerableSymbol;
