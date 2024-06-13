import type { Helper } from '@glimmer/interfaces';
import { getInternalHelperManager } from '@glimmer/manager';

export function InvokeHelper(definition: object) {
  const helper = getHelper(definition);
}

function getHelper(definition: object): Helper<object> {
  const manager = getInternalHelperManager(definition);

  if (typeof manager === 'function') {
    return manager;
  } else {
    return manager.getHelper(definition);
  }
}
