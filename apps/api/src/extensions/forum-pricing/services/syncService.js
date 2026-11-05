import crypto from 'node:crypto';
import { desc, eq, sql } from 'drizzle-orm';
import db from '../../../db/index.js';
import { FORUM_PRICING_CONTRACT } from '../constants.js';
import { verifyForumPricingSnapshot } from '../crypto.js';
import { resolveTrustedVerification } from '../trust.js';
import { validateForumPricingSnapshot } from '../validate.js';
import { opsForumPricingSnapshots, opsForumPricingSyncs } from '../schema.js';
import { viewFromSnapshot, findPackage, findSeoService, findPaidPin } from './catalogView.js';

function digestSnapshot(snapshot) {
  return crypto.createHash('sha256').update(JSON.stringify(snapshot)).digest('hex');
}

/** Missing additive baseline 0007/0008 — treat as no HTTP catalog, never 500. */
function isMissingPricingStore(err) {
  const msg = String(err?.cause?.message || err?.message || '');
  return err?.cause?.code === '42P01'
    || /ops_forum_pricing_snapshots/i.test(msg)
    || /relation .* does not exist/i.test(msg);
}

export class ForumPricingSyncService {
  constructor(fastify, connectionStore, opsClient) {
    this.fastify = fastify;
    this.connectionStore = connectionStore;
    this.opsClient = opsClient;
    this._pricingStoreMissing = null;
  }

  async pricingStoreAvailable() {
    if (this._pricingStoreMissing === true) return false;
    if (this._pricingStoreMissing === false) return true;
    try {
      await db.select({ version: opsForumPricingSnapshots.version }).from(opsForumPricingSnapshots).limit(1);
      this._pricingStoreMissing = false;
      return true;
    } catch (err) {
      if (isMissingPricingStore(err)) {
        this._pricingStoreMissing = true;
        this.fastify?.log?.warn?.(
          '[forum-pricing] ops_forum_pricing_snapshots missing; apply baseline 0007_forum_pricing_ops.sql',
        );
        return false;
      }
      throw err;
    }
  }

  async getMaxStoredVersion() {
    if (!(await this.pricingStoreAvailable())) return 0;
    const [row] = await db.select({
      max: sql`coalesce(max(${opsForumPricingSnapshots.version}), 0)`,
    }).from(opsForumPricingSnapshots);
    return Number(row?.max || 0);
  }

  async getLatestVerified() {
    if (!(await this.pricingStoreAvailable())) return null;
    try {
      const [row] = await db.select().from(opsForumPricingSnapshots)
        .orderBy(desc(opsForumPricingSnapshots.version))
        .limit(1);
      return row || null;
    } catch (err) {
      if (isMissingPricingStore(err)) {
        this._pricingStoreMissing = true;
        return null;
      }
      throw err;
    }
  }

  /**
   * Effective snapshot for new quotes: latest verified whose effectiveAt <= now
   * and validUntil is null or future. Offline: last verified still usable while valid.
   */
  async getEffectiveVerified(now = new Date()) {
    if (!(await this.pricingStoreAvailable())) return null;
    try {
      const rows = await db.select().from(opsForumPricingSnapshots)
        .orderBy(desc(opsForumPricingSnapshots.version))
        .limit(50);
      const t = now.getTime();
      for (const row of rows) {
        if (new Date(row.effectiveAt).getTime() > t) continue;
        if (row.validUntil && new Date(row.validUntil).getTime() <= t) continue;
        return row;
      }
      return null;
    } catch (err) {
      if (isMissingPricingStore(err)) {
        this._pricingStoreMissing = true;
        return null;
      }
      throw err;
    }
  }

  async getCatalogView(now = new Date()) {
    const row = await this.getEffectiveVerified(now);
    if (!row) return null;
    return viewFromSnapshot(row.snapshot, { checksum: row.checksum, now });
  }

  async requireCatalogView(now = new Date()) {
    const view = await this.getCatalogView(now);
    if (!view || view.expired) {
      const err = new Error('No authorized current OPS pricing catalog is available');
      err.code = 'PRICE_UNAVAILABLE';
      err.statusCode = 409;
      throw err;
    }
    return view;
  }

  async getPackage(packageCode, now = new Date()) {
    const row = await this.getEffectiveVerified(now);
    if (!row) {
      const err = new Error('No authorized current credit package price is available');
      err.code = 'PRICE_UNAVAILABLE';
      err.statusCode = 409;
      throw err;
    }
    const pack = findPackage(row.snapshot, packageCode);
    if (!pack) {
      const err = new Error('unknown_package');
      err.code = 'unknown_package';
      err.statusCode = 400;
      throw err;
    }
    return {
      ...pack,
      snapshotVersion: row.version,
      pricingVersion: row.version,
      pricingVersionId: row.pricingVersionId,
      sourceId: 'ops-forum-pricing',
      creditVnd: row.vndPerCredit,
      unitPrice: pack.priceVnd,
      quantity: 1,
      totalCredits: pack.credits,
      amountVnd: pack.priceVnd,
      creditsGranted: pack.credits,
      id: pack.code,
    };
  }

  async getSeoProduct(code, now = new Date()) {
    const row = await this.getEffectiveVerified(now);
    if (!row) return null;
    const svc = findSeoService(row.snapshot, code);
    if (!svc) return null;
    const view = viewFromSnapshot(row.snapshot, { checksum: row.checksum, now });
    return view.products.find((p) => p.productId === code) || null;
  }

  async getPaidPin(code, now = new Date()) {
    const row = await this.getEffectiveVerified(now);
    if (!row) {
      const err = new Error('No authorized current paid_pin price is available');
      err.code = 'PRICE_UNAVAILABLE';
      err.statusCode = 409;
      throw err;
    }
    const pin = findPaidPin(row.snapshot, code);
    if (!pin) {
      const err = new Error('unknown_sku');
      err.code = 'unknown_sku';
      err.statusCode = 400;
      throw err;
    }
    const view = viewFromSnapshot(row.snapshot, { checksum: row.checksum, now });
    return view.paidPins.find((p) => p.code === code) || null;
  }

  /**
   * Ingest one signed snapshot. Fail closed on verify/tamper. Never invent prices.
   * Trust comes only from the local OPS key registry — not sync-response publicKey alone.
   */
  async ingestSnapshot(snapshot, syncVerification = null) {
    validateForumPricingSnapshot(snapshot);
    const trust = resolveTrustedVerification(snapshot.signature?.keyId, syncVerification);
    if (!trust.ok) {
      const err = new Error(`OPS price authentication failed: ${trust.reason}`);
      err.code = trust.reason;
      err.statusCode = 400;
      throw err;
    }
    const verified = verifyForumPricingSnapshot(snapshot, trust.verification);
    if (!verified.ok) {
      const err = new Error(`OPS price authentication failed: ${verified.reason}`);
      err.code = verified.reason;
      err.statusCode = 400;
      throw err;
    }

    const existing = await db.select().from(opsForumPricingSnapshots)
      .where(eq(opsForumPricingSnapshots.version, snapshot.version))
      .limit(1);
    if (existing[0]) {
      const same = existing[0].checksum === digestSnapshot(snapshot);
      if (!same) {
        const err = new Error('OPS version downgrade or replay conflict');
        err.code = 'version_conflict';
        err.statusCode = 409;
        throw err;
      }
      return { version: snapshot.version, unchanged: true };
    }

    const max = await this.getMaxStoredVersion();
    if (snapshot.version < max) {
      const err = new Error('OPS version downgrade or replay conflict');
      err.code = 'version_downgrade';
      err.statusCode = 409;
      throw err;
    }

    await db.insert(opsForumPricingSnapshots).values({
      version: snapshot.version,
      pricingVersionId: snapshot.pricingVersionId,
      productKey: snapshot.productKey,
      schemaVersion: snapshot.schemaVersion,
      issuedAt: new Date(snapshot.issuedAt),
      effectiveAt: new Date(snapshot.effectiveAt),
      validUntil: snapshot.validUntil ? new Date(snapshot.validUntil) : null,
      vndPerCredit: snapshot.vndPerCredit,
      keyId: trust.verification.keyId,
      publicKey: trust.verification.publicKey,
      checksum: digestSnapshot(snapshot),
      snapshot,
      verifiedAt: new Date(),
    });
    return { version: snapshot.version, unchanged: false, keyId: trust.verification.keyId };
  }

  async syncFromOps({ afterVersion } = {}) {
    const row = await this.connectionStore.getRow();
    if (!row?.credentialCiphertext) {
      const err = new Error('Not enrolled with OPS');
      err.code = 'not_enrolled';
      err.statusCode = 400;
      throw err;
    }

    const after = afterVersion == null ? await this.getMaxStoredVersion() : Number(afterVersion);
    let response;
    try {
      const credential = await this.connectionStore.getActiveCredentialPlaintext();
      response = await this.opsClient.pricingSync(row, credential, { afterVersion: after });
    } catch (err) {
      await db.insert(opsForumPricingSyncs).values({
        success: false,
        afterVersion: after,
        currentVersion: null,
        importedCount: 0,
        reason: String(err.message || err).slice(0, 250),
      });
      // Offline policy: keep last verified; do not invent.
      throw err;
    }

    const data = response.data;
    if (data?.schemaVersion && data.schemaVersion !== FORUM_PRICING_CONTRACT) {
      const err = new Error('contract_mismatch');
      err.code = 'contract_mismatch';
      err.statusCode = 400;
      throw err;
    }

    const verification = data.verification;
    let imported = 0;
    for (const entry of data.versions || []) {
      const snapshot = entry.snapshot;
      const result = await this.ingestSnapshot(snapshot, verification);
      if (!result.unchanged) imported += 1;
    }

    await db.insert(opsForumPricingSyncs).values({
      success: true,
      afterVersion: after,
      currentVersion: data.currentVersion ?? null,
      importedCount: imported,
      reason: 'VERIFIED',
    });

    if (this.connectionStore.setStatus) {
      await this.connectionStore.setStatus({ lastSyncAt: new Date(), lastError: null });
    }
    return {
      afterVersion: after,
      currentVersion: data.currentVersion ?? null,
      imported,
      catalog: await this.getCatalogView(),
    };
  }

  async createOpsQuote({ localUserId, quoteKind, skuCode, quantity = 1, pricingVersion, idempotencyKey }) {
    const row = await this.connectionStore.getRow();
    if (!row?.credentialCiphertext) {
      const err = new Error('Not enrolled with OPS');
      err.code = 'not_enrolled';
      err.statusCode = 400;
      throw err;
    }
    const credential = await this.connectionStore.getActiveCredentialPlaintext();
    return this.opsClient.pricingCreateQuote(row, credential, {
      localUserId: String(localUserId),
      quoteKind,
      skuCode,
      quantity,
      pricingVersion: pricingVersion ?? undefined,
      idempotencyKey: idempotencyKey || undefined,
    });
  }
}
