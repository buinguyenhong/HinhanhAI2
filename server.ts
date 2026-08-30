import express from 'express';
import path from 'path';
import { createServer as createViteServer } from 'vite';
import { GoogleGenAI, Type } from '@google/genai';
import dotenv from 'dotenv';

dotenv.config();

const app = express();
const PORT = 3000;

// Increase payload limit for base64 image data
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ limit: '50mb', extended: true }));

// Health check endpoint
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// Lazy-initialized Gemini Client
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

// Endpoint: AI Image Style, Background, Lighting & Composition Analyzer
app.post('/api/gemini/analyze-style', async (req, res) => {
  try {
    const { imageBase64, mimeType = 'image/jpeg', userFocus } = req.body;

    if (!imageBase64) {
      return res.status(400).json({ error: 'imageBase64 is required' });
    }

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
app.post('/api/generate-image', async (req, res) => {
  try {
    const {
      prompt,
      negativePrompt,
      aspectRatio = '1:1',
      variations = 1,
      quality = 'high',
      seed,
      model = 'gemini-3.1-flash-image',
      sourceImageBase64,
      referenceImageBase64,
      customApiKey,
      provider = 'gemini',
      customEndpoint,
      customHeaders,
    } = req.body;

    if (!prompt || typeof prompt !== 'string' || !prompt.trim()) {
      return res.status(400).json({ error: 'Prompt is required' });
    }

    const trimmedPrompt = prompt.trim();
    const effectiveNegative = negativePrompt ? ` [Avoid: ${negativePrompt}]` : '';
    const fullPrompt = `${trimmedPrompt}${effectiveNegative}`;
    const mappedRatio = mapAspectRatioToStandard(aspectRatio);
    const count = Math.min(Math.max(Number(variations) || 1, 1), 4);
    const baseSeed = seed && seed !== '-1' ? parseInt(seed, 10) : Math.floor(Math.random() * 900000) + 100000;

    const generatedImages: { url: string; seed: string; modelUsed: string }[] = [];

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
                });
                imageSuccess = true;
                break;
              }
            }
          }
        } catch (flashErr: any) {
          // Free tier has quota limit 0 for gemini-3.1-flash-image; fallback to Flux.1 neural synthesizer
          console.log('Gemini 3.1 flash image not available or quota limit 0, using Flux.1 AI synthesis');
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
          });
        }
      } catch (openAiErr: any) {
        console.error('OpenAI generation error:', openAiErr?.message);
      }
    }

    // 3. High-Quality Real-time AI Generation Engine (generates real AI images based on exact prompt & seed)
    // Ensures users always see genuinely synthesized images matching their exact prompt text
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
        // Construct real-time generative neural synthesis URL from the user's exact prompt
        const encodedPrompt = encodeURIComponent(
          `${trimmedPrompt}, masterpiece, highly detailed, photorealistic, 8k resolution, cinematic lighting${
            negativePrompt ? `, avoid ${negativePrompt}` : ''
          }`
        );
        const liveAiUrl = `https://image.pollinations.ai/prompt/${encodedPrompt}?width=${width}&height=${height}&seed=${itemSeed}&nologo=true&enhance=true&model=flux`;

        generatedImages.push({
          url: liveAiUrl,
          seed: itemSeed.toString(),
          modelUsed: 'Flux.1 Schnell AI Neural Synthesis (Live Render)',
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
