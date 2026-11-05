/**
 * Bank-payment runtime config.
 * Feature flag defaults OFF. Sandbox never grants Credit to production wallets
 * unless BANK_PAYMENT_SANDBOX_GRANT=true (local fixture only).
 */

import {
  DEFAULT_PROVIDER,
  PROVIDER_FIXTURE,
  PROVIDER_SEPAY,
  SETTING_BANK_PAYMENT_ENABLED,
  SETTING_BANK_PAYMENT_PUBLIC,
} from './constants.js';

function truthy(v, fallback = false) {
  if (v === undefined || v === null || v === '') return fallback;
  if (typeof v === 'boolean') return v;
  return String(v).toLowerCase() === 'true' || v === '1';
}

export function readEnvConfig() {
  const provider = (process.env.BANK_PAYMENT_PROVIDER || DEFAULT_PROVIDER).toLowerCase();
  const sandbox = truthy(process.env.BANK_PAYMENT_SANDBOX, provider === PROVIDER_FIXTURE || !truthy(process.env.BANK_PAYMENT_ENABLED, false));
  return {
    /** Master switch — default OFF. */
    enabled: truthy(process.env.BANK_PAYMENT_ENABLED, false),
    /** Public user checkout — default OFF even if enabled for admin/sandbox. */
    publicCheckout: truthy(process.env.BANK_PAYMENT_PUBLIC, false),
    provider,
    sandbox,
    /** Never true in production deploys. Allows fixture grants in local tests only. */
    sandboxGrantToWallet: truthy(process.env.BANK_PAYMENT_SANDBOX_GRANT, false),
    sepay: {
      webhookSecret: process.env.SEPAY_WEBHOOK_SECRET || '',
      apiKey: process.env.SEPAY_API_KEY || '',
      apiToken: process.env.SEPAY_API_TOKEN || process.env.SEPAY_API_KEY || '',
      accountNumber: process.env.SEPAY_ACCOUNT_NUMBER || '',
      bankCode: process.env.SEPAY_BANK_CODE || '',
      accountName: process.env.SEPAY_ACCOUNT_NAME || '',
      bankAccountId: process.env.SEPAY_BANK_ACCOUNT_ID || '',
      paymentCodePrefix: process.env.SEPAY_PAYMENT_CODE_PREFIX || 'PBN',
    },
    orderTtlMinutes: Math.max(5, Number(process.env.BANK_PAYMENT_ORDER_TTL_MINUTES || 60) || 60),
  };
}

/**
 * Merge env with optional forum_commercial_settings overrides.
 * Settings cannot silently turn ON production grants without env alignment —
 * enabling still requires BANK_PAYMENT_ENABLED=true for live bank use.
 */
export async function resolvePaymentConfig(fastify) {
  const envCfg = readEnvConfig();
  let settingsEnabled;
  let settingsPublic;
  try {
    const enabled = await fastify?.settings?.get?.(SETTING_BANK_PAYMENT_ENABLED);
    if (enabled != null) {
      settingsEnabled = typeof enabled === 'object' ? Boolean(enabled.enabled) : Boolean(enabled);
    }
    const pub = await fastify?.settings?.get?.(SETTING_BANK_PAYMENT_PUBLIC);
    if (pub != null) {
      settingsPublic = typeof pub === 'object' ? Boolean(pub.enabled) : Boolean(pub);
    }
  } catch {
    // settings plugin optional at boot
  }

  const enabled = envCfg.enabled && (settingsEnabled !== false);
  const publicCheckout = enabled && envCfg.publicCheckout && settingsPublic !== false;

  return {
    ...envCfg,
    enabled,
    publicCheckout,
    /** True when webhook processing may call ledger.grant. */
    mayGrantCredits: enabled && (!envCfg.sandbox || envCfg.sandboxGrantToWallet),
    fixtureMode: envCfg.provider === PROVIDER_FIXTURE || envCfg.sandbox,
  };
}

export function assertProviderSupported(name) {
  const ok = [PROVIDER_SEPAY, PROVIDER_FIXTURE].includes(name);
  if (!ok) {
    const err = new Error(`Payment provider '${name}' is not implemented yet`);
    err.code = 'provider_unsupported';
    err.statusCode = 501;
    throw err;
  }
}
