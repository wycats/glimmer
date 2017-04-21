import { PathReference, VersionedPathReference } from '@glimmer/reference';
import { Opaque, Option } from '../core';
import * as Simple from '../dom/simple';
import DynamicScope from './dynamic-scope';
import { RenderResult } from "../runtime/render-result";
import { Block } from "./block";

export type TemplateIterator = Iterator<RenderResult>;

/**
 * Environment specific template.
 */
export interface Template<T> {
  /**
   * Template identifier, if precompiled will be the id of the
   * precompiled template.
   */
  id: string;

  /**
   * Template meta (both compile time and environment specific).
   */
  meta: T;

  hasEval: boolean;

  /**
   * Symbols computed at compile time.
   */
  symbols: string[];

  /**
   * Helper to render template as root entry point.
   */
  render(self: PathReference<Opaque>, appendTo: Simple.Element, dynamicScope: DynamicScope): Iterator<RenderResult>;

  debug(self: PathReference<Opaque>, appendTo: Simple.Element, dynamicScope: DynamicScope): Iterator<Debug>;
}

type ScopeSlot = VersionedPathReference<Opaque> | Option<Block>;

interface Debug {
  opcode(): { name: string, params: object };
  stack(): Option<Opaque[]>;
  scope(): ScopeSlot[];
  elements(): Simple.Element[];
  output(): string;

  evaluate(): void;
}