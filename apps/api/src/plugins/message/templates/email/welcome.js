/**
 * Welcome email template (locale-aware).
 * Default UI locale is Vietnamese; English is the fallback.
 */

function resolveLocale(locale) {
  if (locale === 'en-US' || locale === 'en') return 'en-US';
  return 'vi-VN';
}

export default function welcomeTemplate({ username, locale }) {
  const loc = resolveLocale(locale);

  if (loc === 'en-US') {
    return {
      subject: 'Welcome aboard',
      html: `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Welcome</title>
</head>
<body style="margin: 0; padding: 0; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; background-color: #f5f5f5;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background-color: #f5f5f5; padding: 40px 0;">
    <tr>
      <td align="center">
        <table width="600" cellpadding="0" cellspacing="0" style="background-color: #ffffff; border-radius: 8px; box-shadow: 0 2px 8px rgba(0,0,0,0.1);">
          <tr>
            <td style="padding: 40px 40px 20px; text-align: center;">
              <h1 style="margin: 0; color: #333; font-size: 28px; font-weight: 600;">
                Welcome!
              </h1>
            </td>
          </tr>
          <tr>
            <td style="padding: 0 40px 40px;">
              <p style="margin: 0 0 20px; color: #666; font-size: 16px; line-height: 1.6;">
                Hello <strong style="color: #333;">${username}</strong>,
              </p>
              <p style="margin: 0 0 20px; color: #666; font-size: 16px; line-height: 1.6;">
                Thanks for joining. Your account is ready — explore the community whenever you like.
              </p>
              <div style="margin: 30px 0; padding: 20px; background-color: #f8f9fa; border-radius: 8px;">
                <h2 style="margin: 0 0 15px; color: #333; font-size: 18px; font-weight: 600;">
                  You can:
                </h2>
                <ul style="margin: 0; padding-left: 20px; color: #666; font-size: 15px; line-height: 1.8;">
                  <li>Browse and join popular discussions</li>
                  <li>Share your ideas and replies</li>
                  <li>Follow people and topics you care about</li>
                  <li>Bookmark content you like</li>
                  <li>Customize your profile</li>
                </ul>
              </div>
              <p style="margin: 20px 0 0; color: #666; font-size: 16px; line-height: 1.6;">
                Questions or feedback? Reach out anytime. Enjoy your stay!
              </p>
            </td>
          </tr>
          <tr>
            <td style="padding: 20px 40px; background-color: #f8f9fa; border-top: 1px solid #e9ecef; border-radius: 0 0 8px 8px;">
              <p style="margin: 0; color: #999; font-size: 12px; line-height: 1.6; text-align: center;">
                If you did not create this account, you can ignore this email.
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
Welcome!

Hello ${username},

Thanks for joining. Your account is ready — explore the community whenever you like.

You can:
- Browse and join popular discussions
- Share your ideas and replies
- Follow people and topics you care about
- Bookmark content you like
- Customize your profile

Questions or feedback? Reach out anytime. Enjoy your stay!

If you did not create this account, you can ignore this email.
    `.trim(),
    };
  }

  return {
    subject: 'Chào mừng bạn đến với diễn đàn',
    html: `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Chào mừng</title>
</head>
<body style="margin: 0; padding: 0; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; background-color: #f5f5f5;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background-color: #f5f5f5; padding: 40px 0;">
    <tr>
      <td align="center">
        <table width="600" cellpadding="0" cellspacing="0" style="background-color: #ffffff; border-radius: 8px; box-shadow: 0 2px 8px rgba(0,0,0,0.1);">
          <tr>
            <td style="padding: 40px 40px 20px; text-align: center;">
              <h1 style="margin: 0; color: #333; font-size: 28px; font-weight: 600;">
                Chào mừng bạn!
              </h1>
            </td>
          </tr>
          <tr>
            <td style="padding: 0 40px 40px;">
              <p style="margin: 0 0 20px; color: #666; font-size: 16px; line-height: 1.6;">
                Xin chào <strong style="color: #333;">${username}</strong>,
              </p>
              <p style="margin: 0 0 20px; color: #666; font-size: 16px; line-height: 1.6;">
                Cảm ơn bạn đã đăng ký. Tài khoản đã sẵn sàng — hãy khám phá cộng đồng bất cứ lúc nào.
              </p>
              <div style="margin: 30px 0; padding: 20px; background-color: #f8f9fa; border-radius: 8px;">
                <h2 style="margin: 0 0 15px; color: #333; font-size: 18px; font-weight: 600;">
                  Bạn có thể:
                </h2>
                <ul style="margin: 0; padding-left: 20px; color: #666; font-size: 15px; line-height: 1.8;">
                  <li>Xem và tham gia các chủ đề nổi bật</li>
                  <li>Chia sẻ ý kiến và trả lời</li>
                  <li>Theo dõi người dùng và chủ đề bạn quan tâm</li>
                  <li>Lưu nội dung yêu thích</li>
                  <li>Tùy chỉnh hồ sơ cá nhân</li>
                </ul>
              </div>
              <p style="margin: 20px 0 0; color: #666; font-size: 16px; line-height: 1.6;">
                Nếu cần hỗ trợ hoặc góp ý, hãy liên hệ với chúng tôi. Chúc bạn trải nghiệm vui vẻ!
              </p>
            </td>
          </tr>
          <tr>
            <td style="padding: 20px 40px; background-color: #f8f9fa; border-top: 1px solid #e9ecef; border-radius: 0 0 8px 8px;">
              <p style="margin: 0; color: #999; font-size: 12px; line-height: 1.6; text-align: center;">
                Nếu bạn không đăng ký tài khoản này, hãy bỏ qua email.
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
Chào mừng bạn!

Xin chào ${username},

Cảm ơn bạn đã đăng ký. Tài khoản đã sẵn sàng — hãy khám phá cộng đồng bất cứ lúc nào.

Bạn có thể:
- Xem và tham gia các chủ đề nổi bật
- Chia sẻ ý kiến và trả lời
- Theo dõi người dùng và chủ đề bạn quan tâm
- Lưu nội dung yêu thích
- Tùy chỉnh hồ sơ cá nhân

Nếu cần hỗ trợ hoặc góp ý, hãy liên hệ với chúng tôi. Chúc bạn trải nghiệm vui vẻ!

Nếu bạn không đăng ký tài khoản này, hãy bỏ qua email.
    `.trim(),
  };
}
