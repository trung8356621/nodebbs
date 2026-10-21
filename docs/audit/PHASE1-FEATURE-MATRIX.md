# Phase 1 — Feature matrix

Kiểm chứng 2026-10-21, upstream `9dbac4be53cdc9ea58bb84854ffadb661e945c87`. PASS chỉ áp dụng đúng phạm vi đã chạy. NOT IMPLEMENTED dựa trên code audit; NOT TESTED là có source nhưng chưa kiểm chứng runtime tương ứng.

| Chức năng | Trạng thái | Bằng chứng / giới hạn |
|---|---|---|
| Dependencies | PASS | pnpm 10.33.0 install frozen lockfile |
| PostgreSQL Laragon | PASS | 17.2, current_database=pbn_dev, 58 bảng public |
| Redis native | PASS | 5.0.14.1, PONG tại 16379; API log connected |
| Drizzle migrations gốc | FAIL | user_credits does not exist; 0 migrations applied |
| Bootstrap schema/index | PASS | db:push theo README; pg_trgm + 4 GIN indexes |
| Seed | PASS | 13 seeders hoàn tất |
| API health | PASS | GET :7100/api 200, status ok, version 2.4.0 |
| Trang chủ | PASS | GET :3100/ 200, HTML chứa topic smoke |
| Danh sách chuyên mục | PASS | GET /categories 200; API /api/categories 200 |
| Danh sách topic theo chuyên mục | PASS | GET /categories/general 200 chứa topic smoke; API /api/topics 200 |
| Chi tiết topic | PASS | GET /topic/1 200 chứa title và reply; GET /api/topics/1 200 |
| Đăng ký | PASS | POST /api/auth/register 200 cho hai account; first user admin, second user thường |
| Đăng nhập | PASS | POST /api/auth/login 200, token dùng thành công ở request kế tiếp |
| Trang auth | PASS | GET /auth/login và /auth/register 200; chưa submit form trong browser |
| Tạo topic | PASS | User thường POST /api/topics 200, ID 1; đọc lại và thấy trong SSR |
| Bình luận | PASS | User thường POST /api/posts 200; GET /api/posts?topicId=1 200 và SSR có reply |
| Admin dashboard API | PASS | /api/dashboard/stats: admin 200, user 403, anonymous 401 |
| Dashboard page shell | PASS | GET /dashboard 200; chưa kiểm tra browser đăng nhập/hydration/widgets |
| Admin dashboard tương tác | NOT TESTED | Chưa thao tác UI bằng browser |
| Ghim/bỏ ghim admin | PASS | User PATCH isPinned 403; admin PATCH true/false 200, GET xác nhận cả hai trạng thái; DB cuối is_pinned=false |
| Wallet đọc số dư | PASS | Member GET /api/ledger/balance 200 balance=0; accounts=[] và transactions empty 200 |
| Grant/deduct/transfer/shop | NOT TESTED | Có service/routes/schema; chưa kiểm tra tài chính/concurrency runtime |
| Mua ghim bằng credit | NOT IMPLEMENTED | useItem chỉ có topic_pin trong comment; không có side effect thực thi |
| Hạn ghim/tự hết hạn | NOT IMPLEMENTED | Topics chỉ isPinned boolean, không có pinnedUntil; không có pin cleanup task |
| Outbound rel theo ba loại bài | NOT IMPLEMENTED | Markdown hiện rel=noopener noreferrer; chưa có ugc/nofollow/sponsored theo paid/editorial |
| Banner/ad slots | NOT TESTED | Ads extension, schema, 9 slots seed và AdSlot có sẵn; chưa tạo/hiển thị ad runtime |
| Moderation/roles nâng cao | NOT TESTED | Có RBAC scopes, moderation queue/routes, roles UI; chỉ smoke quyền pin/dashboard |
| OAuth/email/SMS/CAPTCHA/storage upload | NOT TESTED | Chưa cấu hình provider hoặc chạy external integration |
| Multi-host tenant isolation | NOT IMPLEMENTED | Một DB pool từ DATABASE_URL; không thấy forumId/tenantId scope |
| Topic Registry/API network | NOT IMPLEMENTED | Chưa có registry liên forum |
| SEO-OPS integration | NOT IMPLEMENTED | Không triển khai/kết nối trong Phase 1 |

Evidence local bị Git ignore: `.local/smoke-results.json` (API status và payload, không token), `.local/web-results.json` (HTTP probes), `.local/_topic_1.html`, `.local/_categories_general.html`, `.local/logs/`. Hai URL thử sai `/topics/1` và `/categories/1` trả 404 đúng routing; route thực tế là `/topic/1` và `/categories/general` đã kiểm lại 200. Lần đăng ký đầu dùng username quá dài bị 400; sửa dữ liệu smoke về <=20 ký tự rồi đăng ký thành công, không sửa validation.
