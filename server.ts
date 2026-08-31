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
    error: 'Báº¡n Ä‘Ã£ gá»­i quÃ¡ nhiá»u yÃªu cáº§u Ä‘áº¿n há»‡ thá»‘ng. Vui lÃ²ng thá»­ láº¡i sau Ã­t phÃºt.',
  },
});

// 2. Strict rate limiter for AI-intensive generation & style analysis endpoints
const aiLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: Number(process.env.AI_RATE_LIMIT_MAX) || 20, // limit each IP to 20 AI requests / 15 mins
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    error: 'Báº¡n Ä‘Ã£ Ä‘áº¡t giá»›i háº¡n yÃªu cáº§u AI (tá»‘i Ä‘a 20 yÃªu cáº§u / 15 phÃºt). Vui lÃ²ng thá»­ láº¡i sau.',
  },
});

// 3. Login attempt rate limiter
const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 15,
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    error: 'ÄÃ£ thá»­ Ä‘Äƒng nháº­p quÃ¡ nhiá»u láº§n. Vui lÃ²ng Ä‘á»£i 15 phÃºt trÆ°á»›c khi thá»­ láº¡i.',
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
      error: 'YÃªu cáº§u xÃ¡c thá»±c. Vui lÃ²ng Ä‘Äƒng nháº­p Ä‘á»ƒ tiáº¿p tá»¥c.',
      code: 'UNAUTHORIZED',
    });
  }

  try {
    const decoded = jwt.verify(token, JWT_SECRET);
    req.user = decoded;
    next();
  } catch (err: any) {
    return res.status(401).json({
      error: 'MÃ£ xÃ¡c thá»±c Ä‘Ã£ háº¿t háº¡n hoáº·c khÃ´ng há»£p lá»‡. Vui lÃ²ng Ä‘Äƒng nháº­p láº¡i.',
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
  password: z.string().min(1, 'Máº­t kháº©u khÃ´ng Ä‘Æ°á»£c Ä‘á»ƒ trá»‘ng').max(200, 'Máº­t kháº©u quÃ¡ dÃ i'),
});

// POST /api/login (Public with loginLimiter)
app.post('/api/login', loginLimiter, (req, res) => {
  const parsed = loginSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({
      error: 'Dá»¯ liá»‡u khÃ´ng há»£p lá»‡',
      details: parsed.error.issues.map((i) => i.message).join(', '),
    });
  }

  const { password } = parsed.data;

  // Constant-time like comparison or direct string equality check
  if (password !== APP_PASSWORD) {
    return res.status(401).json({
      error: 'MÃ£ truy cáº­p khÃ´ng há»£p lá»‡. Vui lÃ²ng kiá»ƒm tra láº¡i.',
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
  imageBase64: z.string().min(1, 'áº¢nh phÃ¢n tÃ­ch khÃ´ng Ä‘Æ°á»£c Ä‘á»ƒ trá»‘ng'),
  mimeType: z.string().max(100).optional().default('image/jpeg'),
  userFocus: z.string().max(2000).optional().nullable(),
});

const ANALYSIS_RESPONSE_SCHEMA = {
  type: Type.OBJECT,
  properties: {
    styleName: { type: Type.STRING, description: 'TÃªn phong cÃ¡ch' },
    genre: { type: Type.STRING, description: 'Thá»ƒ loáº¡i nghá»‡ thuáº­t' },
    styleDescription: { type: Type.STRING, description: 'MÃ´ táº£ chi tiáº¿t phong cÃ¡ch' },
    lighting: {
      type: Type.OBJECT,
      properties: {
        sourceType: { type: Type.STRING, description: 'Nguá»“n sÃ¡ng' },
        direction: { type: Type.STRING, description: 'HÆ°á»›ng sÃ¡ng' },
        colorTemperature: { type: Type.STRING, description: 'Nhiá»‡t Ä‘á»™ mÃ u' },
        quality: { type: Type.STRING, description: 'Äá»™ má»m/gáº¯t' },
        detailedAnalysis: { type: Type.STRING, description: 'PhÃ¢n tÃ­ch chi tiáº¿t Ã¡nh sÃ¡ng vÃ  bÃ³ng Ä‘á»•' },
        promptSnippetEn: { type: Type.STRING, description: 'Äoáº¡n prompt tiáº¿ng Anh riÃªng cho Ã¡nh sÃ¡ng' },
        promptSnippetVi: { type: Type.STRING, description: 'Äoáº¡n mÃ´ táº£ tiáº¿ng Viá»‡t riÃªng cho Ã¡nh sÃ¡ng' },
      },
      required: ['sourceType', 'direction', 'colorTemperature', 'quality', 'detailedAnalysis'],
    },
    background: {
      type: Type.OBJECT,
      properties: {
        settingType: { type: Type.STRING, description: 'Loáº¡i bá»‘i cáº£nh chÃ­nh' },
        architecturalStyle: { type: Type.STRING, description: 'Phong cÃ¡ch kiáº¿n trÃºc' },
        depthOfField: { type: Type.STRING, description: 'Äá»™ sÃ¢u trÆ°á»ng áº£nh' },
        elements: { type: Type.ARRAY, items: { type: Type.STRING } },
        objectsAndProps: {
          type: Type.ARRAY,
          items: {
            type: Type.OBJECT,
            properties: {
              name: { type: Type.STRING, description: 'TÃªn váº­t thá»ƒ' },
              category: { type: Type.STRING, description: 'NhÃ³m váº­t thá»ƒ' },
              description: { type: Type.STRING, description: 'MÃ´ táº£ chi tiáº¿t váº­t thá»ƒ' },
              promptSnippet: { type: Type.STRING, description: 'Máº£nh prompt tiáº¿ng Anh' },
            },
            required: ['name'],
          },
        },
        materials: { type: Type.ARRAY, items: { type: Type.STRING } },
        atmosphere: { type: Type.STRING, description: 'Báº§u khÃ´ng khÃ­' },
        detailedAnalysis: { type: Type.STRING, description: 'PhÃ¢n tÃ­ch chi tiáº¿t bá»‘i cáº£nh' },
        promptSnippetEn: { type: Type.STRING, description: 'Prompt tiáº¿ng Anh cho bá»‘i cáº£nh' },
        promptSnippetVi: { type: Type.STRING, description: 'Prompt tiáº¿ng Viá»‡t cho bá»‘i cáº£nh' },
      },
      required: ['settingType', 'depthOfField', 'elements', 'detailedAnalysis'],
    },
    camera: {
      type: Type.OBJECT,
      properties: {
        shotType: { type: Type.STRING, description: 'GÃ³c chá»¥p' },
        lensSuggestion: { type: Type.STRING, description: 'á»ng kÃ­nh gá»£i Ã½' },
        compositionRule: { type: Type.STRING, description: 'Quy táº¯c bá»‘ cá»¥c' },
        detailedAnalysis: { type: Type.STRING, description: 'PhÃ¢n tÃ­ch camera' },
        promptSnippetEn: { type: Type.STRING, description: 'Prompt tiáº¿ng Anh cho camera' },
        promptSnippetVi: { type: Type.STRING, description: 'Prompt tiáº¿ng Viá»‡t cho camera' },
      },
      required: ['shotType', 'lensSuggestion', 'compositionRule', 'detailedAnalysis'],
    },
    colorPalette: {
      type: Type.OBJECT,
      properties: {
        dominantMood: { type: Type.STRING, description: 'TÃ´ng cáº£m xÃºc chÃ­nh' },
        hexColors: {
          type: Type.ARRAY,
          items: {
            type: Type.OBJECT,
            properties: {
              hex: { type: Type.STRING, description: 'MÃ£ mÃ u HEX' },
              name: { type: Type.STRING, description: 'TÃªn mÃ u sáº¯c' },
              role: { type: Type.STRING, description: 'Vai trÃ² mÃ u sáº¯c' },
            },
            required: ['hex', 'name', 'role'],
          },
        },
        colorGrading: { type: Type.STRING, description: 'Phong cÃ¡ch chá»‰nh mÃ u' },
        promptSnippetEn: { type: Type.STRING, description: 'Prompt tiáº¿ng Anh cho mÃ u sáº¯c' },
        promptSnippetVi: { type: Type.STRING, description: 'Prompt tiáº¿ng Viá»‡t cho mÃ u sáº¯c' },
      },
      required: ['dominantMood', 'hexColors', 'colorGrading'],
    },
    subjectDetails: {
      type: Type.OBJECT,
      properties: {
        subjectType: { type: Type.STRING, description: 'Chá»§ thá»ƒ chÃ­nh' },
        poseAndExpression: { type: Type.STRING, description: 'TÆ° tháº¿ vÃ  biá»ƒu cáº£m' },
        texturesAndMaterials: { type: Type.STRING, description: 'Cháº¥t liá»‡u bá» máº·t' },
        promptSnippetEn: { type: Type.STRING, description: 'Prompt tiáº¿ng Anh cho chá»§ thá»ƒ' },
        promptSnippetVi: { type: Type.STRING, description: 'Prompt tiáº¿ng Viá»‡t cho chá»§ thá»ƒ' },
      },
      required: ['subjectType', 'poseAndExpression', 'texturesAndMaterials'],
    },
    recommendedPromptEn: { type: Type.STRING, description: 'Prompt tiáº¿ng Anh tá»‘i Æ°u' },
    recommendedPromptVi: { type: Type.STRING, description: 'Prompt tiáº¿ng Viá»‡t chi tiáº¿t' },
    negativePrompt: { type: Type.STRING, description: 'Negative prompt' },
    suggestedAspectRatio: { type: Type.STRING, description: 'Tá»· lá»‡ khung hÃ¬nh Ä‘á» xuáº¥t' },
    keyTags: { type: Type.ARRAY, items: { type: Type.STRING } },
  },
  required: [
    'styleName', 'genre', 'styleDescription', 'lighting', 'background', 'camera',
    'colorPalette', 'subjectDetails', 'recommendedPromptEn', 'recommendedPromptVi',
    'negativePrompt', 'suggestedAspectRatio', 'keyTags',
  ],
};

const generateImageSchema = z.object({
  prompt: z
    .string()
    .min(1, 'Prompt khÃ´ng Ä‘Æ°á»£c Ä‘á»ƒ trá»‘ng')
    .max(4000, 'Prompt khÃ´ng Ä‘Æ°á»£c vÆ°á»£t quÃ¡ 4000 kÃ½ tá»±'),
  negativePrompt: z.string().max(2000).optional().nullable(),
  aspectRatio: z
    .enum(['original', '1:1', '16:9', '9:16', '4:3', '3:2', '21:9', '3:4', '2:3'])
    .default('1:1'),
  variations: z.number().int().min(1, 'Tá»‘i thiá»ƒu 1 biáº¿n thá»ƒ').max(4, 'Tá»‘i Ä‘a 4 biáº¿n thá»ƒ').default(1),
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
        error: 'Dá»¯ liá»‡u Ä‘áº§u vÃ o khÃ´ng há»£p lá»‡',
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
1. Overall Art Style & Aesthetic (Phong cÃ¡ch tá»•ng thá»ƒ)
2. In-Depth Background & Environment Breakdown (PhÃ¢n tÃ­ch bá»‘i cáº£nh cá»±c ká»³ chi tiáº¿t):
   - Setting type (vÃ­ dá»¥: LÃ¢u Ä‘Ã i cá»• Gothic ChÃ¢u Ã‚u, Biá»‡t thá»± cá»• Ä‘iá»ƒn, Studio tá»‘i giáº£n, Loft tÆ°á»ng xi mÄƒng má»™c...)
   - Architectural style (Phong cÃ¡ch kiáº¿n trÃºc, vÃ²m cá»­a, cá»™t trá»¥, ban cÃ´ng...)
   - Objects and Props (Liá»‡t kÃª tá»‰ má»‰ má»i Ä‘á»“ váº­t, Ä‘áº¡o cá»¥: ÄÃ¨n chÃ¹m cá»• Ä‘iá»ƒn, ÄÃ¨n dáº§u/Ä‘Ã¨n bÃ£o, TÆ°á»ng xi mÄƒng trÃ³c sÆ¡n, TÆ°á»ng Ä‘Ã¡ rÃªu phong, Cá»­a sá»• kÃ­nh hoa Ä‘á»“ng, RÃ¨m nhung, LÃ² sÆ°á»Ÿi, Tranh cá»• máº¡ vÃ ng, BÃ¬nh hoa...)
   - Materials & Textures (Váº­t liá»‡u: Xi mÄƒng thÃ´, ÄÃ¡ cá»• phong hÃ³a, Gá»— sá»“i má»™c, Kim loáº¡i Ä‘á»“ng gá»‰, Thá»§y tinh pha lÃª...)
   - Atmosphere & Environmental mood (Báº§u khÃ´ng khÃ­: SÆ°Æ¡ng mÃ¹ huyá»n bÃ­, Bá»¥i bay lÆ¡ lá»­ng trong váº¡t náº¯ng, Ãnh náº¿n lung linh...)
   - Depth of field (Äá»™ sÃ¢u trÆ°á»ng áº£nh DOF, Bokeh)
3. Lighting & Illumination (Ãnh sÃ¡ng: hÆ°á»›ng sÃ¡ng, nguá»“n sÃ¡ng, nhiá»‡t Ä‘á»™ mÃ u, Ä‘á»™ gáº¯t/dá»‹u, bÃ³ng Ä‘á»• Chiaroscuro...)
4. Camera & Optical Composition (GÃ³c mÃ¡y, bá»‘ cá»¥c, tiÃªu cá»± á»‘ng kÃ­nh Ä‘á» xuáº¥t, kháº©u Ä‘á»™)
5. Color Palette & Mood (Báº£ng mÃ u chá»§ Ä‘áº¡o, cÃ¡c mÃ£ HEX ná»•i báº­t, tÃ´ng cáº£m xÃºc, Color grading)
6. Subject & Textures (Chá»§ thá»ƒ, tháº§n thÃ¡i, cháº¥t liá»‡u bá» máº·t)
7. Modular Prompt Snippets (Tá»«ng máº£nh ghÃ©p prompt Ä‘á»™c láº­p Ä‘á»ƒ ngÆ°á»i dÃ¹ng cÃ³ thá»ƒ tÃ¹y Ã½ tÃ­ch chá»n tá»«ng pháº§n ghÃ©p vÃ o prompt):
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
          responseSchema: ANALYSIS_RESPONSE_SCHEMA,
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
            responseSchema: ANALYSIS_RESPONSE_SCHEMA,
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
        error: 'Dá»¯ liá»‡u Ä‘áº§u vÃ o khÃ´ng há»£p lá»‡',
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
            error: `TÃªn miá»n endpoint '${hostname}' khÃ´ng náº±m trong danh sÃ¡ch Ä‘Æ°á»£c phÃ©p. Chá»‰ cho phÃ©p cÃ¡c domain: ${OPENAI_ALLOWED_DOMAINS.join(
              ', '
            )}`,
            success: false,
          });
        }
      } catch (urlErr) {
        return res.status(400).json({
          error: 'customEndpoint khÃ´ng pháº£i lÃ  má»™t URL há»£p lá»‡.',
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
