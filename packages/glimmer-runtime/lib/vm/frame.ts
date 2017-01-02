import { Scope, Environment, Opcode } from '../environment';
import { Reference, PathReference, ReferenceIterator } from 'glimmer-reference';
import { TRUST, Option, unwrap } from 'glimmer-util';
import { InlineBlock } from '../scanner';
import { EvaluatedArgs } from '../compiled/expressions/args';
import { Slice } from '../opcodes';
import { Component, ComponentManager } from '../component/interfaces';

export class CapturedFrame {
  constructor(
    public operand: Option<PathReference<any>>,
    public args: Option<EvaluatedArgs>,
    public condition: Option<Reference<boolean>>
  ) {}
}

interface VolatileRegisters {
  immediate: any;
  callerScope: Option<Scope>;
  blocks: Option<Blocks>;
  iterator: Option<ReferenceIterator>;
  key: Option<string>;
  component: Component;
  manager: Option<ComponentManager<Component>>;
  shadow: Option<InlineBlock>;
}

interface SavedRegisters {
  operand: Option<PathReference<any>>;
  args: Option<EvaluatedArgs>;
  condition: Option<Reference<boolean>>;
}

function volatileRegisters(component: Component, manager: Option<ComponentManager<Component>>, shadow: Option<InlineBlock>): VolatileRegisters {
  return {
    immediate: null,
    callerScope: null,
    blocks: null,
    iterator: null,
    key: null,
    component,
    manager,
    shadow
  };
}

function savedRegisters(): SavedRegisters {
  return {
    operand: null,
    args: null,
    condition: null
  };
}

class Frame {
  ip: number;
  volatile: VolatileRegisters;
  saved: SavedRegisters;

  constructor(
    public ops: Slice,
    component: Component = null,
    manager: Option<ComponentManager<Component>> = null,
    shadow: Option<InlineBlock> = null
  ) {
    this.ip = ops[0];
    this.volatile = volatileRegisters(component, manager, shadow);
    this.saved = savedRegisters();
  }

  capture(): CapturedFrame {
    let { operand, args, condition } = this.saved;
    return new CapturedFrame(operand, args, condition);
  }

  restore(frame: CapturedFrame) {
    this.saved.operand = frame['operand'];
    this.saved.args = frame['args'];
    this.saved.condition = frame['condition'];
  }
}

export interface Blocks {
  default: Option<InlineBlock>;
  inverse: Option<InlineBlock>;
}

export class FrameStack {
  private frames: Frame[] = [];
  private frame = 0;

  private get currentFrame(): Frame {
    // console.log(this.frames[this.frame]);
    return this.frames[this.frame - 1];
  }

  push(ops: Slice, component: Component = null, manager: Option<ComponentManager<Component>> = null, shadow: Option<InlineBlock> = null) {
    let frame = ++this.frame;

    if (this.frames.length < frame) {
      this.frames.push(null as TRUST<Frame, 'the null is replaced on the next line'>);
    }

    this.frames[frame - 1] = new Frame(ops, component, manager, shadow);
  }

  pop() {
    let { frames, frame } = this;
    frames[--frame] = null as TRUST<Frame, "this frame won't be accessed anymore">;
    this.frame--;
  }

  capture(): CapturedFrame {
    return this.currentFrame.capture();
  }

  restore(frame: CapturedFrame) {
    this.currentFrame.restore(frame);
  }

  getOps(): Slice {
    return this.currentFrame.ops;
  }

  getCurrent(): number {
    return this.currentFrame.ip;
  }

  setCurrent(ip: number): number {
    return this.currentFrame.ip = ip;
  }

  getOperand<T>(): PathReference<T> {
    return unwrap(this.currentFrame.saved.operand);
  }

  setOperand<T>(operand: PathReference<T>): PathReference<T> {
    return this.currentFrame.saved.operand = operand;
  }

  getImmediate<T>(): T {
    return this.currentFrame.volatile.immediate;
  }

  setImmediate<T>(value: T): T {
    return this.currentFrame.volatile.immediate = value;
  }

  // FIXME: These options are required in practice by the existing code, but
  // figure out why.

  getArgs(): Option<EvaluatedArgs> {
    return this.currentFrame.saved.args;
  }

  setArgs(args: EvaluatedArgs): EvaluatedArgs {
    return this.currentFrame.saved.args = args;
  }

  getCondition(): Reference<boolean> {
    return unwrap(this.currentFrame.saved.condition);
  }

  setCondition(condition: Reference<boolean>): Reference<boolean> {
    return this.currentFrame.saved.condition = condition;
  }

  getIterator(): ReferenceIterator {
    return unwrap(this.currentFrame.volatile.iterator);
  }

  setIterator(iterator: ReferenceIterator): ReferenceIterator {
    return this.currentFrame.volatile.iterator = iterator;
  }

  getKey(): Option<string> {
    return this.currentFrame.volatile.key;
  }

  setKey(key: string): string {
    return this.currentFrame.volatile.key = key;
  }

  getBlocks(): Blocks {
    return unwrap(this.currentFrame.volatile.blocks);
  }

  setBlocks(blocks: Blocks): Blocks {
    return this.currentFrame.volatile.blocks = blocks;
  }

  getCallerScope(): Scope {
    return unwrap(this.currentFrame.volatile.callerScope);
  }

  setCallerScope(callerScope: Scope): Scope {
    return this.currentFrame.volatile.callerScope = callerScope;
  }

  getComponent(): Component {
    return unwrap(this.currentFrame.volatile.component);
  }

  getManager(): ComponentManager<Component> {
    return unwrap(this.currentFrame.volatile.manager);
  }

  getShadow(): Option<InlineBlock> {
    return this.currentFrame.volatile.shadow;
  }

  goto(ip: number) {
    this.setCurrent(ip);
  }

  hasOpcodes(): boolean {
    return this.frame !== 0;
  }

  nextStatement(env: Environment): Option<Opcode> {
    let frame = this.frames[this.frame - 1];
    let ip = frame.ip;
    let ops = this.getOps();

    if (ip <= ops[1]) {
      let program = env.program;
      this.setCurrent(ip + 4);
      return program.opcode(ip);
    } else {
      this.pop();
      return null;
    }
  }
}
