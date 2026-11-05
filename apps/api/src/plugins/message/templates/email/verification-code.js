/**
 * Verification-code email template (locale-aware).
 * Default UI locale is Vietnamese; English is the fallback.
 */

const TYPE_LABELS = {
  'vi-VN': {
    register: 'đăng ký',
    verify_email: 'xác minh email',
    login: 'đăng nhập',
    password_reset: 'đặt lại mật khẩu',
    bind_email: 'liên kết email',
    change_email_old: 'đổi email (xác minh email cũ)',
    change_email_new: 'đổi email (xác minh email mới)',
    sensitive: 'xác minh thao tác nhạy cảm',
  },
  'en-US': {
    register: 'registration',
    verify_email: 'email verification',
    login: 'login',
    password_reset: 'password reset',
    bind_email: 'email linking',
    change_email_old: 'email change (verify current email)',
    change_email_new: 'email change (verify new email)',
    sensitive: 'sensitive action verification',
  },
};

function resolveLocale(locale) {
  if (locale === 'en-US' || locale === 'en') return 'en-US';
  return 'vi-VN';
}

function typeLabel(typeKey, type, locale) {
  const labels = TYPE_LABELS[locale] || TYPE_LABELS['vi-VN'];
  if (typeKey && labels[typeKey]) return labels[typeKey];
  // Prefer English technical description over leaking Chinese seed text.
  if (type && !/\p{Script=Han}/u.test(type)) return type;
  return labels.login;
}

export default function verificationCodeTemplate({
  code,
  type,
  typeKey,
  expiryMinutes,
  identifier,
  locale,
}) {
  const loc = resolveLocale(locale);
  const action = typeLabel(typeKey, type, loc);

  if (loc === 'en-US') {
    return {
      subject: `${action} verification code`,
      html: `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${action} verification code</title>
</head>
<body style="margin: 0; padding: 0; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; background-color: #f5f5f5;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background-color: #f5f5f5; padding: 40px 0;">
    <tr>
      <td align="center">
        <table width="600" cellpadding="0" cellspacing="0" style="background-color: #ffffff; border-radius: 8px; box-shadow: 0 2px 8px rgba(0,0,0,0.1);">
          <tr>
            <td style="padding: 40px 40px 20px; text-align: center;">
              <h1 style="margin: 0; color: #333; font-size: 28px; font-weight: 600;">
                Verification code
              </h1>
            </td>
          </tr>
          <tr>
            <td style="padding: 0 40px 40px;">
              <p style="margin: 0 0 20px; color: #666; font-size: 16px; line-height: 1.6;">
                Hello,
              </p>
              <p style="margin: 0 0 20px; color: #666; font-size: 16px; line-height: 1.6;">
                You are performing <strong style="color: #333;">${action}</strong>. Use this code to continue:
              </p>
              <table width="100%" cellpadding="0" cellspacing="0" style="margin: 30px 0;">
                <tr>
                  <td align="center" style="background-color: #f8f9fa; border: 2px dashed #dee2e6; border-radius: 8px; padding: 20px;">
                    <div style="font-size: 36px; font-weight: 700; color: #007bff; letter-spacing: 8px; font-family: 'Courier New', monospace;">
                      ${code}
                    </div>
                  </td>
                </tr>
              </table>
              <p style="margin: 20px 0 0; color: #666; font-size: 14px; line-height: 1.6;">
                <strong>Expires in:</strong> ${expiryMinutes} minutes
              </p>
              <p style="margin: 10px 0 0; color: #999; font-size: 14px; line-height: 1.6;">
                For your account security, do not share this code with anyone.
              </p>
            </td>
          </tr>
          <tr>
            <td style="padding: 20px 40px; background-color: #f8f9fa; border-top: 1px solid #e9ecef; border-radius: 0 0 8px 8px;">
              <p style="margin: 0; color: #999; font-size: 12px; line-height: 1.6; text-align: center;">
                If you did not request this, you can ignore this email.
              </p>
              <p style="margin: 10px 0 0; color: #999; font-size: 12px; line-height: 1.6; text-align: center;">
                Sent to: ${identifier}
              </p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>
    `,
      text: `
Verification code (${action})

Hello,

You are performing ${action}. Use this code to continue:

Code: ${code}

Expires in: ${expiryMinutes} minutes

For your account security, do not share this code with anyone.

If you did not request this, you can ignore this email.

Sent to: ${identifier}
    `.trim(),
    };
  }

  return {
    subject: `Mã xác minh ${action}`,
    html: `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Mã xác minh ${action}</title>
</head>
<body style="margin: 0; padding: 0; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; background-color: #f5f5f5;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background-color: #f5f5f5; padding: 40px 0;">
    <tr>
      <td align="center">
        <table width="600" cellpadding="0" cellspacing="0" style="background-color: #ffffff; border-radius: 8px; box-shadow: 0 2px 8px rgba(0,0,0,0.1);">
          <tr>
            <td style="padding: 40px 40px 20px; text-align: center;">
              <h1 style="margin: 0; color: #333; font-size: 28px; font-weight: 600;">
                Mã xác minh
              </h1>
            </td>
          </tr>
          <tr>
            <td style="padding: 0 40px 40px;">
              <p style="margin: 0 0 20px; color: #666; font-size: 16px; line-height: 1.6;">
                Xin chào,
              </p>
              <p style="margin: 0 0 20px; color: #666; font-size: 16px; line-height: 1.6;">
                Bạn đang thực hiện thao tác <strong style="color: #333;">${action}</strong>. Vui lòng dùng mã sau để tiếp tục:
              </p>
              <table width="100%" cellpadding="0" cellspacing="0" style="margin: 30px 0;">
                <tr>
                  <td align="center" style="background-color: #f8f9fa; border: 2px dashed #dee2e6; border-radius: 8px; padding: 20px;">
                    <div style="font-size: 36px; font-weight: 700; color: #007bff; letter-spacing: 8px; font-family: 'Courier New', monospace;">
                      ${code}
                    </div>
                  </td>
                </tr>
              </table>
              <p style="margin: 20px 0 0; color: #666; font-size: 14px; line-height: 1.6;">
                <strong>Hiệu lực:</strong> ${expiryMinutes} phút
              </p>
              <p style="margin: 10px 0 0; color: #999; font-size: 14px; line-height: 1.6;">
                Vì an toàn tài khoản, vui lòng không chia sẻ mã này với người khác.
              </p>
            </td>
          </tr>
          <tr>
            <td style="padding: 20px 40px; background-color: #f8f9fa; border-top: 1px solid #e9ecef; border-radius: 0 0 8px 8px;">
              <p style="margin: 0; color: #999; font-size: 12px; line-height: 1.6; text-align: center;">
                Nếu bạn không yêu cầu mã này, hãy bỏ qua email.
              </p>
              <p style="margin: 10px 0 0; color: #999; font-size: 12px; line-height: 1.6; text-align: center;">
                Gửi tới: ${identifier}
              </p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>
    `,
    text: `
Mã xác minh (${action})

Xin chào,

Bạn đang thực hiện thao tác ${action}. Vui lòng dùng mã sau để tiếp tục:

Mã: ${code}

Hiệu lực: ${expiryMinutes} phút

Vì an toàn tài khoản, vui lòng không chia sẻ mã này với người khác.

Nếu bạn không yêu cầu mã này, hãy bỏ qua email.

Gửi tới: ${identifier}
    `.trim(),
  };
}
