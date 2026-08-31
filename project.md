# Dự án: AI Image Studio (Công cụ chỉnh sửa ảnh AI tùy chỉnh)

> Tài liệu này được cập nhật theo trạng thái code hiện tại. Xem `AIchangelog.md` để biết lịch sử công việc chi tiết.

## 1. Giới thiệu chung
AI Image Studio (tên gọi khác: **HinhanhAI**) là một công cụ chỉnh sửa hình ảnh AI chất lượng cao, tích hợp và gọi các API AI tùy chỉnh. Ứng dụng hỗ trợ phân tích prompt thông minh, sinh ảnh, và xuất file trực tiếp lên Google Drive. Toàn bộ giao diện bằng tiếng Việt, phong cách "editorial minimal".

## 2. Công nghệ / Stack
- **Frontend:** React 19 + TypeScript + Vite 6 + Tailwind CSS 4 (`@tailwindcss/vite`), `lucide-react`, `motion`.
- **Backend:** Express 4, chạy chung server với Vite (middleware mode khi dev; serve `dist/` khi production).
- **Auth:** JWT (12h), mật khẩu qua biến môi trường `APP_PASSWORD`; cookie httpOnly + Bearer token.
- **AI:** `@google/genai` (Gemini), gọi OpenAI/Anthropic qua `fetch` (OpenAI-compatible / Anthropic API).
- **Google Drive:** OAuth token flow (GIS `gsi/client`), Drive API v3.
- **Lưu trữ client:** `localStorage` (cài đặt + lịch sử).
- **Bundler/runner:** `tsx` (dev), `esbuild` (bundle server), `bun.lock` + `npm` scripts.

## 3. Các tính năng cốt lõi

### 3.1. Khu vực Chỉnh sửa (Editor)
- Tải **Ảnh Gốc** (bắt buộc) và **Ảnh Mẫu** (tùy chọn, để tham khảo phong cách).
- **Phân tích AI & Trích xuất Prompt** (Style Analyzer): đọc hiểu ảnh mẫu, xuất prompt chuẩn (EN/VI), negative prompt, gợi ý tỷ lệ khung hình; cho phép ghép prompt theo module (style/background/lighting/camera/colors/subject).
- Tùy chỉnh đầu ra: số biến thể (1–4), tỷ lệ khung hình, chất lượng, negative prompt, seed, CFG.
- Quy trình duyệt & lưu: grid so sánh → chọn 1 ảnh → "Chốt hình & Lưu lên Drive" hoặc "Tạo lại".
- Lịch sử tự lưu vào `localStorage`.

### 3.2. Bảng điều khiển (Dashboard)
- Hiện là **số liệu tĩnh/mock** (chưa nối dữ liệu thật): tổng ảnh, credits, render time, Drive sync, phân bổ model, activity logs.

### 3.3. Lịch sử (History)
- Lưu `localStorage` (key `hinhanhai_history_v2`, tối đa 100 mục), dạng lưới, có lightbox, tải về, lưu Drive, xóa.

### 3.4. Cài đặt (Settings)
- **Quản lý API Profiles** (đa provider, mỗi profile có vai trò riêng — xem mục 4).
- **Google Drive:** kết nối OAuth, thư mục đích, auto-sync.
- **Giao diện:** theme sáng/tối.
- **Defaults:** chất lượng, tỷ lệ, số biến thể mặc định.

### 3.5. Bảo mật & Xác thực
- Màn hình Login, mật khẩu qua biến môi trường `APP_PASSWORD` (server-side).
- JWT secret qua biến `JWT_SECRET`.
- **Production bắt buộc** có `APP_PASSWORD` và `JWT_SECRET`, nếu thiếu server **crash ngay** (exit 1) kèm log rõ ràng.

## 4. Kiến trúc Multi-Provider (ĐÃ TRIỂN KHAI — chờ commit/push)
> Refactor hoàn tất ở local; đã `npm run lint` + `npm run build` pass. Chờ commit/push lên remote (gộp với bản sửa encoding).

### 4.1. Mô hình provider mới
- **Provider:** chỉ còn 3 loại: `gemini` | `openai` | `anthropic`.
- **Mặc định:** 1 profile `gemini` duy nhất (có thể đổi API key trong Settings).
- **Custom API:** người dùng tự tạo profile, **bắt buộc chọn chuẩn** là `openai` hoặc `anthropic`.
- **Mỗi profile chọn model cụ thể** cho từng vai trò:
  - `renderModel`: model dùng để **sinh ảnh** (render).
  - `analyzeModel`: model dùng để **phân tích ảnh mẫu** (analyze).
- **Vai trò (role):** `render` | `analyze` | `both` — xác định profile dùng để làm gì.
- **Quy tắc Anthropic:** KHÔNG hỗ trợ render (sinh ảnh) — UI chặn không cho chọn vai trò render; backend trả lỗi nếu cố gọi render bằng Anthropic.
- **Hai "engine" riêng biệt:**
  - `renderProfileId`: profile dùng để sinh ảnh (role `render`/`both`).
  - `analyzeProfileId`: profile dùng để phân tích ảnh mẫu (role `analyze`/`both`).

### 4.2. Quyết định thiết kế đã chốt (theo câu hỏi với người dùng)
1. Gemini mặc định: **hiển thị trong Settings, người dùng đổi được key**.
2. Anthropic + render: **chặn** (disable/không cho chọn render).
3. Fallback Pollinations: **bỏ hẳn** (không gửi prompt/ảnh ra dịch vụ bên ngoài; lỗi thì báo rõ).
4. Chuẩn OpenAI: **cho phép nhập endpoint tùy ý** (OpenAI-compatible proxy), vẫn có allowlist domain chống SSRF.

### 4.3. Luồng backend (đã triển khai)
- `POST /api/generate-image`: nhận `provider` (`gemini`|`openai`|`anthropic`), `model` (renderModel), `apiKey`, `apiEndpoint`; route theo provider; Anthropic → lỗi 400 "không hỗ trợ sinh ảnh"; **không còn fallback Pollinations** — nếu tất cả variant fail → trả 500 với thông báo rõ.
- `POST /api/gemini/analyze-style`: nhận `provider`, `model` (analyzeModel), `apiKey`, `apiEndpoint`; tách 3 hàm `analyzeWithGemini`/`OpenAI`/`Anthropic`; Gemini dùng `responseSchema` trực tiếp từ `ANALYSIS_RESPONSE_SCHEMA`, OpenAI/Anthropic ép JSON qua system prompt; trả `{ fallback: true }` nếu lỗi để client dùng visual engine nội bộ.

## 5. Cấu hình / Biến môi trường
Xem `.env.example`:
- `GEMINI_API_KEY` — key Gemini (AI Studio có thể tự inject khi deploy lên AI Studio/Vercel).
- `APP_PASSWORD` — mật khẩu đăng nhập (mặc định local: `admin`; production bắt buộc set).
- `JWT_SECRET` — khóa ký JWT (production bắt buộc set; local có giá trị dev).
- `OPENAI_ALLOWED_DOMAINS` — **legacy/không còn dùng**. Endpoint OpenAI-compatible hiện tự do (chỉ check URL hợp lệ). Người dùng tự chịu trách nhiệm chọn endpoint tin cậy.
- `ANALYZE_NORMALIZER_ENABLED` — bật/tắt server-side LLM normalizer (mặc định `true`). Khi provider trả JSON sai schema, server gọi Gemini flash-lite map về schema chuẩn.
- `PORT` — cổng server (mặc định 3000).
- Rate limit: `RATE_LIMIT_WINDOW_MS`, `RATE_LIMIT_MAX`, `AI_RATE_LIMIT_MAX`.

## 6. Các endpoint chính (server.ts)
- `GET /api/health` — public.
- `POST /api/login` — đăng nhập, trả JWT (cookie httpOnly + token).
- `POST /api/gemini/analyze-style` — phân tích ảnh mẫu (multi-provider: gemini/openai/anthropic).
- `POST /api/generate-image` — sinh ảnh (multi-provider; bỏ fallback Pollinations).
- Bảo vệ: tất cả `/api/*` ngoài health/login yêu cầu auth (Bearer hoặc cookie).

## 7. Cấu trúc thư mục
```
server.ts                       # Express server + AI routing (multi-provider)
src/
  main.tsx                      # Root render + ErrorBoundary
  App.tsx                       # Tab điều hướng + auth gate + theme
  index.css                     # Tailwind + CSS vars light/dark
  components/
    ErrorBoundary.tsx
    auth/LoginView.tsx
    layout/Header.tsx
    editor/EditorView.tsx, CanvasWorkspace.tsx, SourceUploader.tsx,
           ReferenceUploader.tsx, PromptEditor.tsx, OutputSettings.tsx,
           StyleAnalyzerModal.tsx, ImageLightbox.tsx
    history/HistoryView.tsx
    dashboard/DashboardView.tsx
    settings/SettingsView.tsx
  services/
    storageService.ts           # v4 — multi-provider + role
    authService.ts
    imageGenerationService.ts   # multi-provider (no Pollinations)
    styleAnalysisService.ts     # multi-provider analyze
    historyService.ts
    googleDriveService.ts
  context/ThemeContext.tsx
  types/index.ts
```

## 8. Lưu ý kỹ thuật / Cạm bẫy
1. **Encoding UTF-8 rất quan trọng:** `server.ts` từng bị hỏng mojibake do dùng PowerShell `Get-Content`/`Set-Content` (mặc định ANSI). **KHÔNG dùng PowerShell để đọc/ghi file code** — chỉ dùng công cụ read/edit/write hoặc `node`. File code phải giữ UTF-8 không BOM.
2. **Đã xảy ra** hỏng encoding trong commit `089b5cf` (500 chỗ mojibake); file đã được khôi phục từ bản sạch `e700579` và đang được tái cấu trúc.
3. Fallback Pollinations (client + server) sẽ bị **xóa** theo quyết định thiết kế.
4. `selectedModel` cũ → đổi thành `renderModel` + `analyzeModel` (đã xử lý normalize trong `storageService.loadAppSettings`).
5. Custom headers (`customHeaders`) đang không dùng nữa trong model mới.
6. Lỗi trắng trang khi phân tích ảnh mẫu trước đây do model fallback thiếu `responseSchema` — đã có giải pháp `ANALYSIS_RESPONSE_SCHEMA` dùng chung (đang áp lại) + ErrorBoundary (đã có).

## 9. Trạng thái deploy / Kế hoạch
- **Production đã deploy:** https://promtpicture.onrender.com/ (Render — giữ Express server, phù hợp với kiến trúc hiện tại).
- **Local:** refactor multi-provider + sửa encoding đã xong; `npm run lint` + `npm run build` pass.
- **Còn lại:** commit (gộp với bản sửa encoding để overwrite commit mojibake `089b5cf` trên remote) → push lên `main` → Render tự build bản mới.
- Drive là nơi lưu ảnh xuất cuối (chưa có DB; lưu localStorage).
- Lưu ý khi deploy Render: set đủ biến môi trường `APP_PASSWORD`, `JWT_SECRET`, `GEMINI_API_KEY`, `OPENAI_ALLOWED_DOMAINS`, `PORT`; build script dùng `npm run build` (vite build + esbuild server).
