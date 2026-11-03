import fp from 'fastify-plugin';
import { ConnectionStore } from './services/connectionStore.js';
import { OpsClient } from './services/opsClient.js';
import { EnrollmentService } from './services/enrollmentService.js';
import { ReceiverService } from './services/receiverService.js';
import { CreditOrderService } from './services/creditOrderService.js';
import { LedgerSyncService } from './services/ledgerSyncService.js';
import receiverRoutes from './routes/receiver.js';
import adminRoutes from './routes/admin.js';

/**
 * Forum Credit OPS integration (forum-credit/1).
 * - Inbound: /ops/v1/forum/*
 * - Admin:   /api/ops/forum/*
 */
async function forumCreditPlugin(fastify) {
  const connectionStore = new ConnectionStore(fastify);
  const opsClient = new OpsClient(fastify, connectionStore);
  const ledgerSync = new LedgerSyncService(fastify, connectionStore, opsClient);
  const enrollment = new EnrollmentService(fastify, connectionStore, opsClient);
  const receiver = new ReceiverService(fastify, connectionStore, ledgerSync);
  const orders = new CreditOrderService(fastify, connectionStore, opsClient);

  fastify.decorate('forumCredit', {
    connectionStore,
    opsClient,
    enrollment,
    receiver,
    orders,
    ledgerSync,
  });

  ledgerSync.installLedgerHooks();

  await fastify.register(receiverRoutes);
  await fastify.register(adminRoutes, { prefix: '/api/ops/forum' });

  if (fastify.cleanup?.registerTask) {
    fastify.cleanup.registerTask('forum-credit-ledger-sync', async () => {
      await ledgerSync.processDue({ limit: 50 });
    });
  }

  fastify.log.info('[forum-credit] extension registered (forum-credit/1)');
}

export default fp(forumCreditPlugin, {
  name: 'forum-credit',
  dependencies: ['db', 'ledger', 'auth'],
});
