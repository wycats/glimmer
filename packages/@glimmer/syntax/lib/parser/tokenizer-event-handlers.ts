/* eslint-disable no-console */
import { LOCAL_DEBUG } from '@glimmer/local-debug-flags';
import { assert, assertPresent, existing, Stack } from '@glimmer/util';
import { EntityParser } from 'simple-html-tokenizer';

import { voidMap } from '../generation/printer';
import { Tag } from '../parser';
import { SourceTemplate } from '../source/source';
import { SourceOffset, SourceSpan } from '../source/span';
import { generateSyntaxError, GlimmerSyntaxError, SymbolicSyntaxError } from '../syntax-error';
import { appendChild, getBlockParams } from '../utils';
import * as ASTv1 from '../v1/api';
import { HandlebarsNodeVisitors } from './handlebars-node-visitors';

type TokenizerState =
  | {
      type: 'comment';
    }
  | {
      type: 'text';
    }
  | {
      type: 'element';
      state: {
        tag: string;
      };
    }
  | {
      type: 'open-tag';
      state: { tag: string };
    }
  | { type: 'attr' }
  | {
      type: 'attr:name';
    }
  | {
      type: 'attr:value';
    };

type TokenizerStateOf<T extends TokenizerState['type']> = Extract<TokenizerState, { type: T }>;

type TokenizerStateRecord = {
  [P in TokenizerState['type']]: TokenizerStateOf<P>;
};

type ExtractKey<TheRecord, Key extends keyof TheRecord, Type> = TheRecord[Key] extends Type
  ? Key
  : never;

type ExcludeKey<TheRecord, Key extends keyof TheRecord, Type> = TheRecord[Key] extends Type
  ? never
  : Key;

type TokenizerStateWithOptions = {
  [P in keyof TokenizerStateRecord as ExtractKey<
    TokenizerStateRecord,
    P,
    { state: object }
  >]: TokenizerStateRecord[P];
};
type TokenizerStateWithoutOptions = {
  [P in keyof TokenizerStateRecord as ExcludeKey<
    TokenizerStateRecord,
    P,
    { state: object }
  >]: TokenizerStateRecord[P];
};

type OptionsFor<T extends keyof TokenizerStateRecord> = TokenizerStateRecord[T] extends {
  type: T;
  state: infer S;
}
  ? S
  : undefined;

type TraceEntry = string | [event: string, params: unknown];

function printTrace(trace: TraceEntry[]) {
  if (LOCAL_DEBUG) {
    console.group('EVENT TRACE');
    console.log(JSON.stringify(trace, null, 2));
    console.groupEnd();
  }
}

function printStates(stack: Stack<TokenizerState>) {
  console.group('STATE STACK');
  console.log(
    JSON.stringify(
      stack.toArray().map((s) => s.type),
      null,
      2
    )
  );
  console.groupEnd();
}
export class TokenizerEventHandlers extends HandlebarsNodeVisitors {
  private tagOpenLine = 0;
  private tagOpenColumn = 0;

  private declare trace: TraceEntry[];

  #state: Stack<TokenizerState> = new Stack();

  constructor(source: SourceTemplate, entityParser?: EntityParser) {
    super(source, entityParser);

    if (LOCAL_DEBUG) {
      this.trace = [];
    }
  }

  get #currentState(): TokenizerState {
    return existing(this.#state.current, { variable: 'this.#state.current' });
  }

  #inState = (type: TokenizerState['type']): boolean => {
    return this.#state.current?.type === type;
  };

  #getState<T extends TokenizerState['type']>(type: T): Extract<TokenizerState, { type: T }> {
    const current = this.#currentState;
    assert(current.type === type, `Expected state of type ${type}, but got ${current.type}`);

    return current as Extract<TokenizerState, { type: T }>;
  }

  #pushState<T extends keyof TokenizerStateWithoutOptions>(type: T): void;
  #pushState<T extends keyof TokenizerStateWithOptions>(type: T, options: OptionsFor<T>): void;
  #pushState<T extends TokenizerState['type']>(type: T, options?: object): void {
    if (options === undefined) {
      this.#state.push({ type } as TokenizerState);
    } else {
      this.#state.push({ type, state: options } as TokenizerState);
    }
  }

  #popState<T extends TokenizerState['type']>(
    expected: T,
    options?: { allowMissing: false }
  ): OptionsFor<T>;
  #popState<T extends TokenizerState['type']>(
    expected: T,
    options: { allowMissing: true }
  ): OptionsFor<T> | null;
  #popState<T extends TokenizerState['type']>(
    expected: T,
    options: { allowMissing: boolean } = { allowMissing: false }
  ): OptionsFor<T> | null {
    if (this.#state.current?.type !== expected && options.allowMissing === true) {
      return null;
    }

    const state = existing(this.#state.pop(), { method: ['this', 'state.pop'] });

    if (LOCAL_DEBUG) {
      if (state.type !== expected) {
        const trace = this.trace.map((entry: string | [string, unknown]) =>
          typeof entry === 'string' ? entry : `${entry[0]}(${JSON.stringify(entry[1])})`
        );

        console.group(
          `%cBUG: Unbalanced push and pop in tokenizer state: ${state.type} !== ${expected}`,
          'color: red'
        );
        printTrace(trace);
        printStates(this.#state);
        throw new Error(
          `BUG: Unbalanced push and pop in tokenizer state: ${state.type} !== ${expected}\n`
        );
      }
    }

    assert(
      state.type === expected,
      `BUG: Unbalanced push and pop in tokenizer state: ${state.type} !== ${expected}`
    );

    return (state as { state?: unknown })['state'] as OptionsFor<T>;
  }

  reset(): void {
    if (#state in this) {

  // Comment

  beginComment(): void {
    if (LOCAL_DEBUG) {
      this.trace.push('beginComment');
    }

    this.#pushState('comment');
    this.currentNode = this.builder.comment(
      '',
      this.source.offsetFor(this.tagOpenLine, this.tagOpenColumn)
    );
  }

  appendToCommentData(char: string): void {
    if (LOCAL_DEBUG) {
      this.trace.push(['appendToCommentData', char]);
    }

    this.currentComment.value += char;
  }

  finishComment(): void {
    if (LOCAL_DEBUG) {
      this.trace.push('finishComment');
    }

    appendChild(this.currentElement(), this.finish(this.currentComment));
    this.#popState('comment');
  }

  // Data

  beginData(): void {
    if (LOCAL_DEBUG) {
      this.trace.push('beginData');
    }

    this.currentNode = this.builder.text({
      chars: '',
      loc: this.offset().collapsed(),
    });
    this.#pushState('text');
  }

  appendToData(char: string): void {
    if (LOCAL_DEBUG) {
      this.trace.push(['appendToData', char]);
    }

    this.currentData.chars += char;
  }

  finishData(): void {
    if (LOCAL_DEBUG) {
      this.trace.push('finishData');
    }

    this.currentData.loc = this.currentData.loc.withEnd(this.offset());

    appendChild(this.currentElement(), this.currentData);
    this.#popState('text');
  }

  // Tags - basic

  tagOpen(): void {
    if (LOCAL_DEBUG) {
      this.trace.push('tagOpen');
    }

    this.tagOpenLine = this.tokenizer.line;
    this.tagOpenColumn = this.tokenizer.column;
  }

  beginStartTag(): void {
    if (LOCAL_DEBUG) {
      this.trace.push('beginStartTag');
    }

    this.#pushState('open-tag', { tag: '' });

    this.currentNode = {
      type: 'StartTag',
      name: '',
      attributes: [],
      modifiers: [],
      comments: [],
      selfClosing: false,
      loc: this.source.offsetFor(this.tagOpenLine, this.tagOpenColumn),
    };
  }

  beginEndTag(): void {
    if (LOCAL_DEBUG) {
      this.trace.push('beginEndTag');
    }

    this.#pushState('open-tag', { tag: '' });

    this.currentNode = {
      type: 'EndTag',
      name: '',
      attributes: [],
      modifiers: [],
      comments: [],
      selfClosing: false,
      loc: this.source.offsetFor(this.tagOpenLine, this.tagOpenColumn),
    };
  }

  finishTag(): void {
    if (LOCAL_DEBUG) {
      this.trace.push('finishTag');
    }

    let tag = this.finish(this.currentTag);

    if (tag.type === 'StartTag') {
      this.finishStartTag();

      if (tag.name === ':') {
        throw generateSyntaxError(
          'Invalid named block named detected, you may have created a named block without a name, or you may have began your name with a number. Named blocks must have names that are at least one character long, and begin with a lower case letter',
          this.source.spanFor({
            start: this.currentTag.loc.toJSON(),
            end: this.offset().toJSON(),
          })
        );
      }

      if (voidMap[tag.name] || tag.selfClosing) {
        this.finishEndTag(true);
      }
    } else if (tag.type === 'EndTag') {
      this.finishEndTag(false);
    }
  }

  finishStartTag(): void {
    if (LOCAL_DEBUG) {
      this.trace.push('finishStartTag');
    }

    let { name, attributes, modifiers, comments, selfClosing, loc } = this.finish(
      this.currentStartTag
    );

    const { attrs, blockParams } = getBlockParams(attributes, loc);

    let element = this.builder.element({
      tag: name,
      selfClosing,
      attrs,
      modifiers,
      comments,
      children: [],
      blockParams,
      loc,
    });

    if (!voidMap[name] && !selfClosing) {
      this.pushScope(blockParams);
    }

    this.elementStack.push(element);
    const { tag } = this.#popState('open-tag');
    this.#pushState('element', { tag });
  }

  finishEndTag(isSelfClosing: boolean): void {
    if (LOCAL_DEBUG) {
      this.trace.push(['finishEndTag', { isSelfClosing }]);
    }

    let tag = this.finish(this.currentTag);

    let element = this.elementStack.pop() as ASTv1.ElementNode;
    let parent = this.currentElement();

    this.#validateEndTag(tag, element, isSelfClosing);

    element.loc = element.loc.withEnd(this.offset());
    appendChild(parent, element);

    const closingTag = this.#popState('open-tag');
    const elementState = this.#popState('element', { allowMissing: true });

    if (elementState === null) {
      this.#syntaxError(['elements.end-without-start-tag', closingTag.tag], tag.loc);
    }

    if (isSelfClosing) {
      return;
    }

    this.popScope();

    if (closingTag.tag !== elementState.tag) {
      this.#syntaxError(
        ['elements.unbalanced-tags', { open: elementState.tag, close: closingTag.tag }],
        tag.loc
      );
    }
  }

  markTagAsSelfClosing(): void {
    if (LOCAL_DEBUG) {
      this.trace.push('markTagAsSelfClosing');
    }

    this.currentTag.selfClosing = true;
  }

  // Tags - name

  appendToTagName(char: string): void {
    if (LOCAL_DEBUG) {
      this.trace.push(['appendToTagName', char]);
    }

    this.#getState('open-tag').state.tag += char;
    this.currentTag.name += char;
  }

  // Tags - attributes

  beginAttribute(): void {
    if (LOCAL_DEBUG) {
      this.trace.push('beginAttribute');
    }

    let offset = this.offset();

    this.currentAttribute = {
      name: '',
      parts: [],
      currentPart: null,
      isQuoted: false,
      isDynamic: false,
      start: offset,
      valueSpan: offset.collapsed(),
    };

    this.#pushState('attr:name');
  }

  appendToAttributeName(char: string): void {
    if (LOCAL_DEBUG) {
      this.trace.push(['appendToAttributeName', char]);
    }

    this.currentAttr.name += char;
  }

  beginAttributeValue(isQuoted: boolean): void {
    if (LOCAL_DEBUG) {
      this.trace.push(['beginAttributeValue', { isQuoted }]);
    }

    this.#popState('attr:name');
    this.#pushState('attr:value');
    this.currentAttr.isQuoted = isQuoted;
    this.startTextPart();
    this.currentAttr.valueSpan = this.offset().collapsed();
  }

  appendToAttributeValue(char: string): void {
    if (LOCAL_DEBUG) {
      this.trace.push(['appendToAttributeValue', char]);
    }

    let parts = this.currentAttr.parts;
    let lastPart = parts[parts.length - 1];

    let current = this.currentAttr.currentPart;

    if (current) {
      current.chars += char;

      // update end location for each added char
      current.loc = current.loc.withEnd(this.offset());
    } else {
      // initially assume the text node is a single char
      let loc: SourceOffset = this.offset();

      // the tokenizer line/column have already been advanced, correct location info
      if (char === '\n') {
        loc = lastPart ? lastPart.loc.getEnd() : this.currentAttrValueSpan.getStart();
      } else {
        loc = loc.move(-1);
      }

      this.currentAttr.currentPart = this.builder.text({ chars: char, loc: loc.collapsed() });
    }
  }

  finishAttributeValue(): void {
    if (LOCAL_DEBUG) {
      this.trace.push('finishAttributeValue');
    }

    this.finalizeTextPart();

    let tag = this.currentTag;
    let tokenizerPos = this.offset();

    let { name, parts, start, isQuoted, isDynamic } = this.currentAttr;
    let valueSpan = this.currentAttrValueSpan;

    let attrLoc = start.until(tokenizerPos);
    let valueLoc = valueSpan.withEnd(tokenizerPos);

    if (tag.type === 'EndTag') {
      this.#syntaxError('elements.invalid-attrs-in-end-tag', attrLoc);
    }

    let value = this.#assembleAttributeValue(parts, isQuoted, isDynamic, valueLoc);
    value.loc = valueSpan.withEnd(tokenizerPos);

    let attribute = this.builder.attr({ name, value, loc: attrLoc });

    this.currentStartTag.attributes.push(attribute);
    this.currentAttribute = null;

    this.#popState('attr:value');
  }

  #syntaxError(error: SymbolicSyntaxError, span: SourceSpan): never {
    if (LOCAL_DEBUG) {
      console.group(`Syntax Error Details`);
      printTrace(this.trace);
      printStates(this.#state);
      console.groupEnd();
    }

    throw GlimmerSyntaxError.from(error, span);
  }

  reportSyntaxError(message: string): void {
    if (this.#inState('attr:name')) {
      // do nothing, handle invalid characters
    } else {
      throw generateSyntaxError(message, this.offset().collapsed());
    }
  }

  #assembleConcatenatedValue = (
    parts: (ASTv1.MustacheStatement | ASTv1.TextNode)[]
  ): ASTv1.ConcatStatement => {
    for (let i = 0; i < parts.length; i++) {
      let part: ASTv1.BaseNode = parts[i];

      if (part.type !== 'MustacheStatement' && part.type !== 'TextNode') {
        throw generateSyntaxError(
          'Unsupported node in quoted attribute value: ' + part['type'],
          part.loc
        );
      }
    }

    assertPresent(parts, `the concatenation parts of an element should not be empty`);

    let first = parts[0];
    let last = parts[parts.length - 1];

    return this.builder.concat(
      parts,
      this.source.spanFor(first.loc).extend(this.source.spanFor(last.loc))
    );
  };

  #validateEndTag = (
    tag: Tag<'StartTag' | 'EndTag'>,
    element: ASTv1.ElementNode,
    selfClosing: boolean
  ): void => {
    if (voidMap[tag.name] && !selfClosing) {
      // EngTag is also called by StartTag for void and self-closing tags (i.e.
      // <input> or <br />, so we need to check for that here. Otherwise, we would
      // throw an error for those cases.
      this.#syntaxError(['elements.unnecessary-end-tag', tag.name], tag.loc);
    } else if (element.tag === undefined) {
      this.#syntaxError(['elements.end-without-start-tag', tag.name], tag.loc);
    } else if (element.tag !== tag.name) {
      throw this.#syntaxError(
        ['elements.unbalanced-tags', { open: element.tag, close: tag.name }],
        tag.loc
      );
    }
  };

  #assembleAttributeValue = (
    parts: (ASTv1.MustacheStatement | ASTv1.TextNode)[],
    isQuoted: boolean,
    isDynamic: boolean,
    span: SourceSpan
  ): ASTv1.ConcatStatement | ASTv1.MustacheStatement | ASTv1.TextNode => {
    if (isDynamic) {
      if (isQuoted) {
        return this.#assembleConcatenatedValue(parts);
      } else {
        if (
          parts.length === 1 ||
          (parts.length === 2 &&
            parts[1].type === 'TextNode' &&
            (parts[1] as ASTv1.TextNode).chars === '/')
        ) {
          return parts[0];
        } else {
          throw this.#syntaxError('attrs.invalid-attr-value', span);
        }
      }
    } else {
      return parts.length > 0 ? parts[0] : this.builder.text({ chars: '', loc: span });
    }
  };
}
