import { rejectEngagementCredit } from '../engagement.js';
import db from '../../../db/index.js';
import { sysCurrencies, sysAccounts, sysTransactions } from '../schema.js';
import { eq, and } from 'drizzle-orm';
import { DEFAULT_CURRENCY_CODE } from '../constants.js';
import {
  addCreditAmount,
  compareCreditAmount,
  creditFromDb,
  normalizeCreditAmount,
  subCreditAmount,
} from '../utils/money.js';
import { creditToVndAmount } from '../utils/transactionDisplay.js';

/**
 * Ledger service — atomic Credit grants/deducts/transfers.
 * Amounts are decimal strings (NUMERIC) so VND÷creditVnd fractions are exact.
 */
export class LedgerService {
  constructor(fastify) {
    this.fastify = fastify;
  }

  /**
   * Attach VND/Credit snapshots from the committed ledger write.
   * Does not rewrite historical rows; only enrich metadata on new inserts.
   * Never derives VND from a later "current" account balance.
   */
  async buildCommittedSnapshot(metadata, { signedAmountCredit, balanceAfterCredit }) {
    const meta = metadata && typeof metadata === 'object' && !Array.isArray(metadata)
      ? { ...metadata }
      : {};

    const ledgerAmountCredit = creditFromDb(signedAmountCredit);
    const balanceCredit = creditFromDb(balanceAfterCredit);
    meta.ledgerAmountCredit = ledgerAmountCredit;
    meta.balanceAfterCredit = balanceCredit;

    if (meta.valueVnd == null) {
      for (const alt of [meta.priceVnd, meta.amountVnd]) {
        if (alt != null && Number.isFinite(Number(alt))) {
          meta.valueVnd = Math.abs(Number(alt));
          break;
        }
      }
    }

    let rate = null;
    for (const c of [meta.creditVnd, meta.vndPerCredit, meta.credit_vnd]) {
      const n = Number(c);
      if (Number.isSafeInteger(n) && n >= 1) {
        rate = n;
        break;
      }
    }
    if (rate == null) {
      try {
        const n = await this.fastify.localPricing?.getVndPerCredit?.();
        if (Number.isSafeInteger(Number(n)) && Number(n) >= 1) rate = Number(n);
      } catch {
        // Rate unavailable — leave Credit-only snapshot; UI shows legacy Credit.
      }
    }

    if (rate != null) {
      meta.creditVnd = rate;
      if (meta.valueVnd == null) {
        const vndStr = creditToVndAmount(ledgerAmountCredit, rate);
        if (vndStr != null) {
          const abs = Math.abs(Number(vndStr));
          if (Number.isFinite(abs)) meta.valueVnd = abs;
        }
      }
    }

    return meta;
  }

  async getAccount(userId, currencyCode, tx = db) {
    await tx.insert(sysAccounts).values({
      userId,
      currencyCode,
      balance: '0',
      totalEarned: '0',
      totalSpent: '0',
    }).onConflictDoNothing();
    const [account] = await tx.select().from(sysAccounts)
      .where(and(eq(sysAccounts.userId, userId), eq(sysAccounts.currencyCode, currencyCode)))
      .limit(1)
      .for('update');
    if (account.isFrozen) {
      throw Object.assign(new Error('Account is frozen'), { statusCode: 409 });
    }
    return {
      ...account,
      balance: creditFromDb(account.balance),
      totalEarned: creditFromDb(account.totalEarned),
      totalSpent: creditFromDb(account.totalSpent),
    };
  }

  async grant({
    userId, amount, currencyCode, type, referenceType, referenceId, description, metadata, tx: outerTx,
  }) {
    rejectEngagementCredit({ currencyCode, type, referenceType, metadata });
    const creditAmount = normalizeCreditAmount(amount);

    const run = async (tx) => {
      const account = await this.getAccount(userId, currencyCode, tx);
      const newBalance = addCreditAmount(account.balance, creditAmount);
      const newTotalEarned = addCreditAmount(account.totalEarned, creditAmount);

      await tx.update(sysAccounts)
        .set({ balance: newBalance, totalEarned: newTotalEarned })
        .where(eq(sysAccounts.id, account.id));

      const snapshot = await this.buildCommittedSnapshot(metadata, {
        signedAmountCredit: creditAmount,
        balanceAfterCredit: newBalance,
      });

      const [transaction] = await tx.insert(sysTransactions).values({
        userId,
        accountId: account.id,
        currencyCode,
        amount: creditAmount,
        balanceAfter: newBalance,
        type,
        referenceType,
        referenceId: String(referenceId),
        description,
        metadata: JSON.stringify(snapshot),
      }).returning();

      return {
        ...transaction,
        amount: creditFromDb(transaction.amount),
        balanceAfter: creditFromDb(transaction.balanceAfter),
      };
    };

    if (outerTx) return run(outerTx);
    return db.transaction(run);
  }

  async deduct({
    userId, amount, currencyCode, type, referenceType, referenceId, description, metadata, tx: outerTx,
  }) {
    const creditAmount = normalizeCreditAmount(amount);

    const run = async (tx) => {
      const account = await this.getAccount(userId, currencyCode, tx);

      if (compareCreditAmount(account.balance, creditAmount) < 0) {
        throw Object.assign(
          new Error(`Insufficient funds. Balance: ${account.balance}, Required: ${creditAmount}`),
          { statusCode: 409 },
        );
      }

      const newBalance = subCreditAmount(account.balance, creditAmount);
      const newTotalSpent = addCreditAmount(account.totalSpent, creditAmount);

      await tx.update(sysAccounts)
        .set({ balance: newBalance, totalSpent: newTotalSpent })
        .where(eq(sysAccounts.id, account.id));

      const signedAmount = `-${creditAmount}`;
      const snapshot = await this.buildCommittedSnapshot(metadata, {
        signedAmountCredit: signedAmount,
        balanceAfterCredit: newBalance,
      });

      const [transaction] = await tx.insert(sysTransactions).values({
        userId,
        accountId: account.id,
        currencyCode,
        amount: signedAmount,
        balanceAfter: newBalance,
        type,
        referenceType,
        referenceId: String(referenceId),
        description,
        metadata: JSON.stringify(snapshot),
      }).returning();

      return {
        ...transaction,
        amount: creditFromDb(transaction.amount),
        balanceAfter: creditFromDb(transaction.balanceAfter),
      };
    };

    if (outerTx) return run(outerTx);
    return db.transaction(run);
  }

  async transfer({
    fromUserId, toUserId, amount, currencyCode, type, referenceType, referenceId, description, metadata,
  }) {
    const creditAmount = normalizeCreditAmount(amount);
    if (fromUserId === toUserId) throw new Error('Cannot transfer to self');

    return db.transaction(async (tx) => {
      const first = await this.getAccount(Math.min(fromUserId, toUserId), currencyCode, tx);
      const second = await this.getAccount(Math.max(fromUserId, toUserId), currencyCode, tx);
      const fromAccount = fromUserId < toUserId ? first : second;
      const toAccount = fromUserId < toUserId ? second : first;

      if (compareCreditAmount(fromAccount.balance, creditAmount) < 0) {
        throw new Error(`Insufficient funds. Balance: ${fromAccount.balance}, Required: ${creditAmount}`);
      }

      const fromNewBalance = subCreditAmount(fromAccount.balance, creditAmount);
      const toNewBalance = addCreditAmount(toAccount.balance, creditAmount);

      await tx.update(sysAccounts)
        .set({
          balance: fromNewBalance,
          totalSpent: addCreditAmount(fromAccount.totalSpent, creditAmount),
        })
        .where(eq(sysAccounts.id, fromAccount.id));

      await tx.update(sysAccounts)
        .set({
          balance: toNewBalance,
          totalEarned: addCreditAmount(toAccount.totalEarned, creditAmount),
        })
        .where(eq(sysAccounts.id, toAccount.id));

      const fromSnapshot = await this.buildCommittedSnapshot(metadata, {
        signedAmountCredit: `-${creditAmount}`,
        balanceAfterCredit: fromNewBalance,
      });
      const toSnapshot = await this.buildCommittedSnapshot(metadata, {
        signedAmountCredit: creditAmount,
        balanceAfterCredit: toNewBalance,
      });

      const [fromTx] = await tx.insert(sysTransactions).values({
        userId: fromUserId,
        accountId: fromAccount.id,
        currencyCode,
        amount: `-${creditAmount}`,
        balanceAfter: fromNewBalance,
        type,
        referenceType,
        referenceId: String(referenceId),
        relatedUserId: toUserId,
        description: description || `Transfer to user ${toUserId}`,
        metadata: JSON.stringify(fromSnapshot),
      }).returning();

      const [toTx] = await tx.insert(sysTransactions).values({
        userId: toUserId,
        accountId: toAccount.id,
        currencyCode,
        amount: creditAmount,
        balanceAfter: toNewBalance,
        type,
        referenceType,
        referenceId: String(referenceId),
        relatedUserId: fromUserId,
        description: description || `Transfer from user ${fromUserId}`,
        metadata: JSON.stringify(toSnapshot),
      }).returning();

      return {
        fromTx: { ...fromTx, amount: creditFromDb(fromTx.amount), balanceAfter: creditFromDb(fromTx.balanceAfter) },
        toTx: { ...toTx, amount: creditFromDb(toTx.amount), balanceAfter: creditFromDb(toTx.balanceAfter) },
      };
    });
  }

  async isCurrencyActive(currencyCode) {
    const [currency] = await db
      .select({ isActive: sysCurrencies.isActive })
      .from(sysCurrencies)
      .where(eq(sysCurrencies.code, currencyCode))
      .limit(1);
    return currency?.isActive ?? false;
  }

  async getCurrencyConfig(currencyCode, key, defaultValue = null) {
    try {
      const [currency] = await db
        .select({ config: sysCurrencies.config })
        .from(sysCurrencies)
        .where(eq(sysCurrencies.code, currencyCode))
        .limit(1);

      if (!currency || !currency.config) return defaultValue;

      const config = JSON.parse(currency.config);
      const item = config[key];
      if (item === undefined) return defaultValue;

      if (item !== null && typeof item === 'object' && 'value' in item) {
        return item.value;
      }
      return item;
    } catch (error) {
      console.error(`[Ledger] Error parsing config for ${currencyCode}:`, error);
      return defaultValue;
    }
  }

  async getCurrencyName(currencyCode = DEFAULT_CURRENCY_CODE) {
    const cacheKey = `currency:name:${currencyCode}`;
    const ttl = 3600;

    try {
      return await this.fastify.cache.remember(cacheKey, ttl, async () => {
        const [currency] = await db
          .select({ name: sysCurrencies.name })
          .from(sysCurrencies)
          .where(eq(sysCurrencies.code, currencyCode))
          .limit(1);
        return currency?.name || currencyCode;
      });
    } catch (error) {
      console.error(`[Ledger] Error getting currency name for ${currencyCode}:`, error);
      return currencyCode;
    }
  }
}
