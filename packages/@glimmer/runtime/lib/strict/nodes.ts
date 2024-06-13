import type { ModifierInstance } from '@glimmer/interfaces';
import type { Cache } from '@glimmer/validator';
import { createCache, getValue } from '@glimmer/validator';

import type { PollResult, RenderNode, RenderNodeInstance, UpdateNode } from './render';

import { replace } from '../bounds';
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
  trusting?: boolean;
}> = ({ name, value, trusting = false }) => {
  const valueCache = createCache(value);

  return render('DynamicAttribute', [valueCache], {
    render: (ctx, value) => {
      const node = ctx.buffer.setDynamicAttribute(name, value, trusting);

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
        buffer.setStaticAttribute(name, attrValue);
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

export type IntoRenderNodeInstance = RenderNodeInstance | RenderNodeInstance[];

export function intoRenderNodeInstance(node: IntoRenderNodeInstance): RenderNodeInstance;
export function intoRenderNodeInstance(
  node: IntoRenderNodeInstance | undefined
): RenderNodeInstance | undefined;
export function intoRenderNodeInstance(
  node: IntoRenderNodeInstance | undefined
): RenderNodeInstance | undefined {
  if (Array.isArray(node)) {
    return FragmentNode(node);
  } else {
    return node;
  }
}

export type IntoAttrValue = string | boolean | (() => string | boolean);

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
  attr: (name: string, value: IntoAttrValue, trusting = false) => {
    if (typeof value === 'function') {
      return DynamicAttributeNode({ name, value, trusting });
    } else {
      return AttributeNode({ name, value });
    }
  },
  el: (
    tag: string,
    options: {
      attrs?: Record<string, string | boolean | (() => string | boolean)>;
      props?: Record<string, () => unknown>;
      modifiers?: ModifierInstance[];
      body?: IntoRenderNodeInstance;
    } = {}
  ) => {
    const attributes = options.attrs
      ? Object.entries(options.attrs).map(([name, value]) => {
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

    return ElementNode({
      tag,
      attributes: [...attributes, ...props],
      modifiers: options.modifiers,
      body: intoRenderNodeInstance(options.body),
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
