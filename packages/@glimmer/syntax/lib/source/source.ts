// eslint-disable-next-line import/no-extraneous-dependencies
import { DEBUG } from '@glimmer/env';
import type { Option } from '@glimmer/interfaces';
import { assert } from '@glimmer/util';
import { parse, parseWithoutProcessing } from '@handlebars/parser';

import { ASTv1 } from '../../index';
import { getEmbedderLocals } from '../get-template-locals';
import { ASTPluginEnvironment, CodemodEntityParser, Syntax } from '../parser/plugins';
import {
  normalize,
  NormalizedPreprocessOptions,
  PreprocessInput,
  PreprocessOptions,
} from '../parser/preprocess';
import { TokenizerEventHandlers } from '../parser/tokenizer-event-handlers';
import traverse from '../traversal/traverse';
import * as HBS from '../v1/handlebars-ast';
import { SourceLocation, SourcePosition } from './location';
import { SourceOffset, SourceSpan } from './span';

export class SourceTemplate {
  static from(
    source: PreprocessInput,
    module: string,
    options: PreprocessOptions = {}
  ): SourceTemplate {
    return SourceTemplate.fromNormalized(source, options && normalize(module, options));
  }

  static nonexistent(module: string): SourceTemplate {
    return SourceTemplate.from('', module, {});
  }

  static fromNormalized(
    source: PreprocessInput,
    options: NormalizedPreprocessOptions
  ): SourceTemplate {
    if (source instanceof SourceTemplate) {
      if (options) {
        // If we got a Source as well as new options, create a new source with
        // the original input string and the new options.
        return new SourceTemplate(source.source, null, options);
      } else {
        // Otherwise, just return the original source.
        return source;
      }
    } else if (typeof source === 'string') {
      return new SourceTemplate(source, null, options);
    } else {
      return new SourceTemplate(null, source, options);
    }
  }

  readonly options: NormalizedPreprocessOptions;

  constructor(
    readonly source: string | null,
    private ast: HBS.Program | null = null,
    options: NormalizedPreprocessOptions
  ) {
    this.options = options === undefined ? normalize(options) : options;
  }

  get module(): string {
    return this.options.module.name;
  }

  get purpose(): 'codemod' | 'precompile' {
    return this.options.mode.purpose;
  }

  get lines(): string[] | null {
    return this.source?.split('\n') ?? null;
  }

  withOptions(options: NormalizedPreprocessOptions): SourceTemplate {
    return new SourceTemplate(this.source, this.ast, options);
  }

  sub(input: PreprocessInput, options: NormalizedPreprocessOptions = this.options): SourceTemplate {
    return SourceTemplate.fromNormalized(input, options);
  }

  embedderHasBinding(name: string): boolean {
    return this.options.embedder.hasBinding(name);
  }

  preprocess(): ASTv1.Template {
    return this.applyPlugins(this.parse(this.handlebarsAST));
  }

  private applyPlugins(template: ASTv1.Template): ASTv1.Template {
    const plugins = this.options.plugins.ast;
    const env: ASTPluginEnvironment = { meta: this.options.meta, syntax: new Syntax(this) };

    if (plugins) {
      for (const transform of plugins) {
        const result = transform(env);

        traverse(template, result.visitor);
      }
    }

    return template;
  }

  private parse(ast: HBS.Program): ASTv1.Template {
    const entityParser = this.purpose === 'codemod' ? new CodemodEntityParser() : undefined;
    const program = new TokenizerEventHandlers(this, entityParser).acceptTemplate(ast);
    program.blockParams = getEmbedderLocals(program) ?? [];
    return program;
  }

  private get handlebarsAST(): HBS.Program {
    if (this.ast === null) {
      const ast = (this.ast = this.parseHBS());

      let offsets = SourceSpan.forCharPositions(this, 0, this.source?.length ?? 0);
      ast.loc = {
        source: '(program)',
        start: offsets.startPosition,
        end: offsets.endPosition,
      };
    }

    return this.ast;
  }

  private parseHBS() {
    if (this.purpose === 'codemod') {
      return parseWithoutProcessing(this.source ?? '', this.options.handlebars) as HBS.Program;
    } else {
      return parse(this.source ?? '', this.options.handlebars) as HBS.Program;
    }
  }

  /**
   * Validate that the character offset represents a position in the source string.
   */
  check(offset: number): boolean {
    return offset >= 0 && offset <= (this.source?.length ?? 0);
  }

  slice(start: number, end: number): string {
    return (this.source ?? '').slice(start, end);
  }

  offsetFor(line: number, column: number): SourceOffset {
    return SourceOffset.forHbsPos(this, { line, column });
  }

  spanFor({ start, end }: Readonly<SourceLocation>): SourceSpan {
    return SourceSpan.forHbsLoc(this, {
      start: { line: start.line, column: start.column },
      end: { line: end.line, column: end.column },
    });
  }

  hbsPosFor(offset: number): Option<SourcePosition> {
    let seenLines = 0;
    let seenChars = 0;

    if (offset > (this.source?.length ?? 0)) {
      return null;
    }

    while (true) {
      let nextLine = (this.source ?? '').indexOf('\n', seenChars);

      if (offset <= nextLine || nextLine === -1) {
        return {
          line: seenLines + 1,
          column: offset - seenChars,
        };
      } else {
        seenLines += 1;
        seenChars = nextLine + 1;
      }
    }
  }

  charPosFor(position: SourcePosition): number | null {
    let { line, column } = position;
    let sourceString = this.source ?? '';
    let sourceLength = sourceString.length;
    let seenLines = 0;
    let seenChars = 0;

    while (true) {
      if (seenChars >= sourceLength) return sourceLength;

      let nextLine = (this.source ?? '').indexOf('\n', seenChars);
      if (nextLine === -1) nextLine = (this.source ?? '').length;

      if (seenLines === line - 1) {
        if (seenChars + column > nextLine) return nextLine;

        if (DEBUG) {
          let roundTrip = this.hbsPosFor(seenChars + column);
          assert(roundTrip !== null, `the returned offset failed to round-trip`);
          assert(roundTrip.line === line, `the round-tripped line didn't match the original line`);
          assert(
            roundTrip.column === column,
            `the round-tripped column didn't match the original column`
          );
        }

        return seenChars + column;
      } else if (nextLine === -1) {
        return 0;
      } else {
        seenLines += 1;
        seenChars = nextLine + 1;
      }
    }
  }
}
