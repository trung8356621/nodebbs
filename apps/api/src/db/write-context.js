import { AsyncLocalStorage } from 'node:async_hooks';
export const writeContext = new AsyncLocalStorage();
export function afterCommit(callback) {
  const context=writeContext.getStore();
  if(context) context.afterCommit.push(callback);
  else callback();
}
