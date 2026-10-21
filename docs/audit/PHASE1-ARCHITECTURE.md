# Phase 1 — Source audit và hướng mở rộng

Audit trực tiếp upstream `9dbac4be53cdc9ea58bb84854ffadb661e945c87`, 2026-10-21. Không thay nghiệp vụ, UI hay schema. Các nhận định code không thay thế kiểm thử runtime.

## Cấu trúc và điểm ghép

Root dùng pnpm workspace + Turborepo. Hiện source gồm `apps/api` và `apps/web`; `packages/*` được khai báo cho tương lai, chưa có shared package thực tế.

Backend `apps/api/src/app.js` tạo Fastify 5; `server.js` AutoLoad plugins, extensions, core routes (/api), rồi đăng ký business modules. `modules/index.js` là composition root; module forum có routes/services/schema riêng. `db/schema.js` re-export forum và extension schema làm entry cho Drizzle. Import alias thực tế trong package.json là **#core/**, khác hướng dẫn #src trong AGENTS.md; nên theo code thực tế khi sửa sau này.

Frontend Next.js 16.2.4/React 19 có App Router ở `apps/web/src/app`, module forum dưới `src/modules/forum`, extension pages/providers dưới `src/extensions`. `src/proxy.js` chuyển API tới SERVER_API_URL; HTML server sử dụng các server loaders. UI forum tách views/layouts, common components, contexts/hooks. Module được nối tĩnh ở composition root, không phải runtime plugin loader.

## A. Forum core

- Auth: `src/routes/auth/{register,login,password,verification,phone-login,qr-login,...}.js`, JWT/cookie, OAuth providers. Đăng ký user đầu tự có role admin (`register.js`); bình thường là user. Runtime đã kiểm tra hai role.
- Authorization: `plugins/auth.js`, `plugins/rbac/`, permission service; role/permission/user-role tables ở core schema; có category scope resolver forum và điều kiện quyền. Không chỉ dựa vào ẩn nút frontend.
- Forum: `modules/forum/db/schema.js` chứa categories, topics, posts và các bảng liên quan; topics/posts FK tới users, category. Comments biểu diễn bằng posts; first post là nội dung đầu topic.
- Routes forum: categories, topics, posts, tags, search, polls, lotteries, attachments. Core routes có users, roles, dashboard, moderation, settings, conversations, notifications, pages, sitemap.
- Moderation: plugins/services + moderation routes/queue; soft deletion, approvalStatus, đóng bài, danh mục private. Runtime chưa kiểm thử đầy đủ.
- Bootstrap: schema/index hiện tại dùng được trên PostgreSQL 17.2. SQL lịch sử và journal không tạo được fresh DB bằng db:migrate; cần xử lý baseline trước quy trình upgrade đáng tin cậy.

## B. Wallet / billing

Có sẵn nền tảng **không cần xây wallet từ đầu**:

- `extensions/ledger/schema.js`: sysCurrencies, sysAccounts, sysTransactions; account unique(userId,currencyCode), transactions có amount, balanceAfter, type, referenceType/referenceId, relatedUserId.
- `extensions/ledger/services/ledgerService.js`: getAccount, grant, deduct, transfer; dùng db.transaction, kiểm tra số dư, cập nhật tổng thu/chi, ghi ledger. Exception trong transaction rollback các statement trong transaction đó.
- `extensions/ledger/routes.js`: balance/accounts/transactions/currencies và admin operations. UI wallet/admin ở web extensions/ledger. Seed credits và gold.
- `extensions/shop/services/shopService.js`: buy/gift inventory, kiểm tra balance/stock/ownership, ghi ledger và userItems trong transaction; badges/rewards có listeners và effects riêng.

**Rủi ro phải sửa trước credit mua ghim**: các nhánh ledger grant/deduct/transfer đọc số dư rồi tính số dư mới trong JS rồi UPDATE, chưa thấy row locking hoặc conditional atomic debit. Transaction đơn thuần không loại bỏ lost update/double spend giữa nhiều request. Shop có atomic stock decrement nhưng precheck stock và balance tách rời; chưa chứng minh ngăn oversell/overdraw. Reference index của transactions là index thường, không phải unique idempotency key. Retry có thể tạo giao dịch lặp. getAccount xử lý unique_violation bằng SELECT trong cùng transaction cũng cần kiểm chứng vì PostgreSQL có thể đã abort transaction. Badge grant được gọi qua service riêng, cần kiểm tra ranh giới transaction khi tích hợp.

Chưa thấy luồng payment gateway/top-up tiền thật, refund/compensation chuẩn cho paid pin hoặc replay-safe service purchase. Không khẳng định rollback toàn bộ nghiệp vụ đã an toàn chỉ vì có db.transaction. Phase 1 chỉ smoke API đọc ví, không thực thi kiểm thử concurrency/rollback.

## C. Topic pin

`modules/forum/db/schema.js` chỉ có isPinned boolean. `routes/topics/index.js` PATCH /:id buộc quyền dashboard.topics khi body có isPinned. Query list ưu tiên pinned. Runtime admin pin/unpin được, user thường bị 403.

Không có hạn pin, paid entitlement hoặc scheduler unpin. `extensions/shop/services/shopService.js` phần useItem có ví dụ topic_pin/pinnedUntil **đang comment toàn bộ**; không thể xem là chức năng đã triển khai. `plugins/cleanup.js` có scheduler chung, forum tự đăng ký cleanup polls/lotteries/attachments/orphan notifications trong `modules/forum/index.js`; chưa có task pin.

Paid pin cần thêm entitlement/expiry, charge gắn với grant trong transaction, idempotency, quyền ownership, hết hạn có hiệu lực ở read/render ngay cả khi scheduler chậm. Đây là đề xuất Phase 2, chưa thêm schema/code.

## D. UI / themes / hooks / banner

Có `src/config/theme.config`, ThemeContext, next-themes, layouts/views tách tương đối rõ. Có web `extensions/ads/components/AdSlot.jsx`, AdsContext và API ads. `modules/forum/ui/layouts/SidebarLayout.jsx`, `views/HomeView.jsx`, `views/TopicView.jsx` đã đặt slot cho home header/footer/sidebar, inline topic list, topic detail/sidebar; seed có 9 slots.

Vì vậy banner display/admin có thể tái sử dụng, không cần xây một slot framework mới ngay. Chưa thấy cơ chế generic runtime UI hook/plugin registry tùy ý; thêm slot mới vẫn sửa layout tại điểm đặt slot, thêm theme theo config/CSS. Backend event bus và user enrichers có điểm mở rộng cho extensions, module registration vẫn tĩnh.

Ads hỗ trợ image/html/script, cần rà quyền admin và cách đánh dấu link quảng cáo khi đưa vào vận hành. Chưa có user tự mua banner bằng wallet được xác minh.

`components/common/MarkdownRender/index.jsx` map anchor sang common Link với rel='noopener noreferrer'; `components/common/Link.jsx` cũng xử lý external link theo đó. **Chưa có policy ba loại bài** ugc nofollow / ugc sponsored / editorial. Cần policy chung ở rendering và mọi bề mặt hiển thị content, dựa trên trạng thái entitlement hiệu lực; mất pin phải render về ugc nofollow. Chưa sửa trong Phase 1.

## E. Multi-forum

`apps/api/src/db/index.js` tạo singleton Pool từ một DATABASE_URL. Core/forum tables không có tenant/forum discriminator; code tìm kiếm hostname hiện phục vụ URL/CORS/security, không phải chọn tenant/database. Settings/site_url, users, categories và ledger hiện thuộc một installation. Chỉ thêm nhiều domain vào CORS không tạo isolation.

Hướng tham chiếu phù hợp nhu cầu tách standalone: giữ source chung, mỗi forum một config/env, database riêng, namespace Redis riêng (hoặc instance riêng), upload/storage scope riêng. Có thể chạy các instance cùng source với port khác nhau và reverse proxy hostname. Chưa triển khai mô hình đó. Không nên dùng chung DB/cache hiện tại cho nhiều forum rồi giả định đã cách ly.

Topic Registry nhẹ cần xây mới: định danh forum/topic và canonical fingerprint/claim để phát hiện phân bổ trùng; không cần chuyển toàn bộ forum data về một hệ điều phối tập trung. SEO-OPS không triển khai/kết nối.

## Fork và Phase 2 đề xuất

Giữ upstream commit làm mốc, thay đổi nhỏ và tách feature commits. README có cấu trúc deployment cũ, AGENTS alias lệch code, journal migrations thiếu/không tuyến tính; cần đọc code khi cập nhật. Extension và module còn chia schema/re-exports, upgrade dễ conflict tại composition roots, auth/RBAC và layout. Pin/wallet/link policy đụng nhiều bề mặt nên cần acceptance tests nghiệp vụ khi triển khai sau.

Thứ tự đề xuất: (1) sửa baseline/migration workflow và kiểm chứng native Redis phù hợp; (2) củng cố atomic ledger/idempotency và kiểm thử concurrency/rollback; (3) triển khai paid pin + expiry + outbound rel policy; (4) cấu hình instance độc lập theo forum, verify DB/cache/storage isolation; (5) registry nhẹ chống topic trùng. Tái sử dụng banner slots, chỉ xây banner purchase khi có yêu cầu. Chưa bắt đầu bất kỳ bước Phase 2 nào.
