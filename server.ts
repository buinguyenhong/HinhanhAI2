import express, { Request, Response, NextFunction } from 'express';
import path from 'path';
import { createServer as createViteServer } from 'vite';
import { GoogleGenAI, Type } from '@google/genai';
import dotenv from 'dotenv';
import cookieParser from 'cookie-parser';
import jwt from 'jsonwebtoken';
import rateLimit from 'express-rate-limit';
import { z } from 'zod';

dotenv.config();

const app = express();
const PORT = Number(process.env.PORT) || 3000;
app.set('trust proxy', 1);

// Configuration & Environment Variables
const isProduction = process.env.NODE_ENV === 'production';
const APP_PASSWORD = process.env.APP_PASSWORD || (isProduction ? '' : 'admin');
const JWT_SECRET =
  process.env.JWT_SECRET || (isProduction ? '' : 'hinhanhai-local-development-jwt-secret');

if (isProduction && (!APP_PASSWORD || !JWT_SECRET)) {
  console.error(
    'Production configuration error: APP_PASSWORD and JWT_SECRET environment variables are required.'
  );
  process.exit(1);
}

const OPENAI_ALLOWED_DOMAINS = (
  process.env.OPENAI_ALLOWED_DOMAINS || 'api.openai.com,api.together.xyz,api.groq.com,openrouter.ai'
)
  .split(',')
  .map((d) => d.trim().toLowerCase())
  .filter(Boolean);

// Middlewares
app.use(cookieParser());
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ limit: '50mb', extended: true }));

// --- RATE LIMITERS ---
// 1. General rate limiter for all /api/ endpoints (lighter)
const apiLimiter = rateLimit({
  windowMs: Number(process.env.RATE_LIMIT_WINDOW_MS) || 15 * 60 * 1000, // 15 minutes
  max: Number(process.env.RATE_LIMIT_MAX) || 150, // limit each IP
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    error: 'Bạn đã gửi quá nhiều yêu cầu đến hệ thống. Vui lòng thử lại sau ít phút.',
  },
});

// 2. Strict rate limiter for AI-intensive generation & style analysis endpoints
const aiLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: Number(process.env.AI_RATE_LIMIT_MAX) || 20, // limit each IP to 20 AI requests / 15 mins
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    error: 'Bạn đã đạt giới hạn yêu cầu AI (tối đa 20 yêu cầu / 15 phút). Vui lòng thử lại sau.',
  },
});

// 3. Login attempt rate limiter
const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 15,
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    error: 'Đã thử đăng nhập quá nhiều lần. Vui lòng đợi 15 phút trước khi thử lại.',
  },
});

// Apply general API rate limiting to all /api routes
app.use('/api', apiLimiter);

// --- AUTHENTICATION MIDDLEWARE ---
export interface AuthenticatedRequest extends Request {
  user?: any;
}

function requireAuth(req: AuthenticatedRequest, res: Response, next: NextFunction) {
  let token: string | undefined;

  // 1. Check Authorization header: Bearer <token>
  const authHeader = req.headers.authorization;
  if (authHeader && authHeader.startsWith('Bearer ')) {
    token = authHeader.substring(7).trim();
  }

  // 2. Check httpOnly cookie
  if (!token && req.cookies && req.cookies.auth_token) {
    token = req.cookies.auth_token;
  }

  if (!token) {
    return res.status(401).json({
      error: 'Yêu cầu xác thực. Vui lòng đăng nhập để tiếp tục.',
      code: 'UNAUTHORIZED',
    });
  }

  try {
    const decoded = jwt.verify(token, JWT_SECRET);
    req.user = decoded;
    next();
  } catch (err: any) {
    return res.status(401).json({
      error: 'Mã xác thực đã hết hạn hoặc không hợp lệ. Vui lòng đăng nhập lại.',
      code: 'INVALID_TOKEN',
    });
  }
}

// --- PUBLIC ENDPOINTS ---

// 1. Health check endpoint (Public)
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// 2. Login validation schema
const loginSchema = z.object({
  password: z.string().min(1, 'Mật khẩu không được để trống').max(200, 'Mật kh�u quá dài'),
});

// POST /api/login (Public with loginLimiter)
app.post('/api/login', loginLimiter, (req, res) => {
  const parsed = loginSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({
      error: 'Dữ liệu không hợp lệ',
      details: parsed.error.issues.map((i) => i.message).join(', '),
    });
  }

  const { password } = parsed.data;

  // Constant-time like comparison or direct string equality check
  if (password !== APP_PASSWORD) {
    return res.status(401).json({
      error: 'Mã truy cập không hợp lệ. Vui lòng kiểm tra lại.',
    });
  }

  // Issue 12-hour JWT
  const token = jwt.sign(
    {
      authenticated: true,
      role: 'user',
      issuedAt: new Date().toISOString(),
    },
    JWT_SECRET,
    {
      expiresIn: '12h',
    }
  );

  // Set secure httpOnly cookie
  res.cookie('auth_token', token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'strict',
    maxAge: 12 * 60 * 60 * 1000, // 12 hours
  });

  return res.json({
    success: true,
    token,
    expiresIn: '12h',
  });
});

// --- PROTECTED API MIDDLEWARE ROUTING ---
// Protect all remaining /api/* endpoints with requireAuth
app.use('/api', (req, res, next) => {
  if (req.path === '/health' || req.path === '/login') {
    return next();
  }
  return requireAuth(req, res, next);
});

// --- LAZY-INITIALIZED GEMINI CLIENT ---
let geminiClient: GoogleGenAI | null = null;
function getGeminiClient(): GoogleGenAI | null {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    return null;
  }
  if (!geminiClient) {
    geminiClient = new GoogleGenAI({
      apiKey,
      httpOptions: {
        headers: {
          'User-Agent': 'aistudio-build',
        },
      },
    });
  }
  return geminiClient;
}

// --- SHARED ANALYSIS RESPONSE SCHEMA (used by Gemini JSON schema; openai/anthropic prompted to follow) ---
const ANALYSIS_RESPONSE_SCHEMA: any = {
  type: Type.OBJECT,
  properties: {
    styleName: { type: Type.STRING, description: 'Tên phong cách' },
    genre: { type: Type.STRING, description: 'Thể loại nghệ thuật' },
    styleDescription: { type: Type.STRING, description: 'Mô tả chi tiết phong cách' },
    lighting: {
      type: Type.OBJECT,
      properties: {
        sourceType: { type: Type.STRING, description: 'Nguồn sáng (Tự nhiên, Đèn studio, Neon, Ánh nến...)' },
        direction: { type: Type.STRING, description: 'Hướng sáng (Góc nghiêng 45 độ, Hắt sau, Ngược sáng...)' },
        colorTemperature: { type: Type.STRING, description: 'Nhiệt độ màu (Ấm 3200K, Trung tính 5000K, Lạnh 6500K...)' },
        quality: { type: Type.STRING, description: 'Độ mềm/gắt (Khuếch tán dịu, Tương phản cao Chiaroscuro...)' },
        detailedAnalysis: { type: Type.STRING, description: 'Phân tích chi tiết ánh sáng và bóng đổ' },
        promptSnippetEn: { type: Type.STRING, description: 'Đoạn prompt tiếng Anh riêng cho ánh sáng' },
        promptSnippetVi: { type: Type.STRING, description: '�oạn mô tả tiếng Việt riêng cho ánh sáng' },
      },
      required: ['sourceType', 'direction', 'colorTemperature', 'quality', 'detailedAnalysis'],
    },
    background: {
      type: Type.OBJECT,
      properties: {
        settingType: { type: Type.STRING, description: 'Loại bối cảnh chính' },
        architecturalStyle: { type: Type.STRING, description: 'Phong cách kiến trúc & kết cấu không gian' },
        depthOfField: { type: Type.STRING, description: 'Độ sâu trường ảnh (Xóa phông mờ ảo Bokeh, Rõ nét toàn cảnh...)' },
        elements: {
          type: Type.ARRAY,
          items: { type: Type.STRING },
          description: 'Các vật thể và chi tiết xuất hiện ở hậu cảnh',
        },
        objectsAndProps: {
          type: Type.ARRAY,
          items: {
            type: Type.OBJECT,
            properties: {
              name: { type: Type.STRING, description: 'Tên vật thể' },
              category: { type: Type.STRING, description: 'Nhóm (lighting_prop, furniture, architecture, material, nature, decoration, other)' },
              description: { type: Type.STRING, description: 'Mô tả chi tiết vật thể' },
              promptSnippet: { type: Type.STRING, description: 'Mảnh prompt tiếng Anh mô tả vật thể này' },
            },
            required: ['name'],
          },
          description: 'Danh sách các vật thể/đạo cụ cụ thể trong bối cảnh',
        },
        materials: {
          type: Type.ARRAY,
          items: { type: Type.STRING },
          description: 'Các chất liệu nhận diện được',
        },
        atmosphere: { type: Type.STRING, description: 'Bầu không khí & hiệu ứng môi trường' },
        detailedAnalysis: { type: Type.STRING, description: 'Phân tích chi tiết toàn diện về bối cảnh và vật thể' },
        promptSnippetEn: { type: Type.STRING, description: 'Đoạn prompt tiếng Anh riêng cho bối cảnh & vật thể' },
        promptSnippetVi: { type: Type.STRING, description: 'Đoạn mô tả tiếng Việt riêng cho bối cảnh & vật thể' },
      },
      required: ['settingType', 'depthOfField', 'elements', 'detailedAnalysis'],
    },
    camera: {
      type: Type.OBJECT,
      properties: {
        shotType: { type: Type.STRING, description: 'Góc chụp (Chân dung cận cảnh, Trung cảnh, Toàn cảnh...)' },
        lensSuggestion: { type: Type.STRING, description: 'Ống kính gợi ý (ví dụ: 85mm f/1.4, 35mm f/1.8)' },
        compositionRule: { type: Type.STRING, description: 'Quy tắc bố cục (Quy tắc 1/3, Đối xứng tâm, Đường dẫn...)' },
        detailedAnalysis: { type: Type.STRING, description: 'Phân tích kỹ thuật quang học và góc chụp' },
        promptSnippetEn: { type: Type.STRING, description: 'Đoạn prompt tiếng Anh riêng cho góc máy & bố cục' },
        promptSnippetVi: { type: Type.STRING, description: 'Đoạn mô tả tiếng Việt riêng cho góc máy & bố cục' },
      },
      required: ['shotType', 'lensSuggestion', 'compositionRule', 'detailedAnalysis'],
    },
    colorPalette: {
      type: Type.OBJECT,
      properties: {
        dominantMood: { type: Type.STRING, description: 'Tông cảm xúc chính (Hoài niệm, Sang trọng, Bí ẩn, Rực rỡ...)' },
        hexColors: {
          type: Type.ARRAY,
          items: {
            type: Type.OBJECT,
            properties: {
              hex: { type: Type.STRING, description: 'Mã màu HEX e.g. #D4A373' },
              name: { type: Type.STRING, description: 'Tên màu sắc' },
              role: { type: Type.STRING, description: 'Vai trò (Chủ đạo, Điểm nhấn, Nền, Ánh sáng)' },
            },
            required: ['hex', 'name', 'role'],
          },
        },
        colorGrading: { type: Type.STRING, description: 'Phong cách chỉnh màu (Color Grading)' },
        promptSnippetEn: { type: Type.STRING, description: 'Đoạn prompt tiếng Anh riêng cho màu sắc & grading' },
        promptSnippetVi: { type: Type.STRING, description: 'Đoạn mô tả tiếng Việt riêng cho màu sắc & grading' },
      },
      required: ['dominantMood', 'hexColors', 'colorGrading'],
    },
    subjectDetails: {
      type: Type.OBJECT,
      properties: {
        subjectType: { type: Type.STRING, description: 'Chủ thể chính' },
        poseAndExpression: { type: Type.STRING, description: 'Tư thế và biểu cảm' },
        texturesAndMaterials: { type: Type.STRING, description: 'Chất liệu bề mặt và chi tiết' },
        promptSnippetEn: { type: Type.STRING, description: 'Đoạn prompt tiếng Anh riêng cho chi tiết bề mặt/chủ thể' },
        promptSnippetVi: { type: Type.STRING, description: 'Đoạn mô tả tiếng Việt riêng cho chi tiết bề mặt/chủ thể' },
      },
      required: ['subjectType', 'poseAndExpression', 'texturesAndMaterials'],
    },
    recommendedPromptEn: { type: Type.STRING, description: 'Prompt tiếng Anh tối ưu cho AI generation' },
    recommendedPromptVi: { type: Type.STRING, description: 'Mô tả prompt tiếng Việt chi tiết' },
    negativePrompt: { type: Type.STRING, description: 'Negative prompt loại trừ lỗi' },
    suggestedAspectRatio: { type: Type.STRING, description: 'Tỷ lệ khung hình đề xuất (1:1, 16:9, 9:16, 4:3, 3:2)' },
    keyTags: {
      type: Type.ARRAY,
      items: { type: Type.STRING },
      description: 'Các từ khóa quan trọng nhất để tạo phong cách tương tự',
    },
  },
  required: [
    'styleName',
    'genre',
    'styleDescription',
    'lighting',
    'background',
    'camera',
    'colorPalette',
    'subjectDetails',
    'recommendedPromptEn',
    'recommendedPromptVi',
    'negativePrompt',
    'suggestedAspectRatio',
    'keyTags',
  ],
};

const ANALYSIS_PROMPT_TEXT = `
You are an elite creative director, cinematographer, and visual AI prompt engineer.
Analyze the provided image in comprehensive, professional detail for the following aspects:
1. Overall Art Style & Aesthetic (Phong cách tổng thể)
2. In-Depth Background & Environment Breakdown (Phân tích bối cảnh cực kỳ chi tiết):
   - Setting type (ví dụ: Lâu đài cổ Gothic Châu Âu, Biệt thự cổ điển, Studio tối giản, Loft tường xi măng mộc...)
   - Architectural style (Phong cách kiến trúc, vòm cửa, cột trụ, ban công...)
   - Objects and Props (Liệt kê tỉ mỉ mọi đồ vật, đạo cụ)
   - Materials & Textures (Xi măng thô, Đá cổ phong hóa, Gỗ sồi mộc, Kim loại đồng gỉ, Thủy tinh pha lê...)
   - Atmosphere & Environmental mood (Sương mù huyền bí, Bụi bay lơ lửng trong vạt nắng, Ánh nến lung linh...)
   - Depth of field (�ộ sâu trường ảnh DOF, Bokeh)
3. Lighting & Illumination (Ánh sáng: hướng sáng, nguồn sáng, nhiệt độ màu, độ gắt/dịu, bóng đ� Chiaroscuro...)
4. Camera & Optical Composition (Góc máy, bố cục, tiêu cự ống kính đề xuất, khẩu độ)
5. Color Palette & Mood (Bảng màu chủ đạo, các mã HEX nổi bật, tông cảm xúc, Color grading)
6. Subject & Textures (Chủ thể, thần thái, chất liệu bề mặt)
7. Modular Prompt Snippets (Từng mảnh ghép prompt độc lập):
   - Background prompt snippet (English & Vietnamese)
   - Lighting prompt snippet (English & Vietnamese)
   - Camera prompt snippet (English & Vietnamese)
   - Color palette prompt snippet (English & Vietnamese)
   - Style/Subject prompt snippet (English & Vietnamese)
8. High-Performance Master Prompts:
   - recommendedPromptEn: Full master English prompt combining all best visual attributes.
   - recommendedPromptVi: Full master Vietnamese prompt.
   - negativePrompt: Optimal negative prompt to eliminate visual flaws.
   - suggestedAspectRatio: One of ["1:1", "16:9", "9:16", "4:3", "3:2"]

Return STRICTLY a JSON object matching the required schema. No prose, no markdown fences, ONLY valid JSON.
`;

// --- PROVIDER-SPECIFIC ANALYSIS CALLS ---

async function analyzeWithGemini(opts: {
  apiKey: string;
  model: string;
  imageBase64: string;
  mimeType: string;
  userFocus?: string | null;
}): Promise<{ analysis: any; source: string }> {
  const ai = new GoogleGenAI({
    apiKey: opts.apiKey,
    httpOptions: { headers: { 'User-Agent': 'aistudio-build' } },
  });
  const cleanBase64 = opts.imageBase64.replace(/^data:image\/[a-zA-Z0-9+]+;base64,/, '');
  const finalPrompt = opts.userFocus
    ? `${ANALYSIS_PROMPT_TEXT}\n\nUser specific focus request: "${opts.userFocus}"`
    : ANALYSIS_PROMPT_TEXT;

  let response: any = null;
  let usedModel = opts.model;

  try {
    response = await ai.models.generateContent({
      model: opts.model,
      contents: {
        parts: [
          {
            inlineData: {
              mimeType: opts.mimeType || 'image/jpeg',
              data: cleanBase64,
            },
          },
          { text: finalPrompt },
        ],
      },
      config: {
        systemInstruction:
          'You are a world-class cinematographer and AI art director. Provide exceptionally deep visual analysis in Vietnamese with modular prompt snippets.',
        responseMimeType: 'application/json',
        responseSchema: ANALYSIS_RESPONSE_SCHEMA,
      },
    });
  } catch (primaryErr: any) {
    console.warn(`Gemini model ${opts.model} failed:`, primaryErr?.message);
    response = null;
  }

  if (response && response.text) {
    const resultJson = JSON.parse(response.text || '{}');
    return { analysis: resultJson, source: usedModel };
  }
  throw new Error(`Gemini model ${opts.model} did not return a valid response.`);
}

async function analyzeWithOpenAI(opts: {
  apiKey: string;
  model: string;
  apiEndpoint?: string | null;
  imageBase64: string;
  mimeType: string;
  userFocus?: string | null;
}): Promise<{ analysis: any; source: string }> {
  const endpoint =
    (opts.apiEndpoint?.replace(/\/$/, '') || 'https://api.openai.com/v1') + '/chat/completions';
  const cleanBase64 = opts.imageBase64.replace(/^data:image\/[a-zA-Z0-9+]+;base64,/, '');
  const dataUrl = `data:${opts.mimeType || 'image/jpeg'};base64,${cleanBase64}`;
  const finalPrompt = opts.userFocus
    ? `${ANALYSIS_PROMPT_TEXT}\n\nUser specific focus request: "${opts.userFocus}"`
    : ANALYSIS_PROMPT_TEXT;

  const response = await fetch(endpoint, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${opts.apiKey}`,
    },
    body: JSON.stringify({
      model: opts.model,
      messages: [
        {
          role: 'system',
          content:
            'You are a world-class cinematographer and AI art director. Respond ONLY with a single valid JSON object matching the schema. No prose, no markdown.',
        },
        {
          role: 'user',
          content: [
            { type: 'text', text: finalPrompt },
            { type: 'image_url', image_url: { url: dataUrl } },
          ],
        },
      ],
      response_format: { type: 'json_object' },
      max_tokens: 4096,
    }),
  });

  if (!response.ok) {
    const errText = await response.text().catch(() => '');
    throw new Error(`OpenAI analyze failed (${response.status}): ${errText.slice(0, 300)}`);
  }
  const data: any = await response.json();
  const content = data?.choices?.[0]?.message?.content;
  if (!content) throw new Error('OpenAI returned empty content.');
  const analysis = typeof content === 'string' ? JSON.parse(content) : content;
  return { analysis, source: opts.model };
}

async function analyzeWithAnthropic(opts: {
  apiKey: string;
  model: string;
  apiEndpoint?: string | null;
  imageBase64: string;
  mimeType: string;
  userFocus?: string | null;
}): Promise<{ analysis: any; source: string }> {
  const endpoint =
    (opts.apiEndpoint?.replace(/\/$/, '') || 'https://api.anthropic.com') + '/v1/messages';
  const cleanBase64 = opts.imageBase64.replace(/^data:image\/[a-zA-Z0-9+]+;base64,/, '');
  const finalPrompt = opts.userFocus
    ? `${ANALYSIS_PROMPT_TEXT}\n\nUser specific focus request: "${opts.userFocus}"`
    : ANALYSIS_PROMPT_TEXT;

  const response = await fetch(endpoint, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': opts.apiKey,
      'anthropic-version': '2023-06-01',
      'anthropic-dangerous-direct-browser-access': 'true',
    },
    body: JSON.stringify({
      model: opts.model,
      max_tokens: 4096,
      system:
        'You are a world-class cinematographer and AI art director. Respond ONLY with a single valid JSON object matching the schema. No prose, no markdown.',
      messages: [
        {
          role: 'user',
          content: [
            {
              type: 'image',
              source: {
                type: 'base64',
                media_type: opts.mimeType || 'image/jpeg',
                data: cleanBase64,
              },
            },
            { type: 'text', text: finalPrompt },
          ],
        },
      ],
    }),
  });

  if (!response.ok) {
    const errText = await response.text().catch(() => '');
    throw new Error(`Anthropic analyze failed (${response.status}): ${errText.slice(0, 300)}`);
  }
  const data: any = await response.json();
  const textBlock = (data?.content || []).find((b: any) => b.type === 'text');
  const content = textBlock?.text;
  if (!content) throw new Error('Anthropic returned empty content.');
  const jsonMatch = content.match(/\{[\s\S]*\}/);
  if (!jsonMatch) throw new Error('Anthropic response did not contain a JSON object.');
  const analysis = JSON.parse(jsonMatch[0]);
  return { analysis, source: opts.model };
}

// --- ZOD INPUT VALIDATION SCHEMAS ---

const analyzeStyleSchema = z.object({
  imageBase64: z.string().min(1, 'Ảnh phân tích không được để trống'),
  mimeType: z.string().max(100).optional().default('image/jpeg'),
  userFocus: z.string().max(2000).optional().nullable(),
  provider: z.enum(['gemini', 'openai', 'anthropic']).optional().default('gemini'),
  model: z.string().max(150).optional().nullable(),
  apiKey: z.string().max(500).optional().nullable(),
  apiEndpoint: z.string().max(500).optional().nullable(),
});

const generateImageSchema = z.object({
  prompt: z
    .string()
    .min(1, 'Prompt không được để trống')
    .max(4000, 'Prompt không được vượt quá 4000 ký tự'),
  negativePrompt: z.string().max(2000).optional().nullable(),
  aspectRatio: z
    .enum(['original', '1:1', '16:9', '9:16', '4:3', '3:2', '21:9', '3:4', '2:3'])
    .default('1:1'),
  variations: z.number().int().min(1, 'Tối thiểu 1 biến thể').max(4, 'Tối đa 4 biến thể').default(1),
  quality: z.enum(['standard', 'high', 'raw']).optional().default('high'),
  seed: z.string().max(50).optional().default('-1'),
  model: z.string().max(150).optional().nullable(),
  provider: z.enum(['gemini', 'openai', 'anthropic']).optional().default('gemini'),
  apiKey: z.string().max(500).optional().nullable(),
  apiEndpoint: z.string().max(500).optional().nullable(),
  sourceImageBase64: z.string().optional().nullable(),
  referenceImageBase64: z.string().optional().nullable(),
});

// Helper: validate custom endpoint hostname against allowlist (SSRF guard)
function validateCustomEndpoint(rawEndpoint: string, provider: string): { ok: boolean; hostname?: string; error?: string } {
  // Gemini uses SDK with key; customEndpoint not used by SDK — skip allowlist entirely for gemini.
  if (provider === 'gemini') return { ok: true };

  let parsedUrl: URL;
  try {
    parsedUrl = new URL(rawEndpoint);
  } catch {
    return { ok: false, error: 'apiEndpoint không phải là một URL hợp lệ.' };
  }
  const hostname = parsedUrl.hostname.toLowerCase();
  const isAllowed = OPENAI_ALLOWED_DOMAINS.some(
    (allowed) => hostname === allowed || hostname.endsWith(`.${allowed}`)
  );
  if (!isAllowed) {
    return {
      ok: false,
      error: `Tên miền endpoint '${hostname}' không nằm trong danh sách được phép. Chỉ cho phép: ${OPENAI_ALLOWED_DOMAINS.join(', ')}`,
    };
  }
  return { ok: true, hostname };
}

// Endpoint: AI Image Style, Background, Lighting & Composition Analyzer (multi-provider)
app.post('/api/gemini/analyze-style', aiLimiter, async (req, res) => {
  try {
    const parsed = analyzeStyleSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({
        error: 'Dữ liệu đầu vào không hợp lệ',
        details: parsed.error.issues.map((i) => `${i.path.join('.')}: ${i.message}`).join(', '),
      });
    }

    const { provider = 'gemini', imageBase64, mimeType = 'image/jpeg', userFocus, model, apiKey, apiEndpoint } = parsed.data;

    // Resolve effective key & model
    const effectiveModel = (model && model.trim()) ||
      (provider === 'gemini' ? 'gemini-3.7-flash' :
        provider === 'anthropic' ? 'claude-3-5-sonnet-latest' : 'gpt-4o');

    let effectiveKey = (apiKey && apiKey.trim()) || '';
    if (!effectiveKey) {
      if (provider === 'gemini') effectiveKey = process.env.GEMINI_API_KEY || '';
    }
    if (!effectiveKey) {
      return res.status(200).json({
        fallback: true,
        message: `Chưa cấu hình API Key cho provider '${provider}'. Sử dụng visual engine tích hợp.`,
      });
    }

    // Allowlist validation (only for non-gemini)
    if (apiEndpoint) {
      const v = validateCustomEndpoint(apiEndpoint, provider);
      if (!v.ok) {
        return res.status(400).json({ error: v.error, success: false });
      }
    }

    let result: { analysis: any; source: string };
    try {
      if (provider === 'gemini') {
        result = await analyzeWithGemini({
          apiKey: effectiveKey,
          model: effectiveModel,
          imageBase64,
          mimeType,
          userFocus,
        });
      } else if (provider === 'openai') {
        result = await analyzeWithOpenAI({
          apiKey: effectiveKey,
          model: effectiveModel,
          apiEndpoint,
          imageBase64,
          mimeType,
          userFocus,
        });
      } else if (provider === 'anthropic') {
        result = await analyzeWithAnthropic({
          apiKey: effectiveKey,
          model: effectiveModel,
          apiEndpoint,
          imageBase64,
          mimeType,
          userFocus,
        });
      } else {
        return res.status(400).json({ error: `Provider không hợp lệ: ${provider}`, success: false });
      }
    } catch (providerErr: any) {
      console.warn(`Analyze via ${provider} failed, fallback to visual engine:`, providerErr?.message);
      return res.status(200).json({
        fallback: true,
        message: providerErr?.message || `Phân tích qua ${provider} thất bại. Đã chuyển sang visual engine.`,
      });
    }

    return res.json({
      success: true,
      analysis: result.analysis,
      source: result.source,
    });
  } catch (error: any) {
    console.error('Error in analyze-style handler:', error);
    return res.status(200).json({
      fallback: true,
      error: error?.message || 'Failed to analyze image style',
    });
  }
});

// Helper to map aspect ratios
function mapAspectRatioToStandard(ratio: string): '1:1' | '16:9' | '9:16' | '4:3' | '3:4' {
  switch (ratio) {
    case '16:9':
      return '16:9';
    case '9:16':
      return '9:16';
    case '4:3':
      return '4:3';
    case '3:2':
      return '4:3';
    case '1:1':
    case 'original':
    default:
      return '1:1';
  }
}

// --- IMAGE GENERATION PROVIDERS ---

interface GenerateParams {
  prompt: string;
  negativePrompt?: string | null;
  aspectRatio: '1:1' | '16:9' | '9:16' | '4:3' | '3:4';
  variations: number;
  quality: 'standard' | 'high' | 'raw';
  seed: string;
  sourceImageBase64?: string | null;
  referenceImageBase64?: string | null;
  apiKey: string;
  apiEndpoint?: string | null;
  model: string;
}

interface GeneratedVariant {
  url: string;
  seed: string;
  modelUsed: string;
}

async function generateWithGemini(p: GenerateParams): Promise<GeneratedVariant[]> {
  const ai = new GoogleGenAI({
    apiKey: p.apiKey,
    httpOptions: { headers: { 'User-Agent': 'aistudio-build' } },
  });
  const out: GeneratedVariant[] = [];
  const baseSeed = p.seed && p.seed !== '-1' ? parseInt(p.seed, 10) : Math.floor(Math.random() * 900000) + 100000;

  for (let i = 0; i < p.variations; i++) {
    const itemSeed = (baseSeed + i * 1337).toString();
    const parts: any[] = [];
    if (p.sourceImageBase64) {
      parts.push({
        inlineData: {
          mimeType: 'image/jpeg',
          data: p.sourceImageBase64.replace(/^data:image\/[a-zA-Z0-9+]+;base64,/, ''),
        },
      });
    }
    if (p.referenceImageBase64) {
      parts.push({
        inlineData: {
          mimeType: 'image/jpeg',
          data: p.referenceImageBase64.replace(/^data:image\/[a-zA-Z0-9+]+;base64,/, ''),
        },
      });
    }
    parts.push({ text: p.prompt });

    try {
      const response = await ai.models.generateContent({
        model: p.model,
        contents: { parts },
        config: {
          imageConfig: { aspectRatio: p.aspectRatio },
        },
      });
      const candidates = response.candidates;
      if (candidates && candidates[0]?.content?.parts) {
        for (const part of candidates[0].content.parts) {
          if (part.inlineData?.data) {
            const mime = part.inlineData.mimeType || 'image/png';
            out.push({
              url: `data:${mime};base64,${part.inlineData.data}`,
              seed: itemSeed,
              modelUsed: `Google Gemini ${p.model}`,
            });
            break;
          }
        }
      }
    } catch (err: any) {
      console.warn(`Gemini generate (${p.model}) variant ${i} failed:`, err?.message);
      throw err;
    }
  }
  return out;
}

async function generateWithOpenAI(p: GenerateParams): Promise<GeneratedVariant[]> {
  const endpoint =
    (p.apiEndpoint?.replace(/\/$/, '') || 'https://api.openai.com/v1') + '/images/generations';
  const sizeMap: Record<string, string> = {
    '1:1': '1024x1024',
    '16:9': '1792x1024',
    '9:16': '1024x1792',
    '4:3': '1024x1024',
    '3:4': '1024x1024',
  };
  const response = await fetch(endpoint, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${p.apiKey}`,
    },
    body: JSON.stringify({
      model: p.model,
      prompt: p.prompt,
      n: p.variations,
      size: sizeMap[p.aspectRatio] || '1024x1024',
      quality: p.quality === 'standard' ? 'standard' : 'hd',
    }),
  });

  if (!response.ok) {
    const errText = await response.text().catch(() => '');
    throw new Error(`OpenAI generate failed (${response.status}): ${errText.slice(0, 300)}`);
  }
  const data: any = await response.json();
  const baseSeed = p.seed && p.seed !== '-1' ? parseInt(p.seed, 10) : Math.floor(Math.random() * 900000) + 100000;
  const out: GeneratedVariant[] = [];
  if (Array.isArray(data?.data)) {
    data.data.forEach((item: any, idx: number) => {
      const url = item?.url || (item?.b64_json ? `data:image/png;base64,${item.b64_json}` : '');
      if (url) {
        out.push({
          url,
          seed: (baseSeed + idx * 941).toString(),
          modelUsed: `OpenAI ${p.model}`,
        });
      }
    });
  }
  if (out.length === 0) throw new Error('OpenAI did not return any image data.');
  return out;
}

// Endpoint: AI Image Generation (multi-provider; no Pollinations fallback)
app.post('/api/generate-image', aiLimiter, async (req, res) => {
  try {
    const parsed = generateImageSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({
        error: 'Dữ liệu đầu vào không hợp lệ',
        details: parsed.error.issues.map((i) => `${i.path.join('.')}: ${i.message}`).join(', '),
        success: false,
      });
    }

    const {
      prompt,
      negativePrompt,
      aspectRatio = '1:1',
      variations = 1,
      quality = 'high',
      seed = '-1',
      sourceImageBase64,
      referenceImageBase64,
      provider = 'gemini',
      apiKey,
      apiEndpoint,
      model,
    } = parsed.data;

    // Anthropic does not support image generation
    if (provider === 'anthropic') {
      return res.status(400).json({
        error: 'Anthropic không hỗ trợ sinh ảnh. Vui lòng chọn profile Gemini hoặc OpenAI.',
        success: false,
      });
    }

    // Resolve effective key & model
    const effectiveModel = (model && model.trim()) ||
      (provider === 'gemini' ? 'imagen-3.0-generate-002' : 'gpt-image-1');
    let effectiveKey = (apiKey && apiKey.trim()) || '';
    if (!effectiveKey) {
      if (provider === 'gemini') effectiveKey = process.env.GEMINI_API_KEY || '';
    }
    if (!effectiveKey) {
      return res.status(400).json({
        error: `Chưa cấu hình API Key cho provider '${provider}'. Vui lòng thêm key trong Settings.`,
        success: false,
      });
    }

    // Allowlist validation
    if (apiEndpoint) {
      const v = validateCustomEndpoint(apiEndpoint, provider);
      if (!v.ok) {
        return res.status(400).json({ error: v.error, success: false });
      }
    }

    const trimmedPrompt = prompt.trim();
    const effectiveNegative = negativePrompt ? ` [Avoid: ${negativePrompt}]` : '';
    const fullPrompt = `${trimmedPrompt}${effectiveNegative}`;
    const mappedRatio = mapAspectRatioToStandard(aspectRatio);
    const count = Math.min(Math.max(Number(variations) || 1, 1), 4);

    const baseSeed = seed && seed !== '-1' ? parseInt(seed, 10) : Math.floor(Math.random() * 900000) + 100000;

    let generatedImages: GeneratedVariant[] = [];

    try {
      if (provider === 'gemini') {
        generatedImages = await generateWithGemini({
          prompt: fullPrompt,
          aspectRatio: mappedRatio,
          variations: count,
          quality,
          seed,
          sourceImageBase64,
          referenceImageBase64,
          apiKey: effectiveKey,
          apiEndpoint,
          model: effectiveModel,
        });
      } else if (provider === 'openai') {
        generatedImages = await generateWithOpenAI({
          prompt: fullPrompt,
          aspectRatio: mappedRatio,
          variations: count,
          quality,
          seed,
          sourceImageBase64,
          referenceImageBase64,
          apiKey: effectiveKey,
          apiEndpoint,
          model: effectiveModel,
        });
      } else {
        return res.status(400).json({ error: `Provider không hỗ trợ sinh ảnh: ${provider}`, success: false });
      }
    } catch (genErr: any) {
      console.error(`Generate via ${provider} failed:`, genErr?.message);
      return res.status(500).json({
        error: genErr?.message || `Sinh ảnh qua ${provider} thất bại. Vui lòng thử lại hoặc đổi profile.`,
        success: false,
      });
    }

    if (generatedImages.length === 0) {
      return res.status(500).json({
        error: `Provider '${provider}' không trả về ảnh nào. Vui lòng thử lại hoặc đổi profile.`,
        success: false,
      });
    }

    void baseSeed; // keep for future use

    return res.json({
      success: true,
      prompt: trimmedPrompt,
      images: generatedImages,
      aspectRatio: mappedRatio,
      count: generatedImages.length,
      createdAt: new Date().toISOString(),
    });
  } catch (error: any) {
    console.error('Generate image error:', error);
    return res.status(500).json({
      error: error?.message || 'Failed to generate image',
      success: false,
    });
  }
});

// Vite / Static Assets Handling
async function startServer() {
  if (process.env.NODE_ENV !== 'production') {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`HinhanhAI Server running on port ${PORT}`);
  });
}

startServer();
