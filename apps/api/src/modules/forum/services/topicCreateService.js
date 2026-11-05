/**
 * Shared topic creation domain logic used by:
 * - POST /api/topics (interactive JWT users)
 * - POST /api/integrations/topics (machine ingest)
 *
 * Callers must already authenticate and (when applicable) run content policy.
 * This module does not bypass moderation, rewards, or permission checks.
 */
import { eq, or, sql } from 'drizzle-orm';
import { nanoid } from 'nanoid';
import db from '#core/db/index.js';
import { generateSlug } from '#core/utils/slug.js';
import {
  topics,
  posts,
  categories,
  topicTags,
  tags,
} from '#modules/forum/db/schema.js';
import { bindPollsToTopic } from './pollService.js';
import { bindLotteriesToTopic } from './lotteryService.js';
import { bindAttachmentsToTopic } from './attachmentService.js';

/**
 * @param {import('fastify').FastifyInstance} fastify
 * @param {object} request - must have request.user and optional request.policyDecision
 * @param {{ title: string, categoryId: number, content: string, tags?: string[] }} input
 */
export async function createTopic(fastify, request, input) {
  const { title, categoryId, content, tags: tagNames } = input;

  const [category] = await db
    .select()
    .from(categories)
    .where(eq(categories.id, categoryId))
    .limit(1);
  if (!category) {
    const err = new Error('Category not found');
    err.statusCode = 404;
    err.code = 'CATEGORY_NOT_FOUND';
    err.body = { error: '分类不存在', code: 'CATEGORY_NOT_FOUND' };
    throw err;
  }

  await fastify.permission.check(request, 'topic.create', {
    categoryId: category.id,
  });

  if (category.isPrivate) {
    const canAccessPrivate = await fastify.permission.can(request, 'dashboard.topics', {
      categoryId: category.id,
    });
    if (!canAccessPrivate) {
      const err = new Error('No permission to post in private category');
      err.statusCode = 403;
      err.code = 'PRIVATE_CATEGORY_FORBIDDEN';
      err.body = { error: '没有权限在私有分类中发帖', code: 'PRIVATE_CATEGORY_FORBIDDEN' };
      throw err;
    }
  }

  const slug = generateSlug(title, { suffix: nanoid(5).toLowerCase(), maxLength: 100 });
  const pendingFromPolicy = request.policyDecision?.action === 'REVIEW';

  const [newTopic] = await db
    .insert(topics)
    .values({
      approvalStatus: pendingFromPolicy ? 'pending' : 'approved',
      title,
      slug,
      categoryId,
      userId: request.user.id,
      postCount: 1,
      lastPostAt: new Date(),
    })
    .returning();

  const afterPolls = await bindPollsToTopic(newTopic.id, content, request.user.id);
  const afterLotteries = await bindLotteriesToTopic(newTopic.id, afterPolls, request.user.id);
  const cleanContent = await bindAttachmentsToTopic(newTopic.id, afterLotteries, request.user.id);

  const [firstPost] = await db
    .insert(posts)
    .values({
      topicId: newTopic.id,
      userId: request.user.id,
      content: cleanContent,
      rawContent: cleanContent,
      approvalStatus: pendingFromPolicy ? 'pending' : 'approved',
      postNumber: 1,
    })
    .returning();

  if (tagNames && tagNames.length > 0) {
    const canUseTags = await fastify.permission.can(request, 'tag.read');
    if (canUseTags) {
      const canCreateTags = await fastify.permission.can(request, 'tag.create');
      for (const tagName of tagNames) {
        const tagSlug = generateSlug(tagName);
        let [tag] = await db
          .select()
          .from(tags)
          .where(or(eq(tags.slug, tagSlug), eq(tags.name, tagName)))
          .limit(1);

        if (!tag) {
          if (!canCreateTags) continue;
          [tag] = await db
            .insert(tags)
            .values({
              name: tagName,
              slug: tagSlug,
              topicCount: 1,
            })
            .returning();
        } else {
          await db
            .update(tags)
            .set({
              topicCount: sql`${tags.topicCount} + 1`,
              ...(tag.slug !== tagSlug && { slug: tagSlug }),
            })
            .where(eq(tags.id, tag.id));
        }

        await db.insert(topicTags).values({
          topicId: newTopic.id,
          tagId: tag.id,
        });
      }
    }
  }

  const moderation = await fastify.moderation.submit({
    forceReview: pendingFromPolicy,
    targetType: 'topic',
    targetId: newTopic.id,
    submittedBy: request.user.id,
    snapshot: {
      title: newTopic.title,
      slug: newTopic.slug,
      preview: cleanContent ? cleanContent.slice(0, 200) : null,
    },
  });

  newTopic.approvalStatus = moderation.status;
  firstPost.approvalStatus = moderation.status;

  const requiresApproval = moderation.status === 'pending';
  const message = requiresApproval
    ? '您的话题已提交，等待审核后将公开显示'
    : '话题创建成功';

  if (!requiresApproval && fastify.activityRewards) {
    try {
      await fastify.activityRewards.grantForRule({
        userId: request.user.id,
        ruleKey: 'post_topic_amount',
        type: 'post_topic',
        referenceType: 'topic',
        referenceId: String(newTopic.id),
        description: `Topic create reward #${newTopic.id}`,
        metadata: { topicId: newTopic.id },
      });
    } catch (err) {
      fastify.log.error(err, '[activity] topic reward failed');
    }
  }

  return {
    topic: newTopic,
    firstPost,
    message,
    requiresApproval,
  };
}
