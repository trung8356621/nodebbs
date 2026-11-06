/**
 * Node-only hook. The http patch lives in a separate module so the Edge
 * bundle does not load node:http.
 */
export async function register() {
  if (process.env.NEXT_RUNTIME === 'nodejs') {
    await import('./instrumentation-node.js');
  }
}
