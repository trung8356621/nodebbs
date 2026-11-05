import {
  integer,
  pgTable,
  varchar,
  text,
  timestamp,
  boolean,
  index,
  unique,
  numeric,
  check,
} from 'drizzle-orm/pg-core';
import { sql } from 'drizzle-orm';
import { relations } from 'drizzle-orm';
import { users } from '../../db/schema.js';
import { $defaults } from '../../db/columns.js';

// ============ Ledger Tables ============
// Credit balances/amounts are NUMERIC (decimal string in JS) so VND÷creditVnd
// fractions like 0.5 Credit are exact. Existing integer rows cast in-place (no ×/÷).

// 1. Currencies
export const sysCurrencies = pgTable(
  'sys_currencies',
  {
    ...$defaults,
    code: varchar('code', { length: 20 }).notNull().unique(),
    name: varchar('name', { length: 50 }).notNull(),
    symbol: varchar('symbol', { length: 10 }),
    /** Decimal places for Credit display/storage (10 supports VND÷rate fractions). */
    precision: integer('precision').notNull().default(10),
    isActive: boolean('is_active').notNull().default(true),
    metadata: text('metadata'),
    config: text('config'),
  },
  (table) => [
    index('sys_currencies_code_idx').on(table.code),
  ]
);

export const sysCurrenciesRelations = relations(sysCurrencies, ({ many }) => ({
  accounts: many(sysAccounts),
}));

// 2. Accounts
export const sysAccounts = pgTable(
  'sys_accounts',
  {
    ...$defaults,
    userId: integer('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    currencyCode: varchar('currency_code', { length: 20 })
      .notNull()
      .references(() => sysCurrencies.code, { onDelete: 'cascade' }),
    balance: numeric('balance', { precision: 30, scale: 10, mode: 'string' }).notNull().default('0'),
    totalEarned: numeric('total_earned', { precision: 30, scale: 10, mode: 'string' }).notNull().default('0'),
    totalSpent: numeric('total_spent', { precision: 30, scale: 10, mode: 'string' }).notNull().default('0'),
    isFrozen: boolean('is_frozen').notNull().default(false),
  },
  (table) => [
    unique().on(table.userId, table.currencyCode),
    check('sys_accounts_balance_safe', sql`${table.balance} >= 0`),
    index('sys_accounts_user_idx').on(table.userId),
    index('sys_accounts_currency_idx').on(table.currencyCode),
  ]
);

export const sysAccountsRelations = relations(sysAccounts, ({ one }) => ({
  user: one(users, {
    fields: [sysAccounts.userId],
    references: [users.id],
  }),
  currency: one(sysCurrencies, {
    fields: [sysAccounts.currencyCode],
    references: [sysCurrencies.code],
  }),
}));

// 3. Transactions (交易流水)
export const sysTransactions = pgTable(
  'sys_transactions',
  {
    ...$defaults,
    userId: integer('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    accountId: integer('account_id')
      .notNull()
      .references(() => sysAccounts.id, { onDelete: 'cascade' }),
    currencyCode: varchar('currency_code', { length: 20 })
      .notNull()
      .references(() => sysCurrencies.code, { onDelete: 'cascade' }),
    amount: numeric('amount', { precision: 30, scale: 10, mode: 'string' }).notNull(),
    balanceAfter: numeric('balance_after', { precision: 30, scale: 10, mode: 'string' }).notNull(),

    type: varchar('type', { length: 50 }).notNull(),
    referenceType: varchar('reference_type', { length: 50 }), // e.g., 'post', 'user', 'system'
    referenceId: varchar('reference_id', { length: 100 }), // 关联ID (可以是 string 或 int 转 string)
    
    relatedUserId: integer('related_user_id').references(() => users.id, {
      onDelete: 'set null',
    }), // 关联用户 (如转账对象)
    
    description: text('description'),
    metadata: text('metadata'), // JSON Snapshots, etc.
  },
  (table) => [
    index('sys_transactions_user_idx').on(table.userId),
    index('sys_transactions_account_idx').on(table.accountId),
    index('sys_transactions_currency_idx').on(table.currencyCode),
    index('sys_transactions_type_idx').on(table.type),
    index('sys_transactions_ref_idx').on(table.referenceType, table.referenceId),
    index('sys_transactions_created_at_idx').on(table.createdAt),
  ]
);

export const sysTransactionsRelations = relations(sysTransactions, ({ one }) => ({
  user: one(users, {
    fields: [sysTransactions.userId],
    references: [users.id],
  }),
  account: one(sysAccounts, {
    fields: [sysTransactions.accountId],
    references: [sysAccounts.id],
  }),
  currency: one(sysCurrencies, {
    fields: [sysTransactions.currencyCode],
    references: [sysCurrencies.code],
  }),
  relatedUser: one(users, {
    fields: [sysTransactions.relatedUserId],
    references: [users.id],
    relationName: 'relatedTransactionUser',
  }),
}));
