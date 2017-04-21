import { VersionedPathReference } from '@glimmer/reference';
import { Opaque } from '../core';

interface DynamicScope {
  get(key: string): VersionedPathReference<Opaque>;
  set(key: string, reference: VersionedPathReference<Opaque>): VersionedPathReference<Opaque>;
  child(): DynamicScope;
}

export default DynamicScope;