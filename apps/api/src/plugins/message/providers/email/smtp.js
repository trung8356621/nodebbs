/**
 * SMTP email provider via nodemailer.
 * Supports encryption modes: none | starttls | ssl
 */
import nodemailer from 'nodemailer';

/**
 * @param {object} config
 * @returns {{ secure: boolean, requireTLS?: boolean, ignoreTLS?: boolean }}
 */
function resolveTlsOptions(config) {
  const encryption = String(
    config.smtpEncryption || (config.smtpSecure === false ? 'starttls' : 'ssl')
  ).toLowerCase();

  switch (encryption) {
    case 'none':
      return { secure: false, requireTLS: false, ignoreTLS: true };
    case 'starttls':
      return { secure: false, requireTLS: true };
    case 'ssl':
    default:
      return { secure: true };
  }
}

/**
 * Send email via SMTP.
 * @param {object} providerConfig - decrypted provider config
 * @param {object} options
 * @param {string} options.to
 * @param {string} options.subject
 * @param {string} options.html
 * @param {string} options.text
 * @returns {Promise<{success: boolean, messageId: string}>}
 */
export async function sendViaSMTP(providerConfig, { to, subject, html, text }) {
  const {
    smtpHost,
    smtpPort,
    smtpUser,
    smtpPassword,
    fromEmail,
    fromName,
  } = providerConfig;

  const tls = resolveTlsOptions(providerConfig);
  const transportOptions = {
    host: smtpHost,
    port: Number(smtpPort),
    ...tls,
  };

  if (smtpUser) {
    transportOptions.auth = {
      user: smtpUser,
      pass: smtpPassword,
    };
  }

  const transporter = nodemailer.createTransport(transportOptions);

  const from = fromName ? `"${fromName}" <${fromEmail}>` : fromEmail;

  const info = await transporter.sendMail({
    from,
    to,
    subject,
    text,
    html,
  });

  return { success: true, messageId: info.messageId };
}
