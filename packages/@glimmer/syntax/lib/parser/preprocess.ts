import { Option } from '@glimmer/interfaces';

import { Source } from '../source/source';
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

export function normalize(options?: PreprocessOptions): NormalizedPreprocessOptions {
  return NormalizedPreprocessOptions.from(options);
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

interface NormalizedPreprocessFields {
  readonly module: string;
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

export class NormalizedPreprocessOptions implements NormalizedPreprocessFields {
  static from(options: PreprocessOptions | undefined): NormalizedPreprocessOptions {
    return new NormalizedPreprocessOptions({
      meta: options?.meta ?? {},
      module: options?.meta?.moduleName ?? 'an unknown module',
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

  static default(): NormalizedPreprocessOptions {
    return NormalizedPreprocessOptions.from(undefined);
  }

  static forModuleName(module: string): NormalizedPreprocessOptions {
    return new NormalizedPreprocessOptions({ ...DEFAULT_PREPROCESS_OPTIONS, module });
  }

  readonly module: string;
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
}

export const DEFAULT_PREPROCESS_OPTIONS = NormalizedPreprocessOptions.default();

export type PreprocessInput = string | Source | HBS.Program;

export function preprocess(input: PreprocessInput, options?: PreprocessOptions): ASTv1.Template {
  return Source.from(input, options).preprocess();
}
