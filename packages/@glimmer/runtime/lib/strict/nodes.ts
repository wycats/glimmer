import type { ElementBuilder, Environment, ModifierInstance } from '@glimmer/interfaces';
import type { Cache } from '@glimmer/validator';
import { createCache, getValue, isConst } from '@glimmer/validator';

export interface AppendContext {
  env: Environment;
  log?: DebugLog | undefined;
}

export interface DebugLog {
  log: (type: string, phase: 'render' | 'update', value: unknown) => void;
}

export interface RenderNode<T extends unknown | unknown[]> {
  (value: T): RenderNodeInstance;
}

export interface RenderNodeInstance {
  append: (builder: ElementBuilder, ctx: AppendContext) => UpdateNode | void;
}

export type PollResult = 'initial' | 'valid' | 'invalid' | 'constant';

export interface UpdateNode {
  (): PollResult;
}

export const AttributeNode: RenderNode<string | { name: string; value: string }> = (attribute) => {
  const { name, value } =
    typeof attribute === 'string' ? { name: attribute, value: '' } : attribute;
  return {
    append: (builder) => {
      builder.setStaticAttribute(name, value ?? '');
    },
  };
};

export const DynamicAttributeNode: RenderNode<{
  name: string;
  value: () => string;
  trusting?: boolean;
}> = ({ name, value, trusting = false }) => {
  const valueCache = createCache(value);
  return {
    append: (builder, { env }) => {
      const initial = getValue(valueCache) as string;

      if (isConst(valueCache)) {
        builder.setStaticAttribute(name, initial);
        return;
      }

      const node = builder.setDynamicAttribute(name, initial, trusting);
      let prev = initial;

      return () => {
        const next = getValue(valueCache) as string;
        if (next === prev) {
          return 'valid';
        } else {
          node.update(next, env);
          prev = next;
          return isConst(valueCache) ? 'constant' : 'invalid';
        }
      };
    },
  };
};

export const ElementNode: RenderNode<{
  tag: string;
  attributes?: RenderNodeInstance[];
  modifiers?: ModifierInstance[];
  children?: RenderNodeInstance[];
}> = (element) => {
  const { tag, attributes, modifiers, children } = element;
  const attrFrag = attributes ? FragmentNode(attributes) : null;
  const bodyFrag = children ? FragmentNode(children) : null;

  return {
    append: (builder, ctx) => {
      builder.openElement(tag);
      const attrUpdates = cacheForUpdate(attrFrag?.append(builder, ctx));
      builder.flushElement(modifiers);
      const bodyUpdates = cacheForUpdate(bodyFrag?.append(builder, ctx));
      builder.closeElement();

      if (attrUpdates || bodyUpdates) {
        return () => {
          return combine(attrUpdates, bodyUpdates);
        };
      }
    },
  };
};

function cacheForUpdate(node: UpdateNode | undefined | void) {
  return node ? createCache(node) : undefined;
}

function combine(...updates: (Cache<PollResult> | undefined)[]): PollResult {
  let validations: PollResult[] = [];

  for (const update of updates) {
    if (update === undefined) {
      continue;
    }

    const result = getValue(update) as PollResult;
    validations.push(result);
  }

  // @todo make this more efficient
  if (validations.length === 0) {
    return 'constant';
  } else if (validations.every((result) => result === 'valid')) {
    return 'valid';
  } else if (validations.every((result) => result === 'constant')) {
    return 'constant';
  } else {
    return 'invalid';
  }
}

export const FragmentNode: RenderNode<RenderNodeInstance[]> = (nodes) => {
  return {
    append: (builder, ctx) => {
      const updates: UpdateNode[] = [];
      for (const node of nodes) {
        const update = node.append(builder, ctx);
        if (update) {
          updates.push(update);
        }
      }

      if (updates.length === 0) {
        return;
      }

      return () => {
        const results = updates.map((update) => update());

        // @todo make this more efficient
        if (results.every((result) => result === 'valid')) {
          return 'valid';
        } else if (results.every((result) => result === 'constant')) {
          return 'constant';
        } else {
          return 'invalid';
        }
      };
    },
  };
};

export const TextNode: RenderNode<string> = (text) => ({
  append: (builder) => {
    builder.appendText(text);
  },
});

export const HtmlNode: RenderNode<string> = (text) => ({
  append: (builder) => {
    builder.appendHTML(text);
  },
});

export const DynamicTextNode: RenderNode<() => string> = (text) => {
  const textCache = createCache(text);
  return {
    append: (builder, { log }) => {
      const initial = getValue(textCache) as string;
      const node = builder.appendText(initial);

      let last = { node, value: initial };

      log?.log('TextNode', 'render', initial);

      if (isConst(textCache)) {
        return;
      }

      return (): PollResult => {
        const next = getValue(textCache) as string;
        if (next === last.value) {
          return 'valid';
        } else {
          last.value = next;
          last.node.nodeValue = next;

          log?.log('TextNode', 'update', next);

          return isConst(textCache) ? 'constant' : 'invalid';
        }
      };
    },
  };
};

export const DynamicHtmlNode: RenderNode<() => string> = (text) => {
  const textCache = createCache(text);
  return {
    append: (builder, { log }) => {
      const initial = getValue(textCache) as string;
      const node = builder.appendDynamicHTML(initial);

      let last = { node, value: initial };

      log?.log('TextNode', 'render', initial);

      if (isConst(textCache)) {
        return;
      }

      return (): PollResult => {
        const next = getValue(textCache) as string;
        if (next === last.value) {
          return 'valid';
        } else {
          last.value = next;
          last.node.nodeValue = next;

          log?.log('TextNode', 'update', next);

          return isConst(textCache) ? 'constant' : 'invalid';
        }
      };
    },
  };
};
