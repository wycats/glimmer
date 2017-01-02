import * as content from './content';
import * as vm from './vm';

import { Insertion } from '../../upsert';

import { Option, Stack, Dict, Opaque, dict, expect } from 'glimmer-util';
import { Constants, Slice } from '../../opcodes';
import { CompiledArgs } from '../expressions/args';
import { ComponentDefinition } from '../../component/interfaces';
import { PartialDefinition } from '../../partial';
import Environment, { Program } from '../../environment';
import { SymbolTable } from 'glimmer-interfaces';
import { ComponentBuilder as IComponentBuilder } from '../../opcode-builder';
import { ComponentBuilder } from '../../compiler';
import { BaselineSyntax, InlineBlock, Template } from '../../scanner';

import {
  APPEND_OPCODES,
  Op as Op,
  AppendOpcode,
  ConstantString,
  ConstantArray,
  ConstantOther,
  ConstantExpression,
  ConstantBlock,
  ConstantFunction
} from '../../opcodes';

function opcode(name: Op, op1?: number, op2?: number, op3?: number): AppendOpcode {
  return APPEND_OPCODES.construct(name, null, op1, op2, op3);
}

export interface CompilesInto<E> {
  compile(builder: OpcodeBuilder): E;
}

export type Represents<E> = CompilesInto<E> | E;

export type Label = string;

export interface SymbolLookup {
  symbolTable: SymbolTable;
}

type TargetOpcode = Op.Jump | Op.JumpIf | Op.JumpUnless | Op.NextIter;
type RangeOpcode = Op.Enter | Op.EnterList | Op.EnterWithKey | Op.NextIter;

class Labels {
  labels = dict<number>();
  jumps: { at: number, target: string, Target: TargetOpcode }[] = [];
  ranges: { at: number, start: string, end: string, Range: RangeOpcode }[] = [];

  label(name: string, index: number) {
    this.labels[name] = index;
  }

  jump(at: number, Target: TargetOpcode, target: string) {
    this.jumps.push({ at, target, Target });
  }

  range(at: number, Range: RangeOpcode, start: string, end: string) {
    this.ranges.push({ at, start, end, Range });
  }

  patch(constants: Constants, opcodes: Program): void {
    for (let { at, target, Target } of this.jumps) {
      opcodes.set(at, APPEND_OPCODES.construct(Target, null, this.labels[target]));
    }

    for (let { at, start, end, Range } of this.ranges) {
      let slice = constants.slice([this.labels[start], this.labels[end] - 1]);
      opcodes.set(at, APPEND_OPCODES.construct(Range, null, slice));
    }
  }
}

// const HI = 0x80000000;
// const HI_MASK = 0x7FFFFFFF;
// const HI2 = 0x40000000;
// const HI2_MASK = 0xbFFFFFFF;

export abstract class BasicOpcodeBuilder implements SymbolLookup {
  private labelsStack = new Stack<Labels>();
  public constants: Constants;
  private start: number;
  private locals = 0;
  private _localsSize = 0;

  constructor(public symbolTable: SymbolTable, public env: Environment, public program: Program) {
    this.constants = env.constants;
    this.start = program.next;

    this.push(null);
  }

  abstract compile<E>(expr: Represents<E>): E;

  private get pos() {
    return this.program.current;
  }

  private get nextPos() {
    return this.program.next;
  }

  protected opcode(name: Op, op1?: number, op2?: number, op3?: number) {
    this.push(opcode(name, op1, op2, op3));
  }

  getLocal(): number {
    let locals = this.locals++;
    if (this._localsSize < this.locals) {
      this._localsSize = this.locals;
    }
    return locals;
  }

  releaseLocal() {
    this.locals--;
  }

  get localsSize() {
    return this._localsSize;
  }

  push(op: Option<AppendOpcode>) {
    // console.log(`pushing ${op && op.type}`);
    if (op === null) {
      this.program.push([0, 0, 0, 0]);
    } else {
      this.program.push(op);
    }
  }

  toSlice(): Slice {
    this.program.set(this.start, opcode(Op.ReserveLocals, this.localsSize));
    this.opcode(Op.ReleaseLocals);
    return [this.start, this.program.current];
  }

  // helpers

  private get labels(): Labels {
    return expect(this.labelsStack.current, 'bug: not in a label stack');
  }

  startLabels() {
    this.labelsStack.push(new Labels());
  }

  stopLabels() {
    let label = expect(this.labelsStack.pop(), 'unbalanced push and pop labels');
    label.patch(this.constants, this.program);
  }

  // partials

  putPartialDefinition(_definition: PartialDefinition<Opaque>) {
    let definition = this.constants.other(_definition);
    this.opcode(Op.PutPartial, definition);
  }

  putDynamicPartialDefinition() {
    this.opcode(Op.PutDynamicPartial, this.constants.other(this.symbolTable));
  }

  evaluatePartial() {
    this.opcode(Op.EvaluatePartial, this.constants.other(this.symbolTable), this.constants.other(dict()));
  }

  // components

  putComponentDefinition(definition: ComponentDefinition<Opaque>) {
    this.opcode(Op.PutComponent, this.other(definition));
  }

  putDynamicComponentDefinition() {
    this.opcode(Op.PutDynamicComponent);
  }

  openComponent(shadow?: InlineBlock) {
    this.opcode(Op.OpenComponent, shadow ? this.block(shadow) : 0);
  }

  didCreateElement() {
    this.opcode(Op.DidCreateElement);
  }

  shadowAttributes() {
    this.opcode(Op.ShadowAttributes);
    this.opcode(Op.CloseBlock);
  }

  didRenderLayout() {
    this.opcode(Op.DidRenderLayout);
  }

  closeComponent() {
    this.opcode(Op.CloseComponent);
  }

  // content

  dynamicContent(Opcode: content.AppendDynamicOpcode<Insertion>) {
    this.opcode(Op.DynamicContent, this.other(Opcode));
  }

  cautiousAppend() {
    this.dynamicContent(new content.OptimizedCautiousAppendOpcode());
  }

  trustingAppend() {
    this.dynamicContent(new content.OptimizedTrustingAppendOpcode());
  }

  guardedCautiousAppend(expression: BaselineSyntax.AnyExpression) {
    this.dynamicContent(new content.GuardedCautiousAppendOpcode(expression, this.symbolTable));
  }

  guardedTrustingAppend(expression: BaselineSyntax.AnyExpression) {
    this.dynamicContent(new content.GuardedTrustingAppendOpcode(expression, this.symbolTable));
  }

  // dom

  text(text: string) {
    this.opcode(Op.Text, this.constants.string(text));
  }

  openPrimitiveElement(tag: string) {
    this.opcode(Op.OpenElement, this.constants.string(tag));
  }

  openComponentElement(tag: string) {
    this.opcode(Op.OpenComponentElement, this.constants.string(tag));
  }

  openDynamicPrimitiveElement() {
    this.opcode(Op.OpenDynamicElement);
  }

  flushElement() {
    this.opcode(Op.FlushElement);
  }

  closeElement() {
    this.opcode(Op.CloseElement);
  }

  staticAttr(_name: string, _namespace: Option<string>, _value: string) {
    let name = this.constants.string(_name);
    let namespace = _namespace ? this.constants.string(_namespace) : 0;
    let value = this.constants.string(_value);

    this.opcode(Op.StaticAttr, name, value, namespace);
  }

  dynamicAttrNS(_name: string, _namespace: string, trusting: boolean) {
    let name = this.constants.string(_name);
    let namespace = this.constants.string(_namespace);

    this.opcode(Op.DynamicAttrNS, name, namespace, (trusting as any)|0);
  }

  dynamicAttr(_name: string, trusting: boolean) {
    let name = this.constants.string(_name);
    this.opcode(Op.DynamicAttr, name, (trusting as any)|0);
  }

  comment(_comment: string) {
    let comment = this.constants.string(_comment);
    this.opcode(Op.Comment, comment);
  }

  modifier(_name: string, _args: Represents<CompiledArgs>) {
    let args = this.constants.expression(this.compile(_args));
    let _modifierManager = this.env.lookupModifier([_name], this.symbolTable);
    let modifierManager = this.constants.other(_modifierManager);
    let name = this.constants.string(_name);
    this.opcode(Op.Modifier, name, modifierManager, args);
  }

  // lists

  putIterator() {
    this.opcode(Op.PutIterator);
  }

  enterList(start: string, end: string) {
    this.push(null);
    this.labels.range(this.pos, Op.EnterList, start, end);
  }

  exitList() {
    this.opcode(Op.ExitList);
  }

  enterWithKey(start: string, end: string) {
    this.push(null);
    this.labels.range(this.pos, Op.EnterWithKey, start, end);
  }

  nextIter(end: string) {
    this.push(null);
    this.labels.jump(this.pos, Op.NextIter, end);
  }

  // expressions

  pushSelf() {
    this.opcode(Op.PushSelf);
  }

  pushSymbol(symbol: number) {
    this.opcode(Op.PushSymbol, symbol);
  }

  getKey(key: string) {
    this.opcode(Op.GetKey, this.string(key));
  }

  getBlock(name: string) {
    let symbol = this.symbolTable.getSymbol('yields', name);
    this.opcode(Op.GetBlock, symbol!);
  }

  hasBlock(name: string) {
    let symbol = this.symbolTable.getSymbol('yields', name);
    this.opcode(Op.HasBlock, symbol!);
  }

  hasBlockParams(name: string) {
    let symbol = this.symbolTable.getSymbol('yields', name);
    this.opcode(Op.HasBlockParams, symbol!);
  }

  concat(size: number) {
    this.opcode(Op.Concat, size);
  }

  function(f: BaselineSyntax.FunctionExpressionCallback<Opaque>) {
    this.opcode(Op.Function, this.func(f));
  }

  putLocal(pos: number) {
    this.opcode(Op.PutLocal, pos);
  }

  pushLocal(pos: number) {
    this.opcode(Op.PushLocal, pos);
  }

  // vm

  openBlock(positional: number) {
    this.opcode(Op.OpenBlock, positional);
  }

  closeBlock() {
    this.opcode(Op.CloseBlock);
  }

  pushRemoteElement() {
    this.opcode(Op.PushRemoteElement);
  }

  popRemoteElement() {
    this.opcode(Op.PopRemoteElement);
  }

  label(name: string) {
    this.labels.label(name, this.nextPos);
  }

  pushChildScope() {
    this.opcode(Op.PushChildScope);
  }

  popScope() {
    this.opcode(Op.PopScope);
  }

  pushDynamicScope() {
    this.opcode(Op.PushDynamicScope);
  }

  popDynamicScope() {
    this.opcode(Op.PopDynamicScope);
  }

  putNull() {
    this.opcode(Op.Put, this.constants.NULL_REFERENCE);
  }

  putEvalledExpr() {
    this.opcode(Op.PutEvalledExpr);
  }

  putEvalledArgs() {
    this.opcode(Op.PutEvalledArgs);
  }

  pushReifiedArgs(positional: number, _names: string[], hasDefault = false, hasInverse = false) {
    let names = this.names(_names);

    let flag = 0;
    if (hasDefault) flag |= 0b01;
    if (hasInverse) flag |= 0b10;

    this.opcode(Op.PushReifiedArgs, positional, names, flag);
  }

  pushImmediate(value: Opaque) {
    this.opcode(Op.PushImmediate, this.other(value));
  }

  pushPrimitive(_primitive: string | number | null | undefined | boolean) {
    let flag: 0 | 1 | 2 = 0;
    let primitive: number;
    switch (typeof _primitive) {
      case 'number':
        primitive = _primitive as number;
        break;
      case 'string':
        primitive = this.string(_primitive as string);
        flag = 1;
        break;
      case 'boolean':
        primitive = (_primitive as any) | 0;
        flag = 2;
        break;
      case 'object':
        // assume null
        primitive = 2;
        flag = 2;
        break;
      case 'undefined':
        primitive = 3;
        flag = 2;
        break;
      default:
        throw new Error('Invalid primitive passed to pushPrimitive');
    }

    this.opcode(Op.PushPrimitive, (flag << 30) | primitive);
  }

  helper(func: Function) {
    this.opcode(Op.Helper, this.func(func));
  }

  putArgs(_args: Represents<CompiledArgs>) {
    throw new Error('removing PutArgs');
  }

  pushBlocks(_default: Option<InlineBlock>, inverse: Option<InlineBlock>) {
    let flag = 0;
    let defaultBlock: ConstantBlock = 0;
    let inverseBlock: ConstantBlock = 0;

    if (_default) {
      flag |= 0b01;
      defaultBlock = this.block(_default);
    }

    if (inverse) {
      flag |= 0b10;
      inverseBlock = this.block(inverse);
    }

    this.opcode(Op.PushBlocks, defaultBlock, inverseBlock, flag);
  }

  bindDynamicScope(_names: string[]) {
    this.opcode(Op.BindDynamicScope, this.names(_names));
  }

  bindPositionalArgs(_names: string[], _symbols: number[]) {
    this.opcode(Op.BindPositionalArgs, this.names(_names), this.symbols(_symbols));
  }

  bindNamedArgs(_names: string[], _symbols: number[]) {
    this.opcode(Op.BindNamedArgs, this.names(_names), this.symbols(_symbols));
  }

  bindBlocks(_names: string[], _symbols: number[]) {
    this.opcode(Op.BindBlocks, this.names(_names), this.symbols(_symbols));
  }

  enter(enter: string, exit: string) {
    this.push(null);
    this.labels.range(this.pos, Op.Enter, enter, exit);
  }

  exit() {
    this.opcode(Op.Exit);
  }

  evaluate(_block: InlineBlock) {
    let block = this.constants.block(_block);
    this.opcode(Op.Evaluate, block);
  }

  test(testFunc: 'const' | 'simple' | 'environment' | vm.TestFunction) {
    let _func: vm.TestFunction;

    if (testFunc === 'const') {
      _func = vm.ConstTest;
    } else if (testFunc === 'simple') {
      _func = vm.SimpleTest;
    } else if (testFunc === 'environment') {
      _func = vm.EnvironmentTest;
    } else if (typeof testFunc === 'function') {
      _func = testFunc;
    } else {
      throw new Error('unreachable');
    }

    let func = this.constants.function(_func);
    this.opcode(Op.Test, func);
  }

  jump(target: string) {
    this.push(null);
    this.labels.jump(this.pos, Op.Jump, target);
  }

  jumpIf(target: string) {
    this.push(null);
    this.labels.jump(this.pos, Op.JumpIf, target);
  }

  jumpUnless(target: string) {
    this.push(null);
    this.labels.jump(this.pos, Op.JumpUnless, target);
  }

  protected string(_string: string): ConstantString {
    return this.constants.string(_string);
  }

  protected names(_names: string[]): ConstantArray {
    let names = _names.map(n => this.constants.string(n));
    return this.constants.array(names);
  }

  protected symbols(symbols: number[]): ConstantArray {
    return this.constants.array(symbols);
  }

  protected other(value: Opaque): ConstantOther {
    return this.constants.other(value);
  }

  protected args(args: Represents<CompiledArgs>): ConstantExpression {
    return this.constants.expression(this.compile(args));
  }

  protected block(block: InlineBlock): ConstantBlock {
    return this.constants.block(block);
  }

  protected func(func: Function): ConstantFunction {
    return this.constants.function(func);
  }
}

function isCompilableExpression<E>(expr: Represents<E>): expr is CompilesInto<E> {
  return expr && typeof expr['compile'] === 'function';
}

export default class OpcodeBuilder extends BasicOpcodeBuilder {
  public component: IComponentBuilder;

  constructor(symbolTable: SymbolTable, env: Environment, program: Program = env.program) {
    super(symbolTable, env, program);
    this.component = new ComponentBuilder(this);
  }

  compile<E>(expr: Represents<E>): E {
    if (isCompilableExpression(expr)) {
      return expr.compile(this);
    } else {
      return expr;
    }
  }

  bindPositionalArgsForLocals(locals: Dict<number>) {
    let symbols = Object.keys(locals).map(name => locals[name]);
    this.opcode(Op.BindPositionalArgs, this.symbols(symbols));
  }

  preludeForLayout(layout: Template) {
    let symbols = layout.symbolTable.getSymbols();

    if (symbols.named) {
      let named = symbols.named;
      let namedNames = Object.keys(named);
      let namedSymbols = namedNames.map(n => named[n]);
      this.opcode(Op.BindNamedArgs, this.names(namedNames), this.symbols(namedSymbols));
    }

    this.opcode(Op.BindCallerScope);

    if (symbols.yields) {
      let yields = symbols.yields;
      let yieldNames = Object.keys(yields);
      let yieldSymbols = yieldNames.map(n => yields[n]);
      this.opcode(Op.BindBlocks, this.names(yieldNames), this.symbols(yieldSymbols));
    }

    if (symbols.partialArgs) {
      this.opcode(Op.BindPartialArgs, symbols.partialArgs);
    }
  }

  yield(positional: number, to: string) {
    let table = this.symbolTable;
    let yields: Option<number>, partial: Option<number>;

    if (yields = table.getSymbol('yields', to)) {
      this.opcode(Op.GetBlock, yields);
    } else if (partial = this.symbolTable.getPartialArgs()) {
      this.opcode(Op.GetEvalBlock, partial, this.string(to));
    } else {
      throw new Error('[BUG] ${to} is not a valid block name.');
    }

    this.openBlock(positional);
    this.closeBlock();
  }

  // TODO
  // come back to this
  labelled(args: Option<Represents<CompiledArgs>>, callback: BlockCallback) {
    if (args) this.putArgs(args);

    this.startLabels();
    this.enter('BEGIN', 'END');
    this.label('BEGIN');

    callback(this, 'BEGIN', 'END');

    this.label('END');
    this.exit();
    this.stopLabels();
  }

  // TODO
  // come back to this
  iter(callback: BlockCallback) {
    this.startLabels();
    this.enterList('BEGIN', 'END');
    this.label('ITER');
    this.nextIter('BREAK');
    this.enterWithKey('BEGIN', 'END');
    this.label('BEGIN');

    callback(this, 'BEGIN', 'END');

    this.label('END');
    this.exit();
    this.jump('ITER');
    this.label('BREAK');
    this.exitList();
    this.stopLabels();
  }

  // TODO
  // come back to this
  unit(callback: (builder: OpcodeBuilder) => void) {
    this.startLabels();
    callback(this);
    this.stopLabels();
  }
}

export type BlockCallback = (dsl: OpcodeBuilder, BEGIN: Label, END: Label) => void;
