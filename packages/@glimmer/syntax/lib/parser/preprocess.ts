import { Option } from '@glimmer/interfaces';

import { SourceTemplate } from '../source/source';
import * as ASTv1 from '../v1/api';
import * as HBS from '../v1/handlebars-ast';
import { ASTPluginBuilder } from './plugins';

interface HandlebarsParseOptions {
  srcName?: string;
  ignoreStandalone?: boolean;
}

export type EmbedderLocals = (name: string) => boolean;

export interface TemplateIdFn {
  (src: string): Option<string>;
}

export interface PrecompileOptions extends PreprocessOptions {
  id?: TemplateIdFn;
  customizeComponentName?(input: string): string;
}

export function optionsWithDefaultModule<P extends PreprocessOptions>(
  options: P,
  module: string
): P & { meta: { moduleName: string } } {
  if (options?.meta?.moduleName) {
    return options as P & { meta: { moduleName: string } };
  } else {
    return {
      ...options,
      meta: {
        ...options?.meta,
        moduleName: module,
      },
    };
  }
}

export interface PreprocessOptions {
  strictMode?: boolean;
  locals?: EmbedderLocals | string[];
  meta?: {
    moduleName?: string;
  };
  plugins?: {
    ast?: ASTPluginBuilder[];
  };
  parseOptions?: HandlebarsParseOptions;
  customizeComponentName?: (input: string) => string;

  /**
    Useful for specifying a group of options together.

    When `'codemod'` we disable all whitespace control in handlebars
    (to preserve as much as possible) and we also avoid any
    escaping/unescaping of HTML entity codes.
   */
  mode?: 'codemod' | 'precompile';
}

export function normalize(
  module: string,
  options?: PreprocessOptions
): NormalizedPreprocessOptions {
  return NormalizedPreprocessOptions.from(options, module);
}

function normalizeLocals(locals: EmbedderLocals | string[] | undefined): (name: string) => boolean {
  if (typeof locals === 'function') {
    return locals;
  } else if (locals) {
    return (name: string) => locals.includes(name);
  } else {
    return () => false;
  }
}

export interface ModuleName {
  name: string;
  synthesized: boolean;
}

export interface NormalizedPreprocessFields {
  readonly module: ModuleName;
  readonly meta: object;
  readonly mode: {
    readonly strictness: 'strict' | 'loose';
    readonly purpose: 'codemod' | 'precompile';
  };
  readonly embedder: {
    readonly hasBinding: (name: string) => boolean;
  };
  readonly plugins: {
    ast: ASTPluginBuilder[];
  };
  readonly customize: {
    readonly componentName: (input: string) => string;
  };
  readonly handlebars: HandlebarsParseOptions;
}

function defaultOptions(module: ModuleName): NormalizedPreprocessFields {
  return {
    module,
    meta: {},
    mode: {
      strictness: 'loose',
      purpose: 'precompile',
    },
    embedder: {
      hasBinding: () => false,
    },
    plugins: {
      ast: [],
    },
    customize: {
      componentName: (input: string) => input,
    },
    handlebars: {},
  };
}

export class NormalizedPreprocessOptions implements NormalizedPreprocessFields {
  static from(options: PreprocessOptions | undefined, module: string): NormalizedPreprocessOptions {
    return NormalizedPreprocessOptions.create(
      options,
      options?.meta?.moduleName
        ? ({ name: options?.meta?.moduleName as string, synthesized: false } as ModuleName)
        : ({ name: module, synthesized: true } as ModuleName)
    );
  }

  static create(
    options: PreprocessOptions | undefined,
    module: ModuleName
  ): NormalizedPreprocessOptions {
    return new NormalizedPreprocessOptions({
      meta: options?.meta ?? {},
      module,
      mode: {
        strictness: options?.strictMode ? 'strict' : 'loose',
        purpose: options?.mode ?? 'precompile',
      },
      embedder: {
        hasBinding: normalizeLocals(options?.locals),
      },
      plugins: {
        ast: options?.plugins?.ast ?? [],
      },
      customize: {
        componentName(name: string) {
          const customize = options?.customizeComponentName;
          return customize ? customize(name) : name;
        },
      },
      handlebars: options?.parseOptions ?? {},
    });
  }

  static fromFields(
    fields: Partial<NormalizedPreprocessFields>,
    module: ModuleName
  ): NormalizedPreprocessOptions {
    return new NormalizedPreprocessOptions({
      ...defaultOptions(module),
      ...fields,
    });
  }

  static default(module: ModuleName): NormalizedPreprocessOptions {
    return NormalizedPreprocessOptions.create(undefined, module);
  }

  readonly module: ModuleName;
  /** The metadata supplied by the user. */
  readonly meta: object;
  readonly mode: {
    readonly strictness: 'strict' | 'loose';
    readonly purpose: 'codemod' | 'precompile';
  };
  readonly embedder: {
    readonly hasBinding: (name: string) => boolean;
  };
  readonly plugins: {
    readonly ast: ASTPluginBuilder[];
  };
  readonly customize: {
    readonly componentName: (name: string) => string;
  };
  readonly handlebars: HandlebarsParseOptions;

  constructor(fields: NormalizedPreprocessFields) {
    this.module = fields.module;
    this.meta = fields.meta;
    this.mode = fields.mode;
    this.embedder = fields.embedder;
    this.plugins = fields.plugins;
    this.customize = fields.customize;
    this.handlebars = fields.handlebars;
  }

  withModule(name: string): NormalizedPreprocessOptions {
    return new NormalizedPreprocessOptions({
      ...this,
      module: name,
      meta: { ...this.meta, moduleName: name },
    });
  }
}

export type PreprocessInput = string | SourceTemplate | HBS.Program;

type PreprocessFunction = (input: PreprocessInput, options?: PreprocessOptions) => ASTv1.Template;
type NormalizedPreprocessFunction = (
  input: PreprocessInput,
  options: NormalizedPreprocessOptions
) => ASTv1.Template;

export interface Preprocess extends PreprocessFunction {
  normalized: NormalizedPreprocessFunction;
}

export function Preprocess({
  preprocess,
  normalized,
}: {
  preprocess: PreprocessFunction & Partial<Preprocess>;
  normalized: NormalizedPreprocessFunction;
}): Preprocess {
  preprocess.normalized = normalized;
  return preprocess as Preprocess;
}

export const preprocess = Preprocess({
  preprocess: (input: PreprocessInput, options?: PreprocessOptions) => {
    return SourceTemplate.from(
      input,
      options?.meta?.moduleName ?? `an ?unknown? module`,
      options
    ).preprocess();
  },
  normalized: (input: PreprocessInput, options: NormalizedPreprocessOptions) => {
    return SourceTemplate.fromNormalized(input, options).preprocess();
  },
});
