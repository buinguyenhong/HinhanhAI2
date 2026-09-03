# AIchangelog — Nhật ký công việc dự án HinhanhAI

> Tài liệu này ghi lại **toàn bộ việc đã làm, đang làm, dự kiến làm** và **các vấn đề đang tạm dừng** để AI/người khác tiếp tục một cách liền mạch. Cập nhật mới nhất ở **đầu mục 0**.

---

## 0. LỊCH SỬ CÁC COMMIT (mới nhất trên cùng)

| # | Commit | Tóm tắt |
|---|---|---|
| 12 | `HEAD` | **feat: dual test buttons in modal, Imagen SDK support & API logic hardening** — nút Test kết nối + Test model sinh ảnh với preview thumbnail & lightbox; hỗ trợ generateImages cho Imagen 3; parse JSON an toàn cho OpenAI markdown; nâng rate limit AI lên 120; chuẩn hóa OpenAI proxy paths. |
| 11 | `db3925f` | **feat: cloud sync store, fix encoding, and harden lifecycle & storage** — sync settings & history qua JSON file server (/api/sync/*); fix triệt để 5 chỗ mojibake UTF-8; memoize ThemeContext & guard hasSyncedRef; quota fallback cho history localStorage; dẹp warning Vite. |
| 10 | `96258a1` | **docs: note Unsplash evaluation decision** — ghi nhận quyết định không tích hợp Unsplash. |
| 9 | `3c900c8` | **docs: consolidate full change history** — củng cố tài liệu và tham chiếu kiến trúc. |
| 8 | `e846c68` | **fix: 404 handling + real test-profile endpoint** — thử 3 image paths; extractUpstreamErrorMessage; `/api/test-profile` thật (analyze text + render image probe). |
| 7 | `0eeab63` | **fix: extend aspectRatio enum + upstream timeouts** — AspectRatio thêm `21:9\|3:4\|2:3`; `fetchWithTimeout` cho analyze (60s) + generate (90s). |
| 6 | `06baaa9` | **feat: server-side LLM normalizer** — `looksLikeCompliantAnalysis()` pass-through khi OK, nếu không thì gọi Gemini flash-lite map về schema. |
| 5 | `d03ee3b` | **fix: graceful schema mismatch** — `normalizeAnalysis()` client-side với nhiều alias (camel/snake/key lạ); ErrorBoundary hiển thị error.message. |
| 4 | `d8e8f05` | **remove SSRF allowlist** — bỏ hoàn toàn check domain, chỉ validate URL hợp lệ. |
| 3 | `089e50b` | **refactor: complete multi-provider (gemini/openai/anthropic), drop Pollinations fallback, fix encoding** — toàn bộ refactor multi-provider (xem mục 0A). |
| 2 | `089b5cf` | **share analyze schema and add error boundary** — ANALYSION_RESPONSE_SCHEMA dùng chung 2 model Gemini; ErrorBoundary. **⚠️ server.ts bị mojibake (PowerShell ANSI).** |
| 1 | `e700579` | **harden production config** — đọc PORT, trust proxy 1, crash nếu thiếu APP_PASSWORD/JWT_SECRET; xóa hint "admin"; dedupe vite trong deps. |

---

## 0A. TÓM TẮT KIẾN TRÚC SAU REFACTOR

### 0A.1. Multi-Provider Model

**3 provider được hỗ trợ:** `gemini` | `openai` ([OI]-compatible) | `anthropic`.

**`ApiProfile` shape (storageService.ts):**
```ts
{
  id: string;
  name: string;
  provider: 'gemini' | 'openai' | 'anthropic';
  role: 'render' | 'analyze' | 'both';
  apiKey: string;
  apiEndpoint: string;      // base URL, NO trailing slash
  renderModel: string;      // model dùng cho sinh ảnh (trống nếu anthropic)
  analyzeModel: string;     // model dùng cho phân tích ảnh
  notes?: string;
  isCustom?: boolean;
  createdAt: string;
}
```

**`AppSettings` shape:**
```ts
{
  theme: 'dark' | 'light';
  renderProfileId: string;    // engine sinh ảnh (role != analyze)
  analyzeProfileId: string;   // engine phân tích (role != render)
  apiProfiles: ApiProfile[];
  // legacy fields kept for migration:
  apiProvider, apiKey, apiEndpoint, apiProvider;
  driveConnected, driveAccount, driveFolder, autoSync;
  defaultQuality, defaultRatio, defaultVariations;
}
```

**Storage key:** `hinhanhai_app_settings_v4`. `normalizeProfile()` tự migrate từ version cũ.

**Helper:**
- `getRenderProfile(settings)` — lấy profile dùng cho sinh ảnh.
- `getAnalyzeProfile(settings)` — lấy profile dùng cho phân tích.
- `getActiveProfile` — alias backward-compat của `getRenderProfile`.

### 0A.2. Quy tắc chặn

| Provider | Render | Analyze |
|---|---|---|
| gemini | ✅ | ✅ |
| openai ([OI]-compatible) | ✅ | ✅ |
| anthropic | ❌ (chặn ở UI + server trả 400) | ✅ |

### 0A.3. Endpoint routes (server.ts)

| Endpoint | Method | Mục đích |
|---|---|---|
| `/api/health` | GET | Public. |
| `/api/login` | POST | JWT 12h + cookie httpOnly. |
| `/api/gemini/analyze-style` | POST | Phân tích ảnh mẫu (multi-provider + vision). |
| `/api/generate-image` | POST | Sinh ảnh (multi-provider, không Pollinations). |
| `/api/test-profile` | POST | Connectivity check thật: text probe (analyze) + image probe (render). |

### 0A.4. Helper quan trọng trong server.ts

- `fetchWithTimeout(url, init, ms)` — AbortController-based timeout (Node 18+).
- `validateCustomEndpoint(url)` — chỉ check URL hợp lệ (http/https). KHÔNG allowlist.
- `ensureCompliantAnalysis(raw, normalizerKey)` — schema gate: pass-through nếu OK, gọi Gemini flash-lite nếu sai schema. Toggle qua `ANALYZE_NORMALIZER_ENABLED` (default true).
- `normalizeAnalysisViaGemini(raw, apiKey)` — gọi Gemini 3.1 Flash-Lite với `responseSchema` chặt để map raw payload → schema.
- `looksLikeCompliantAnalysis(payload)` — spot-check 13 field bắt buộc + nested shapes.
- `extractUpstreamErrorMessage(status, rawText)` — rút message người đọc được từ proxy envelope.
- `generateWith[OI](p)` — thử lần lượt `/images/generations`, `/images`, `/v1/images/generations`. Nếu cả 3 đều 404 → message "endpoint không hỗ trợ sinh ảnh".

### 0A.5. Env vars

| Var | Default | Mục đích |
|---|---|---|
| `GEMINI_API_KEY` | — | Gemini SDK key. |
| `APP_PASSWORD` | `admin` (dev) | Mật khẩu login. Production bắt buộc. |
| `JWT_SECRET` | dev value | Ký JWT. Production bắt buộc. |
| `OPENAI_ALLOWED_DOMAINS` | (none — legacy, không dùng) | Đã bỏ SSRF guard. |
| `ANALYZE_NORMALIZER_ENABLED` | `true` | Bật/tắt server-side LLM normalizer. |
| `ANALYZE_TIMEOUT_MS` | 60000 | Timeout analyze. |
| `GENERATE_TIMEOUT_MS` | 90000 | Timeout generate. |
| `RATE_LIMIT_WINDOW_MS` / `RATE_LIMIT_MAX` / `AI_RATE_LIMIT_MAX` | 900000 / 150 / 20 | Rate-limit config. |
| `PORT` | 3000 | Server port. |

### 0A.6. Client-side normalization (styleAnalysisService.ts)

`normalizeAnalysis(raw)` map linh hoạt:
- snake_case ↔ camelCase (vd `hex_colors` ↔ `hexColors`).
- Alias nhóm (vd `overallArtStyleAesthetic` → `styleName`/`genre`/`styleDescription`).
- Fallback field mặc định (chuỗi rỗng, mảng rỗng) để không bao giờ throw.

### 0A.7. UI components đã cập nhật

| File | Vai trò |
|---|---|
| `SettingsView.tsx` | Multi-profile manager, 2 engine banner tách riêng, form provider mới (gemini/openai/anthropic, role, renderModel, analyzeModel), Test button thật. |
| `OutputSettings.tsx` | Render Engine selector, lọc profile `role !== 'analyze'`. |
| `EditorView.tsx` | Dùng `getRenderProfile`; badge "Render Engine". |
| `StyleAnalyzerModal.tsx` | Truyền `getAnalyzeProfile(loadAppSettings())` vào `analyzeImageStyle`. |
| `ErrorBoundary.tsx` | Hiện error.message + nút "Thử lại" (không reload state). |
| `storageService.ts` | Schema v4 (multi-provider + role). |
| `imageGenerationService.ts` | Truyền `renderModel` + `apiKey` + `apiEndpoint`. |
| `styleAnalysisService.ts` | `analyzeProfile` param; client-side normalizer. |

### 0A.8. Encoding rule

**Tuyệt đối KHÔNG dùng PowerShell** (`Get-Content`/`Set-Content` mặc định ANSI) để đọc/ghi file code. Chỉ dùng `read`/`edit`/`write` tool hoặc `node`. File code giữ UTF-8 **không BOM**.

### 0A.9. Deploy

- **URL:** https://promtpicture.onrender.com/ (Render, Express server).
- Build: `npm run build` (vite + esbuild server.cjs).
- Start: `npm start` (`node dist/server.cjs`).
- Render tự build khi push `main`.

### 0A.10. Bug fixes đáng nhớ

| Bug | Triệu chứng | Fix |
|---|---|---|
| Mojibake 500 chỗ | Tiếng Việt trong server.ts bị `TÃªn`, `áº£nh` | Khôi phục từ `git cat-file blob e700579:server.ts`, viết qua Node. |
| Allowlist Gemini | `generativelanguage.googleapis.com` không nằm allowlist | Bỏ allowlist hoàn toàn (commit d8e8f05). |
| `1endpoint.dev` analyze schema lạ | Client crash vì response thiếu `styleName` | Server-side normalizer (commit 06baaa9) + client-side alias (d03ee3b). |
| `aspectRatio: 3:4` reject | Server schema chấp nhận nhưng type client thiếu | Thêm `21:9\|3:4\|2:3` vào `AspectRatio` + options UI (0eeab63). |
| Timeout 1.6 min | Proxy chậm không abort | `fetchWithTimeout` 60s/90s (0eeab63). |
| 404 image route | `1endpoint.dev` không có `/images/generations` | Thử 3 paths + message rõ (e846c68) + `/api/test-profile` (e846c68). |

### 0A.11. Unsplash — đã đánh giá, KHÔNG tích hợp

User hỏi dùng Unsplash làm provider sinh ảnh. Đã tra docs (https://unsplash.com/documentation).

**Kết luận:** Không phù hợp với mục tiêu "AI Image Studio".

| Đặc điểm | Unsplash | Đánh giá |
|---|---|---|
| Bản chất | Thư viện ảnh stock có sẵn | ❌ Không phải AI generation. |
| Endpoint sinh ảnh | `GET /photos/random?query=<keyword>` trả ảnh match keyword | ❌ Không có `/images/generations`. |
| Vision / analyze | Không hỗ trợ | ❌ Không dùng cho analyze. |
| Auth | `Authorization: Client-ID <ACCESS_KEY>` | ✅ Có key nhưng flow khác (không phải Bearer). |
| Rate limit | Demo 50/h, production 1000/h | ⚠️ Demo rất thấp. |
| Nội dung ảnh | Ảnh người thật, sẵn có | ❌ User muốn generate mới, không muốn ảnh stock. |

**Quyết định:** Không tích hợp. Nếu sau này cần stock photo → làm endpoint riêng `/api/unsplash-search` (sandbox), không gộp vào generate-image flow.

---

## 0B. COMMIT ĐẦU TIÊN — REFACTOR MULTI-PROVIDER (commit `089e50b`)

**Commit sẽ tới:** `refactor: complete multi-provider (gemini/openai/anthropic), drop Pollinations fallback, fix encoding`.


## 0. HOÀN TẤT REFACTOR MULTI-PROVIDER (mới nhất — local, chờ commit/push)

**Commit sẽ tới:** `refactor: complete multi-provider (gemini/openai/anthropic), drop Pollinations fallback, fix encoding`.

### 0.1. Phạm vi thay đổi

**Server (`server.ts`):**
- Tái tạo `ANALYSIS_RESPONSE_SCHEMA` làm hằng số dùng chung; Gemini dùng trực tiếp với `responseSchema`, OpenAI/Anthropic dùng system prompt ép trả JSON.
- Tách 3 hàm provider-specific: `analyzeWithGemini`, `analyzeWithOpenAI`, `analyzeWithAnthropic` (vision đa phương thức qua OpenAI `image_url` / Anthropic `image` block).
- `/api/gemini/analyze-style`: nhận `provider`/`model`/`apiKey`/`apiEndpoint`; resolve key (gemini dùng `GEMINI_API_KEY` nếu rỗng); trả `{ fallback: true }` nếu lỗi.
- `/api/generate-image`: đổi `provider` enum thành `['gemini','openai','anthropic']`, **bỏ hoàn toàn Pollinations fallback**; tách `generateWithGemini`/`generateWithOpenAI`; Anthropic → trả lỗi "không hỗ trợ sinh ảnh"; không có ảnh → trả lỗi rõ ràng.
- `validateCustomEndpoint()`: chỉ check URL hợp lệ (http/https). Đã **bỏ SSRF allowlist** theo yêu cầu người dùng — endpoint OpenAI-compatible tự do (1endpoint.dev, Together, Groq, OpenRouter, v.v.).
- Encoding sạch (UTF-8 no BOM), không còn mojibake.

**Services (`src/services/`):**
- `imageGenerationService.ts`: truyền `renderModel` + `apiKey` + `apiEndpoint` (mới) thay `selectedModel` + `customHeaders` (cũ); **bỏ Pollinations fallback phía client**; throw lỗi để hiển thị thẳng.
- `styleAnalysisService.ts`: thêm tham số `analyzeProfile?: ApiProfile | null`; gửi `provider`/`model`/`apiKey`/`apiEndpoint` lên server.

**UI (`src/components/`):**
- `SettingsView.tsx`: form provider mới (gemini/openai/anthropic), có `role` (render/analyze/both), `renderModel`, `analyzeModel`, không còn `customHeaders`/`flux`/`stability`. Anthropic chặn role render trong UI. Banner Engine tách riêng cho Render & Analyze.
- `OutputSettings.tsx`: chuyển sang "Render Engine" selector (lọc profile `role !== 'analyze'`); hiển thị `renderModel`.
- `EditorView.tsx`: dùng `getRenderProfile`; badge đổi thành "Render Engine".
- `StyleAnalyzerModal.tsx`: truyền `getAnalyzeProfile(loadAppSettings())` vào `analyzeImageStyle`.

### 0.2. Verification
- `npm run lint` → pass.
- `npm run build` → pass (vite + esbuild server thành công).

### 0.3. Chưa commit/push
- Sẽ commit gộp với bản sửa encoding (ghi đè commit mojibake `089b5cf` trên remote).
- Sau push, Render sẽ tự build lại.

---

---

## 1. Bối cảnh ban đầu

- Dự án: HinhanhAI / AI Image Studio — ứng dụng chỉnh sửa ảnh AI, tiếng Việt, sinh ảnh + phân tích ảnh mẫu + lưu Google Drive.
- Stack: React 19 + Vite 6 + Tailwind 4 + Express 4 + `@google/genai` + JWT + localStorage.
- Mục tiêu người dùng: sẵn sàng production → push git → deploy (Vercel hoặc nền tảng phù hợp) → lưu ảnh trên Google Drive; chuyển đổi linh hoạt giữa các model AI.

---

## 2. Công việc ĐÃ HOÀN THÀNH (đã commit/push)

### 2.1. `harden production config` — commit `e700579` (đã push)
- `server.ts`: đọc `PORT` từ `process.env.PORT` (mặc định 3000); thêm `app.set('trust proxy', 1)` (rate-limit tính đúng IP sau reverse proxy).
- `server.ts`: Production **crash ngay** (exit 1) nếu thiếu `APP_PASSWORD` / `JWT_SECRET`, kèm log rõ ràng; local vẫn có giá trị dev.
- `LoginView.tsx`: xóa dòng gợi ý "Mã truy cập mặc định: admin".
- `package.json` + `bun.lock`: xóa `vite` trùng ở `devDependencies` (giữ ở `dependencies`).

### 2.2. `share analyze schema and add error boundary` — commit `089b5cf` (đã push, NHƯNG server.ts bị hỏng encoding — xem mục 5.1)
- Đã tách `ANALYSIS_RESPONSE_SCHEMA` dùng chung cho 2 model Gemini (sửa lỗi trắng trang khi phân tích ảnh mẫu).
- Thêm `src/components/ErrorBoundary.tsx` (bọc trong `main.tsx`) để chặn crash render.
- **CẢNH BÁO:** commit này đã đẩy lên remote bản `server.ts` bị **mojibake** (500 chỗ) do lỗi PowerShell `Set-Content`. Hiện file đã được khôi phục sạch từ `e700579` ở working tree (chưa commit).

---

## 3. Công việc ĐANG LÀM (đang tạm dừng vì response bị block — người khác tiếp tục)

### 3.1. Refactor Multi-Provider (yêu cầu mới của người dùng)
**Yêu cầu:** chỉ để 1 provider Gemini mặc định; custom API rõ ràng — chọn giữa chuẩn **OpenAI** hoặc **Anthropic**; mỗi provider chọn model cụ thể; mỗi provider chọn vai trò **render / phân tích ảnh mẫu / cả hai**.

**Quyết định thiết kế đã chốt (hỏi người dùng):**
1. Gemini mặc định: **hiển thị trong Settings, đổi được key**.
2. Anthropic + render: **chặn** (không cho chọn render).
3. Fallback Pollinations: **bỏ hẳn**.
4. OpenAI: **cho nhập endpoint tùy ý** + allowlist domain chống SSRF.

### 3.2. Trạng thái từng file (đã cập nhật ở mục 0 — refactor HOÀN TẤT)

| File | Trạng thái | Chi tiết |
|---|---|---|
| `src/services/storageService.ts` | ✅ **ĐÃ REFACTOR XONG** | `ApiProviderType = 'gemini'\|'openai'\|'anthropic'`; `ApiProfileRole`; `ApiProfile` có `role`, `renderModel`, `analyzeModel` (bỏ `selectedModel`/`customHeaders`); `AppSettings` có `renderProfileId`, `analyzeProfileId`; `DEFAULT_PROFILES` 1 profile gemini (`both`); key `hinhanhai_app_settings_v4`; `normalizeProfile` migrate từ cũ; `getRenderProfile`, `getAnalyzeProfile`, `getActiveProfile` (alias). |
| `server.ts` | ✅ **�Ã REFACTOR XONG** | Encoding sạch (UTF-8 no BOM). `ANALYSIS_RESPONSE_SCHEMA` dùng chung; `analyzeWithGemini`/`OpenAI`/`Anthropic`; `generateImageSchema` provider enum = 3; bỏ Pollinations; Anthropic → 400 render; `validateCustomEndpoint` skip allowlist cho gemini. |
| `src/services/imageGenerationService.ts` | ✅ **ĐÃ REFACTOR XONG** | Truyền `renderModel` + `apiKey` + `apiEndpoint`; bỏ Pollinations; throw lỗi nếu server fail. |
| `src/services/styleAnalysisService.ts` | ✅ **ĐÃ REFACTOR XONG** | Thêm `analyzeProfile` param; truyền provider/model/apiKey/apiEndpoint. |
| `src/components/settings/SettingsView.tsx` | ✅ **ĐÃ REFACTOR XONG** | Form provider mới (gemini/openai/anthropic), có `role` + `renderModel` + `analyzeModel`. Banner 2 engine tách biệt. Anthropic chặn render trong UI. |
| `src/components/editor/OutputSettings.tsx` | ✅ **ĐÃ REFACTOR XONG** | Render Engine selector, lọc profile `role !== 'analyze'`, hiển thị `renderModel`. |
| `src/components/editor/EditorView.tsx` | ✅ **ĐÃ REFACTOR XONG** | Dùng `getRenderProfile`, badge "Render Engine". |
| `src/components/editor/StyleAnalyzerModal.tsx` | ✅ **ĐÃ REFACTOR XONG** | Truyền `getAnalyzeProfile(loadAppSettings())` cho `analyzeImageStyle`. |

---

## 4. Công việc CHUẨN BỊ THỰC HIỆN (kế hoạch)

### 4.1. Tiếp tục refactor multi-provider
1. **server.ts**:
   - Tái tạo hằng số `ANALYSIS_RESPONSE_SCHEMA` (dùng chung cho các provider hỗ trợ JSON schema; gemini dùng trực tiếp, openai/anthropic dùng prompt hướng dẫn trả JSON đúng cấu trúc).
   - Sửa allowlist: `usesCustomEndpoint = provider === 'openai' || provider === 'custom'` (bỏ qua gemini).
   - `generateImageSchema`: đổi `provider` enum thành `['gemini','openai','anthropic']`; bỏ `customHeaders`.
   - Viết lại `/api/generate-image`: nhận `model` (renderModel) + `apiKey` + `apiEndpoint`; route theo provider; Anthropic → trả lỗi "không hỗ trợ render"; **xóa hoàn toàn Pollinations fallback**; nếu không tạo được ảnh → trả lỗi rõ ràng (không fallback).
   - Viết lại `/api/gemini/analyze-style` (hoặc đổi thành `/api/analyze-style`): nhận `provider`/`model`/`apiKey`/`apiEndpoint`, hỗ trợ vision gemini/openai/anthropic; trả `fallback: true` nếu lỗi để client dùng visual engine nội bộ (client fallback này là OK — chạy local, không gửi ảnh ra ngoài).
2. **imageGenerationService.ts**: dùng profile render mới, bỏ client fallback Pollinations (giữ visual engine chỉ cho analyze).
3. **styleAnalysisService.ts**: dùng profile analyze mới.
4. **SettingsView.tsx**: form provider mới.
5. **OutputSettings.tsx / EditorView.tsx / StyleAnalyzerModal.tsx**: nối `renderProfileId` / `analyzeProfileId`.

### 4.2. Sau refactor
- Chạy `npm install` (nếu chưa có node_modules) rồi `npm run lint` và `npm run build` — phải pass.
- Kiểm tra thủ công flow: đăng nhập → tạo ảnh bằng gemini → phân tích ảnh mẫu → lưu Drive.
- Commit/push (lưu ý: commit sửa encoding + refactor nên gộp gọn).
- Deploy: khuyến nghị Render/Railway (giữ Express). Nếu Vercel: frontend + backend riêng.

---

## 5. VẤN ĐỀ ĐÃ XỬ LÝ (đóng — chuyển sang mục 0 lịch sử)

### 5.1. ✅ `server.ts` bị h�ng encoding trên remote
- **Đã xử lý:** file ở working tree đã sạch encoding (UTF-8 no BOM, tiếng Việt hiển thị đúng). Commit refactor (mục 0) sẽ gộp bản sửa và push lên remote để overwrite commit mojibake `089b5cf`.
- **Quy tắc tránh tái phạm:** KHÔNG dùng PowerShell đọc/ghi file code (mặc định ANSI). Chỉ dùng read/edit/write tool hoặc `node`. File code giữ UTF-8 **không BOM**.

### 5.2. ✅ Allowlist chặn nhầm Gemini endpoint & các endpoint OpenAI-compatible khác
- **Vấn đề mở rộng:** allowlist chỉ có 4 domain — chặn cả Gemini (dùng SDK) lẫn các OpenAI-compatible proxy khác (VD: 1endpoint.dev).
- **Đã xử lý (yêu cầu người dùng):** **bỏ hoàn toàn SSRF allowlist**. `validateCustomEndpoint()` chỉ check URL hợp lệ (http/https). Người dùng tự chịu trách nhiệm chọn endpoint OpenAI-compatible tin cậy.

### 5.3. ✅ Refactor multi-provider các file còn lại
- Tất cả file UI/service đã được cập nhật theo schema mới (`renderProfileId`/`analyzeProfileId`, `role`, `renderModel`, `analyzeModel`). Xem chi tiết mục 0 và mục 3.2.

---

## 6. Hướng dẫn cho người/AI tiếp tục (checklist ngắn)

1. `git status` + đọc mục 5 (đặc biệt 5.1 — nhớ fix encoding trước khi commit).
2. Hoàn tất `server.ts` theo mục 4.1.
3. Sửa `imageGenerationService.ts`, `styleAnalysisService.ts`.
4. ~~Sửa `SettingsView.tsx`, `OutputSettings.tsx`, `EditorView.tsx`, `StyleAnalyzerModal.tsx`.~~ **Đã xong.**
5. ~~`npm install` (nếu chưa có) → `npm run lint` → `npm run build`.~~ **Đã pass.**
6. **Còn lại:** commit (gộp với bản sửa encoding) → push lên `main` → Render tự build.

---

## 7. TRIỂN KHAI PRODUCTION

- **URL production:** https://promtpicture.onrender.com/ (Render, giữ Express server).
- Deploy qua Render: build `npm run build` (vite build + esbuild `server.ts`), start `npm start` (`node dist/server.cjs`).
- Biến môi trường bắt buộc trên Render: `APP_PASSWORD`, `JWT_SECRET`, `GEMINI_API_KEY`, `OPENAI_ALLOWED_DOMAINS`, `PORT` (Render tự cấp `PORT`).
- **Lưu ý:** sau khi hoàn tất refactor multi-provider + sửa encoding, push lên `main` để Render tự build bản mới.
- Nếu cần kiểm tra nhanh bản deploy: `GET https://promtpicture.onrender.com/api/health`.
