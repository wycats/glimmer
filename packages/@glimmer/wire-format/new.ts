import { Dict } from '@glimmer/util';

type JsonValue =
    string
  | number
  | boolean
  | JsonObject
  | JsonArray
  ;

interface JsonObject extends Dict<JsonValue> {}
interface JsonArray extends Array<JsonValue> {}

enum Expressions {
  /**
   * (GetVariable symbol:u32)
   */
  GetVariable,

  /**
   * (GetProperty property:string)
   */
  GetProperty,

  /**
   * (GetMaybeLocal head:string)
   */
  GetMaybeLocal,

  /**
   * (GetUnknown name:string)
   */
  GetUnknown,

  /**
   * (Concat parts:u32)
   */
  Concat,

  /**
   * (Helper name:string)
   */
  Helper,

  /**
   * (HasBlock symbol:u32)
   */
  HasBlock,

  /**
   * (HasBlockParams symbol:u32)
   */
  HasBlockParams,

  /**
   * (Undefined)
   */
  Undefined,

  /**
   * (ClientSide value:any)
   */
  ClientSide
}

enum Statements {
  /**
   * (Text value:string)
   */
  Text,

  /**
   * (Comment value:string)
   */
  Comment,

  /**
   * (Append trust:boolean)
   */
  Append,

  /**
   * (Modifier)
   */
  Modifier,

  /**
   * (Block params:slice names:Array<string> values:slice)
   */
}