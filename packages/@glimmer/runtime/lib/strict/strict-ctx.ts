import type {
  Cursor,
  ElementBuilder,
  Environment,
  GlimmerTreeConstruction,
  SimpleDocument,
} from '@glimmer/interfaces';
import { castToSimple } from '@glimmer/util';

import type { EnvironmentDelegate } from '../environment';

import EnvironmentImpl from '../environment';
import { NewElementBuilder } from '../vm/element-builder';

export class StrictRuntime {
  static browser(env?: Partial<EnvironmentDelegate>): StrictRuntime {
    return new StrictRuntime({
      doc: document,
      env: env,
    });
  }

  readonly #env: EnvironmentImpl;

  constructor({
    env: envDelegate,
    doc = document,
  }: {
    doc?: SimpleDocument | Document | undefined;
    env?: Partial<EnvironmentDelegate> | undefined;
  }) {
    const env: EnvironmentDelegate = {
      isInteractive: true,
      enableDebugTooling: false,
      onTransactionCommit: () => void 0,
      ...envDelegate,
    };

    this.#env = new EnvironmentImpl({ document: castToSimple(doc) }, env);
  }

  get env(): Environment {
    return this.#env;
  }

  get append(): GlimmerTreeConstruction {
    return this.#env.getAppendOperations();
  }

  elements(cursor: Cursor, options: { for: 'initial-render' }): ElementBuilder {
    if (options.for === 'initial-render') {
      return NewElementBuilder.forInitialRender(this.#env, cursor);
    }

    throw new Error('Not implemented');
  }
}
