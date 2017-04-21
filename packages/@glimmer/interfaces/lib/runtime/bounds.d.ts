import { Option } from '../core';
import * as Simple from '../dom/simple';

export interface Bounds {
  parentElement(): Simple.Element;
  firstNode(): Option<Simple.Node>;
  lastNode(): Option<Simple.Node>;
}