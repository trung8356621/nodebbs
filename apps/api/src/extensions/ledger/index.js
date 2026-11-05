import fp from 'fastify-plugin';
import { LedgerService } from './services/ledgerService.js';
import { ActivityRewardService } from './services/activityRewardService.js';
import ledgerRoutes from './routes.js';

/**
 * Ledger extension — currencies, transactions, activity reward rules.
 */
async function ledgerPlugin(fastify, options) {
  const service = new LedgerService(fastify);
  fastify.decorate('ledger', service);
  fastify.decorate('activityRewards', new ActivityRewardService(fastify));

  fastify.register(ledgerRoutes, { prefix: '/api/ledger' });

  fastify.log.info('[Ledger] extension registered');
}

export default fp(ledgerPlugin, {
  name: 'ledger',
  dependencies: ['db'],
});
