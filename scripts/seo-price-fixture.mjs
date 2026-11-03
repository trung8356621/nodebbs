import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import {config,root,local,readJson,writeJson,privateDirectory,runtime} from './forum.mjs';

const now = new Date();
const sharedPayload = {
  schemaVersion: 2,
  contract: 'forum-pricing/1',
  version: 1,
  productCode: 'pbn',
  sourceId: 'development-ops-fixture',
  issuedAt: now.toISOString(),
  validUntil: new Date(now.getTime() + 30 * 86400000).toISOString(),
  effectiveAt: now.toISOString(),
  creditVnd: 10000,
  businessTimeZone: 'Asia/Ho_Chi_Minh',
  quoteTtlSeconds: 300,
  products: [
    {
      id: 'seo-monthly',
      priceVersion: 1,
      type: 'seo_entitlement',
      name: 'Development monthly SEO',
      durationMonths: 1,
      listPriceCredit: 5,
      salePriceCredit: 0,
      unitPriceCredit: 0,
      enabled: true,
      effectiveAt: now.toISOString(),
      endsAt: null,
      renewalWindowDays: 7,
      discount: { label: 'Development activation price', amountCredit: 5, percentage: 100 },
    },
    {
      id: 'seo-monthly-paid',
      priceVersion: 1,
      type: 'seo_entitlement',
      name: 'Development paid monthly SEO',
      durationMonths: 1,
      listPriceCredit: 5,
      salePriceCredit: 3,
      unitPriceCredit: 3,
      enabled: true,
      effectiveAt: now.toISOString(),
      endsAt: null,
      renewalWindowDays: 7,
    },
    {
      id: 'credit-pack-100',
      priceVersion: 1,
      type: 'credit_package',
      name: '100 Credits',
      creditsGranted: 100,
      amountVnd: 1000000,
      listAmountVnd: 1000000,
      saleAmountVnd: 1000000,
      enabled: true,
      effectiveAt: now.toISOString(),
      endsAt: null,
    },
    {
      id: 'credit-pack-free-launch',
      priceVersion: 1,
      type: 'credit_package',
      name: 'Free launch grant',
      creditsGranted: 50,
      amountVnd: 0,
      listAmountVnd: 0,
      saleAmountVnd: 0,
      enabled: true,
      effectiveAt: now.toISOString(),
      endsAt: null,
    },
    {
      id: 'pin-7d',
      priceVersion: 1,
      type: 'paid_pin',
      name: '7-day topic pin',
      durationSeconds: 604800,
      listPriceCredit: 10,
      salePriceCredit: 10,
      unitPriceCredit: 10,
      enabled: true,
      effectiveAt: now.toISOString(),
      endsAt: null,
    },
  ],
};

for (const name of ['a', 'b']) {
  const c = config('forums/forum-' + name + '.json');
  const dir = privateDirectory(path.join(root, '.local/seo-final/ops', c.id));
  const secret = path.join(dir, 'signing-private.pem');
  const trust = path.join(dir, 'trust-public.pem');
  const snapshot = path.join(dir, 'prices.json');
  if (!fs.existsSync(secret)) {
    const keys = crypto.generateKeyPairSync('ed25519');
    fs.writeFileSync(secret, keys.privateKey.export({ type: 'pkcs8', format: 'pem' }));
    fs.writeFileSync(trust, keys.publicKey.export({ type: 'spki', format: 'pem' }));
  }
  // Always rewrite shared schemaVersion 2 catalog for both forums (same prices).
  const bytes = Buffer.from(JSON.stringify(sharedPayload));
  writeJson(snapshot, {
    payload: bytes.toString('base64'),
    checksum: crypto.createHash('sha256').update(bytes).digest('hex'),
    signature: crypto.sign(null, bytes, fs.readFileSync(secret)).toString('base64'),
  });
  const file = path.join(local(c), 'secrets.json');
  const s = readJson(file);
  s.opsPriceSnapshotFile = snapshot;
  s.opsPriceTrustKeyFile = trust;
  s.opsPriceSourceId = 'development-ops-fixture';
  writeJson(file, s);
  runtime(c);
  console.log(c.id + ': shared forum-pricing/1 fixture configured (schemaVersion 2); paid_pin listed as catalog SKU, runtime still MIGRATION_PENDING');
}
