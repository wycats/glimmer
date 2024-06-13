import type { ElementBuilder, Environment } from '@glimmer/interfaces/index';
import type { Cache } from '@glimmer/validator/index';
import { createCache, getValue, isConst } from '@glimmer/validator/index';

import { NewElementBuilder } from '../vm/element-builder';

export interface AppendContext {
  env: Environment;

  log?: DebugLog | undefined;
}

export interface RenderContext extends AppendContext {
  buffer: ElementBuilder;
}

export interface DebugLog {
  log: (type: string, phase: 'render' | 'const' | 'update', value: unknown) => void;
}

export interface RenderNode<T extends unknown | unknown[]> {
  (value: T): RenderNodeInstance;
}

export interface RenderNodeInstance {
  append: (ctx: { buffer: ElementBuilder } & AppendContext) => UpdateNode | void;
}

export type PollResult = 'initial' | 'valid' | 'invalid' | 'constant';

export interface UpdateNode<Args extends unknown[] = []> {
  (...args: Args): PollResult;
}

type ArgsCaches = Cache<unknown>[];
type ArgsValues<C extends ArgsCaches> = {
  [P in keyof C]: C[P] extends Cache<infer U> ? U : never;
};
interface AppendBlockOptions<C extends ArgsCaches = ArgsCaches> {
  render: (
    ctx: RenderContext,
    ...args: ArgsValues<C>
  ) => UpdateNode<ArgsValues<C>> | undefined | void;
}
interface AppendOptions<T extends ArgsCaches = ArgsCaches> {
  render: (
    ctx: RenderContext,
    ...args: ArgsValues<T>
  ) => ((...args: ArgsValues<T>) => PollResult | void | undefined) | undefined | void;
}

export function renderStatic<T extends unknown[]>(
  name: string,
  args: T,
  { render }: { render: (ctx: RenderContext, ...args: T) => void }
): RenderNodeInstance {
  return {
    append: (ctx) => {
      ctx.log?.log(name, 'render', { args });
      render(ctx, ...args);
    },
  };
}
export function render<T extends ArgsCaches>(
  name: string,
  args: T,
  { render }: AppendOptions<T>
): RenderNodeInstance {
  return {
    append: (ctx) => {
      const argsCache = createCache(() => args.map(getValue));
      const initialArgs = getValue(argsCache) as ArgsValues<T>;

      if (isConst(argsCache)) {
        render(ctx, ...initialArgs);
        return;
      }

      ctx.log?.log(name, 'render', { args: initialArgs });
      const updates = render(ctx, ...initialArgs);
      if (!updates) return;

      const last = { args: initialArgs, updates };

      return () => {
        const nextArgs = getValue(argsCache) as ArgsValues<T>;

        if (eq(last.args, nextArgs)) return 'valid';

        last.args = nextArgs;

        ctx.log?.log(name, 'update', { args: nextArgs });
        const next = updates(...nextArgs);

        if (isConst(argsCache) && next === 'constant') {
          return 'constant';
        }

        return next ?? 'invalid';
      };
    },
  };
}
export function renderBlock<T extends ArgsCaches>(
  name: string,
  args: T,
  { render }: AppendBlockOptions<T>
): RenderNodeInstance {
  return {
    append: (ctx) => {
      const { env, buffer } = ctx;
      const argsCache = createCache(() => args.map(getValue));
      const initialArgs = getValue(argsCache) as ArgsValues<T>;

      if (isConst(argsCache)) {
        ctx.log?.log(name, 'const', { args: initialArgs });
        render(ctx, ...initialArgs);
        return;
      }

      const block = buffer.pushUpdatableBlock();
      const updates = render(ctx, ...initialArgs);
      buffer.popBlock();

      if (!updates) return;

      const last = { args: initialArgs, updates };

      return () => {
        const nextArgs = getValue(argsCache) as ArgsValues<T>;

        if (eq(last.args, nextArgs)) {
          // recurse into the child updates
          return last.updates(...nextArgs);
        }

        last.args = nextArgs;
        const updateBuffer = NewElementBuilder.resume(env, block);

        const updates = render({ ...ctx, buffer: updateBuffer }, ...nextArgs);
        let result: PollResult;

        if (updates) {
          last.updates = updates;
          result = 'invalid';
        } else if (isConst(argsCache)) {
          result = 'constant';
        } else {
          result = 'invalid';
        }

        updateBuffer.popBlock();
        return result;
      };
    },
  };
}

function eq(prev: unknown[], next: unknown[]): boolean {
  return prev.length === next.length && prev.every((value, i) => value === next[i]);
}
