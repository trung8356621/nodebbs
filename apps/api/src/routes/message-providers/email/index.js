import db from '../../../db/index.js';
import { messageProviders } from '../../../db/schema.js';
import { eq, and } from 'drizzle-orm';
import { isEmailAddress } from '../../../utils/normalization.js';
import {
  EMAIL_SECRET_KEYS,
  sanitizeConfigForClient,
  mergeProviderConfig,
  validateEmailProviderConfig,
} from '../../../plugins/message/utils/providerSecrets.js';

/**
 * Email provider config routes
 * Path: /api/message-providers/email
 */
export default async function emailProvidersRoutes(fastify, options) {
  const CHANNEL = 'email';

  /**
   * List email providers.
   * Public: enabled providers only (no secrets).
   * Admin (dashboard.settings): all providers, secrets redacted.
   */
  fastify.get(
    '/',
    {
      preHandler: [fastify.optionalAuth],
      schema: {
        tags: ['message-providers'],
        description: '获取邮件提供商配置',
        response: {
          200: {
            type: 'object',
            properties: {
              items: {
                type: 'array',
                items: {
                  type: 'object',
                  properties: {
                    id: { type: 'number' },
                    channel: { type: 'string' },
                    provider: { type: 'string' },
                    isEnabled: { type: 'boolean' },
                    config: { type: ['object', 'null'], additionalProperties: true },
                    displayName: { type: ['string', 'null'] },
                    displayOrder: { type: 'number' },
                    createdAt: { type: 'string' },
                    updatedAt: { type: 'string' },
                  },
                },
              },
            },
          },
        },
      },
    },
    async (request, reply) => {
      try {
        const canManage = await fastify.permission.can(request, 'dashboard.settings');

        let items;

        if (canManage) {
          const results = await db
            .select()
            .from(messageProviders)
            .where(eq(messageProviders.channel, CHANNEL))
            .orderBy(messageProviders.displayOrder);

          items = results.map((item) => {
            const rawConfig = item.config ? JSON.parse(item.config) : null;
            return {
              ...item,
              config: sanitizeConfigForClient(rawConfig, EMAIL_SECRET_KEYS),
            };
          });
        } else {
          items = await db
            .select({
              provider: messageProviders.provider,
              isEnabled: messageProviders.isEnabled,
              displayName: messageProviders.displayName,
              displayOrder: messageProviders.displayOrder,
            })
            .from(messageProviders)
            .where(and(
              eq(messageProviders.channel, CHANNEL),
              eq(messageProviders.isEnabled, true)
            ))
            .orderBy(messageProviders.displayOrder);
        }

        return { items };
      } catch (error) {
        fastify.log.error(error, '[消息] 获取邮件配置失败');
        return reply.code(500).send({ error: '获取邮件配置失败' });
      }
    }
  );

  /**
   * Update email provider config (admin).
   */
  fastify.patch(
    '/:provider',
    {
      preHandler: [fastify.requirePermission('dashboard.settings')],
      schema: {
        tags: ['message-providers', 'admin'],
        description: '更新邮件提供商配置（仅管理员）',
        security: [{ bearerAuth: [] }],
        params: {
          type: 'object',
          properties: {
            provider: { type: 'string' },
          },
        },
        body: {
          type: 'object',
          properties: {
            isEnabled: { type: 'boolean' },
            config: { type: 'object' },
            displayName: { type: 'string' },
            displayOrder: { type: 'number' },
            clearSmtpPassword: { type: 'boolean' },
            clearApiKey: { type: 'boolean' },
          },
        },
        response: {
          200: {
            type: 'object',
            properties: {
              message: { type: 'string' },
              config: { type: ['object', 'null'], additionalProperties: true },
            },
          },
        },
      },
    },
    async (request, reply) => {
      const { provider } = request.params;
      const updateData = request.body;

      try {
        const existing = await db
          .select()
          .from(messageProviders)
          .where(and(
            eq(messageProviders.channel, CHANNEL),
            eq(messageProviders.provider, provider)
          ))
          .limit(1);

        if (existing.length === 0) {
          return reply.code(404).send({ error: '邮件提供商不存在' });
        }

        const existingConfig = existing[0].config
          ? JSON.parse(existing[0].config)
          : {};

        let nextConfig = existingConfig;
        if (updateData.config !== undefined) {
          const clearSecrets = [];
          if (updateData.clearSmtpPassword) clearSecrets.push('smtpPassword');
          if (updateData.clearApiKey) clearSecrets.push('apiKey');

          nextConfig = mergeProviderConfig(existingConfig, updateData.config, {
            clearSecrets,
            secretKeys: EMAIL_SECRET_KEYS,
          });

          const willBeEnabled = updateData.isEnabled === true
            || (updateData.isEnabled === undefined && existing[0].isEnabled);

          const validation = validateEmailProviderConfig(provider, nextConfig, {
            requireSecrets: willBeEnabled,
          });
          if (!validation.ok) {
            return reply.code(400).send({ error: validation.message });
          }
        }

        if (updateData.isEnabled === true) {
          const enableCheck = validateEmailProviderConfig(provider, nextConfig, {
            requireSecrets: true,
          });
          if (!enableCheck.ok) {
            return reply.code(400).send({ error: enableCheck.message });
          }

          await db
            .update(messageProviders)
            .set({ isEnabled: false })
            .where(and(
              eq(messageProviders.channel, CHANNEL),
              eq(messageProviders.isEnabled, true)
            ));
        }

        const setData = {};
        if (updateData.isEnabled !== undefined) setData.isEnabled = updateData.isEnabled;
        if (updateData.displayName !== undefined) setData.displayName = updateData.displayName;
        if (updateData.displayOrder !== undefined) setData.displayOrder = updateData.displayOrder;
        if (updateData.config !== undefined) {
          setData.config = JSON.stringify(nextConfig);
        }

        await db
          .update(messageProviders)
          .set(setData)
          .where(and(
            eq(messageProviders.channel, CHANNEL),
            eq(messageProviders.provider, provider)
          ));

        fastify.log.info(`[消息] 邮件提供商 ${provider} 配置已更新`);

        const storedConfig = setData.config
          ? JSON.parse(setData.config)
          : existingConfig;

        return {
          message: '邮件配置已更新',
          config: sanitizeConfigForClient(storedConfig, EMAIL_SECRET_KEYS),
        };
      } catch (error) {
        fastify.log.error(error, '[消息] 更新邮件配置失败');
        return reply.code(500).send({ error: '更新邮件配置失败' });
      }
    }
  );

  /**
   * Test email provider (admin). Never reports success on send failure.
   */
  fastify.post(
    '/:provider/test',
    {
      preHandler: [fastify.requirePermission('dashboard.settings')],
      schema: {
        tags: ['message-providers', 'admin'],
        description: '测试邮件提供商配置（仅管理员）',
        security: [{ bearerAuth: [] }],
        params: {
          type: 'object',
          properties: {
            provider: { type: 'string' },
          },
        },
        body: {
          type: 'object',
          required: ['testEmail'],
          properties: {
            testEmail: { type: 'string', format: 'email' },
          },
        },
        response: {
          200: {
            type: 'object',
            properties: {
              success: { type: 'boolean' },
              message: { type: 'string' },
            },
          },
        },
      },
    },
    async (request, reply) => {
      const { provider } = request.params;
      const { testEmail } = request.body;

      try {
        if (!testEmail || !isEmailAddress(testEmail)) {
          return reply.code(400).send({
            success: false,
            message: 'A valid test email address is required',
          });
        }

        const results = await db
          .select()
          .from(messageProviders)
          .where(and(
            eq(messageProviders.channel, CHANNEL),
            eq(messageProviders.provider, provider)
          ))
          .limit(1);

        if (results.length === 0) {
          return reply.code(404).send({ error: '邮件提供商不存在' });
        }

        const providerRecord = results[0];
        const parsed = fastify.message.email.parseConfig(providerRecord);
        const config = parsed.config;

        try {
          fastify.message.email.validateConfig(provider, config);
        } catch (validationError) {
          return { success: false, message: validationError.message };
        }

        const siteName = await fastify.settings.get('site_name', 'Forum');

        try {
          await fastify.message.email.send({
            to: testEmail,
            subject: `[${siteName}] Email service test`,
            html: `
              <h2>Email service test</h2>
              <p>This is a test message from <strong>${siteName}</strong> (${providerRecord.displayName || provider}).</p>
              <p>If you received this email, SMTP configuration is working.</p>
              <hr>
              <p style="color: #666; font-size: 12px;">Sent at: ${new Date().toISOString()}</p>
            `,
            text: `Email service test\n\nThis is a test message from ${siteName} (${providerRecord.displayName || provider}).\nIf you received this email, SMTP configuration is working.`,
            provider,
            wait: true,
          });

          return { success: true, message: `Test email sent to ${testEmail}` };
        } catch (error) {
          fastify.log.error(
            { err: { message: error.message, code: error.code } },
            '[消息] 发送测试邮件失败'
          );
          return {
            success: false,
            message: `Failed to send test email: ${error.message}`,
          };
        }
      } catch (error) {
        fastify.log.error(error, '[消息] 测试邮件配置失败');
        return reply.code(500).send({ error: '测试邮件配置失败' });
      }
    }
  );
}
