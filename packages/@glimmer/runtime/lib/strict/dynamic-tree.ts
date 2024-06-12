import type { ElementBuilder } from '@glimmer/interfaces';

import type { AppendContext, RenderNodeInstance, UpdateNode } from './nodes';

export class DynamicTreeBuilder {
  readonly #builder: ElementBuilder;

  constructor(builder: ElementBuilder) {
    this.#builder = builder;
  }

  append(node: RenderNodeInstance, ctx: AppendContext): void | UpdateNode {
    return node.append(this.#builder, ctx);
  }
}
