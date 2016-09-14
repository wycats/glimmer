import { Dict } from 'glimmer-util';

type JsonValue =
    string
  | number
  | boolean
  | JsonObject
  | JsonArray
  ;

interface JsonObject extends Dict<JsonValue> {}
interface JsonArray extends Array<JsonValue> {}

// This entire file is serialized to disk, so all strings
// end up being interned.
export type str = string;
export type TemplateReference = number;
export type YieldTo = str;

function is<T extends any[]>(variant: number): (value: any[]) => value is T {
  return function(value: any[]): value is T {
    return value[0] === variant;
  };
}

export namespace Core {
  type Expression = Expressions.Expression;

  export type Path          = str[];
  export type Params        = Expression[];
  export type Hash          = [str[], Expression[]];
}

export namespace Expressions {
  type Path = Core.Path;
  type Params = Core.Params;
  type Hash = Core.Hash;

  export enum TemplateExpressions {
    unknown,
    arg,
    get,
    hasBlock,
    hasBlockParams,
    notDefined
  }

  export type Unknown        = [TemplateExpressions.unknown, Path];
  export type Arg            = [TemplateExpressions.arg, Path];
  export type Get            = [TemplateExpressions.get, Path];
  export type Value          = str | number | boolean | null; // tslint:disable-line
  export type HasBlock       = [TemplateExpressions.hasBlock, str];
  export type HasBlockParams = [TemplateExpressions.hasBlockParams, str];
  export type Undefined      = [TemplateExpressions.notDefined];

  export type Expression =
      Unknown
    | Arg
    | Get
    | Concat
    | HasBlock
    | HasBlockParams
    | Helper
    | Undefined
    | Value
    ;

  export interface Concat extends Array<any> {
    [0]: 'concat';
    [1]: Params;
  }

  export interface Helper extends Array<any> {
    [0]: 'helper';
    [1]: Path;
    [2]: Params;
    [3]: Hash;
  }

  export const isUnknown        = is<Unknown>(1);
  export const isArg            = is<Arg>(2);
  export const isGet            = is<Get>(3);
  export const isConcat         = is<Concat>(4);
  export const isHelper         = is<Helper>(5);
  export const isHasBlock       = is<HasBlock>(6);
  export const isHasBlockParams = is<HasBlockParams>(7);
  export const isUndefined      = is<Undefined>(8);

  export function isPrimitiveValue(value: any): value is Value {
    if (value === null) {
      return true;
    }
    return typeof value !== 'object';
  }
}

export type Expression = Expressions.Expression;

export namespace Statements {

  export enum TemplateStatements {
    text,
    append,
    comment,
    modifier,
    block,
    openElement,
    flushElement,
    closeElement,
    staticAttr,
    dynamicAttr,
    yieldz,
    dynamicArg,
    staticArg,
    trustingArg
  }

  type Expression = Expressions.Expression;
  type Params = Core.Params;
  type Hash = Core.Hash;
  type Path = Core.Path;

  export type Text          = [TemplateStatements.text, str];
  export type Append        = [TemplateStatements.append, Expression, boolean];
  export type Comment       = [TemplateStatements.comment, str];
  export type Modifier      = [TemplateStatements.modifier, Path, Params, Hash];
  export type Block         = [TemplateStatements.block, Path, Params, Hash, TemplateReference, TemplateReference];
  export type OpenElement   = [TemplateStatements.openElement, str, str[]];
  export type FlushElement  = [TemplateStatements.flushElement];
  export type CloseElement  = [TemplateStatements.closeElement];
  export type StaticAttr    = [TemplateStatements.staticAttr, str, Expression, str];
  export type DynamicAttr   = [TemplateStatements.dynamicAttr, str, Expression, str];
  export type Yield         = [TemplateStatements.yieldz, YieldTo, Params];
  export type DynamicArg    = [TemplateStatements.dynamicArg, str, Expression];
  export type StaticArg     = [TemplateStatements.staticArg, str, Expression];
  export type TrustingAttr  = [TemplateStatements.trustingArg, str, Expression, str];

  export const isText         = is<Text>(1);
  export const isAppend       = is<Append>(2);
  export const isComment      = is<Comment>(3);
  export const isModifier     = is<Modifier>(4);
  export const isBlock        = is<Block>(5);
  export const isOpenElement  = is<OpenElement>(6);
  export const isFlushElement = is<FlushElement>(7);
  export const isCloseElement = is<CloseElement>(8);
  export const isStaticAttr   = is<StaticAttr>(9);
  export const isDynamicAttr  = is<DynamicAttr>(10);
  export const isYield        = is<Yield>(11);
  export const isDynamicArg   = is<DynamicArg>(12);
  export const isStaticArg    = is<StaticArg>(13);
  export const isTrustingAttr = is<TrustingAttr>(14);

  export type Statement =
      Text
    | Append
    | Comment
    | Modifier
    | Block
    | OpenElement
    | FlushElement
    | CloseElement
    | StaticAttr
    | DynamicAttr
    | Yield
    | StaticArg
    | DynamicArg
    | TrustingAttr
    ;
}

export type Statement = Statements.Statement;

/**
 * A JSON object of static compile time meta for the template.
 */
export interface TemplateMeta {
  moduleName?: string;
}

/**
 * A JSON object that the Block was serialized into.
 */
export interface SerializedBlock {
  statements: Statements.Statement[];
  locals: string[];
}

/**
 * A JSON object that the compiled TemplateBlock was serialized into.
 */
export interface SerializedTemplateBlock extends SerializedBlock {
  named: string[];
  yields: string[];
  blocks: SerializedBlock[];
}

/**
 * A JSON object that the compiled Template was serialized into.
 */
export interface SerializedTemplate<T extends TemplateMeta> {
  block: SerializedTemplateBlock;
  meta: T;
}

/**
 * A string of JSON containing a SerializedTemplateBlock
 * @typedef {string} SerializedTemplateBlockJSON
 */
export type SerializedTemplateBlockJSON = string;

/**
 * A JSON object containing the SerializedTemplateBlock as JSON and TemplateMeta.
 */
export interface SerializedTemplateWithLazyBlock<T extends TemplateMeta> {
  id?: string;
  block: SerializedTemplateBlockJSON;
  meta: T;
}

/**
 * A string of Javascript containing a SerializedTemplateWithLazyBlock to be
 * concatenated into a Javascript module.
 * @typedef {string} TemplateJavascript
 */
export type TemplateJavascript = string;
