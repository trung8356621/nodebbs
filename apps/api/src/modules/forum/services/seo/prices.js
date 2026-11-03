import crypto from 'node:crypto';
import fs from 'node:fs';

export const FORUM_PRICING_CONTRACT = 'forum-pricing/1';
export const digest = (value) => crypto.createHash('sha256').update(value).digest('hex');

const integer = (n, min, max) => Number.isSafeInteger(n) && n >= min && n <= max;
const timestamp = (v) => {
  if (typeof v !== 'string') return false;
  const m = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2}):(\d{2})(?:\.\d{1,3})?(Z|([+-])(\d{2}):(\d{2}))$/.exec(v);
  if (!m || !Number.isFinite(Date.parse(v))) return false;
  const [, y, month, day, hour, minute, second] = m;
  return +month >= 1 && +month <= 12
    && +day >= 1 && +day <= new Date(Date.UTC(+y, +month, 0)).getUTCDate()
    && +hour <= 23 && +minute <= 59 && +second <= 59
    && (m[7] === 'Z' || (+m[9] <= 14 && +m[10] <= 59 && (+m[9] !== 14 || +m[10] === 0)));
};
const exact = (o, keys) => o && typeof o === 'object' && !Array.isArray(o) && Object.keys(o).every((k) => keys.includes(k));
const hasKeys = (o, keys) => o && typeof o === 'object' && !Array.isArray(o) && keys.every((k) => Object.prototype.hasOwnProperty.call(o, k));

function validateDiscount(d, listPriceCredit, salePriceCredit) {
  if (d === undefined) return;
  const amount = listPriceCredit - salePriceCredit;
  if (!exact(d, ['label', 'amountCredit', 'percentage']) || amount <= 0) throw new Error('Invalid OPS discount metadata');
  if (d.label !== undefined && (typeof d.label !== 'string' || !d.label.trim() || d.label.length > 80)) throw new Error('Invalid OPS discount metadata');
  if (d.amountCredit !== undefined && d.amountCredit !== amount) throw new Error('Invalid OPS discount metadata');
  if (d.percentage !== undefined && (!integer(d.percentage, 0, 100) || d.percentage * listPriceCredit !== amount * 100)) throw new Error('Invalid OPS discount metadata');
}

function validateSeoProduct(r) {
  const keys = ['id', 'priceVersion', 'type', 'name', 'durationMonths', 'listPriceCredit', 'salePriceCredit', 'enabled', 'effectiveAt', 'endsAt', 'renewalWindowDays', 'discount'];
  const v2Keys = [...keys, 'unitPriceCredit'];
  if (!(exact(r, keys) || exact(r, v2Keys))) throw new Error('Invalid OPS product price');
  if (typeof r.id !== 'string' || !/^[-a-z0-9]{1,80}$/.test(r.id) || !integer(r.priceVersion, 1, 2147483647)
    || r.type !== 'seo_entitlement' || typeof r.name !== 'string' || !r.name.trim() || r.name.length > 120
    || !integer(r.durationMonths, 1, 12) || !integer(r.listPriceCredit, 0, 1000000000)
    || !integer(r.salePriceCredit, 0, r.listPriceCredit) || typeof r.enabled !== 'boolean'
    || !timestamp(r.effectiveAt)
    || (r.endsAt !== undefined && r.endsAt !== null && (!timestamp(r.endsAt) || Date.parse(r.endsAt) <= Date.parse(r.effectiveAt)))
    || !integer(r.renewalWindowDays, 0, 14)) throw new Error('Invalid OPS product price');
  if (r.unitPriceCredit !== undefined && r.unitPriceCredit !== r.salePriceCredit) throw new Error('Invalid OPS unit price');
  validateDiscount(r.discount, r.listPriceCredit, r.salePriceCredit);
}

function validateCreditPackage(r) {
  if (!hasKeys(r, ['id', 'priceVersion', 'type', 'name', 'creditsGranted', 'amountVnd', 'listAmountVnd', 'saleAmountVnd', 'enabled', 'effectiveAt'])
    || typeof r.id !== 'string' || !/^[-a-z0-9]{1,80}$/.test(r.id) || !integer(r.priceVersion, 1, 2147483647)
    || r.type !== 'credit_package' || typeof r.name !== 'string' || !r.name.trim() || r.name.length > 120
    || !integer(r.creditsGranted, 0, 1000000000) || !integer(r.amountVnd, 0, 1000000000000)
    || !integer(r.listAmountVnd, 0, 1000000000000) || !integer(r.saleAmountVnd, 0, r.listAmountVnd)
    || r.amountVnd !== r.saleAmountVnd || typeof r.enabled !== 'boolean' || !timestamp(r.effectiveAt)
    || (r.endsAt !== undefined && r.endsAt !== null && (!timestamp(r.endsAt) || Date.parse(r.endsAt) <= Date.parse(r.effectiveAt)))) {
    throw new Error('Invalid OPS credit package price');
  }
}

function validatePaidPin(r) {
  if (!hasKeys(r, ['id', 'priceVersion', 'type', 'name', 'durationSeconds', 'listPriceCredit', 'salePriceCredit', 'unitPriceCredit', 'enabled', 'effectiveAt'])
    || typeof r.id !== 'string' || !/^[-a-z0-9]{1,80}$/.test(r.id) || !integer(r.priceVersion, 1, 2147483647)
    || r.type !== 'paid_pin' || typeof r.name !== 'string' || !r.name.trim() || r.name.length > 120
    || !integer(r.durationSeconds, 60, 31536000) || !integer(r.listPriceCredit, 0, 1000000000)
    || !integer(r.salePriceCredit, 0, r.listPriceCredit) || r.unitPriceCredit !== r.salePriceCredit
    || typeof r.enabled !== 'boolean' || !timestamp(r.effectiveAt)
    || (r.endsAt !== undefined && r.endsAt !== null && (!timestamp(r.endsAt) || Date.parse(r.endsAt) <= Date.parse(r.effectiveAt)))) {
    throw new Error('Invalid OPS paid_pin price');
  }
  validateDiscount(r.discount, r.listPriceCredit, r.salePriceCredit);
}

function validateIntervals(products) {
  for (const id of new Set(products.map((r) => r.id))) {
    const intervals = products.filter((r) => r.id === id).sort((a, b) => Date.parse(a.effectiveAt) - Date.parse(b.effectiveAt));
    for (let i = 1; i < intervals.length; i++) {
      if (!intervals[i - 1].endsAt || Date.parse(intervals[i - 1].endsAt) > Date.parse(intervals[i].effectiveAt)) {
        throw new Error('Overlapping OPS price intervals');
      }
    }
  }
}

/** Validate legacy SEO schemaVersion 1 or shared forum-pricing/1 schemaVersion 2. */
export function validatePrices(p, forumId, sourceId) {
  if (!p || typeof p !== 'object' || Array.isArray(p)) throw new Error('Invalid OPS price snapshot');
  if (p.schemaVersion === 1) return validateLegacyV1(p, forumId, sourceId);
  if (p.schemaVersion === 2) return validateSharedV2(p, sourceId);
  throw new Error('Invalid OPS price snapshot');
}

function validateLegacyV1(p, forumId, sourceId) {
  if (!exact(p, ['schemaVersion', 'version', 'forumId', 'sourceId', 'issuedAt', 'validUntil', 'products'])
    || p.schemaVersion !== 1 || !integer(p.version, 1, 2147483647) || p.forumId !== forumId || p.sourceId !== sourceId
    || !timestamp(p.issuedAt) || !timestamp(p.validUntil) || Date.parse(p.validUntil) <= Date.parse(p.issuedAt)
    || Date.parse(p.validUntil) - Date.parse(p.issuedAt) > 366 * 86400000
    || !Array.isArray(p.products) || p.products.length > 200) throw new Error('Invalid OPS price snapshot');
  const identities = new Set();
  for (const r of p.products) {
    validateSeoProduct(r);
    const identity = `${r.id}:${r.priceVersion}`;
    if (identities.has(identity)) throw new Error('Duplicate OPS product version');
    identities.add(identity);
  }
  validateIntervals(p.products);
  return {
    ...p,
    contract: null,
    productCode: null,
    creditVnd: null,
    businessTimeZone: null,
    quoteTtlSeconds: null,
    effectiveAt: p.issuedAt,
  };
}

function validateSharedV2(p, sourceId) {
  const required = ['schemaVersion', 'contract', 'version', 'productCode', 'sourceId', 'issuedAt', 'validUntil', 'effectiveAt', 'creditVnd', 'businessTimeZone', 'quoteTtlSeconds', 'products'];
  if (!exact(p, required)
    || p.schemaVersion !== 2 || p.contract !== FORUM_PRICING_CONTRACT || p.productCode !== 'pbn'
    || !integer(p.version, 1, 2147483647) || p.sourceId !== sourceId
    || !timestamp(p.issuedAt) || !timestamp(p.validUntil) || !timestamp(p.effectiveAt)
    || Date.parse(p.validUntil) <= Date.parse(p.issuedAt)
    || Date.parse(p.validUntil) - Date.parse(p.issuedAt) > 366 * 86400000
    || !integer(p.creditVnd, 1, 1000000000)
    || typeof p.businessTimeZone !== 'string' || !p.businessTimeZone.trim() || p.businessTimeZone.length > 64
    || !integer(p.quoteTtlSeconds, 30, 3600)
    || !Array.isArray(p.products) || p.products.length > 200) throw new Error('Invalid OPS price snapshot');

  const identities = new Set();
  for (const r of p.products) {
    if (!r || typeof r !== 'object') throw new Error('Invalid OPS product price');
    if (r.type === 'seo_entitlement') validateSeoProduct(r);
    else if (r.type === 'credit_package') validateCreditPackage(r);
    else if (r.type === 'paid_pin') validatePaidPin(r);
    else throw new Error('Invalid OPS product price');
    const identity = `${r.id}:${r.priceVersion}`;
    if (identities.has(identity)) throw new Error('Duplicate OPS product version');
    identities.add(identity);
  }
  validateIntervals(p.products);
  return p;
}

export function catalogMetaFromPayload(payload) {
  if (!payload) return null;
  if (payload.schemaVersion === 2) {
    return {
      schemaVersion: 2,
      contract: payload.contract,
      creditVnd: payload.creditVnd,
      businessTimeZone: payload.businessTimeZone,
      quoteTtlSeconds: payload.quoteTtlSeconds,
      productCode: payload.productCode,
      effectiveAt: payload.effectiveAt,
    };
  }
  return {
    schemaVersion: 1,
    contract: null,
    creditVnd: null,
    businessTimeZone: null,
    quoteTtlSeconds: null,
    productCode: null,
    effectiveAt: payload.issuedAt || null,
  };
}

export function productsFromPayload(payload, type) {
  if (!payload?.products) return [];
  return payload.products.filter((p) => !type || p.type === type);
}

export async function synchronizePrices(pool, envelope, key, { forumId, sourceId, allowUnchanged = false }) {
  const client = await pool.connect();
  let version = null;
  try {
    if (typeof forumId !== 'string' || !sourceId
      || typeof envelope?.payload !== 'string' || envelope.payload.length > 1400000
      || typeof envelope.signature !== 'string' || envelope.signature.length > 200
      || !/^([a-f0-9]{64})$/.test(envelope.checksum || '')) {
      throw new Error('OPS source is not configured or envelope is invalid');
    }
    const bytes = Buffer.from(envelope.payload, 'base64');
    const publicKey = crypto.createPublicKey(key);
    if (bytes.length > 1000000 || bytes.toString('base64') !== envelope.payload
      || publicKey.asymmetricKeyType !== 'ed25519'
      || digest(bytes) !== envelope.checksum
      || !crypto.verify(null, bytes, publicKey, Buffer.from(envelope.signature, 'base64'))) {
      throw new Error('OPS price authentication failed');
    }
    const payload = validatePrices(JSON.parse(bytes.toString('utf8')), forumId, sourceId);
    version = payload.version;
    await client.query('BEGIN');
    await client.query("SET LOCAL lock_timeout='10s'");
    await client.query("SELECT pg_advisory_xact_lock(hashtext('pbn-seo-prices'))");
    const now = (await client.query('SELECT clock_timestamp() AS now')).rows[0].now;
    if (Date.parse(payload.validUntil) <= now.getTime() || Date.parse(payload.issuedAt) > now.getTime() + 300000) {
      throw new Error('OPS snapshot is expired or issued in the future');
    }
    const old = (await client.query('SELECT version,checksum FROM ops_price_snapshots ORDER BY version DESC LIMIT 1')).rows[0];
    if (old && (version < old.version || (version === old.version && old.checksum !== envelope.checksum))) {
      throw new Error('OPS version downgrade or replay conflict');
    }
    if (old && old.version === version) {
      if (!allowUnchanged) throw new Error('OPS snapshot replay');
      await client.query('COMMIT');
      return { version, checksum: envelope.checksum, products: payload.products.length, unchanged: true };
    }
    if (!old || old.version !== version) {
      await client.query(
        'INSERT INTO ops_price_snapshots(version,source_id,checksum,payload,valid_until) VALUES($1,$2,$3,$4,$5)',
        [version, sourceId, envelope.checksum, payload, payload.validUntil],
      );
      for (const r of payload.products) {
        if (r.type !== 'seo_entitlement') continue;
        await client.query(
          'INSERT INTO seo_products(snapshot_version,product_id,price_version,name,type,duration_months,list_price,sale_price,enabled,effective_at,ends_at,renewal_window_days,discount) VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13)',
          [version, r.id, r.priceVersion, r.name, r.type, r.durationMonths, r.listPriceCredit, r.salePriceCredit, r.enabled, r.effectiveAt, r.endsAt || null, r.renewalWindowDays, r.discount || null],
        );
      }
    }
    await client.query(
      "INSERT INTO ops_price_syncs(id,success,version,reason) VALUES($1,true,$2,'VERIFIED')",
      [crypto.randomUUID(), version],
    );
    await client.query('COMMIT');
    return { version, checksum: envelope.checksum, products: payload.products.length, schemaVersion: payload.schemaVersion };
  } catch (error) {
    await client.query('ROLLBACK');
    await client.query(
      'INSERT INTO ops_price_syncs(id,success,version,reason) VALUES($1,false,$2,$3)',
      [crypto.randomUUID(), version, String(error.message).slice(0, 250)],
    );
    throw error;
  } finally {
    client.release();
  }
}

export async function synchronizeConfiguredPrices(pool) {
  if (!process.env.OPS_PRICE_SNAPSHOT_FILE || !process.env.OPS_PRICE_TRUST_KEY_FILE || !process.env.OPS_PRICE_SOURCE_ID) {
    throw new Error('OPS price source is not configured');
  }
  if (fs.statSync(process.env.OPS_PRICE_SNAPSHOT_FILE).size > 1500000) throw new Error('OPS snapshot exceeds size limit');
  return synchronizePrices(
    pool,
    JSON.parse(fs.readFileSync(process.env.OPS_PRICE_SNAPSHOT_FILE, 'utf8')),
    fs.readFileSync(process.env.OPS_PRICE_TRUST_KEY_FILE, 'utf8'),
    { forumId: process.env.FORUM_ID, sourceId: process.env.OPS_PRICE_SOURCE_ID, allowUnchanged: true },
  );
}
