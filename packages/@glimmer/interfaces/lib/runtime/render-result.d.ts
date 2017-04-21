import { Option, Destroyable } from '../core';
import { Bounds } from "./bounds";
import * as Simple from "../dom/simple";

interface RenderResult extends Bounds, Destroyable {
  rerender(options: { alwaysRevalidate: boolean }): void;

  parentElement(): Simple.Element;
  firstNode(): Option<Simple.Node>;
  lastNode(): Option<Simple.Node>;

  destroy(): void;
}
