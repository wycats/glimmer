import { assertPresent } from '@glimmer/util';

import { voidMap } from '../generation/printer';
import { Tag } from '../parser';
import { SourceOffset, SourceSpan } from '../source/span';
import { generateSyntaxError, GlimmerSyntaxError, symbolicMessage } from '../syntax-error';
import { appendChild, getBlockParams } from '../utils';
import * as ASTv1 from '../v1/api';
import { HandlebarsNodeVisitors } from './handlebars-node-visitors';

export class TokenizerEventHandlers extends HandlebarsNodeVisitors {
  private tagOpenLine = 0;
  private tagOpenColumn = 0;

  reset(): void {
    this.currentNode = null;
  }

  // Comment

  beginComment(): void {
    this.currentNode = this.builder.comment(
      '',
      this.source.offsetFor(this.tagOpenLine, this.tagOpenColumn)
    );
  }

  appendToCommentData(char: string): void {
    this.currentComment.value += char;
  }

  finishComment(): void {
    appendChild(this.currentElement(), this.finish(this.currentComment));
  }

  // Data

  beginData(): void {
    this.currentNode = this.builder.text({
      chars: '',
      loc: this.offset().collapsed(),
    });
  }

  appendToData(char: string): void {
    this.currentData.chars += char;
  }

  finishData(): void {
    this.currentData.loc = this.currentData.loc.withEnd(this.offset());

    appendChild(this.currentElement(), this.currentData);
  }

  // Tags - basic

  tagOpen(): void {
    this.tagOpenLine = this.tokenizer.line;
    this.tagOpenColumn = this.tokenizer.column;
  }

  beginStartTag(): void {
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
  }

  finishEndTag(isVoid: boolean): void {
    let tag = this.finish(this.currentTag);

    let element = this.elementStack.pop() as ASTv1.ElementNode;
    let parent = this.currentElement();

    this.validateEndTag(tag, element, isVoid);

    element.loc = element.loc.withEnd(this.offset());
    appendChild(parent, element);

    if (!voidMap[tag.name] && !tag.selfClosing) {
      this.popScope();
    }
  }

  markTagAsSelfClosing(): void {
    this.currentTag.selfClosing = true;
  }

  // Tags - name

  appendToTagName(char: string): void {
    this.currentTag.name += char;
  }

  // Tags - attributes

  beginAttribute(): void {
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
  }

  appendToAttributeName(char: string): void {
    this.currentAttr.name += char;
  }

  beginAttributeValue(isQuoted: boolean): void {
    this.currentAttr.isQuoted = isQuoted;
    this.startTextPart();
    this.currentAttr.valueSpan = this.offset().collapsed();
  }

  appendToAttributeValue(char: string): void {
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
        loc = lastPart ? lastPart.loc.getEnd() : this.currentAttr.valueSpan.getStart();
      } else {
        loc = loc.move(-1);
      }

      this.currentAttr.currentPart = this.builder.text({ chars: char, loc: loc.collapsed() });
    }
  }

  finishAttributeValue(): void {
    this.finalizeTextPart();

    let tag = this.currentTag;
    let tokenizerPos = this.offset();

    let { name, parts, start, isQuoted, isDynamic, valueSpan } = this.currentAttr;

    let attrLoc = start.until(tokenizerPos);
    let valueLoc = valueSpan.withEnd(tokenizerPos);

    if (tag.type === 'EndTag') {
      throw GlimmerSyntaxError.from('elements.invalid-attrs-in-end-tag', attrLoc);
    }

    let value = this.assembleAttributeValue(parts, isQuoted, isDynamic, valueLoc);
    value.loc = valueSpan.withEnd(tokenizerPos);

    let attribute = this.builder.attr({ name, value, loc: attrLoc });

    this.currentStartTag.attributes.push(attribute);
  }

  reportSyntaxError(message: string): void {
    throw generateSyntaxError(message, this.offset().collapsed());
  }

  assembleConcatenatedValue(
    parts: (ASTv1.MustacheStatement | ASTv1.TextNode)[]
  ): ASTv1.ConcatStatement {
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
  }

  validateEndTag(
    tag: Tag<'StartTag' | 'EndTag'>,
    element: ASTv1.ElementNode,
    selfClosing: boolean
  ): void {
    if (voidMap[tag.name] && !selfClosing) {
      // EngTag is also called by StartTag for void and self-closing tags (i.e.
      // <input> or <br />, so we need to check for that here. Otherwise, we would
      // throw an error for those cases.
      throw GlimmerSyntaxError.from(['elements.unnecessary-end-tag', tag.name], tag.loc);
    } else if (element.tag === undefined) {
      throw GlimmerSyntaxError.from(['elements.end-without-start-tag', tag.name], tag.loc);
    } else if (element.tag !== tag.name) {
      throw GlimmerSyntaxError.from(
        ['elements.unbalanced-tags', { open: element.tag, close: tag.name }],
        tag.loc
      );
    }
  }

  assembleAttributeValue(
    parts: (ASTv1.MustacheStatement | ASTv1.TextNode)[],
    isQuoted: boolean,
    isDynamic: boolean,
    span: SourceSpan
  ): ASTv1.ConcatStatement | ASTv1.MustacheStatement | ASTv1.TextNode {
    if (isDynamic) {
      if (isQuoted) {
        return this.assembleConcatenatedValue(parts);
      } else {
        if (
          parts.length === 1 ||
          (parts.length === 2 &&
            parts[1].type === 'TextNode' &&
            (parts[1] as ASTv1.TextNode).chars === '/')
        ) {
          return parts[0];
        } else {
          throw GlimmerSyntaxError.from('attrs.invalid-attr-value', span);
        }
      }
    } else {
      return parts.length > 0 ? parts[0] : this.builder.text({ chars: '', loc: span });
    }
  }
}
