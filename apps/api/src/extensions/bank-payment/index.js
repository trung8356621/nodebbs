import fp from 'fastify-plugin';
import { createPaymentProvider } from './providers/index.js';
import { OrderService } from './services/orderService.js';
import { WebhookService } from './services/webhookService.js';
import { resolvePaymentConfig } from './config.js';
import userRoutes from './routes/user.js';
import webhookRoutes from './routes/webhook.js';
import adminRoutes from './routes/admin.js';

/**
 * Independent bank-transfer Credit top-up (SePay-first adapter).
 * Reuses existing Ledger wallet — never creates a second balance.
 * Feature flag default OFF; sandbox webhooks do not grant production Credit.
 */
async function bankPaymentPlugin(fastify) {
  const providerFactory = (name) => createPaymentProvider(name);
  const orders = new OrderService(fastify, providerFactory);
  const webhooks = new WebhookService(fastify, orders, providerFactory);

  fastify.decorate('bankPayment', {
    orders,
    webhooks,
    createProvider: providerFactory,
    resolveConfig: () => resolvePaymentConfig(fastify),
  });

  await orders.ensurePackagesSeeded().catch((err) => {
    fastify.log.warn(
      { err: err.message },
      '[bank-payment] package seed skipped (apply baseline/0011_bank_payment.sql)',
    );
  });

  await fastify.register(userRoutes, { prefix: '/api/bank-payment' });
  await fastify.register(adminRoutes, { prefix: '/api/bank-payment/admin' });
  // Webhooks outside /api so provider dashboards can use a stable path.
  await fastify.register(webhookRoutes, { prefix: '/payments' });

  if (fastify.cleanup?.registerTask) {
    fastify.cleanup.registerTask('bank-payment-noop', async () => {
      // Placeholder for future TTL expiry / reconcile sweep.
    });
  }

  const cfg = await resolvePaymentConfig(fastify);
  fastify.log.info(
    {
      enabled: cfg.enabled,
      publicCheckout: cfg.publicCheckout,
      provider: cfg.provider,
      sandbox: cfg.sandbox,
      mayGrantCredits: cfg.mayGrantCredits,
    },
    '[bank-payment] extension registered (feature flag default OFF)',
  );
}

export default fp(bankPaymentPlugin, {
  name: 'bank-payment',
  dependencies: ['db', 'ledger', 'auth'],
});
