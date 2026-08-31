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
  password: z.string().min(1, 'Mật khẩu không được để trống').max(200, 'Mật khẩu quá dài'),
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

// --- ZOD INPUT VALIDATION SCHEMAS ---

const analyzeStyleSchema = z.object({
  imageBase64: z.string().min(1, 'Ảnh phân tích không được để trống'),
  mimeType: z.string().max(100).optional().default('image/jpeg'),
  userFocus: z.string().max(2000).optional().nullable(),
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
  model: z.string().max(150).optional(),
  provider: z.enum(['gemini', 'openai', 'custom']).optional().default('gemini'),
  customApiKey: z.string().max(500).optional().nullable(),
  customEndpoint: z.string().max(500).optional().nullable(),
  customHeaders: z.record(z.string(), z.string()).optional().nullable(),
  sourceImageBase64: z.string().optional().nullable(),
  referenceImageBase64: z.string().optional().nullable(),
});

// Endpoint: AI Image Style, Background, Lighting & Composition Analyzer
app.post('/api/gemini/analyze-style', aiLimiter, async (req, res) => {
  try {
    const parsed = analyzeStyleSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({
        error: 'Dữ liệu đầu vào không hợp lệ',
        details: parsed.error.issues.map((i) => `${i.path.join('.')}: ${i.message}`).join(', '),
      });
    }

    const { imageBase64, mimeType = 'image/jpeg', userFocus } = parsed.data;

    const ai = getGeminiClient();
    if (!ai) {
      // Return structured fallback flag so client can use visual engine
      return res.status(200).json({
        fallback: true,
        message: 'No GEMINI_API_KEY detected on server. Using built-in visual intelligence engine.',
      });
    }

    // Clean base64 string
    const cleanBase64 = imageBase64.replace(/^data:image\/[a-zA-Z0-9+]+;base64,/, '');

    const promptText = `
You are an elite creative director, cinematographer, and visual AI prompt engineer.
Analyze the provided image in comprehensive, professional detail for the following aspects:
1. Overall Art Style & Aesthetic (Phong cách tổng thể)
2. In-Depth Background & Environment Breakdown (Phân tích bối cảnh cực kỳ chi tiết):
   - Setting type (ví dụ: Lâu đài cổ Gothic Châu Âu, Biệt thự cổ điển, Studio tối giản, Loft tường xi măng mộc...)
   - Architectural style (Phong cách kiến trúc, vòm cửa, cột trụ, ban công...)
   - Objects and Props (Liệt kê tỉ mỉ mọi đồ vật, đạo cụ: Đèn chùm cổ điển, Đèn dầu/đèn bão, Tường xi măng tróc sơn, Tường đá rêu phong, Cửa sổ kính hoa đồng, Rèm nhung, Lò sưởi, Tranh cổ mạ vàng, Bình hoa...)
   - Materials & Textures (Vật liệu: Xi măng thô, Đá cổ phong hóa, Gỗ sồi mộc, Kim loại đồng gỉ, Thủy tinh pha lê...)
   - Atmosphere & Environmental mood (Bầu không khí: Sương mù huyền bí, Bụi bay lơ lửng trong vạt nắng, Ánh nến lung linh...)
   - Depth of field (Độ sâu trường ảnh DOF, Bokeh)
3. Lighting & Illumination (Ánh sáng: hướng sáng, nguồn sáng, nhiệt độ màu, độ gắt/dịu, bóng đổ Chiaroscuro...)
4. Camera & Optical Composition (Góc máy, bố cục, tiêu cự ống kính đề xuất, khẩu độ)
5. Color Palette & Mood (Bảng màu chủ đạo, các mã HEX nổi bật, tông cảm xúc, Color grading)
6. Subject & Textures (Chủ thể, thần thái, chất liệu bề mặt)
7. Modular Prompt Snippets (Từng mảnh ghép prompt độc lập để người dùng có thể tùy ý tích chọn từng phần ghép vào prompt):
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

${userFocus ? `User specific focus request: "${userFocus}"` : ''}

Respond strictly in JSON format matching the schema.
`;

    let response: any = null;
    let usedModel = 'gemini-3.7-flash';

    // 1. Try gemini-3.7-flash first
    try {
      response = await ai.models.generateContent({
        model: 'gemini-3.7-flash',
        contents: {
          parts: [
            {
              inlineData: {
                mimeType: mimeType || 'image/jpeg',
                data: cleanBase64,
              },
            },
            {
              text: promptText,
            },
          ],
        },
        config: {
          systemInstruction:
            'You are a world-class cinematographer and AI art director. Provide exceptionally deep, evocative visual analysis in Vietnamese with modular and master English/Vietnamese prompt snippets.',
          responseMimeType: 'application/json',
          responseSchema: {
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
                  promptSnippetVi: { type: Type.STRING, description: 'Đoạn mô tả tiếng Việt riêng cho ánh sáng' },
                },
                required: ['sourceType', 'direction', 'colorTemperature', 'quality', 'detailedAnalysis'],
              },
              background: {
                type: Type.OBJECT,
                properties: {
                  settingType: { type: Type.STRING, description: 'Loại bối cảnh chính (ví dụ: Lâu đài cổ Gothic, Biệt thự cổ điển, Studio tường xi măng thô...)' },
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
                        name: { type: Type.STRING, description: 'Tên vật thể (ví dụ: Đèn chùm cổ điển, Tường xi măng mộc, Khung tranh dát vàng...)' },
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
                    description: 'Các chất liệu nhận diện được (ví dụ: Xi măng thô, Đá cổ phong hóa, Gỗ mun, Thủy tinh pha lê...)',
                  },
                  atmosphere: { type: Type.STRING, description: 'Bầu không khí & hiệu ứng môi trường (Sương mù, bụi nắng, lung linh...)' },
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
          },
        },
      });
    } catch (primaryErr: any) {
      console.warn('gemini-3.7-flash busy/unavailable, trying gemini-3.1-flash-lite fallback:', primaryErr?.message);
      // 2. Try gemini-3.1-flash-lite fallback
      try {
        usedModel = 'gemini-3.1-flash-lite';
        response = await ai.models.generateContent({
          model: 'gemini-3.1-flash-lite',
          contents: {
            parts: [
              {
                inlineData: {
                  mimeType: mimeType || 'image/jpeg',
                  data: cleanBase64,
                },
              },
              {
                text: promptText,
              },
            ],
          },
          config: {
            systemInstruction:
              'You are a world-class cinematographer and AI art director. Provide exceptionally deep visual analysis in Vietnamese with modular prompt snippets.',
            responseMimeType: 'application/json',
          },
        });
      } catch (secondaryErr: any) {
        console.warn('Secondary fallback model also encountered issue:', secondaryErr?.message);
      }
    }

    if (response && response.text) {
      const resultJson = JSON.parse(response.text || '{}');
      return res.json({
        success: true,
        analysis: resultJson,
        source: usedModel,
      });
    }

    // If both remote Gemini calls were throttled or unavailable, return fallback flag cleanly
    return res.status(200).json({
      fallback: true,
      message: 'Gemini service is temporarily under high demand, utilizing intelligent visual engine.',
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

// Endpoint: AI Image Generation (Gemini 3.1 Flash Image, Imagen 3, OpenAI, or Live Generative Engine)
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
      customApiKey,
      provider = 'gemini',
      customEndpoint,
    } = parsed.data;

    // Validate customEndpoint domain against allowlist if provided
    if (customEndpoint) {
      try {
        const parsedUrl = new URL(customEndpoint);
        const hostname = parsedUrl.hostname.toLowerCase();
        const isAllowed = OPENAI_ALLOWED_DOMAINS.some(
          (allowed) => hostname === allowed || hostname.endsWith(`.${allowed}`)
        );

        if (!isAllowed) {
          return res.status(400).json({
            error: `Tên miền endpoint '${hostname}' không nằm trong danh sách được phép. Chỉ cho phép các domain: ${OPENAI_ALLOWED_DOMAINS.join(
              ', '
            )}`,
            success: false,
          });
        }
      } catch (urlErr) {
        return res.status(400).json({
          error: 'customEndpoint không phải là một URL hợp lệ.',
          success: false,
        });
      }
    }

    const trimmedPrompt = prompt.trim();
    const effectiveNegative = negativePrompt ? ` [Avoid: ${negativePrompt}]` : '';
    const fullPrompt = `${trimmedPrompt}${effectiveNegative}`;
    const mappedRatio = mapAspectRatioToStandard(aspectRatio);
    const count = Math.min(Math.max(Number(variations) || 1, 1), 4);
    const baseSeed = seed && seed !== '-1' ? parseInt(seed, 10) : Math.floor(Math.random() * 900000) + 100000;

    const generatedImages: {
      url: string;
      seed: string;
      modelUsed: string;
      isFallbackEngine: boolean;
    }[] = [];

    // 1. Try Gemini / Imagen if provider is gemini or default
    const geminiKey = customApiKey || process.env.GEMINI_API_KEY;
    if (provider === 'gemini' && geminiKey) {
      const ai = new GoogleGenAI({
        apiKey: geminiKey,
        httpOptions: {
          headers: {
            'User-Agent': 'aistudio-build',
          },
        },
      });

      // Try generating requested variations
      for (let i = 0; i < count; i++) {
        const itemSeed = (baseSeed + i * 1337).toString();
        let imageSuccess = false;

        // Try gemini-3.1-flash-image with image editing/generation capability (paid tier)
        try {
          const parts: any[] = [];

          if (sourceImageBase64) {
            parts.push({
              inlineData: {
                mimeType: 'image/jpeg',
                data: sourceImageBase64.replace(/^data:image\/[a-zA-Z0-9+]+;base64,/, ''),
              },
            });
          }

          if (referenceImageBase64) {
            parts.push({
              inlineData: {
                mimeType: 'image/jpeg',
                data: referenceImageBase64.replace(/^data:image\/[a-zA-Z0-9+]+;base64,/, ''),
              },
            });
          }

          parts.push({
            text: fullPrompt,
          });

          const response = await ai.models.generateContent({
            model: 'gemini-3.1-flash-image',
            contents: { parts },
            config: {
              imageConfig: {
                aspectRatio: mappedRatio,
              },
            },
          });

          const candidates = response.candidates;
          if (candidates && candidates[0]?.content?.parts) {
            for (const part of candidates[0].content.parts) {
              if (part.inlineData?.data) {
                const mime = part.inlineData.mimeType || 'image/png';
                generatedImages.push({
                  url: `data:${mime};base64,${part.inlineData.data}`,
                  seed: itemSeed,
                  modelUsed: 'Google Gemini 3.1 Flash Image',
                  isFallbackEngine: false,
                });
                imageSuccess = true;
                break;
              }
            }
          }
        } catch (flashErr: any) {
          // Free tier has quota limit 0 for gemini-3.1-flash-image; fallback to synthesis engine
          console.log('Gemini 3.1 flash image not available or quota limit 0, using fallback synthesis');
        }
      }
    }

    // 2. If Custom OpenAI-compatible / DALL-E provider
    if (provider === 'openai' && customApiKey) {
      try {
        const sizeMap: Record<string, string> = {
          '1:1': '1024x1024',
          '16:9': '1792x1024',
          '9:16': '1024x1792',
          '4:3': '1024x1024',
          '3:2': '1792x1024',
        };
        const endpoint = customEndpoint || 'https://api.openai.com/v1/images/generations';
        const response = await fetch(endpoint, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${customApiKey}`,
          },
          body: JSON.stringify({
            model: 'dall-e-3',
            prompt: fullPrompt,
            n: 1,
            size: sizeMap[mappedRatio] || '1024x1024',
            quality: quality === 'raw' || quality === 'high' ? 'hd' : 'standard',
          }),
        });
        const data = await response.json();
        if (data.data && data.data[0]?.url) {
          generatedImages.push({
            url: data.data[0].url,
            seed: baseSeed.toString(),
            modelUsed: 'OpenAI DALL-E 3',
            isFallbackEngine: false,
          });
        }
      } catch (openAiErr: any) {
        console.error('OpenAI generation error:', openAiErr?.message);
      }
    }

    // 3. Fallback Engine (Pollinations): Used when primary Gemini and OpenAI are unavailable
    // Transparently tagged with modelUsed and isFallbackEngine: true
    if (generatedImages.length === 0) {
      let width = 1024;
      let height = 1024;
      if (mappedRatio === '16:9') {
        width = 1280;
        height = 720;
      } else if (mappedRatio === '9:16') {
        width = 720;
        height = 1280;
      } else if (mappedRatio === '4:3') {
        width = 1152;
        height = 864;
      } else if (mappedRatio === '3:4') {
        width = 864;
        height = 1152;
      }

      for (let i = 0; i < count; i++) {
        const itemSeed = baseSeed + i * 941;
        // Construct neural synthesis URL from the user's exact prompt
        const encodedPrompt = encodeURIComponent(
          `${trimmedPrompt}, masterpiece, highly detailed, photorealistic, 8k resolution, cinematic lighting${
            negativePrompt ? `, avoid ${negativePrompt}` : ''
          }`
        );
        const liveAiUrl = `https://image.pollinations.ai/prompt/${encodedPrompt}?width=${width}&height=${height}&seed=${itemSeed}&nologo=true&enhance=true&model=flux`;

        generatedImages.push({
          url: liveAiUrl,
          seed: itemSeed.toString(),
          modelUsed: 'Public Fallback Engine (Pollinations)',
          isFallbackEngine: true,
        });
      }
    }

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
