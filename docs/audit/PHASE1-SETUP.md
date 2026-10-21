# Phase 1 — Windows + Laragon + Node.js

Ngày kiểm chứng: 2026-10-21 (Asia/Bangkok). Workspace: `D:\workspace-2026\pbn`.

## Source và môi trường

- Upstream: https://github.com/aiprojecthub/nodebbs
- Commit: `9dbac4be53cdc9ea58bb84854ffadb661e945c87`, version 2.4.0. Clone trực tiếp vào workspace, giữ đầy đủ Git history; không commit/push thay đổi.
- Node.js v24.18.0; pnpm đúng packageManager repo: 10.33.0 (pnpm launcher ban đầu 10.14.0 tự tải bản repo).
- `pnpm install --frozen-lockfile`: PASS, 758 packages, lockfile không thay đổi.
- PostgreSQL **Laragon 17.2**, không phải 18: `D:\laragon\bin\postgresql\postgresql\bin`. Kết nối thực tế thành công.
- Redis native có sẵn trong Laragon: 5.0.14.1. Đã chạy và API kết nối thành công; đây là bản cũ hơn Redis 7 trong README, chưa chứng minh tương thích tất cả module.
- **Docker: Not used for development.** Giữ nguyên Dockerfile upstream. Trước quyết định NO DOCKER đã yêu cầu khởi động Desktop, nhưng không tạo container/volume/database Docker. Sau quyết định không thực hiện thêm lệnh Docker và không dừng dịch vụ dùng chung.

| Dịch vụ | Địa chỉ | Dữ liệu / phạm vi |
|---|---|---|
| PostgreSQL Laragon | `127.0.0.1:5432` | Database riêng `pbn_dev` |
| Redis PBN native | `127.0.0.1:16379`, DB 0 | `.local/redis`, AOF; riêng process/port PBN |
| Fastify | http://127.0.0.1:7100/api | Loopback |
| Swagger | http://127.0.0.1:7100/docs | API docs |
| Next.js | http://127.0.0.1:3100 | Loopback, dev mode |

Redis 6379 không có listener khi thử bằng redis-cli. Web/API/Redis PBN đã bind thành công trên port tương ứng, không dừng process khác. Một lần chạy API chẩn đoán trùng gặp EADDRINUSE vì API PBN trước đó đã khởi động xong; không kill process chiếm port.

## Cấu hình local

Đã tạo `apps/api/.env`, `apps/web/.env`; Git ignore đã xác minh. JWT tạo bằng crypto random, không ghi vào tài liệu. API dùng `DATABASE_URL` tới `127.0.0.1:5432/pbn_dev`, `REDIS_URL` tới `127.0.0.1:16379/0`, `HOST=127.0.0.1`, `PORT=7100`, CORS cho localhost/127.0.0.1:3100. Web dùng `SERVER_API_URL=http://127.0.0.1:7100`.

Laragon local cho phép kết nối user `postgres` không cần mật khẩu tại thời điểm thử. Không thay pg_hba.conf/password hay database khác. Nếu Laragon sau này yêu cầu mật khẩu, cập nhật riêng `.env`, URL-encode ký tự đặc biệt; không commit credentials. Không dùng cấu hình local này làm production.

`.local/` được ignore trong `.git/info/exclude` và chứa log, Redis data, kết quả HTTP, hai tài khoản smoke với mật khẩu ngẫu nhiên. Xem `.local/smoke-accounts.json` để đăng nhập local: phần tử đầu là admin, thứ hai là user. Không đưa file này vào Git. Repo nguyên bản cấp admin cho user đầu tiên. Smoke để lại một topic và một bình luận trong `pbn_dev`.

## Database: kết quả thực tế

Database `pbn_dev` chưa tồn tại; đã tạo riêng bằng `createdb`. Trước khi thao tác đã xác minh target; sau khi setup query xác nhận `current_database()=pbn_dev`, PostgreSQL 17.2.

```powershell
pnpm --dir apps/api exec dotenvx run -- pnpm db:migrate
```

**FAIL**: migration đầu trong journal (`0003_handy_lightspeed`) đọc bảng legacy `user_credits` chưa có. Transaction rollback; bảng lịch sử Drizzle có **0** migration applied. Journal chỉ liệt kê 5 entries dù còn nhiều SQL khác; không tự sắp xếp/chạy toàn bộ SQL hoặc giả lập migration đã hoàn tất.

Bootstrap thay thế theo README, chỉ trên database mới này:

```powershell
pnpm --dir apps/api exec dotenvx run -- pnpm db:push
pnpm --dir apps/api seed
```

**PASS**: schema hiện tại đã push, 58 bảng public; pg_trgm và 4 GIN indexes thành công; 13 seeders hoàn tất. Không sửa schema/migration upstream. **Schema bootstrap thành công không có nghĩa migration history đã được sửa**. Không chạy db:migrate trên database này trước khi xử lý baseline ở Phase 2.

Drizzle config không tự load `.env`, vì vậy các lệnh Drizzle cần wrapper `dotenvx run` như trên. Seed/dev API đã có wrapper trong package scripts.

## Khởi động lại sau restart Windows

1. Mở Laragon và bật PostgreSQL hiện có. Không khởi tạo lại data directory. Kiểm tra:

   ```powershell
   & 'D:\laragon\bin\postgresql\postgresql\bin\pg_isready.exe' -h 127.0.0.1 -p 5432
   & 'D:\laragon\bin\postgresql\postgresql\bin\psql.exe' -h 127.0.0.1 -p 5432 -U postgres -d pbn_dev -w -c 'SELECT current_database(), version();'
   ```

2. Terminal Redis, từ workspace:

   ```powershell
   Set-Location D:\workspace-2026\pbn
   .\scripts\start-pbn-redis.ps1
   ```

   Script chạy foreground, từ chối port đã có listener. Nếu Redis PBN đang chạy thì không chạy thêm. Có thể chỉ định `-RedisExe` khi đường dẫn Laragon thay đổi. Kiểm tra `redis-cli.exe -h 127.0.0.1 -p 16379 ping` phải trả PONG.

3. Terminal API:

   ```powershell
   Set-Location D:\workspace-2026\pbn
   pnpm --dir apps/api dev
   ```

4. Terminal Web:

   ```powershell
   Set-Location D:\workspace-2026\pbn
   pnpm --dir apps/web exec next dev --turbopack -p 3100 --hostname 127.0.0.1
   ```

   `pnpm --dir apps/web dev` cũng là script gốc, nhưng không giới hạn hostname loopback. `pnpm dev` chạy cả hai qua Turbo sau khi PostgreSQL/Redis sẵn sàng.

5. Mở frontend, `/categories`, `/categories/general`, `/topic/1`, `/auth/login`, `/dashboard`. API health `/api` phải trả `status: ok`. Không cần chạy migration/seed mỗi lần restart.

Dừng process foreground bằng Ctrl+C ở terminal tương ứng. Các process bootstrap hiện chạy nền, log tại `.local/logs/`; nếu cần dừng, kiểm tra command line/cwd/port để xác nhận PBN trước. Không kill toàn bộ node/redis/postgres. Không có autostart hệ thống được cài thêm.

## Giới hạn kiểm chứng

Đã kiểm tra HTTP HTML SSR, API proxy và API auth/write/read/RBAC; chưa thao tác trình duyệt tương tác hay đánh giá visual/hydration. pnpm cảnh báo bỏ qua lifecycle scripts của sharp/esbuild/parcel/alicloud; Web/API thực tế chạy được, chưa chạy production build hoặc upload/image smoke. Không chạy test suite vì repo không có suite theo AGENTS.md.
