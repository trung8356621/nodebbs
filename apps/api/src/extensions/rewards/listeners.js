export async function registerRewardListeners(fastify) {
  // Tip / legacy reward_event listeners stay off. Activity grants run via fastify.activityRewards.
  fastify.log.info('Legacy rewards-extension listeners idle; activity-rules-v1 handles configured grants');
}
