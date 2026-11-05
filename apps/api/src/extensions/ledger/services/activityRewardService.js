import { and, eq, gte, sql } from 'drizzle-orm';
import db, { pool } from '../../../db/index.js';
import { sysTransactions } from '../schema.js';
import { userCheckIns } from '../../rewards/schema.js';
import { DEFAULT_CURRENCY_CODE } from '../constants.js';
import { ACTIVITY_RULES_ENGINE } from '../engagement.js';
import {
  buildRewardRulesView,
  normalizeRuleEntry,
  parseCurrencyConfig,
  readRuleEnabled,
  readRuleValueVnd,
} from '../rewardRules.js';
import {
  addCreditAmount,
  compareCreditAmount,
  creditFromDb,
  mulCreditAmount,
  vndToCreditAmount,
} from '../utils/money.js';
import { EVENTS } from '../../../constants/events.js';

/** Conservative default: 100 Credit / day from activity grants (does not rewrite saved policy). */
export const DEFAULT_DAILY_ACTIVITY_CAP_CREDIT = '100';

const FORUM_TZ = 'Asia/Ho_Chi_Minh';

/** In-process clock override for Forum B E2E only — never touches OS / shared DB clocks. */
let _nowOverride = null;

export function setActivityNowOverride(dateOrNull) {
  _nowOverride = dateOrNull == null ? null : new Date(dateOrNull);
  if (_nowOverride && Number.isNaN(_nowOverride.getTime())) {
    _nowOverride = null;
    throw Object.assign(new Error('Invalid activity clock override'), { statusCode: 400, code: 'invalid_clock' });
  }
  return _nowOverride;
}

export function getActivityNowOverride() {
  return _nowOverride ? new Date(_nowOverride.getTime()) : null;
}

export function activityNow() {
  return _nowOverride ? new Date(_nowOverride.getTime()) : new Date();
}

export function forumDateKey(date = activityNow()) {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: FORUM_TZ,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(date);
}

export function forumDayBounds(date = activityNow()) {
  const key = forumDateKey(date);
  // en-CA → YYYY-MM-DD; interpret midnight in Forum TZ via UTC offset approximation using Date parsing.
  const start = new Date(`${key}T00:00:00+07:00`);
  const end = new Date(start.getTime() + 24 * 60 * 60 * 1000);
  return { key, start, end };
}

export class ActivityRewardService {
  constructor(fastify) {
    this.fastify = fastify;
  }

  async getCreditsConfig() {
    const { sysCurrencies } = await import('../schema.js');
    const [currency] = await db.select().from(sysCurrencies)
      .where(eq(sysCurrencies.code, DEFAULT_CURRENCY_CODE)).limit(1);
    return parseCurrencyConfig(currency?.config);
  }

  async getVndPerCredit() {
    // Read via pool so a missing local-pricing table cannot abort an ambient
    // policy atomicWrite transaction (db Proxy would reuse that tx).
    try {
      const { rows } = await pool.query(
        `SELECT value FROM forum_credit_vnd_rate ORDER BY id DESC LIMIT 1`,
      );
      const n = Number(rows[0]?.value);
      if (Number.isSafeInteger(n) && n >= 1) return n;
    } catch { /* table may be absent on older Forum B DBs */ }
    try {
      const n = await this.fastify.localPricing?.getVndPerCredit?.();
      if (Number.isSafeInteger(n) && n >= 1) return n;
    } catch { /* fall through */ }
    return 10000;
  }

  async resolveRuleCredit(config, key) {
    const rate = await this.getVndPerCredit();
    const entry = normalizeRuleEntry(config?.[key]);
    if (!readRuleEnabled(entry)) return { enabled: false, credit: '0', vnd: 0, rate };
    const vnd = readRuleValueVnd(entry, rate);
    if (vnd <= 0) return { enabled: true, credit: '0', vnd: 0, rate };
    const credit = vndToCreditAmount(vnd, rate);
    return { enabled: true, credit, vnd, rate };
  }

  async findExistingTx({ userId, type, referenceType, referenceId }) {
    const [row] = await db.select({ id: sysTransactions.id })
      .from(sysTransactions)
      .where(and(
        eq(sysTransactions.userId, userId),
        eq(sysTransactions.type, type),
        eq(sysTransactions.referenceType, referenceType),
        eq(sysTransactions.referenceId, String(referenceId)),
      ))
      .limit(1);
    return row || null;
  }

  async sumActivityGrantsToday(userId) {
    const { start } = forumDayBounds();
    const [row] = await db.select({
      total: sql`coalesce(sum(${sysTransactions.amount}), 0)`,
    })
      .from(sysTransactions)
      .where(and(
        eq(sysTransactions.userId, userId),
        eq(sysTransactions.currencyCode, DEFAULT_CURRENCY_CODE),
        gte(sysTransactions.createdAt, start),
        sql`${sysTransactions.amount} > 0`,
        sql`coalesce(${sysTransactions.metadata}::jsonb->>'engine', '') = ${ACTIVITY_RULES_ENGINE}`,
      ));
    return creditFromDb(row?.total ?? 0);
  }

  async assertDailyCap(userId, addCredit) {
    if (!addCredit || addCredit === '0' || Number(addCredit) <= 0) return;
    const rate = await this.getVndPerCredit();
    const config = await this.getCreditsConfig();
    const capEntry = normalizeRuleEntry(config.daily_activity_reward_cap_vnd);
    // Missing key → conservative default. Explicitly disabled → no daily cap.
    if (capEntry && typeof capEntry.enabled === 'boolean' && !capEntry.enabled) return;
    let capCredit = DEFAULT_DAILY_ACTIVITY_CAP_CREDIT;
    if (capEntry && readRuleValueVnd(capEntry, rate) > 0) {
      capCredit = vndToCreditAmount(readRuleValueVnd(capEntry, rate), rate);
    }
    const used = await this.sumActivityGrantsToday(userId);
    const projected = addCreditAmount(used, addCredit);
    if (compareCreditAmount(projected, capCredit) > 0) {
      throw Object.assign(
        new Error(`Daily activity reward cap reached (${capCredit} Credit)`),
        { statusCode: 429, code: 'daily_reward_cap', silent: true },
      );
    }
  }

  /**
   * Idempotent grant for an activity rule. No-ops when disabled, zero, duplicate, or indivisible.
   */
  async grantForRule({
    userId,
    ruleKey,
    type,
    referenceType,
    referenceId,
    description,
    metadata = {},
  }) {
    if (!this.fastify.ledger) return { skipped: true, reason: 'no_ledger' };
    const active = await this.fastify.ledger.isCurrencyActive(DEFAULT_CURRENCY_CODE);
    if (!active) return { skipped: true, reason: 'currency_inactive' };

    const config = await this.getCreditsConfig();
    const resolved = await this.resolveRuleCredit(config, ruleKey);
    if (!resolved.enabled || !resolved.credit || resolved.credit === '0') {
      return { skipped: true, reason: 'disabled_or_zero' };
    }

    const existing = await this.findExistingTx({
      userId, type, referenceType, referenceId,
    });
    if (existing) return { skipped: true, reason: 'duplicate', transactionId: existing.id };

    try {
      await this.assertDailyCap(userId, resolved.credit);
    } catch (err) {
      if (err.silent) return { skipped: true, reason: 'daily_cap' };
      throw err;
    }

    const tx = await this.fastify.ledger.grant({
      userId,
      amount: resolved.credit,
      currencyCode: DEFAULT_CURRENCY_CODE,
      type,
      referenceType,
      referenceId: String(referenceId),
      description: description || ruleKey,
      metadata: {
        ...metadata,
        engine: ACTIVITY_RULES_ENGINE,
        ruleKey,
        valueVnd: resolved.vnd,
        creditVnd: resolved.rate,
      },
    });
    return { granted: true, amount: resolved.credit, transaction: tx };
  }

  async deductForRule({
    userId,
    ruleKey,
    type,
    referenceType,
    referenceId,
    description,
    metadata = {},
  }) {
    if (!this.fastify.ledger) return { skipped: true, reason: 'no_ledger' };
    const active = await this.fastify.ledger.isCurrencyActive(DEFAULT_CURRENCY_CODE);
    if (!active) return { skipped: true, reason: 'currency_inactive' };

    const config = await this.getCreditsConfig();
    const resolved = await this.resolveRuleCredit(config, ruleKey);
    if (!resolved.enabled || !resolved.credit || resolved.credit === '0') {
      return { skipped: true, reason: 'disabled_or_zero' };
    }

    const existing = await this.findExistingTx({
      userId, type, referenceType, referenceId,
    });
    if (existing) return { skipped: true, reason: 'duplicate', transactionId: existing.id };

    const tx = await this.fastify.ledger.deduct({
      userId,
      amount: resolved.credit,
      currencyCode: DEFAULT_CURRENCY_CODE,
      type,
      referenceType,
      referenceId: String(referenceId),
      description: description || ruleKey,
      metadata: {
        ...metadata,
        engine: ACTIVITY_RULES_ENGINE,
        ruleKey,
        valueVnd: resolved.vnd,
        creditVnd: resolved.rate,
      },
    });
    return { deducted: true, amount: resolved.credit, transaction: tx };
  }

  /** Peek fee without writing — for pre-checks before creating a post. */
  async peekFeeCredit(ruleKey) {
    const config = await this.getCreditsConfig();
    return this.resolveRuleCredit(config, ruleKey);
  }

  async getCheckInStatus(userId) {
    const [data] = await db.select().from(userCheckIns).where(eq(userCheckIns.userId, userId)).limit(1);
    const today = forumDateKey(activityNow());
    let isCheckedIn = false;
    if (data?.lastCheckInDate) {
      isCheckedIn = forumDateKey(new Date(data.lastCheckInDate)) === today;
    }
    return {
      checkInStreak: data?.checkInStreak || 0,
      lastCheckInDate: data?.lastCheckInDate || null,
      isCheckedIn,
      forumDate: today,
    };
  }

  /**
   * Daily check-in with streak + base/streak rules. Idempotent per Forum calendar day.
   */
  async checkIn(userId) {
    const active = await this.fastify.ledger.isCurrencyActive(DEFAULT_CURRENCY_CODE);
    if (!active) {
      throw Object.assign(new Error('Credit currency is not active'), { statusCode: 409, code: 'currency_inactive' });
    }

    const now = activityNow();
    const today = forumDateKey(now);
    const status = await this.getCheckInStatus(userId);
    if (status.isCheckedIn) {
      return { message: 'done', checkInStreak: status.checkInStreak, alreadyCheckedIn: true };
    }

    let newStreak = 1;
    if (status.lastCheckInDate) {
      const lastKey = forumDateKey(new Date(status.lastCheckInDate));
      // Prefer exact previous calendar day in Forum TZ
      const y = new Date(`${today}T12:00:00+07:00`);
      y.setDate(y.getDate() - 1);
      const yesterdayKey = forumDateKey(y);
      newStreak = lastKey === yesterdayKey ? status.checkInStreak + 1 : 1;
    }

    if (status.lastCheckInDate || status.checkInStreak > 0) {
      await db.update(userCheckIns).set({
        lastCheckInDate: now,
        checkInStreak: newStreak,
      }).where(eq(userCheckIns.userId, userId));
    } else {
      try {
        await db.insert(userCheckIns).values({
          userId,
          lastCheckInDate: now,
          checkInStreak: 1,
        });
        newStreak = 1;
      } catch (error) {
        if (error.code === '23505') {
          return { message: 'done', alreadyCheckedIn: true };
        }
        throw error;
      }
    }

    const config = await this.getCreditsConfig();
    const rate = await this.getVndPerCredit();
    const base = await this.resolveRuleCredit(config, 'check_in_base_amount');
    const streak = await this.resolveRuleCredit(config, 'check_in_streak_bonus');

    let totalCredit = '0';
    let baseCredit = '0';
    let streakCredit = '0';
    let totalVnd = 0;
    if (base.enabled && base.credit && base.credit !== '0') {
      baseCredit = base.credit;
      totalCredit = addCreditAmount(totalCredit, baseCredit);
      totalVnd += Number(base.vnd) || 0;
    }
    if (streak.enabled && streak.credit && streak.credit !== '0' && newStreak > 1) {
      const days = Math.min(newStreak - 1, 6);
      streakCredit = mulCreditAmount(streak.credit, days);
      totalCredit = addCreditAmount(totalCredit, streakCredit);
      totalVnd += (Number(streak.vnd) || 0) * days;
    }

    const referenceId = `${today}_${userId}`;
    const existing = await this.findExistingTx({
      userId,
      type: 'check_in',
      referenceType: 'check_in',
      referenceId,
    });
    if (existing) {
      return {
        message: 'done',
        alreadyCheckedIn: true,
        checkInStreak: newStreak,
        amount: '0',
      };
    }

    let balance = null;
    if (totalCredit !== '0') {
      try {
        await this.assertDailyCap(userId, totalCredit);
        const tx = await this.fastify.ledger.grant({
          userId,
          amount: totalCredit,
          currencyCode: DEFAULT_CURRENCY_CODE,
          type: 'check_in',
          referenceType: 'check_in',
          referenceId,
          description: `Daily check-in (${newStreak}-day streak)`,
          metadata: {
            engine: ACTIVITY_RULES_ENGINE,
            ruleKey: 'check_in_base_amount',
            checkInStreak: newStreak,
            baseCredit,
            streakCredit,
            valueVnd: totalVnd,
            creditVnd: rate,
            forumDate: today,
          },
        });
        balance = tx.balanceAfter;
      } catch (err) {
        if (err.silent || err.code === 'daily_reward_cap') {
          return {
            amount: '0',
            checkInStreak: newStreak,
            message: 'checked_in_cap_reached',
            capped: true,
          };
        }
        throw err;
      }
    }

    if (this.fastify.eventBus) {
      this.fastify.eventBus.emit(EVENTS.USER_CHECKIN, { userId, streak: newStreak });
    }

    if (this.fastify.cache) {
      await this.fastify.cache.invalidate(`checkin:status:${userId}`);
    }

    return {
      amount: totalCredit,
      balance,
      checkInStreak: newStreak,
      message: totalCredit !== '0' ? 'check_in_ok' : 'check_in_ok_zero',
    };
  }

  async rulesView() {
    const config = await this.getCreditsConfig();
    const rate = await this.getVndPerCredit();
    return buildRewardRulesView(config, { creditVnd: rate });
  }
}
