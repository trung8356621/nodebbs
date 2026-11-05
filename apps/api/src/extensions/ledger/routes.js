import { sysAccounts, sysTransactions, sysCurrencies } from './schema.js';
import { DEFAULT_CURRENCY_CODE } from './constants.js';
import {
  REWARD_RULE_CURRENCY,
  buildRewardRulesView,
  mergeRewardRuleUpdates,
  parseCurrencyConfig,
} from './rewardRules.js';
import { enrichTransactionForDisplay } from './utils/transactionDisplay.js';
import db from '../../db/index.js';
import { eq, and, desc, sql, gte, lt, count } from 'drizzle-orm';
import { users } from '../../db/schema.js';

export default async function ledgerRoutes(fastify, options) {
  
  // ============ 统一接口 ============
  
  // 1. 获取统计数据 (仪表盘) - 仅限管理员
  fastify.get('/stats', {
    preHandler: [fastify.requirePermission('dashboard.extensions')],
    schema: {
      tags: ['ledger', 'admin'],
      description: '获取账本统计数据（仅管理员）',
    }
  }, async (req, reply) => {
    // 获取所有货币，按 isActive 降序（启用在前）、创建时间升序排列
    const currencies = await db.select().from(sysCurrencies)
      .orderBy(desc(sysCurrencies.isActive), sysCurrencies.createdAt);

    const results = [];
    for (const curr of currencies) {
      results.push(await getSystemStats(curr));
    }
    
    return results;
  });

  // 辅助函数：获取系统统计
  async function getSystemStats(currency) {
      const currencyCode = currency.code;
      
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      const tomorrow = new Date(today);
      tomorrow.setDate(tomorrow.getDate() + 1);

      // 1. 总流通量
      const [circulation] = await db
        .select({ total: sql`sum(${sysAccounts.balance})` })
        .from(sysAccounts)
        .where(eq(sysAccounts.currencyCode, currencyCode));
      
      // 2. 今日获取
      const [earned] = await db
        .select({ total: sql`sum(${sysTransactions.amount})` })
        .from(sysTransactions)
        .where(and(
            eq(sysTransactions.currencyCode, currencyCode),
            gte(sysTransactions.amount, 0),
            gte(sysTransactions.createdAt, today),
            lt(sysTransactions.createdAt, tomorrow)
        ));

      // 3. 今日消耗
      const [spent] = await db
        .select({ total: sql`sum(${sysTransactions.amount})` })
        .from(sysTransactions)
        .where(and(
            eq(sysTransactions.currencyCode, currencyCode),
            lt(sysTransactions.amount, 0),
            gte(sysTransactions.createdAt, today),
            lt(sysTransactions.createdAt, tomorrow)
        ));

      // 4. 用户数量
      const [usersCount] = await db
        .select({ count: count() })
        .from(sysAccounts)
        .where(eq(sysAccounts.currencyCode, currencyCode));

      return {
          scope: 'system',
          currency: currencyCode,
          info: currency,
          totalCirculation: Number(circulation?.total || 0),
          todayEarned: Number(earned?.total || 0),
          todaySpent: Math.abs(Number(spent?.total || 0)),
          userCount: Number(usersCount?.count || 0)
      };
  }

  // Transaction history — VND enrichment is display-only from snapshots (never revalues legacy).
  fastify.get('/transactions', {
    preHandler: [fastify.authenticate],
    schema: {
      tags: ['ledger'],
      description: 'List ledger transactions with display-only VND enrichment from snapshots',
      querystring: {
        type: 'object',
        properties: {
          page: { type: 'integer', default: 1 },
          limit: { type: 'integer', default: 20, maximum: 100 },
          currency: { type: 'string' },
          userId: { type: 'integer' },
          type: { type: 'string' },
          direction: { type: 'string', enum: ['credit', 'debit', 'zero'] },
          from: { type: 'string' },
          to: { type: 'string' },
        },
      },
    },
  }, async (req) => {
    const page = Math.max(1, Number(req.query.page) || 1);
    const limit = Math.min(100, Math.max(1, Number(req.query.limit) || 20));
    const offset = (page - 1) * limit;
    const { currency, userId, type, direction, from, to } = req.query;

    let filterUserId = req.user.id;
    const canManage = await fastify.permission.can(req, 'dashboard.extensions');
    if (canManage) {
      filterUserId = userId || undefined;
    } else {
      filterUserId = req.user.id;
    }

    const directionClause = direction === 'credit'
      ? sql`${sysTransactions.amount} > 0`
      : direction === 'debit'
        ? sql`${sysTransactions.amount} < 0`
        : direction === 'zero'
          ? sql`${sysTransactions.amount} = 0`
          : undefined;

    let fromDate;
    let toDate;
    if (from) {
      const d = new Date(from);
      if (!Number.isNaN(d.getTime())) fromDate = d;
    }
    if (to) {
      const d = new Date(to);
      if (!Number.isNaN(d.getTime())) toDate = d;
    }

    const whereClause = and(
      filterUserId ? eq(sysTransactions.userId, filterUserId) : undefined,
      currency ? eq(sysTransactions.currencyCode, currency) : undefined,
      type ? eq(sysTransactions.type, type) : undefined,
      directionClause,
      fromDate ? gte(sysTransactions.createdAt, fromDate) : undefined,
      toDate ? lt(sysTransactions.createdAt, toDate) : undefined,
    );

    const items = await db.select({
      id: sysTransactions.id,
      userId: sysTransactions.userId,
      username: users.username,
      currencyCode: sysTransactions.currencyCode,
      currencyName: sysCurrencies.name,
      amount: sysTransactions.amount,
      balance: sysTransactions.balanceAfter,
      balanceAfter: sysTransactions.balanceAfter,
      type: sysTransactions.type,
      referenceType: sysTransactions.referenceType,
      referenceId: sysTransactions.referenceId,
      description: sysTransactions.description,
      createdAt: sysTransactions.createdAt,
      metadata: sysTransactions.metadata,
    })
      .from(sysTransactions)
      .leftJoin(users, eq(sysTransactions.userId, users.id))
      .leftJoin(sysCurrencies, eq(sysTransactions.currencyCode, sysCurrencies.code))
      .where(whereClause)
      .orderBy(desc(sysTransactions.createdAt))
      .limit(limit)
      .offset(offset);

    const [{ count: total }] = await db.select({ count: count() })
      .from(sysTransactions)
      .where(whereClause);

    return {
      items: items.map(enrichTransactionForDisplay),
      total,
      page,
      limit,
      storageUnit: 'credit',
      displayUnit: 'vnd',
      note: 'VND fields are display-only from snapshots; legacy rows without rate/value snapshot leave amountVnd null',
    };
  });

  // 3. 获取余额 (指定货币) - 替代 /rewards/balance
  fastify.get('/balance', {
      preHandler: [fastify.authenticate],
      schema: {
          tags: ['ledger'],
          description: '获取用户账户余额',
          querystring: {
              type: 'object',
              properties: {
                  currency: { type: 'string', default: DEFAULT_CURRENCY_CODE },
                  userId: { type: 'integer' }
              }
          }
      }
  }, async (req, reply) => {
      const { currency = DEFAULT_CURRENCY_CODE, userId } = req.query;
      
      let targetUserId = req.user.id;
      const canManage = await fastify.permission.can(req, 'dashboard.extensions');
      if (canManage && userId) {
          targetUserId = userId;
      }

      const [account] = await db.select()
        .from(sysAccounts)
        .where(and(
            eq(sysAccounts.userId, targetUserId),
            eq(sysAccounts.currencyCode, currency)
        ));

      return {
          userId: targetUserId,
          currency,
          balance: account ? Number(account.balance) : 0
      };
  });

  // 3.5 获取活跃货币 (公开)
  fastify.get('/active-currencies', {
      schema: {
          tags: ['ledger'],
          description: '获取所有活跃货币列表'
      }
  }, async (req, reply) => {
      return db.select({
          code: sysCurrencies.code,
          name: sysCurrencies.name,
          symbol: sysCurrencies.symbol,
          isActive: sysCurrencies.isActive
      }).from(sysCurrencies).where(eq(sysCurrencies.isActive, true));
  });

  // 4. 获取所有账户 (用户钱包) - 保持现有
  fastify.get('/accounts', {
    preHandler: [fastify.authenticate],
    schema: {
        tags: ['ledger'],
        description: '获取所有钱包账户'
    }
  }, async (req, reply) => {
      // 1. 获取所有活跃货币
      const currencies = await db.select().from(sysCurrencies).where(eq(sysCurrencies.isActive, true));
      
      // 2. 获取用户账户
      const accounts = await db.select().from(sysAccounts).where(eq(sysAccounts.userId, req.user.id));
      
      const accountMap = new Map();
      accounts.forEach(a => accountMap.set(a.currencyCode, a));
      
      const result = currencies.map(c => {
          const acc = accountMap.get(c.code);
          return {
              currency: c,
              balance: acc ? Number(acc.balance) : 0,
              totalEarned: acc ? Number(acc.totalEarned) : 0,
              isFrozen: acc ? acc.isFrozen : false
          };
      });
      
      return result;
  });

  // ============ 管理员配置 (重命名) ============
  
  // 获取所有货币 (RESTful: GET /currencies - 公开，但仅管理员可看到全部)
  fastify.get('/currencies', {
      preHandler: [fastify.authenticate],
      schema: {
          tags: ['ledger'],
          description: '获取所有货币配置'
      }
  }, async (req, reply) => {
      const canManage = await fastify.permission.can(req, 'dashboard.extensions');

      if (!canManage) {
        // 非管理员只能看到活跃货币，且字段有限 (与 active-currencies 类似，但保持结构一致)
        return db.select({
            code: sysCurrencies.code,
            name: sysCurrencies.name,
            symbol: sysCurrencies.symbol,
            isActive: sysCurrencies.isActive,
            // 隐藏 config
        }).from(sysCurrencies).where(eq(sysCurrencies.isActive, true));
      }

      return db.select().from(sysCurrencies).orderBy(sysCurrencies.id);
  });

  // 创建/更新货币身份 (Admin Only: POST /currencies)
  // Identity-only updates MUST omit config so existing reward rules are preserved.
  fastify.post('/currencies', {
      preHandler: [fastify.requirePermission('dashboard.extensions')],
      schema: {
          tags: ['ledger', 'admin'],
          description: 'Create or update currency identity. Omitting config preserves existing rules.',
          body: {
            type: 'object',
            required: ['code', 'name', 'symbol'],
            additionalProperties: false,
            properties: {
              code: { type: 'string', minLength: 1, maxLength: 32 },
              name: { type: 'string', minLength: 1, maxLength: 64 },
              symbol: { type: 'string', minLength: 1, maxLength: 16 },
              isActive: { type: 'boolean' },
              config: { type: ['string', 'object', 'null'] },
            },
          },
      }
  }, async (req, reply) => {
      const { code, name, symbol, isActive, config } = req.body;
      const active = isActive !== undefined ? isActive : true;

      const [existing] = await db.select({
        code: sysCurrencies.code,
        config: sysCurrencies.config,
      }).from(sysCurrencies).where(eq(sysCurrencies.code, code)).limit(1);

      let nextConfig;
      if (config !== undefined) {
        // Explicit config (legacy clients). Normalize to JSON string.
        nextConfig = typeof config === 'string' ? config : JSON.stringify(config ?? {});
      } else if (existing) {
        nextConfig = existing.config; // preserve reward rules on identity edit
      } else {
        nextConfig = null; // new currency: no invented reward keys
      }

      await db.insert(sysCurrencies).values({
          code,
          name,
          symbol,
          isActive: active,
          config: nextConfig,
      }).onConflictDoUpdate({
          target: sysCurrencies.code,
          set: {
            name,
            symbol,
            isActive: active,
            ...(config !== undefined ? { config: nextConfig } : {}),
          },
      });

      // 清除货币名称缓存
      if (fastify.cache) {
        await fastify.cache.invalidate(`currency:name:${code}`);
      }

      return { success: true, configPreserved: config === undefined && Boolean(existing) };
  });

  async function resolveCreditVnd() {
    try {
      const n = await fastify.localPricing?.getVndPerCredit?.();
      if (Number.isSafeInteger(n) && n >= 1) return n;
    } catch { /* default */ }
    return 10000;
  }

  // Local activity reward/spend rules stored in credits.config (not OPS pricing).
  fastify.get('/reward-rules', {
    preHandler: [fastify.requirePermission('dashboard.extensions')],
    schema: {
      tags: ['ledger', 'admin'],
      description: 'List local activity reward/spend rules (Admin amounts in VND)',
    },
  }, async () => {
    const creditVnd = await resolveCreditVnd();
    const [row] = await db.select().from(sysCurrencies)
      .where(eq(sysCurrencies.code, REWARD_RULE_CURRENCY)).limit(1);
    if (!row) {
      return { data: buildRewardRulesView({}, { creditVnd }), currencyActive: false, missingCurrency: true };
    }
    const config = parseCurrencyConfig(row.config);
    return {
      data: buildRewardRulesView(config, { creditVnd }),
      currencyActive: Boolean(row.isActive),
      missingCurrency: false,
    };
  });

  fastify.patch('/reward-rules', {
    preHandler: [fastify.requirePermission('dashboard.extensions')],
    schema: {
      tags: ['ledger', 'admin'],
      description: 'Update reward rule VND values and/or enabled flags (merge; no unknown keys)',
      body: {
        type: 'object',
        required: ['updates'],
        additionalProperties: false,
        properties: {
          currency: { type: 'string', enum: [REWARD_RULE_CURRENCY] },
          updates: {
            type: 'object',
            additionalProperties: {
              anyOf: [
                { type: 'number' },
                {
                  type: 'object',
                  additionalProperties: false,
                  properties: {
                    value: { type: 'integer', minimum: 0 },
                    enabled: { type: 'boolean' },
                  },
                },
              ],
            },
          },
        },
      },
    },
  }, async (req, reply) => {
    const currency = req.body.currency || REWARD_RULE_CURRENCY;
    if (currency !== REWARD_RULE_CURRENCY) {
      return reply.code(400).send({ error: 'only_credits', message: 'Only credits reward rules are editable' });
    }
    try {
      const creditVnd = await resolveCreditVnd();
      const [row] = await db.select().from(sysCurrencies)
        .where(eq(sysCurrencies.code, REWARD_RULE_CURRENCY)).limit(1);
      if (!row) {
        return reply.code(404).send({ error: 'currency_missing', message: 'credits currency not found' });
      }
      const existing = parseCurrencyConfig(row.config);
      const { nextConfig, applied } = mergeRewardRuleUpdates(existing, req.body.updates, { creditVnd });
      await db.update(sysCurrencies)
        .set({ config: JSON.stringify(nextConfig) })
        .where(eq(sysCurrencies.code, REWARD_RULE_CURRENCY));
      if (fastify.cache) {
        await fastify.cache.invalidate(`currency:name:${REWARD_RULE_CURRENCY}`);
      }
      return {
        data: buildRewardRulesView(nextConfig, { creditVnd }),
        applied,
      };
    } catch (err) {
      const status = err.statusCode || 500;
      return reply.code(status).send({
        error: err.code || 'request_failed',
        message: err.message,
        unknown: err.unknown,
        creditVnd: err.creditVnd,
      });
    }
  });

  // Activity check-in (new safe path — legacy /api/check-in remains HTTP 410).
  fastify.get('/activity/check-in', {
    preHandler: [fastify.authenticate],
    schema: {
      tags: ['ledger', 'activity'],
      description: 'Get daily check-in status (Forum timezone)',
    },
  }, async (request) => {
    return fastify.activityRewards.getCheckInStatus(request.user.id);
  });

  fastify.post('/activity/check-in', {
    preHandler: [fastify.authenticate],
    schema: {
      tags: ['ledger', 'activity'],
      description: 'Perform daily check-in and apply configured VND→Credit rewards',
    },
  }, async (request, reply) => {
    try {
      return await fastify.activityRewards.checkIn(request.user.id);
    } catch (err) {
      const status = err.statusCode || 500;
      return reply.code(status).send({ error: err.code || 'check_in_failed', message: err.message });
    }
  });

  // Forum B / local E2E only: in-process activity clock (no OS or shared-DB clock changes).
  fastify.post('/admin/activity-clock', {
    preHandler: [fastify.requirePermission('dashboard.extensions')],
    schema: {
      tags: ['ledger', 'admin', 'activity'],
      description: 'Set in-process activity clock override for streak E2E (requires PBN_ALLOW_ACTIVITY_CLOCK=1)',
      body: {
        type: 'object',
        properties: {
          now: { type: ['string', 'null'], description: 'ISO timestamp or null to clear' },
        },
      },
    },
  }, async (req, reply) => {
    if (process.env.PBN_ALLOW_ACTIVITY_CLOCK !== '1') {
      return reply.code(403).send({
        error: 'activity_clock_disabled',
        message: 'Activity clock override is disabled (set PBN_ALLOW_ACTIVITY_CLOCK=1 on Forum B only)',
      });
    }
    try {
      const { setActivityNowOverride, getActivityNowOverride, forumDateKey } = await import(
        './services/activityRewardService.js'
      );
      const next = setActivityNowOverride(req.body?.now ?? null);
      return {
        data: {
          now: next ? next.toISOString() : null,
          forumDate: forumDateKey(),
          override: Boolean(getActivityNowOverride()),
        },
      };
    } catch (err) {
      const status = err.statusCode || 500;
      return reply.code(status).send({ error: err.code || 'clock_failed', message: err.message });
    }
  });

  // 管理员操作：发放/扣除货币 (保留 /admin 前缀 - 纯管理操作)
  fastify.post('/admin/operation', {
    preHandler: [fastify.requirePermission('dashboard.extensions')],
    schema: {
        tags: ['ledger', 'admin'],
        description: '发放或扣除用户货币（仅管理员）',
        body: {
            type: 'object',
            required: ['userId', 'currency', 'amount', 'type'],
            properties: {
                userId: { type: 'integer' },
                currency: { type: 'string' },
                amount: { type: 'number', minimum: 0 },
                type: { type: 'string', enum: ['grant', 'deduct'] },
                description: { type: 'string' }
            }
        }
    }
  }, async (req, reply) => {
      const { userId, currency, amount, type, description } = req.body;
      const service = fastify.ledger;

      if (type === 'grant') {
          await service.grant({
              userId,
              amount,
              currencyCode: currency,
              type: 'admin_grant',
              referenceType: 'admin_operation',
              referenceId: req.user.id, // 管理员ID作为参考
              description: description || 'Admin grant'
          });
      } else {
          await service.deduct({
              userId,
              amount,
              currencyCode: currency,
              type: 'admin_deduct',
              referenceType: 'admin_operation',
              referenceId: req.user.id,
              description: description || 'Admin deduct',
              allowNegative: true // 允许扣成负数? 暂时允许，符合管理员强制操作
          });
      }

      return { success: true };
  });

}
