import * as content from './content';
import * as vm from './vm';

import { Insertion } from '../../upsert';

import { Option, Stack, Dict, Opaque, dict, expect, fillNulls } from 'glimmer-util';
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

type TargetOpcode = Op.Jump | Op.JumpIf | Op.JumpUnless;
type RangeOpcode = Op.Enter | Op.EnterList

class Labels {
  labels = dict<number>();
  jumps: { at: number, target: string, Target: TargetOpcode }[] = [];
  ranges: { at: number, start: string, end: string, Range: RangeOpcode }[] = [];
  iters: { at: number, breaks: string, start: string, end: string }[] = [];

  label(name: string, index: number) {
    this.labels[name] = index;
  }

  iter(at: number, breaks: string, start: string, end: string) {
    this.iters.push({ at, breaks, start, end });
  }

  jump(at: number, Target: TargetOpcode, target: string) {
    this.jumps.push({ at, target, Target });
  }

  range(at: number, Range: RangeOpcode, start: string, end: string) {
    this.ranges.push({ at, start, end, Range });
  }

  patch(opcodes: Program): void {
    for (let { at, target, Target } of this.jumps) {
      opcodes.set(at, APPEND_OPCODES.construct(Target, null, this.labels[target]));
    }

    for (let { at, start, end, Range } of this.ranges) {
      opcodes.set(at, APPEND_OPCODES.construct(Range, null, this.labels[start], this.labels[end] - 4));
    }

    for (let { at, breaks, start, end } of this.iters) {
      debugger;
      opcodes.set(at, opcode(Op.Iterate, this.labels[breaks], this.labels[start], this.labels[end] - 4));
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

  upvars<T extends [Opaque]>(count: number): T {
    return fillNulls(count) as T;
  }

  local(): number {
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
    label.patch(this.program);
  }

  // partials

  PutPartialDefinition(_definition: PartialDefinition<Opaque>): AppendOpcode {
    let definition = this.constants.other(_definition);
    return opcode(Op.PutPartial, definition);
  }

  putPartialDefinition(_definition: PartialDefinition<Opaque>) {
    this.push(this.PutPartialDefinition(_definition));
  }

  putDynamicPartialDefinition() {
    this.opcode(Op.PutDynamicPartial, this.constants.other(this.symbolTable));
  }

  evaluatePartial() {
    this.opcode(Op.EvaluatePartial, this.constants.other(this.symbolTable), this.constants.other(dict()));
  }

  // components

  pushComponentManager(definition: ComponentDefinition<Opaque>) {
    this.opcode(Op.PushComponentManager, this.other(definition));
  }

  setComponentState(local: number) {
    this.opcode(Op.SetComponentState, local);
  }

  pushComponentArgs(positional: number, named: number, namedDict: Dict<number>) {
    this.opcode(Op.PushComponentArgs, positional, named, this.constants.other(namedDict));
  }

  createComponent(state: number, hasDefault: boolean, hasInverse: boolean) {
    let flag = (<any>hasDefault|0) | ((<any>hasInverse|0) << 1);
    this.opcode(Op.CreateComponent, flag, state);
  }

  registerComponentDestructor(state: number) {
    this.opcode(Op.RegisterComponentDestructor, state);
  }

  beginComponentTransaction() {
    this.opcode(Op.BeginComponentTransaction);
  }

  pushComponentOperations() {
    this.opcode(Op.PushComponentOperations);
  }

  putDynamicComponentDefinition() {
    this.opcode(Op.PushDynamicComponent);
  }

  getComponentLayout(state: number ) {
    this.opcode(Op.GetComponentLayout, state);
  }

  openComponent(shadow?: InlineBlock) {
    this.opcode(Op.OpenComponent, shadow ? this.block(shadow) : 0);
  }

  didCreateElement(state: number) {
    this.opcode(Op.DidCreateElement, state);
  }

  shadowAttributes() {
    this.opcode(Op.ShadowAttributes);
    this.opcode(Op.DoneBlock);
  }

  didRenderLayout() {
    this.opcode(Op.DidRenderLayout);
  }

  closeComponent() {
    this.opcode(Op.CloseComponent);
  }

  // content

  DynamicContent(Opcode: content.AppendDynamicOpcode<Insertion>): AppendOpcode {
    return opcode(Op.DynamicContent, this.other(Opcode));
  }

  dynamicContent(Opcode: content.AppendDynamicOpcode<Insertion>) {
    this.push(this.DynamicContent(Opcode));
  }

  CautiousAppend() {
    return this.DynamicContent(new content.OptimizedCautiousAppendOpcode());
  }

  cautiousAppend() {
    return this.push(this.CautiousAppend());
  }

  TrustingAppend() {
    return this.DynamicContent(new content.OptimizedTrustingAppendOpcode());
  }

  trustingAppend() {
    return this.push(this.TrustingAppend());
  }

  GuardedCautiousAppend(expression: BaselineSyntax.AnyExpression) {
    return this.DynamicContent(new content.GuardedCautiousAppendOpcode(expression, this.symbolTable));
  }

  guardedCautiousAppend(expression: BaselineSyntax.AnyExpression) {
    return this.push(this.GuardedCautiousAppend(expression));
  }

  GuardedTrustingAppend(expression: BaselineSyntax.AnyExpression) {
    return this.DynamicContent(new content.GuardedTrustingAppendOpcode(expression, this.symbolTable));
  }

  guardedTrustingAppend(expression: BaselineSyntax.AnyExpression) {
    return this.push(this.GuardedTrustingAppend(expression));
  }

  // dom

  text(text: string) {
    this.opcode(Op.Text, this.constants.string(text));
  }

  openPrimitiveElement(tag: string) {
    this.opcode(Op.OpenElement, this.constants.string(tag));
  }

  openElementWithOperations(tag: string) {
    this.opcode(Op.OpenElementWithOperations, this.constants.string(tag));
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

  iterate(breaks: string, start: string, end: string) {
    this.push(null);
    this.labels.iter(this.pos, breaks, start, end);
  }

  // expressions

  Self(): AppendOpcode {
    return opcode(Op.Self);
  }

  self() {
    this.push(this.Self());
  }

  SetVariable(symbol: number): AppendOpcode {
    return opcode(Op.SetVariable, symbol);
  }

  setVariable(symbol: number) {
    this.push(this.SetVariable(symbol));
  }

  GetVariable(symbol: number) {
    return opcode(Op.GetVariable, symbol);
  }

  getVariable(symbol: number) {
    this.push(this.GetVariable(symbol));
  }

  GetProperty(key: string) {
    return opcode(Op.GetProperty, this.string(key));
  }

  getProperty(key: string) {
    this.push(this.GetProperty(key));
  }

  GetBlock(name: string) {
    let symbol = this.symbolTable.getSymbol('yields', name);
    return opcode(Op.GetBlock, symbol!);
  }

  getBlock(name: string) {
    this.push(this.GetBlock(name));
  }

  HasBlock(name: string) {
    let symbol = this.symbolTable.getSymbol('yields', name);
    return opcode(Op.HasBlock, symbol!);
  }

  hasBlock(name: string) {
    this.push(this.HasBlock(name));
  }

  HasBlockParams(name: string) {
    let symbol = this.symbolTable.getSymbol('yields', name);
    return opcode(Op.HasBlockParams, symbol!);
  }

  hasBlockParams(name: string) {
    this.push(this.HasBlockParams(name));
  }

  Concat(size: number) {
    return opcode(Op.Concat, size);
  }

  concat(size: number) {
    this.push(this.Concat(size));
  }

  Function(f: BaselineSyntax.FunctionExpressionCallback<Opaque>) {
    return opcode(Op.Function, this.func(f));
  }

  function(f: BaselineSyntax.FunctionExpressionCallback<Opaque>) {
    return this.Function(f);
  }

  SetLocal(pos: number) {
    return opcode(Op.SetLocal, pos);
  }

  setLocal(pos: number) {
    this.push(this.SetLocal(pos));
  }

  GetLocal(pos: number) {
    return opcode(Op.GetLocal, pos);
  }

  getLocal(pos: number) {
    this.push(this.GetLocal(pos));
  }

  Pop() {
    return opcode(Op.Pop);
  }

  pop() {
    return this.push(this.Pop());
  }

  // vm

  openBlock(positional: number) {
    this.opcode(Op.InvokeBlock, positional);
  }

  closeBlock() {
    this.opcode(Op.DoneBlock);
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

  bindSelf() {
    this.opcode(Op.BindSelf);
  }

  bindVirtualBlock(layout: number, block: number) {
    this.opcode(Op.BindVirtualBlock, layout, block);
  }

  bindVirtualNamed(layout: number, name: string) {
    this.opcode(Op.BindVirtualNamed, layout, this.string(name));
  }

  pushRootScope(symbols: number, bindCallerScope: boolean) {
    this.opcode(Op.RootScope, symbols, <any>bindCallerScope|0);
  }

  pushVirtualRootScope(bindCallerScope: boolean) {
    this.opcode(Op.VirtualRootScope, <any>bindCallerScope|0);
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
    this.opcode(Op.Constant, this.constants.NULL_REFERENCE);
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
    this.opcode(Op.Constant, this.other(value));
  }

  Primitive(_primitive: string | number | null | undefined | boolean) {
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

    return opcode(Op.Primitive, (flag << 30) | primitive);
  }

  primitive(_primitive: string | number | null | undefined | boolean) {
    return this.push(this.Primitive(_primitive));
  }

  helper(func: Function) {
    this.opcode(Op.Helper, this.func(func));
  }

  putArgs(_args: Represents<CompiledArgs>) {
    throw new Error('removing PutArgs');
  }

  pushBlock(block: Option<InlineBlock>) {
    this.opcode(Op.PushBlock, this.block(block));
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

  invokeVirtual(): void {
    this.opcode(Op.InvokeVirtual);
  }

  invokeStatic(_block: InlineBlock, args: Option<AppendOpcode[]>): void;
  invokeStatic(_block: InlineBlock, args: number): void;
  invokeStatic(_block: InlineBlock, args: any): void {
    let paramSize = _block.symbolTable.getSymbolSize('local');
    let argSize: number;
    let onStack: boolean;

    if (typeof args === 'number') {
      argSize = args;
      onStack = true;
    } else {
      argSize = Math.min(paramSize, args ? args.length : 0);
      onStack = false;
    }

    if (argSize) {
      let locals = _block.symbolTable.getSymbols().locals!;
      this.pushChildScope();

      for (let i=0; i<argSize; i++) {
        if (!onStack) this.push((args as AppendOpcode[])[i]);
        this.setVariable(locals[i]);
      }
    }

    let block = this.constants.block(_block);
    this.opcode(Op.InvokeStatic, block);

    if (argSize) {
      this.popScope();
    }
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
    this.opcode(Op.ToBoolean, func);
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

  protected block(block: Option<InlineBlock>): ConstantBlock {
    return block ? this.constants.block(block) : 0;
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
  labelled(callback: BlockCallback) {
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
    this.iterate('BREAK', 'BEGIN', 'END');
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
