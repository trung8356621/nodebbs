/**
 * Email 渠道实现
 * 负责邮件发送的统一入口
 */

import { BaseChannel } from './base.js';
import { eq, and } from 'drizzle-orm';
import db from '../../../db/index.js';
import { messageProviders } from '../schema.js';
import { emailProviderSenders } from '../providers/email/index.js';
import { getEmailTemplate } from '../templates/email/index.js';
import { isDev } from '../../../config/env.js';
import { MessageError, MessageErrorCode } from '../errors.js';
import {
  decryptConfigSecrets,
  validateEmailProviderConfig,
} from '../utils/providerSecrets.js';

export class EmailChannel extends BaseChannel {
  constructor(fastify) {
    super(fastify);
    this.channelType = 'email';
  }

  /**
   * 获取默认 Email 提供商配置
   */
  async getDefaultProvider() {
    const result = await db
      .select()
      .from(messageProviders)
      .where(and(
        eq(messageProviders.channel, this.channelType),
        eq(messageProviders.isEnabled, true)
      ))
      .limit(1);

    return this.parseConfig(result[0]);
  }

  /**
   * 获取指定 Email 提供商配置
   */
  async getProvider(name) {
    const result = await db
      .select()
      .from(messageProviders)
      .where(and(
        eq(messageProviders.channel, this.channelType),
        eq(messageProviders.provider, name)
      ))
      .limit(1);

    return this.parseConfig(result[0]);
  }

  /**
   * Parse provider row and decrypt secret fields for sending.
   * @param {object} provider
   * @returns {object|null}
   */
  parseConfig(provider) {
    const parsed = super.parseConfig(provider);
    if (!parsed) return null;
    return {
      ...parsed,
      config: decryptConfigSecrets(parsed.config),
    };
  }

  /**
   * Validate provider config.
   * @param {string} providerName
   * @param {object} config - decrypted config
   * @throws {MessageError}
   */
  validateConfig(providerName, config) {
    const result = validateEmailProviderConfig(providerName, config, {
      requireSecrets: true,
    });
    if (!result.ok) {
      throw new MessageError(
        MessageErrorCode.INVALID_CONFIG,
        result.message,
        { provider: providerName }
      );
    }
  }

  /**
   * 发送邮件
   * @param {object} options - 发送选项
   * @param {string} options.to - 收件人邮箱
   * @param {string} [options.subject] - 邮件主题
   * @param {string} [options.html] - HTML 内容
   * @param {string} [options.text] - 纯文本内容
   * @param {string} [options.template] - 模板名称
   * @param {object} [options.data] - 模板数据
   * @param {string} [options.provider] - 指定提供商
   * @returns {Promise<{queued: boolean}>}
   */
  async send(options) {
    const { to, subject, html, text, template, data, provider: providerName } = options;

    // ===== 准备邮件内容 =====
    let finalSubject = subject;
    let finalHtml = html;
    let finalText = text;

    if (template) {
      const templateData = { identifier: to, ...(data || {}) };
      const rendered = getEmailTemplate(template, templateData);
      finalSubject = finalSubject || rendered.subject;
      finalHtml = finalHtml || rendered.html;
      finalText = finalText || rendered.text;
    }

    // ===== 验证必需参数 =====
    if (!to) {
      throw new MessageError(
        MessageErrorCode.MISSING_RECIPIENT,
        '收件人地址 (to) 是必需的'
      );
    }
    if (!finalSubject) {
      throw new MessageError(
        MessageErrorCode.MISSING_SUBJECT,
        '邮件主题 (subject) 是必需的'
      );
    }
    if (!finalHtml && !finalText) {
      throw new MessageError(
        MessageErrorCode.MISSING_CONTENT,
        '邮件内容 (html 或 text) 是必需的'
      );
    }

    // ===== 获取提供商配置 =====
    let provider;
    if (providerName) {
      provider = await this.getProvider(providerName);
    } else {
      provider = await this.getDefaultProvider();
    }

    if (!provider) {
      throw new MessageError(
        MessageErrorCode.PROVIDER_NOT_CONFIGURED,
        '邮件服务未配置'
      );
    }
    // 只在未显式指定 provider 时检查 isEnabled
    if (!providerName && !provider.isEnabled) {
      throw new MessageError(
        MessageErrorCode.PROVIDER_DISABLED,
        '邮件服务未启用',
        { provider: provider.provider }
      );
    }

    // ===== 验证提供商配置 =====
    this.validateConfig(provider.provider, provider.config);

    if (isDev) {
      const safeData = data ? { ...data, code: data.code ? '[redacted]' : undefined } : undefined;
      this.fastify.log.info(`[邮件发送] 收件人: ${to}, 数据: ${JSON.stringify(safeData)}, 模板: ${template || '自定义'}`);
    }

    // ===== 获取发送函数 =====
    const senderFn = emailProviderSenders[provider.provider];
    if (!senderFn) {
      throw new MessageError(
        MessageErrorCode.UNSUPPORTED_PROVIDER,
        `不支持的邮件提供商: ${provider.provider}`,
        { provider: provider.provider }
      );
    }

    const sendPromise = senderFn(provider.config, {
      to,
      subject: finalSubject,
      html: finalHtml,
      text: finalText,
    })
      .then((result) => {
        this.fastify.log.info(`[邮件发送成功] 收件人: ${to}, 模板: ${template || '自定义'}, MessageId: ${result.messageId || 'N/A'}`);
        return result;
      })
      .catch((error) => {
        this.fastify.log.error(`[邮件发送失败] 收件人: ${to}, 模板: ${template || '自定义'}, 错误: ${error.message}`);
        throw error;
      });

    if (options.wait) {
      return await sendPromise;
    }

    sendPromise.catch(() => {});

    return { queued: true };
  }
}

