import { PROVIDER_FIXTURE, PROVIDER_SEPAY } from '../constants.js';
import { assertProviderSupported } from '../config.js';
import { createSePayAdapter } from './sepay.js';
import { createFixtureAdapter } from './fixture.js';

/**
 * Factory — Ledger never imports SePay; only this factory selects adapters.
 * @param {string} name
 * @param {object} [opts]
 */
export function createPaymentProvider(name, opts = {}) {
  assertProviderSupported(name);
  if (name === PROVIDER_FIXTURE) return createFixtureAdapter(opts.store);
  if (name === PROVIDER_SEPAY) return createSePayAdapter();
  const err = new Error(`Unknown provider ${name}`);
  err.code = 'provider_unsupported';
  err.statusCode = 501;
  throw err;
}

export { createSePayAdapter, createFixtureAdapter };
export { signFixtureWebhook } from './fixture.js';
export { buildVietQrUrl, verifySePayWebhook, normalizeSePayPayload } from './sepay.js';
