import { EntityParser } from 'simple-html-tokenizer';

import { Source } from '../source/source';
import traverse from '../traversal/traverse';
import { NodeVisitor } from '../traversal/visitor';
import Walker from '../traversal/walker';
import * as ASTv1 from '../v1/api';
import { PublicBuilders } from '../v1/public-builders';
import {
  NormalizedPreprocessOptions,
  preprocess,
  PreprocessInput,
  PreprocessOptions,
} from './preprocess';

/**
  ASTPlugins can make changes to the Glimmer template AST before
  compilation begins.
*/
export interface ASTPluginBuilder<TEnv extends ASTPluginEnvironment = ASTPluginEnvironment> {
  (env: TEnv): ASTPlugin;
}

export interface ASTPlugin {
  name: string;
  visitor: NodeVisitor;
}

export interface ASTPluginEnvironment {
  meta?: object;
  syntax: Syntax;
}

// export interface Syntax {
//   parse: typeof preprocess;
//   builders: typeof publicBuilder;
//   print: typeof print;
//   traverse: typeof traverse;
//   Walker: typeof Walker;
// }

export class Syntax {
  constructor(private options: NormalizedPreprocessOptions) {}

  readonly parse: typeof preprocess = (
    input: PreprocessInput,
    options?: PreprocessOptions
  ): ASTv1.Template => {
    const source = options
      ? Source.from(input, options)
      : Source.fromNormalized(input, this.options);

    return source.preprocess();
  };

  readonly builders = PublicBuilders.top(this.options);
  readonly print = print;
  readonly traverse = traverse;
  readonly Walker = Walker;
}

export class CodemodEntityParser extends EntityParser {
  // match upstream types, but never match an entity
  constructor() {
    super({});
  }

  parse(): string | undefined {
    return undefined;
  }
}
