import { Dict, Option } from '@glimmer/interfaces';
import { LOCAL_DEBUG } from '@glimmer/local-debug-flags';
import { assert, assign, deprecate, isPresent } from '@glimmer/util';

import { NormalizedPreprocessOptions } from '../parser/preprocess';
import { Scope } from '../parser/scope';
import { SourceLocation, SourcePosition, SYNTHETIC_LOCATION } from '../source/location';
import { Source } from '../source/source';
import { SourceSpan } from '../source/span';
import * as ASTv1 from './api';
import { PathExpressionImplV1 } from './legacy-interop';

let _SOURCE: Source | undefined;

function SOURCE(): Source {
  if (!_SOURCE) {
    _SOURCE = Source.fromNormalized(
      '',
      NormalizedPreprocessOptions.forModuleName('an unknown module')
    );
  }

  return _SOURCE;
}

// const SOURCE = new Source('', '(tests)');

// Statements

export type BuilderHead = string | ASTv1.Expression;
export type TagDescriptor = string | { name: string; selfClosing: boolean };

function tryLoc(source: string | ASTv1.Node): SourceLocation | undefined {
  if (typeof source === 'string') {
    return undefined;
  } else {
    return source.loc;
  }
}

// Nodes

export type ElementParts =
  | ['attrs', ...AttrSexp[]]
  | ['modifiers', ...ModifierSexp[]]
  | ['body', ...ASTv1.Statement[]]
  | ['comments', ...ElementComment[]]
  | ['as', ...string[]]
  | ['loc', SourceLocation];

export type PathSexp = string | ['path', string, LocSexp?];

export type ModifierSexp =
  | string
  | [PathSexp, LocSexp?]
  | [PathSexp, ASTv1.Expression[], LocSexp?]
  | [PathSexp, ASTv1.Expression[], Dict<ASTv1.Expression>, LocSexp?];

export type AttrSexp = [string, ASTv1.AttrNode['value'] | string, LocSexp?];

export type LocSexp = ['loc', SourceLocation];

export type ElementComment = ASTv1.MustacheCommentStatement | SourceLocation | string;

export type SexpValue =
  | string
  | ASTv1.Expression[]
  | Dict<ASTv1.Expression>
  | LocSexp
  | PathSexp
  | undefined;

export interface BuildElementOptions {
  attrs?: ASTv1.AttrNode[];
  modifiers?: ASTv1.ElementModifierStatement[];
  children?: ASTv1.Statement[];
  comments?: ElementComment[];
  blockParams?: string[];
  loc?: SourceSpan;
}

// Miscellaneous

export class PublicBuilders {
  static top(options: NormalizedPreprocessOptions): PublicBuilders {
    return new PublicBuilders(Scope.top(options));
  }

  static default(): PublicBuilders {
    return PublicBuilders.top(NormalizedPreprocessOptions.forModuleName('an unknown module'));
  }

  readonly #scope: Scope;

  constructor(scope: Scope) {
    this.#scope = scope;
  }

  mustache(
    path: BuilderHead | ASTv1.Literal,
    params?: ASTv1.Expression[],
    hash?: ASTv1.Hash,
    raw?: boolean,
    loc?: SourceLocation,
    strip?: ASTv1.StripFlags
  ): ASTv1.MustacheStatement {
    if (typeof path === 'string') {
      path = this.path(path, tryLoc(path));
    }

    return {
      type: 'MustacheStatement',
      path,
      params: params || [],
      hash: hash || this.hash([]),
      escaped: !raw,
      trusting: !!raw,
      loc: this.loc(loc || null),
      strip: strip || { open: false, close: false },
    };
  }

  block(
    path: BuilderHead,
    params: Option<ASTv1.Expression[]>,
    hash: Option<ASTv1.Hash>,
    _defaultBlock: ASTv1.PossiblyDeprecatedBlock,
    _elseBlock?: Option<ASTv1.PossiblyDeprecatedBlock>,
    loc?: SourceLocation,
    openStrip?: ASTv1.StripFlags,
    inverseStrip?: ASTv1.StripFlags,
    closeStrip?: ASTv1.StripFlags
  ): ASTv1.BlockStatement {
    let defaultBlock: ASTv1.Block;
    let elseBlock: Option<ASTv1.Block> | undefined;

    if (_defaultBlock.type === 'Template') {
      if (LOCAL_DEBUG) {
        deprecate(`b.program is deprecated. Use b.blockItself instead.`);
      }

      defaultBlock = assign({}, _defaultBlock, { type: 'Block' }) as unknown as ASTv1.Block;
    } else {
      defaultBlock = _defaultBlock;
    }

    if (_elseBlock !== undefined && _elseBlock !== null && _elseBlock.type === 'Template') {
      if (LOCAL_DEBUG) {
        deprecate(`b.program is deprecated. Use b.blockItself instead.`);
      }

      elseBlock = assign({}, _elseBlock, { type: 'Block' }) as unknown as ASTv1.Block;
    } else {
      elseBlock = _elseBlock;
    }

    return {
      type: 'BlockStatement',
      path: this.path(path, tryLoc(path)),
      params: params || [],
      hash: hash || this.hash([]),
      program: defaultBlock || null,
      inverse: elseBlock || null,
      loc: this.loc(loc || null),
      openStrip: openStrip || { open: false, close: false },
      inverseStrip: inverseStrip || { open: false, close: false },
      closeStrip: closeStrip || { open: false, close: false },
    };
  }

  elementModifier(
    path: BuilderHead | ASTv1.Expression,
    params?: ASTv1.Expression[],
    hash?: ASTv1.Hash,
    loc?: Option<SourceLocation>
  ): ASTv1.ElementModifierStatement {
    return {
      type: 'ElementModifierStatement',
      path: this.path(path, tryLoc(path)),
      params: params || [],
      hash: hash || this.hash([]),
      loc: this.loc(loc || null),
    };
  }

  partial(
    name: ASTv1.PathExpression,
    params?: ASTv1.Expression[],
    hash?: ASTv1.Hash,
    indent?: string,
    loc?: SourceLocation
  ): ASTv1.PartialStatement {
    return {
      type: 'PartialStatement',
      name: name,
      params: params || [],
      hash: hash || this.hash([]),
      indent: indent || '',
      strip: { open: false, close: false },
      loc: this.loc(loc || null),
    };
  }

  comment(value: string, loc?: SourceLocation): ASTv1.CommentStatement {
    return {
      type: 'CommentStatement',
      value: value,
      loc: this.loc(loc || null),
    };
  }

  mustacheComment(value: string, loc?: SourceLocation): ASTv1.MustacheCommentStatement {
    return {
      type: 'MustacheCommentStatement',
      value: value,
      loc: this.loc(loc || null),
    };
  }

  concat(
    parts: (ASTv1.TextNode | ASTv1.MustacheStatement)[],
    loc?: SourceLocation
  ): ASTv1.ConcatStatement {
    if (!isPresent(parts)) {
      throw new Error(`b.concat requires at least one part`);
    }

    return {
      type: 'ConcatStatement',
      parts: parts || [],
      loc: this.loc(loc || null),
    };
  }

  element(tag: TagDescriptor, options: BuildElementOptions = {}): ASTv1.ElementNode {
    let { attrs, blockParams, modifiers, comments, children, loc } = options;

    let tagName: string;

    // this is used for backwards compat, prior to `selfClosing` being part of the ElementNode AST
    let selfClosing = false;
    if (typeof tag === 'object') {
      selfClosing = tag.selfClosing;
      tagName = tag.name;
    } else if (tag.slice(-1) === '/') {
      tagName = tag.slice(0, -1);
      selfClosing = true;
    } else {
      tagName = tag;
    }

    return {
      type: 'ElementNode',
      tag: tagName,
      selfClosing: selfClosing,
      attributes: attrs || [],
      blockParams: blockParams || [],
      modifiers: modifiers || [],
      comments: (comments as ASTv1.MustacheCommentStatement[]) || [],
      children: children || [],
      loc: this.loc(loc || null),
    };
  }

  attr(name: string, value: ASTv1.AttrNode['value'], loc?: SourceLocation): ASTv1.AttrNode {
    return {
      type: 'AttrNode',
      name: name,
      value: value,
      loc: this.loc(loc || null),
    };
  }

  text(chars?: string, loc?: SourceLocation): ASTv1.TextNode {
    return {
      type: 'TextNode',
      chars: chars || '',
      loc: this.loc(loc || null),
    };
  }

  // Expressions

  sexpr(
    path: BuilderHead,
    params?: ASTv1.Expression[],
    hash?: ASTv1.Hash,
    loc?: SourceLocation
  ): ASTv1.SubExpression {
    return {
      type: 'SubExpression',
      path: this.path(path, tryLoc(path)),
      params: params || [],
      hash: hash || this.hash([]),
      loc: this.loc(loc || null),
    };
  }

  fullPath(head: ASTv1.PathHead, tail: string[], loc: SourceLocation): ASTv1.PathExpression {
    let { original: originalHead, parts: headParts } = headToString(head);
    let parts = [...headParts, ...tail];
    let original = [...originalHead, ...parts].join('.');

    return new PathExpressionImplV1(original, head, tail, this.loc(loc || null), this.#scope);
  }

  path(
    path: ASTv1.PathExpression | string | { head: string; tail: string[] },
    loc?: SourceLocation
  ): ASTv1.PathExpression;
  path(path: ASTv1.Expression, loc?: SourceLocation): ASTv1.Expression;
  path(path: BuilderHead | ASTv1.Expression, loc?: SourceLocation): ASTv1.Expression;
  path(
    path: BuilderHead | ASTv1.Expression | { head: string; tail: string[] },
    loc?: SourceLocation
  ): ASTv1.Expression {
    if (typeof path !== 'string') {
      if ('type' in path) {
        return path;
      } else {
        let { head, tail } = this.processHead(path.head, SourceSpan.broken());

        assert(
          tail.length === 0,
          `builder.path({ head, tail }) should not be called with a head with dots in it`
        );

        let { original: originalHead } = headToString(head);

        return new PathExpressionImplV1(
          [originalHead, ...tail].join('.'),
          head,
          tail,
          this.loc(loc || null),
          this.#scope
        );
      }
    }

    let { head, tail } = this.processHead(path, SourceSpan.broken());

    return new PathExpressionImplV1(path, head, tail, this.loc(loc || null), this.#scope);
  }

  this(loc: SourceLocation): ASTv1.PathHead {
    return {
      type: 'ThisHead',
      loc: this.loc(loc || null),
    };
  }

  atName(name: string, loc: SourceLocation): ASTv1.PathHead {
    // the `@` should be included so we have a complete source range
    assert(name[0] === '@', `call builders.at() with a string that starts with '@'`);

    return {
      type: 'AtHead',
      name,
      loc: this.loc(loc || null),
    };
  }

  var(name: string, loc: SourceLocation): ASTv1.PathHead {
    assert(name !== 'this', `You called builders.var() with 'this'. Call builders.this instead`);
    assert(
      name[0] !== '@',
      `You called builders.var() with '${name}'. Call builders.at('${name}') instead`
    );

    return {
      type: 'VarHead',
      name,
      declared: this.#scope.declaration(name),
      loc: this.loc(loc || null),
    };
  }

  private processHead(
    original: string,
    loc: SourceLocation
  ): { head: ASTv1.PathHead; tail: string[] } {
    let [head, ...tail] = original.split('.');
    let headNode: ASTv1.PathHead;

    if (head === 'this') {
      headNode = {
        type: 'ThisHead',
        loc: this.loc(loc || null),
      };
    } else if (head[0] === '@') {
      headNode = {
        type: 'AtHead',
        name: head,
        loc: this.loc(loc || null),
      };
    } else {
      headNode = {
        type: 'VarHead',
        name: head,
        declared: this.#scope.declaration(name),
        loc: this.loc(loc || null),
      };
    }

    return {
      head: headNode,
      tail,
    };
  }

  head(head: string, loc: SourceLocation): ASTv1.PathHead {
    if (head[0] === '@') {
      return this.atName(head, loc);
    } else if (head === 'this') {
      return this.this(loc);
    } else {
      return this.var(head, loc);
    }
  }

  buildNamedBlockName(name: string, loc?: SourceLocation): ASTv1.NamedBlockName {
    return {
      type: 'NamedBlockName',
      name,
      loc: this.loc(loc || null),
    };
  }

  literal<T extends ASTv1.Literal>(type: T['type'], value: T['value'], loc?: SourceLocation): T {
    return {
      type,
      value,
      original: value,
      loc: this.loc(loc || null),
    } as T;
  }

  readonly string = literal('StringLiteral');
  readonly boolean = literal('BooleanLiteral');
  readonly number = literal('NumberLiteral');
  readonly undefined = literal('UndefinedLiteral', { value: undefined });
  readonly null = literal('NullLiteral', { value: null });

  // Syntax Fragments

  hash(pairs?: ASTv1.HashPair[], loc?: SourceLocation): ASTv1.Hash {
    return {
      type: 'Hash',
      pairs: pairs || [],
      loc: this.loc(loc || null),
    };
  }

  pair(key: string, value: ASTv1.Expression, loc?: SourceLocation): ASTv1.HashPair {
    return {
      type: 'HashPair',
      key: key,
      value,
      loc: this.loc(loc || null),
    };
  }

  program(body?: ASTv1.Statement[], blockParams?: string[], loc?: SourceLocation): ASTv1.Template {
    return {
      type: 'Template',
      body: body || [],
      blockParams: blockParams || [],
      loc: this.loc(loc || null),
    };
  }

  blockItself(
    body?: ASTv1.Statement[],
    blockParams?: string[],
    chained = false,
    loc?: SourceLocation
  ): ASTv1.Block {
    return {
      type: 'Block',
      body: body || [],
      blockParams: blockParams || [],
      chained,
      loc: this.loc(loc || null),
    };
  }

  buildTemplate(
    body?: ASTv1.Statement[],
    blockParams?: string[],
    loc?: SourceLocation
  ): ASTv1.Template {
    return {
      type: 'Template',
      body: body || [],
      blockParams: blockParams || [],
      loc: this.loc(loc || null),
    };
  }

  pos(line: number, column: number): SourcePosition {
    return {
      line,
      column,
    };
  }

  loc(loc: Option<SourceLocation>): SourceSpan;
  loc(
    startLine: number,
    startColumn: number,
    endLine?: number,
    endColumn?: number,
    source?: string
  ): SourceSpan;
  loc(...args: any[]): SourceSpan {
    if (args.length === 1) {
      let loc = args[0];

      if (loc && typeof loc === 'object') {
        return SourceSpan.forHbsLoc(SOURCE(), loc);
      } else {
        return SourceSpan.forHbsLoc(SOURCE(), SYNTHETIC_LOCATION);
      }
    } else {
      let [startLine, startColumn, endLine, endColumn, _source] = args;
      let source = _source ? new Source(null, _source) : SOURCE();

      return SourceSpan.forHbsLoc(source, {
        start: {
          line: startLine,
          column: startColumn,
        },
        end: {
          line: endLine,
          column: endColumn,
        },
      });
    }
  }
}

function headToString(head: ASTv1.PathHead): { original: string; parts: string[] } {
  switch (head.type) {
    case 'AtHead':
      return { original: head.name, parts: [head.name] };
    case 'ThisHead':
      return { original: `this`, parts: [] };
    case 'VarHead':
      return { original: head.name, parts: [head.name] };
  }
}

type LiteralNode<T extends ASTv1.Literal['type']> = Extract<
  ASTv1.Literal,
  { type: T }
> extends infer L
  ? L extends ASTv1.Literal
    ? L
    : never
  : never;

type BuildLiteral<T extends ASTv1.Literal['type']> = Extract<
  ASTv1.Literal,
  { type: T }
> extends infer L
  ? L extends ASTv1.Literal
    ? L['value'] extends null | undefined
      ? (loc?: SourceLocation) => L
      : (value: L['value'], loc?: SourceLocation) => L
    : never
  : never;

function literal<T extends ASTv1.Literal['type']>(
  type: T,
  options?: { value: LiteralNode<T>['value'] }
): BuildLiteral<T> {
  return function (this: PublicBuilders, value: T, loc?: SourceLocation) {
    if (options) {
      return this.literal(type as LiteralNode<T>['type'], options.value, loc);
    } else {
      return this.literal(type, value, loc);
    }
  } as BuildLiteral<T>;
}
