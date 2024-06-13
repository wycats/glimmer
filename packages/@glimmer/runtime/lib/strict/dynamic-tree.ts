import type { ElementBuilder } from '@glimmer/interfaces';

import type { AppendContext, RenderNodeInstance, UpdateNode } from './render';

export class DynamicTreeBuilder {
  readonly #builder: ElementBuilder;

  constructor(builder: ElementBuilder) {
    this.#builder = builder;
  }

  append(node: RenderNodeInstance, ctx: AppendContext): void | UpdateNode {
    return node.append({ buffer: this.#builder, ...ctx });
  }
}
