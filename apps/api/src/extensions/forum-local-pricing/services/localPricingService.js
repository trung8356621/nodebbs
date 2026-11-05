import crypto from 'node:crypto';
import { eq, desc } from 'drizzle-orm';
import db from '#core/db/index.js';
import {
  forumLocalServices,
  forumLocalServicePriceHistory,
  forumOpsServicePolicies,
  forumCommercialSettings,
  forumCreditVndRateHistory,
} from '../schema.js';
import { vndToCreditAmount } from '../../ledger/utils/money.js';
import {
  KNOWN_SERVICES,
  SERVICE_PAID_PIN,
  SERVICE_SEO,
  SOURCE_FORUM_BASE,
  SOURCE_OPS_OVERRIDE,
  SOURCE_FREE_MODE,
  SOURCE_OPS_BAN,
  OPS_SERVICE_SYNC_STATUS,
} from '../constants.js';

const fail = (message, statusCode = 400, code = 'request_failed') =>
  Object.assign(new Error(message), { statusCode, code });

function policyValid(policy, now = new Date()) {
  if (!policy) return false;
  if (policy.validUntil && new Date(policy.validUntil).getTime() <= now.getTime()) return false;
  return true;
}

export class LocalPricingService {
  constructor(fastify) {
    this.fastify = fastify;
  }

  async ensureSeeded() {
    for (const code of KNOWN_SERVICES) {
      const [row] = await db.select().from(forumLocalServices).where(eq(forumLocalServices.serviceCode, code)).limit(1);
      if (row) continue;
      const defaults = code === SERVICE_PAID_PIN
        ? { basePriceVnd: 50000, options: { durationSeconds: 86400, skuCode: 'paid_pin_default', name: 'Paid topic pin 24h' } }
        : { basePriceVnd: 30000, options: { durationMonths: 1, skuCode: 'seo_monthly_local', name: 'SEO entitlement 1 month', renewalWindowDays: 7 } };
      await db.insert(forumLocalServices).values({
        serviceCode: code,
        enabled: true,
        basePriceVnd: defaults.basePriceVnd,
        localPriceVersion: 1,
        options: defaults.options,
      }).onConflictDoNothing();
      await db.insert(forumLocalServicePriceHistory).values({
        id: crypto.randomUUID(),
        serviceCode: code,
        localPriceVersion: 1,
        basePriceVnd: defaults.basePriceVnd,
        enabled: true,
        options: defaults.options,
        actorId: null,
        source: 'system_seed',
      }).onConflictDoNothing();
    }
    await db.insert(forumCommercialSettings).values({
      key: 'free_mode',
      value: { enabled: false },
    }).onConflictDoNothing();
    await db.insert(forumCommercialSettings).values({
      key: 'vnd_per_credit',
      value: { value: 10000 },
    }).onConflictDoNothing();
  }

  async getSetting(key, fallback) {
    const [row] = await db.select().from(forumCommercialSettings).where(eq(forumCommercialSettings.key, key)).limit(1);
    return row?.value ?? fallback;
  }

  async setSetting(key, value, actorId) {
    await db.insert(forumCommercialSettings).values({
      key,
      value,
      updatedBy: actorId ?? null,
      updatedAt: new Date(),
    }).onConflictDoUpdate({
      target: forumCommercialSettings.key,
      set: { value, updatedBy: actorId ?? null, updatedAt: new Date() },
    });
  }

  /**
   * Forum-local display/conversion ratio (1 Credit = N VND).
   * Authoritative for Admin config, activity rewards, and local service Credit display.
   * Does not require OPS; OPS catalog rate is exposed separately as reference only.
   */
  async getVndPerCredit() {
    const local = await this.getSetting('vnd_per_credit', { value: 10000 });
    const n = Number(local?.value);
    if (!Number.isSafeInteger(n) || n < 1) throw fail('Invalid VND-per-Credit setting', 409, 'INVALID_CONVERSION');
    return n;
  }

  async getOpsVndPerCreditReference() {
    try {
      const view = await this.fastify.forumPricing?.getCatalogView?.();
      if (view && !view.expired && Number.isFinite(Number(view.vndPerCredit || view.creditVnd))) {
        const n = Number(view.vndPerCredit || view.creditVnd);
        if (Number.isSafeInteger(n) && n >= 1) return n;
      }
    } catch { /* ignore */ }
    return null;
  }

  async isFreeMode() {
    const fm = await this.getSetting('free_mode', { enabled: false });
    return Boolean(fm?.enabled);
  }

  /**
   * Exact Credit for a VND price (may be fractional string/number).
   * Commercial pin/SEO still coerce to Number when callers require SafeInteger —
   * fractional service charges need pin_entitlements.price NUMERIC (separate change).
   * For whole Credits the value is an integer; for fractions returns a number when
   * IEEE-exact (0.5) or the decimal string otherwise for ledger deduct.
   */
  vndToCredits(priceVnd, vndPerCredit) {
    const vnd = Number(priceVnd);
    const rate = Number(vndPerCredit);
    if (!Number.isFinite(vnd) || vnd < 0) throw fail('Invalid VND price', 400, 'INVALID_PRICE');
    if (vnd === 0) return 0;
    if (!Number.isSafeInteger(rate) || rate < 1) throw fail('Invalid VND-per-Credit', 409, 'INVALID_CONVERSION');
    const exact = vndToCreditAmount(vnd, rate);
    if (!exact.includes('.')) return Number(exact);
    // Prefer ceil for legacy pin bigint price column compatibility on fractional service prices.
    return Math.ceil(vnd / rate);
  }

  /**
   * Effective commercial price for a service.
   * Precedence: OPS ban → Free Mode → OPS override → Forum base.
   */
  async resolveEffective(serviceCode, now = new Date()) {
    await this.ensureSeeded();
    const [local] = await db.select().from(forumLocalServices)
      .where(eq(forumLocalServices.serviceCode, serviceCode)).limit(1);
    if (!local) throw fail(`Unknown service ${serviceCode}`, 404, 'UNKNOWN_SERVICE');

    const [policy] = await db.select().from(forumOpsServicePolicies)
      .where(eq(forumOpsServicePolicies.serviceCode, serviceCode)).limit(1);
    const policyOk = policyValid(policy, now);

    if (policyOk && policy.banned) {
      const bannedOpts = local.options || {};
      return {
        serviceCode,
        available: false,
        reason: 'ops_ban',
        enabled: local.enabled,
        basePriceVnd: local.basePriceVnd,
        localPriceVersion: local.localPriceVersion,
        overridePriceVnd: policy.overridePriceVnd ?? null,
        effectivePriceVnd: null,
        effectiveSource: SOURCE_OPS_BAN,
        options: bannedOpts,
        name: typeof bannedOpts.name === 'string' ? bannedOpts.name : null,
        description: typeof bannedOpts.description === 'string' ? bannedOpts.description : null,
        durationDays: serviceCode === SERVICE_PAID_PIN
          ? Math.max(1, Math.round((Number(bannedOpts.durationSeconds) || 86400) / 86400))
          : null,
        durationMonths: serviceCode === SERVICE_SEO ? (Number(bannedOpts.durationMonths) || 1) : null,
        ops: {
          banned: true,
          opsVersion: policy.opsVersion,
          opsPricingVersionId: policy.opsPricingVersionId,
          acceptedAt: policy.acceptedAt,
          validUntil: policy.validUntil,
        },
        freeMode: false,
        vndPerCredit: await this.getVndPerCredit(),
        effectivePriceCredit: null,
        purchaseSupported: serviceCode === SERVICE_PAID_PIN || serviceCode === SERVICE_SEO,
      };
    }

    const freeMode = await this.isFreeMode();
    const vndPerCredit = await this.getVndPerCredit();
    let effectivePriceVnd = local.basePriceVnd;
    let effectiveSource = SOURCE_FORUM_BASE;
    let overridePriceVnd = null;

    if (policyOk && policy.overridePriceVnd != null) {
      overridePriceVnd = policy.overridePriceVnd;
      effectivePriceVnd = policy.overridePriceVnd;
      effectiveSource = SOURCE_OPS_OVERRIDE;
    }
    if (freeMode) {
      effectivePriceVnd = 0;
      effectiveSource = SOURCE_FREE_MODE;
    }

    const available = Boolean(local.enabled);
    const options = local.options || {};
    return {
      serviceCode,
      available,
      reason: available ? null : 'disabled',
      enabled: local.enabled,
      basePriceVnd: local.basePriceVnd,
      localPriceVersion: local.localPriceVersion,
      overridePriceVnd,
      effectivePriceVnd,
      effectiveSource,
      options,
      name: typeof options.name === 'string' ? options.name : null,
      description: typeof options.description === 'string' ? options.description : null,
      durationDays: serviceCode === SERVICE_PAID_PIN
        ? Math.max(1, Math.round((Number(options.durationSeconds) || 86400) / 86400))
        : null,
      durationMonths: serviceCode === SERVICE_SEO
        ? (Number(options.durationMonths) || 1)
        : null,
      ops: policy ? {
        banned: Boolean(policy.banned),
        opsVersion: policy.opsVersion,
        opsPricingVersionId: policy.opsPricingVersionId,
        acceptedAt: policy.acceptedAt,
        validUntil: policy.validUntil,
      } : null,
      freeMode,
      vndPerCredit,
      effectivePriceCredit: available ? this.vndToCredits(effectivePriceVnd, vndPerCredit) : null,
      purchaseSupported: serviceCode === SERVICE_PAID_PIN || serviceCode === SERVICE_SEO,
      updatedAt: local.updatedAt,
    };
  }

  /** Paid Pin plan row for checkout listing. */
  async paidPinPlan(now = new Date()) {
    const eff = await this.resolveEffective(SERVICE_PAID_PIN, now);
    if (!eff.available) {
      const err = fail(
        eff.reason === 'ops_ban' ? 'Paid pin is banned by OPS policy' : 'Paid pin is disabled',
        409,
        eff.reason === 'ops_ban' ? 'OPS_BAN' : 'SERVICE_DISABLED',
      );
      throw err;
    }
    const opts = eff.options || {};
    const durationSeconds = Number(opts.durationSeconds) || 86400;
    const skuCode = opts.skuCode || 'paid_pin_default';
    return {
      id: skuCode,
      code: skuCode,
      name: opts.name || 'Paid topic pin',
      price: eff.effectivePriceCredit,
      priceVnd: eff.effectivePriceVnd,
      durationSeconds,
      durationHours: Math.round(durationSeconds / 3600),
      currencyCode: 'credits',
      isActive: true,
      pricingAuthority: authorityFromSource(eff.effectiveSource),
      pricingSource: eff.effectiveSource,
      localPriceVersion: eff.localPriceVersion,
      basePriceVnd: eff.basePriceVnd,
      overridePriceVnd: eff.overridePriceVnd,
      freeMode: eff.freeMode,
      vndPerCredit: eff.vndPerCredit,
      _effective: eff,
    };
  }

  /** SEO product shape compatible with quote/purchase snapshot fields. */
  async seoProduct(now = new Date()) {
    const eff = await this.resolveEffective(SERVICE_SEO, now);
    if (!eff.available) {
      const err = fail(
        eff.reason === 'ops_ban' ? 'SEO entitlement is banned by OPS policy' : 'SEO entitlement is disabled',
        409,
        eff.reason === 'ops_ban' ? 'OPS_BAN' : 'SERVICE_DISABLED',
      );
      throw err;
    }
    const opts = eff.options || {};
    const productId = opts.skuCode || 'seo_monthly_local';
    const credit = eff.effectivePriceCredit;
    const version = `local-v${eff.localPriceVersion}`;
    const validUntil = new Date(Date.now() + 365 * 86400000).toISOString();
    return {
      productId,
      id: productId,
      code: productId,
      name: opts.name || 'SEO entitlement 1 month',
      type: 'seo_service',
      snapshotVersion: version,
      priceVersion: version,
      sourceId: 'forum-local-pricing',
      checksum: null,
      durationMonths: Number(opts.durationMonths) || 1,
      listPriceCredit: credit,
      salePriceCredit: credit,
      unitPriceCredit: credit,
      effectiveAt: new Date(0).toISOString(),
      endsAt: null,
      snapshotValidUntil: validUntil,
      renewalWindowDays: Number(opts.renewalWindowDays) || 7,
      discount: null,
      pricingAuthority: authorityFromSource(eff.effectiveSource),
      pricingSource: eff.effectiveSource,
      basePriceVnd: eff.basePriceVnd,
      priceVnd: eff.effectivePriceVnd,
      freeMode: eff.freeMode,
      vndPerCredit: eff.vndPerCredit,
      localPriceVersion: eff.localPriceVersion,
      _effective: eff,
    };
  }

  async listServices() {
    await this.ensureSeeded();
    let enrolledFlag = false;
    try {
      const st = await this.fastify.forumCredit?.connectionStore?.getPublicStatus?.();
      enrolledFlag = Boolean(st?.connected || st?.connectionStatus === 'connected' || st?.forumId);
    } catch {
      enrolledFlag = false;
    }

    const rows = [];
    for (const code of KNOWN_SERVICES) {
      rows.push(await this.resolveEffective(code));
    }
    const vndPerCredit = await this.getVndPerCredit();
    return {
      services: rows,
      freeMode: await this.isFreeMode(),
      vndPerCredit,
      creditDisplay: {
        unit: 'VND',
        creditVnd: vndPerCredit,
        label: `1 Credit = ${vndPerCredit.toLocaleString('vi-VN')} VND`,
        opsReference: await this.getOpsVndPerCreditReference(),
      },
      opsSync: {
        ...OPS_SERVICE_SYNC_STATUS,
        enrolled: enrolledFlag,
        enabled: false,
        status: 'unsupported',
      },
    };
  }

  async updateService(serviceCode, { basePriceVnd, enabled, options }, actorId) {
    if (!KNOWN_SERVICES.includes(serviceCode)) throw fail('Unknown service', 404, 'UNKNOWN_SERVICE');
    if (basePriceVnd !== undefined) {
      const n = Number(basePriceVnd);
      if (!Number.isSafeInteger(n) || n < 0 || n > 1_000_000_000) {
        throw fail('basePriceVnd must be an integer >= 0', 400, 'INVALID_PRICE');
      }
    }
    await this.ensureSeeded();
    const [current] = await db.select().from(forumLocalServices)
      .where(eq(forumLocalServices.serviceCode, serviceCode)).limit(1);
    if (!current) throw fail('Unknown service', 404, 'UNKNOWN_SERVICE');

    const nextPrice = basePriceVnd !== undefined ? Number(basePriceVnd) : current.basePriceVnd;
    const nextEnabled = enabled !== undefined ? Boolean(enabled) : current.enabled;
    const mergedOptions = options !== undefined
      ? { ...(current.options || {}), ...options }
      : { ...(current.options || {}) };

    // Admin configures pin duration in whole days; persist seconds for runtime/snapshots.
    if (serviceCode === SERVICE_PAID_PIN && options && options.durationDays !== undefined) {
      const days = Number(options.durationDays);
      if (!Number.isInteger(days) || days < 1 || days > 365) {
        throw fail('durationDays must be an integer 1..365', 400, 'INVALID_OPTIONS');
      }
      mergedOptions.durationDays = days;
      mergedOptions.durationSeconds = days * 86400;
    }
    if (options && typeof options.name === 'string') {
      const name = options.name.trim();
      if (!name || name.length > 120) throw fail('name must be 1..120 chars', 400, 'INVALID_OPTIONS');
      mergedOptions.name = name;
    }
    if (options && options.description !== undefined) {
      if (options.description == null || options.description === '') {
        mergedOptions.description = '';
      } else if (typeof options.description !== 'string' || options.description.length > 500) {
        throw fail('description must be <= 500 chars', 400, 'INVALID_OPTIONS');
      } else {
        mergedOptions.description = options.description.trim();
      }
    }

    const nextOptions = mergedOptions;
    if (serviceCode === SERVICE_PAID_PIN) {
      const dur = Number(nextOptions.durationSeconds);
      if (!Number.isInteger(dur) || dur < 60 || dur > 31536000) {
        throw fail('durationSeconds must be 60..31536000', 400, 'INVALID_OPTIONS');
      }
      if (nextOptions.durationDays == null) {
        nextOptions.durationDays = Math.max(1, Math.round(dur / 86400));
      }
    }
    if (serviceCode === SERVICE_SEO) {
      const months = Number(nextOptions.durationMonths ?? 1);
      if (!Number.isInteger(months) || months < 1 || months > 36) {
        throw fail('durationMonths must be 1..36', 400, 'INVALID_OPTIONS');
      }
    }

    const priceChanged = nextPrice !== current.basePriceVnd
      || nextEnabled !== current.enabled
      || JSON.stringify(nextOptions) !== JSON.stringify(current.options || {});
    if (!priceChanged) return this.resolveEffective(serviceCode);

    const nextVersion = current.localPriceVersion + 1;
    await db.update(forumLocalServices).set({
      basePriceVnd: nextPrice,
      enabled: nextEnabled,
      options: nextOptions,
      localPriceVersion: nextVersion,
      updatedAt: new Date(),
      updatedBy: actorId ?? null,
    }).where(eq(forumLocalServices.serviceCode, serviceCode));

    await db.insert(forumLocalServicePriceHistory).values({
      id: crypto.randomUUID(),
      serviceCode,
      localPriceVersion: nextVersion,
      basePriceVnd: nextPrice,
      enabled: nextEnabled,
      options: nextOptions,
      actorId: actorId ?? null,
      source: 'admin',
    });

    return this.resolveEffective(serviceCode);
  }

  async priceHistory(serviceCode, limit = 50) {
    await this.ensureSeeded();
    return db.select().from(forumLocalServicePriceHistory)
      .where(eq(forumLocalServicePriceHistory.serviceCode, serviceCode))
      .orderBy(desc(forumLocalServicePriceHistory.createdAt))
      .limit(Math.min(100, Math.max(1, Number(limit) || 50)));
  }

  async setFreeMode(enabled, actorId) {
    await this.setSetting('free_mode', { enabled: Boolean(enabled) }, actorId);
    return { freeMode: Boolean(enabled) };
  }

  async setVndPerCredit(value, actorId, note) {
    const n = Number(value);
    if (!Number.isSafeInteger(n) || n < 1 || n > 1_000_000_000) {
      throw fail('vndPerCredit must be a positive integer VND amount', 400, 'INVALID_CONVERSION');
    }
    const previous = await this.getVndPerCredit().catch(() => null);
    if (previous === n) {
      return {
        vndPerCredit: n,
        changed: false,
        opsReference: await this.getOpsVndPerCreditReference(),
      };
    }
    const effectiveAt = new Date();
    await this.setSetting('vnd_per_credit', { value: n, effectiveAt: effectiveAt.toISOString() }, actorId);
    await db.insert(forumCreditVndRateHistory).values({
      id: crypto.randomUUID(),
      oldValue: previous,
      newValue: n,
      actorId: actorId ?? null,
      effectiveAt,
      note: note ? String(note).slice(0, 255) : 'admin_update',
    });
    return {
      vndPerCredit: n,
      previousVndPerCredit: previous,
      changed: true,
      effectiveAt: effectiveAt.toISOString(),
      opsReference: await this.getOpsVndPerCreditReference(),
    };
  }

  async listVndPerCreditHistory(limit = 20) {
    return db.select().from(forumCreditVndRateHistory)
      .orderBy(desc(forumCreditVndRateHistory.effectiveAt))
      .limit(Math.min(100, Math.max(1, Number(limit) || 20)));
  }

  /**
   * Accept OPS override/ban policy locally. Version must not move backward.
   * Ingestion only — outbound sync remains unsupported.
   */
  async acceptOpsPolicy(serviceCode, policy, actorNote = 'ops_policy') {
    if (!KNOWN_SERVICES.includes(serviceCode)) throw fail('Unknown service', 404, 'UNKNOWN_SERVICE');
    const [existing] = await db.select().from(forumOpsServicePolicies)
      .where(eq(forumOpsServicePolicies.serviceCode, serviceCode)).limit(1);
    if (existing?.opsVersion && policy.opsVersion) {
      if (String(policy.opsVersion) < String(existing.opsVersion)) {
        throw fail('Stale OPS policy version rejected', 409, 'STALE_OPS_POLICY');
      }
    }
    await db.insert(forumOpsServicePolicies).values({
      serviceCode,
      banned: Boolean(policy.banned),
      overridePriceVnd: policy.overridePriceVnd == null ? null : Number(policy.overridePriceVnd),
      opsVersion: policy.opsVersion || null,
      opsPricingVersionId: policy.opsPricingVersionId || null,
      evidence: policy.evidence || { note: actorNote },
      acceptedAt: new Date(),
      validUntil: policy.validUntil ? new Date(policy.validUntil) : null,
    }).onConflictDoUpdate({
      target: forumOpsServicePolicies.serviceCode,
      set: {
        banned: Boolean(policy.banned),
        overridePriceVnd: policy.overridePriceVnd == null ? null : Number(policy.overridePriceVnd),
        opsVersion: policy.opsVersion || null,
        opsPricingVersionId: policy.opsPricingVersionId || null,
        evidence: policy.evidence || { note: actorNote },
        acceptedAt: new Date(),
        validUntil: policy.validUntil ? new Date(policy.validUntil) : null,
      },
    });
    return this.resolveEffective(serviceCode);
  }
}

function authorityFromSource(source) {
  if (source === SOURCE_OPS_OVERRIDE) return 'ops-override';
  if (source === SOURCE_FREE_MODE) return 'forum-free-mode';
  if (source === SOURCE_OPS_BAN) return 'ops-ban';
  return 'forum-local';
}
