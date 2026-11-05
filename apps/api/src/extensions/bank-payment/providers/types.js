/**
 * @typedef {object} PaymentRequestInput
 * @property {string} orderId
 * @property {string} paymentCode
 * @property {number} amountVnd
 * @property {string} [description]
 * @property {object} [config] provider-specific env/settings
 */

/**
 * @typedef {object} PaymentRequestResult
 * @property {string} provider
 * @property {string} paymentCode
 * @property {number} amountVnd
 * @property {string} accountNumber
 * @property {string} bankCode
 * @property {string} [accountName]
 * @property {string} transferContent
 * @property {string} qrImageUrl
 * @property {object} [raw]
 */

/**
 * @typedef {object} NormalizedTransaction
 * @property {string} provider
 * @property {string} providerEventId unique webhook/event id
 * @property {string} providerTxnRef unique provider transaction id
 * @property {string} [bankTxnRef] bank reference (FT…)
 * @property {string} [paymentCode] extracted order code
 * @property {'in'|'out'|string} transferType
 * @property {number} amountVnd
 * @property {string} accountNumber receiving (or source) account
 * @property {string} [gateway]
 * @property {string} [content]
 * @property {string} [transactionDate]
 * @property {object} raw
 */

/**
 * @typedef {object} WebhookVerifyInput
 * @property {string|Buffer} rawBody
 * @property {Record<string, string|string[]|undefined>} headers
 * @property {object} [parsedBody]
 * @property {object} config
 */

/**
 * @typedef {object} WebhookVerifyResult
 * @property {boolean} ok
 * @property {string} [reason] forged|replay|missing_secret|…
 * @property {NormalizedTransaction} [transaction]
 */

/**
 * @typedef {object} PaymentStatusResult
 * @property {string} status pending|paid|failed|unknown|offline
 * @property {NormalizedTransaction} [transaction]
 * @property {string} [error]
 */

/**
 * PaymentProviderAdapter — swap SePay / Casso / payOS without touching LedgerService.
 *
 * Required methods:
 * - createPaymentRequest
 * - verifyWebhook
 * - normalizeTransaction
 * - getPaymentStatus
 * - reconcilePayment (optional enrichment via provider API)
 *
 * @typedef {object} PaymentProviderAdapter
 * @property {string} name
 * @property {(input: PaymentRequestInput) => Promise<PaymentRequestResult>} createPaymentRequest
 * @property {(input: WebhookVerifyInput) => Promise<WebhookVerifyResult>} verifyWebhook
 * @property {(payload: object) => NormalizedTransaction} normalizeTransaction
 * @property {(query: { paymentCode?: string, providerTxnRef?: string, orderId?: string }, config: object) => Promise<PaymentStatusResult>} getPaymentStatus
 * @property {(query: object, config: object) => Promise<PaymentStatusResult>} [reconcilePayment]
 */

export {};
