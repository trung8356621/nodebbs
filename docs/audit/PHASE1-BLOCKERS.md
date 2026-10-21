# Phase 1 — Blockers và tồn đọng

## Kết luận

Forum **đã chạy thực tế native** trên Windows + Laragon: Web 3100, API 7100, PostgreSQL 17.2 / pbn_dev, Redis native 16379. Core API và SSR smoke thành công. Không refactor nghiệp vụ/UI/schema, không production deploy, không bắt đầu Phase 2.

## Lỗi đã xử lý trong bootstrap

- Sandbox Git không truy cập mạng (`getaddrinfo thread failed`): clone bằng quyền được duyệt, giữ nguyên history.
- pnpm sandbox EPERM khi tải pnpm 10.33.0: install với quyền được duyệt; frozen lockfile thành công, không đổi lockfile.
- PostgreSQL/Redis không trong PATH: dùng executable Laragon hiện có. PostgreSQL thực tế 17.2, không cài thêm PostgreSQL.
- Redis Laragon chưa chạy: chạy instance PBN loopback port 16379, data trong workspace; không tái cấu hình service khác.
- Migration trên fresh DB lỗi legacy user_credits: db:push theo README bootstrap schema hiện tại; seed thành công. **Không sửa được lịch sử migrations bằng fallback này.**
- Initial smoke username quá dài và route frontend đoán sai: sửa input/URL theo source, chạy lại thành công. API diagnostic khởi động trùng port PBN: không kill process khác.

## Blockers còn lại trước vận hành mở rộng

1. **Migration reproducibility FAIL**. Journal đầu chạy data migration yêu cầu bảng legacy; chỉ 5 journal entries trong khi còn SQL ngoài journal, timestamp không tuyến tính. pbn_dev có schema hiện tại nhưng applied migrations=0. Cần thiết kế/review baseline fresh-install và upgrade path riêng, không tự mark SQL là đã chạy hoặc chạy mù toàn bộ thư mục.
2. **Wallet chưa đủ bằng chứng an toàn cho trả phí**. Read/compute/write balance trong transaction, không thấy row locks/atomic conditional debit; thiếu idempotency constraint cho giao dịch. Chưa thử concurrency, failed purchase rollback, retry/refund.
3. **Paid pin và expiry chưa triển khai**. Chỉ có manual boolean pin; shop example bị comment. Chưa có scheduler pin hoặc policy link khi hết hạn.
4. **Outbound rel policy chưa triển khai**. Markdown hiện chỉ noopener noreferrer; thiếu ugc/nofollow/sponsored theo loại bài và trạng thái pin. Ads link cũng chưa xác minh đánh dấu sponsored theo nhu cầu.
5. **Multi-forum isolation/Registry chưa có**. Singleton DB + settings/cache/global user state một installation. Không dùng chung instance hiện tại cho tenant độc lập.

## Giới hạn kiểm thử

- Redis native Laragon 5.0.14.1 cũ hơn README 7: PING/API/RBAC/forum hoạt động ở phạm vi smoke, chưa kiểm chứng mọi Redis command/feature. Nếu cần nâng cấp, đánh giá native Windows compatible service riêng; không tự tải/cài hệ thống hay chuyển Docker.
- pnpm bỏ qua build scripts một số packages; runtime cơ bản chạy được. Chưa build production, upload/image handling, email/SMS/OAuth/CAPTCHA, moderation nâng cao, shop purchase/ads rendering.
- Chưa có browser automation trong phiên: SSR HTTP PASS và API PASS không chứng minh đầy đủ tương tác UI/hydration. Admin page shell 200, API stats đã kiểm tra admin/user/anonymous, widget tương tác NOT TESTED.
- Chưa thêm autostart Windows. Sau restart cần bật PostgreSQL trong Laragon, Redis PBN và hai dev servers theo SETUP.
- `.local/` và `.env` phải tiếp tục được ignore; credentials tài khoản smoke chỉ lưu local. Local Laragon postgres đang kết nối không mật khẩu, không sửa cấu hình shared server.

## Phạm vi Git và hạ tầng

Không xóa Docker assets, không tạo PBN containers/volumes và không prune/dừng containers khác. Trước yêu cầu NO DOCKER từng gọi Desktop start; không sử dụng Docker cho DB/API/Web và không gọi thêm Docker sau thay đổi. Không đổi database ngoài pbn_dev. Chỉ thêm audit docs và script chạy Redis native; app/schema/migrations upstream giữ nguyên. Dừng tại báo cáo Phase 1.
