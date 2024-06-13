import type { ModifierInstance } from '@glimmer/interfaces';
import type { Cache } from '@glimmer/validator';
import { createCache, getValue } from '@glimmer/validator';

import type { PollResult, RenderNode, RenderNodeInstance, UpdateNode } from './render';

import { replace } from '../bounds';
import { ADJUST_FOREIGN_ATTRIBUTES } from './html';
import { render, renderBlock, renderStatic } from './render';

export interface IfNodeOptions {
  condition: () => unknown;
  then: RenderNodeInstance;
  else?: RenderNodeInstance | undefined;
}

export const IfNode: RenderNode<IfNodeOptions> = ({ condition, then, else: inverse }) => {
  const conditionCache = createCache(condition);

  return renderBlock('If', [conditionCache], {
    render: (ctx, condition) => {
      if (condition) {
        return then.append(ctx);
      } else if (inverse) {
        return inverse.append(ctx);
      }
    },
  });
};

export type AttrValue = string | boolean;

export const DynamicAttributeNode: RenderNode<{
  name: string;
  value: () => AttrValue;
  trusting?: boolean | undefined;
}> = ({ name, value, trusting = false }) => {
  const valueCache = createCache(value);

  return render('DynamicAttribute', [valueCache], {
    render: (ctx, value) => {
      const node = ctx.buffer.setDynamicAttribute(
        name,
        value,
        trusting,
        ADJUST_FOREIGN_ATTRIBUTES[name] ?? null
      );

      return (next) => {
        node.update(next, ctx.env);
      };
    },
  });
};

export const DynamicPropertyNode: RenderNode<{
  name: string;
  value: () => unknown;
}> = ({ name, value }) => {
  const valueCache = createCache(value);

  return render('DynamicProperty', [valueCache], {
    render: (ctx, value) => {
      ctx.buffer.setProperty(name, value);
      const element = ctx.buffer.constructing!;

      return (next) => {
        ctx.env.getDOM().setProperty(element, name, next);
      };
    },
  });
};

export const ElementNode: RenderNode<{
  tag: string;
  attributes?: RenderNodeInstance[] | undefined;
  modifiers?: ModifierInstance[] | undefined;
  body?: RenderNodeInstance | undefined;
}> = (element) => {
  const { tag, attributes, modifiers, body } = element;
  const attrFrag = attributes ? FragmentNode(attributes) : null;

  return {
    append: (ctx) => {
      ctx.buffer.openElement(tag);
      const attrUpdates = cacheForUpdate(attrFrag?.append(ctx));
      ctx.buffer.flushElement(modifiers);
      const bodyUpdates = cacheForUpdate(body?.append(ctx));
      ctx.buffer.closeElement();

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
    append: (ctx) => {
      const updates: UpdateNode[] = [];
      for (const node of nodes) {
        const update = node.append(ctx);
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

export const TextNode: RenderNode<string> = (text) =>
  renderStatic('Text', [text], { render: (ctx, text) => ctx.buffer.appendText(text) });

export const HtmlNode: RenderNode<string> = (text) =>
  renderStatic('Html', [text], { render: (ctx, text) => ctx.buffer.appendHTML(text) });

export const DynamicTextNode: RenderNode<() => string> = (text) => {
  const textCache = createCache(text);

  return render('~Text', [textCache], {
    render: (ctx, text) => {
      const node = ctx.buffer.appendDynamicText(text);

      return (next) => {
        node.nodeValue = next;
      };
    },
  });
};

export const DynamicHtmlNode: RenderNode<() => string> = (text) => {
  const textCache = createCache(text);

  return render('~Html', [textCache], {
    render: (ctx, text) => {
      let bounds = ctx.buffer.appendDynamicHTML(text);

      return (next) => {
        bounds = replace(bounds, (cursor) =>
          ctx.env.getDOM().insertHTMLBefore(cursor.element, cursor.nextSibling, next)
        );
      };
    },
  });
};

export const AttributeNode: RenderNode<string | { name: string; value: string | boolean }> = (
  attribute
) => {
  const { name, value } =
    typeof attribute === 'string' ? { name: attribute, value: true } : attribute;
  return {
    append: ({ buffer }) => {
      const attrValue = toAttrValue(name, value);
      if (attrValue !== undefined) {
        buffer.setStaticAttribute(name, attrValue, ADJUST_FOREIGN_ATTRIBUTES[name] ?? null);
      }
    },
  };
};

export const PropertyNode: RenderNode<{ name: string; value: unknown }> = ({ name, value }) => {
  return {
    append: ({ buffer }) => {
      buffer.setProperty(name, value);
    },
  };
};

function toAttrValue(name: string, value: string | boolean): string | undefined {
  if (value === true) {
    return '';
  } else if (value !== false) {
    return value;
  }
}

export type IntoRenderNodeInstance = string | RenderNodeInstance | RenderNodeInstance[];

export function intoRenderNodeInstance(node: IntoRenderNodeInstance): RenderNodeInstance;
export function intoRenderNodeInstance(
  node: IntoRenderNodeInstance | undefined
): RenderNodeInstance | undefined;
export function intoRenderNodeInstance(
  node: IntoRenderNodeInstance | undefined
): RenderNodeInstance | undefined {
  if (Array.isArray(node)) {
    return FragmentNode(node);
  } else if (typeof node === 'string') {
    return TextNode(node);
  } else {
    return node;
  }
}

export type IntoAttrValue = string | boolean | (() => string | boolean);

interface FullElOptions {
  tag: string;
  attrs?: Record<string, IntoAttrValue>;
  props?: Record<string, () => unknown>;
  modifiers?: ModifierInstance[];
  body?: IntoRenderNodeInstance[];
}

type ElOptions =
  | [tag: string]
  | [tag: string, body: IntoRenderNodeInstance[]]
  | [tag: string, attributes: Record<string, IntoAttrValue>]
  | [
      tag: string,
      body: IntoRenderNodeInstance[],
      options: { props?: Record<string, () => unknown>; modifiers?: ModifierInstance[] },
    ]
  | [tag: string, attributes: Record<string, IntoAttrValue>, body: IntoRenderNodeInstance[]]
  | [
      tag: string,
      attributes: Record<string, IntoAttrValue>,
      body: IntoRenderNodeInstance[],
      options: {
        props?: Record<string, () => unknown>;
        modifiers?: ModifierInstance[];
      },
    ];

function intoElOptions(options: ElOptions): FullElOptions {
  const [tag, ...rest] = options;

  if (rest.length === 0) {
    return { tag };
  }

  if (rest.length === 1) {
    const [first] = rest;
    if (Array.isArray(first)) {
      return { tag, body: first };
    } else {
      return { tag, attrs: unwrap(first) };
    }
  }

  if (Array.isArray(rest[0])) {
    const [body, options] = rest as Extract<typeof rest, { 0: unknown[] }>;
    return { tag, body, ...options };
  }

  const [attrs, body, extra] = rest as unknown as Exclude<typeof rest, { 0: unknown[] }>;
  return { tag, attrs, body, ...extra };
}

export const nodes = {
  if: (
    condition: () => unknown,
    { then, else: inverse }: { then: IntoRenderNodeInstance; else?: IntoRenderNodeInstance }
  ) => {
    return IfNode({
      condition,
      then: intoRenderNodeInstance(then),
      else: intoRenderNodeInstance(inverse),
    });
  },
  attr: (name: string, value: IntoAttrValue, options: { trusting?: boolean } = {}) => {
    if (typeof value === 'function') {
      return DynamicAttributeNode({
        name,
        value,
        trusting: options.trusting,
      });
    } else {
      return AttributeNode({ name, value });
    }
  },
  el: (...args: ElOptions) => {
    const { tag, attrs, body, ...options } = intoElOptions(args);

    const attributes = attrs
      ? Object.entries(attrs).map(([name, value]) => {
          if (typeof value === 'function') {
            return DynamicAttributeNode({ name, value });
          } else {
            return AttributeNode({ name, value });
          }
        })
      : [];

    const props = options.props
      ? Object.entries(options.props).map(([name, value]) => DynamicPropertyNode({ name, value }))
      : [];

    const bodyFragment = body
      ? FragmentNode(body.map(intoRenderNodeInstance).filter((v) => v !== undefined))
      : undefined;

    return ElementNode({
      tag,
      attributes: [...attributes, ...props],
      modifiers: options.modifiers,
      body: bodyFragment,
    });
  },
  text: (text: string | (() => string)) => {
    if (typeof text === 'function') {
      return DynamicTextNode(text);
    } else {
      return TextNode(text);
    }
  },
  html: (text: string | (() => string)) => {
    if (typeof text === 'function') {
      return DynamicHtmlNode(text);
    } else {
      return HtmlNode(text);
    }
  },
};

function unwrap<T>(value: T | undefined): T {
  if (import.meta.env.DEV) {
    if (value === undefined) {
      throw new Error('Expected value to be defined');
    }
  }

  return value as T;
}
