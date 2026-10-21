# PBN Phase 1.5 — i18n / Git / README

Ngày kiểm chứng: 2026-10-21, Asia/Bangkok. Workspace: `D:\workspace-2026\pbn`.

Upstream NodeBBS: `9dbac4be53cdc9ea58bb84854ffadb661e945c87` (2.4.0). Branch review: `chore/pbn-phase1-5-i18n`. Chưa commit hoặc push. Phase 2 và SEO-OPS không được triển khai/kết nối.

## Lựa chọn i18n

Chọn **next-intl 4.14.9** cho Next.js 16 App Router. Thư viện có API tương ứng cho Server Components đồng bộ/bất đồng bộ và Client Components, hỗ trợ request-scoped configuration và lựa chọn locale bằng cookie khi không cần đổi routing. Tham khảo [App Router setup](https://next-intl.dev/docs/getting-started/app-router) và [Server/Client Components](https://next-intl.dev/docs/environments/server-client-components).

- Locale hỗ trợ: `vi-VN`, `en-US`; mặc định development là tiếng Việt.
- Header có selector Tiếng Việt / English. Cookie `pbn-locale` lưu một năm, Path=/, SameSite=Lax, host-scoped; thêm Secure khi chạy HTTPS. Cookie chỉ lưu locale, không chứa thông tin xác thực.
- Chuyển ngôn ngữ reload URL hiện tại để SSR, client state và error/toast cùng locale; refresh tiếp theo vẫn giữ lựa chọn.
- `FORUM_DEFAULT_LOCALE` cho mỗi installation; Web có thêm `NEXT_PUBLIC_FORUM_DEFAULT_LOCALE` cho fallback utility phía browser. Hai giá trị nên đồng nhất. Đây chỉ là cấu hình default, không có tenant resolver hay cơ chế multi-forum mới.
- Không thêm prefix `/vi`/`en`, không đổi proxy matcher, canonical structure hoặc route sitemap. HTML lang theo locale.
- Provider và các utility dùng translator theo request/render; không đặt locale mutable dùng chung giữa các request trên server. Time và calendar cũng dùng locale theo instance thay vì global dayjs zh-cn.
- Dictionary Việt merge lên dictionary Anh làm fallback. Backend chọn bản Việt nếu có, nếu thiếu dùng bản Anh.

## Tổ chức catalog và phạm vi chuyển text

| Hạng mục | Kết quả |
| --- | --- |
| Key frontend mỗi ngôn ngữ | **2.515** |
| Namespace frontend | **10**: auth, forum, common, admin, profile, wallet, shop, ads, badges, rewards |
| Callsite `pbnT` literal được kiểm tra | **3.528** |
| Template backend mỗi ngôn ngữ | **689** |
| Missing key / mismatch interpolation / ICU lỗi | **0** |
| Literal tiếng Trung trong code UI, không tính comment/catalog | **0** |

Các con số key là kích thước catalog, không phải số câu duy nhất giữa frontend và backend. Một số key di chuyển từ source được giữ ổn định dù hiện chỉ có giá trị tham khảo. `source-messages.json` và catalog source backend giữ văn bản gốc để tra cứu; không dùng để dịch nội dung bài viết.

Đã chuyển text ở header/footer/navigation; home/category/topic/tag/search/rank; auth/login/register/password; profile/settings/messages/notifications; editor/topic/reply/poll/giveaway/attachment; dashboard/admin/roles/permissions/moderation/settings/users/files/pages/invitations; wallet/ledger/rewards/shop/badges; banner/ad slots; pagination, loading/empty states, form labels/placeholders, confirmation, toast/error và accessibility labels. Chuyển thêm 155 chuỗi log developer trong UI sang tiếng Anh, không cần ngoại lệ literal tiếng Trung cho log. Bổ sung khoảng trắng cho 187 vị trí ghép nhãn/giá trị để câu Việt/Anh không dính từ.

Các config UI cấp module được lấy theo translator thay vì dịch một lần lúc import. Metadata trang dùng API dịch phía server. Các giá trị kỹ thuật như slug, role code, currency code, CSS size/variant, API field và enum vẫn giữ nguyên.

## Backend và dữ liệu

`apps/api/src/plugins/i18n.js` dịch ở `onSend` sau khi serialize, trên bản JSON response riêng của request:

- `error`/`message` của response envelope, bao gồm lỗi auth, validation, quyền, forum, wallet/shop, upload, OAuth/provider.
- Thông báo sinh bởi các notification type đã biết; giữ nguyên title, body, tên người dùng, metadata và giá trị nội suy do người dùng cung cấp.
- Chỉ với `/api/roles/config`: dịch label/description/placeholder của metadata form tĩnh, không đổi keys/options/value.
- Với các response moderation: dịch label/typeLabel của loại kiểm duyệt.

Không duyệt dịch toàn bộ response data, không đổi status code/response shape, không cập nhật text trong database. Request SSR chuyển cookie locale tới API. Response có text được dịch bổ sung Content-Language/Vary phù hợp. Kiểm tra metadata ở hai locale xác nhận phần dữ liệu kỹ thuật còn lại deep-equal.

Native HTML validation trong Input dùng thông báo Việt/Anh, giữ nguyên required/type/pattern/range constraints và handler tùy chỉnh do caller cung cấp.

Không chạy migration/seed trong Phase 1.5. Schema và migrations, API routes/services/forum core, LICENSE và proxy routing không thay đổi. Các lần smoke chỉ tạo account/topic/reply thử nghiệm trong `pbn_dev` và thử pin/unpin trên chính topic smoke; không chỉnh dữ liệu có sẵn từ Phase 1. Các smoke account/password chỉ lưu ở `.local/` bị ignore.

## Kết quả kiểm thử

| Kiểm tra | Kết quả / bằng chứng |
| --- | --- |
| `pnpm i18n:check` | PASS: parity, interpolation, ICU format, reference keys, source Han scan và backend error/metadata coverage |
| `pnpm lint` | PASS, 0 errors; 11 warning về eslint-disable cũ cho các rule không bật trong cấu hình này |
| `pnpm build` | PASS: Next.js production build qua Turborepo; API là JavaScript native, không có build task riêng |
| Browser scan rộng | PASS: 23 route mỗi locale (46 lượt), HTTP 200, HTML lang đúng, không pageerror; gồm public, auth, create, profile, wallet/shop và admin |
| `pnpm smoke:i18n` | PASS: 22 lượt browser mở trang ở hai locale, login, validation, wallet, dashboard, settings/shop/ads và user-content assertions |
| Locale switch và refresh | PASS: mặc định vi-VN → en-US → refresh → vi-VN; cookie đúng, URL không đổi |
| Đăng ký/đăng nhập | PASS: API tạo user mới và đăng nhập 200; browser thử sai mật khẩu rồi đăng nhập đúng ở cả hai locale |
| Backend error/validation | PASS: sai mật khẩu 401, thiếu password 400; text Việt/Anh đúng, `FST_ERR_VALIDATION` và field names giữ nguyên |
| Forum regression Phase 1 | PASS: categories/topics/detail, tạo topic, bình luận, đọc lại; admin pin/unpin; user thường pin 403; dashboard admin 200/user 403/anonymous 401 |
| Wallet read regression | PASS: balance/transactions API và trang wallet hai locale |
| User content | PASS: bài smoke có nội dung `用户自定义内容` đọc lại chính xác ở cả hai locale |
| SEO endpoints / canonical | PASS: robots.txt và sitemap.xml trả 200, nội dung giống nhau giữa hai locale; canonical DOM ở các route smoke cũng giống nhau; không thêm locale vào URL |
| Backend UI metadata | PASS: roles/config 89 nhãn mỗi locale, moderation/config và queue/stat 6 nhãn mỗi locale; không Han trong các nhãn này, technical payload giữ nguyên |
| Git diff whitespace | PASS: `git diff --check` |

Browser dùng Chromium headless qua Playwright; không chỉ suy luận từ README hoặc HTTP shell. Screenshot và JSON evidence nằm trong `.local/` (không commit): `browser-phase15.json`, `browser-switch.json`, `phase15-smoke.json`, `registration-phase15.json`, `metadata-phase15.json` và các PNG `phase15-*.png`.

Build cuối chạy tuần tự khi tạm dừng riêng dev server PBN, exit 0; sau đó đã bật lại Web tại 3100 và chạy smoke thành công. Build có log `Dynamic server usage` khi thử prerender robots/sitemap trong luồng upstream `getSiteInfo → request → cookies`; các route được xử lý động. Luồng route này được giữ nguyên; kiểm tra live xác nhận nội dung không phụ thuộc locale. Không sửa caching/SEO architecture để xử lý cảnh báo trong phase này. So sánh canonical áp dụng cấu hình local hiện tại, bao gồm trường hợp không có canonical khi `site_url` chưa đặt; chưa kiểm tra domain production.

Smoke phát hiện behavior upstream: API client phát sự kiện unauthorized cho cả lần nhập sai mật khẩu, làm mở login dialog toàn cục che form login trang hiện tại. Bài kiểm thử đóng dialog bằng Escape rồi tiếp tục đăng nhập đúng. Không đổi nghiệp vụ auth trong phase này. Nên review UX này riêng.

Một số lỗi render nhỏ có sẵn được sửa để lint/runtime kiểm tra được: đưa loading return của TreeSelect xuống sau hooks; dùng `watch` của đúng form trong BadgeFormDialog; thêm import Badge bị thiếu ở ProfileSidebar; đổi alias action `useItem` để không bị hiểu nhầm thành React Hook. Không đổi schema/quyền/nghiệp vụ.

## Text và nội dung còn giữ nguyên

Không còn literal tiếng Trung trong code UI được scanner kiểm tra. Tuy vậy **có thể vẫn thấy tiếng Trung từ dữ liệu cấu hình/nội dung gốc**, ví dụ chuyên mục `综合讨论`, mô tả forum, role names/descriptions, currency names, tên/miêu tả sản phẩm và huy hiệu seed. Chúng là các field dữ liệu có thể chỉnh sửa, không phải literal nhãn UI; không tự dịch hoặc ghi đè để tuân thủ yêu cầu giữ dữ liệu. Input chỉnh sửa những giá trị này vẫn hiển thị raw value.

Comment developer và nội dung tài liệu OpenAPI/provider templates của upstream không được biến thành nội dung người dùng đã dịch. UI khung tải/error của API reference được dịch; các mô tả OpenAPI lấy từ backend vẫn là tài liệu gốc. Không cấu hình/gửi email, SMS, OAuth, payment hay SEO-OPS để kiểm thử bên ngoài. Các nhánh tích hợp đó chưa được xác minh end-to-end.

Các chuỗi ghép theo nhiều fragment và thuật ngữ chuyên ngành nên được người Việt/Anh review biên tập thêm. Scanner bảo đảm đủ key và không còn literal Han, không thay thế review ngôn ngữ trong mọi trạng thái dữ liệu.

## Git hygiene

`.gitignore` bổ sung cho toàn monorepo: dependency/virtual store, Next/build outputs, cache, logs, `.env` secrets, local dumps/backups/temp files, Redis persistence/PID, IDE/machine files, `.local`, Playwright outputs và API runtime uploads. SQL dumps bị ignore nhưng có exception cho SQL migration dưới `apps/api/drizzle/`. `.env.example` vẫn được theo dõi; không xóa dữ liệu/file hiện hữu. Template dev đổi về loopback/PBN database/Redis native và để JWT_SECRET trống cho người dùng tự sinh.

Đã xác minh `apps/api/.env`, `apps/web/.env`, local smoke accounts/log/data bị ignore; các `.env.example` không bị ignore. Quét 734 đường dẫn tracked trong current tree theo mẫu credential URL, GitHub/AWS token và private-key marker không thấy secret thực. Kết quả khớp còn lại là placeholder `-----BEGIN PRIVATE KEY----- ...` trong form cấu hình Apple OAuth, không phải key material. Redis password mẫu upstream trong `.env.example` đã bỏ khỏi template native.

Có 5 tài liệu upstream trong `docs/superpowers/` đã tracked dù khớp ignore rule có sẵn. Chúng không chứa secret phát hiện được và vẫn được giữ trong Git; không tự untrack hoặc xóa. Đề xuất giữ như tài liệu upstream, chỉ tách bỏ nếu reviewer quyết định riêng. Quét heuristic current tree không phải chứng nhận toàn bộ lịch sử Git không có secret; không rewrite history trong phase này.

## README và bàn giao

README root là tiếng Anh với tên **PBN — Forum Network**, mô tả đúng dự án, stack, cấu trúc source, hướng dẫn Windows/Laragon/native Redis, environment keys không kèm credentials, lệnh chạy/check, i18n, trạng thái và roadmap đúng yêu cầu. Có cảnh báo migration baseline Phase 1 chưa sửa để người đọc không chạy mù db:migrate. Giữ README.en.md upstream, author metadata và nguyên LICENSE MIT, Copyright (c) 2025 qianshan w.

Roadmap giữ Phase 1 completed, Phase 1.5 in progress/awaiting review, các Phase 2–4 planned và SEO-OPS deferred. Không triển khai production, không dùng Docker, không commit/push. Dừng tại Phase 1.5 để review.
