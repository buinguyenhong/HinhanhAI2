import crypto from 'node:crypto';
import express, { type NextFunction, type Request, type Response } from 'express';
import { GoogleGenAI, Type } from '@google/genai';

const app = express();
const isProduction = process.env.NODE_ENV === 'production';
const sessionTtlMs = 1000 * 60 * 60 * 12;
const requestWindowMs = 60_000;
const requestLimit = 20;
const requests = new Map<string, { count: number; startedAt: number }>();

app.disable('x-powered-by');
app.use(express.json({ limit: '20mb' }));

function requireEnv(name: string): string {
  const value = process.env[name];
  if (!value) throw new Error(`${name} is not configured`);
  return value;
}

function sign(value: string): string {
  return crypto.createHmac('sha256', requireEnv('SESSION_SECRET')).update(value).digest('base64url');
}

function getCookie(req: Request, name: string): string | undefined {
  const cookies = req.headers.cookie?.split(';') ?? [];
  return cookies.map((value) => value.trim()).find((value) => value.startsWith(`${name}=`))?.slice(name.length + 1);
}

function setSession(res: Response): void {
  const payload = Buffer.from(JSON.stringify({ exp: Date.now() + sessionTtlMs })).toString('base64url');
  const token = `${payload}.${sign(payload)}`;
  res.setHeader('Set-Cookie', `hinhanhai_session=${token}; Path=/; HttpOnly; SameSite=Lax; Max-Age=${sessionTtlMs / 1000}${isProduction ? '; Secure' : ''}`);
}

function clearSession(res: Response): void {
  res.setHeader('Set-Cookie', `hinhanhai_session=; Path=/; HttpOnly; SameSite=Lax; Max-Age=0${isProduction ? '; Secure' : ''}`);
}

function hasValidSession(req: Request): boolean {
  try {
    const token = getCookie(req, 'hinhanhai_session');
    if (!token) return false;
    const [payload, signature] = token.split('.');
    if (!payload || !signature || !crypto.timingSafeEqual(Buffer.from(signature), Buffer.from(sign(payload)))) return false;
    return JSON.parse(Buffer.from(payload, 'base64url').toString()).exp > Date.now();
  } catch {
    return false;
  }
}

function requireAuth(req: Request, res: Response, next: NextFunction): void {
  if (!hasValidSession(req)) {
    res.status(401).json({ error: 'Authentication required' });
    return;
  }
  next();
}

function rateLimit(req: Request, res: Response, next: NextFunction): void {
  const key = req.ip || 'unknown';
  const now = Date.now();
  const entry = requests.get(key);
  if (!entry || now - entry.startedAt > requestWindowMs) {
    requests.set(key, { count: 1, startedAt: now });
    next();
    return;
  }
  entry.count += 1;
  if (entry.count > requestLimit) {
    res.status(429).json({ error: 'Too many requests. Try again in one minute.' });
    return;
  }
  next();
}

function cleanBase64(value: unknown): string | null {
  if (typeof value !== 'string') return null;
  const data = value.replace(/^data:image\/[a-zA-Z0-9+.-]+;base64,/, '');
  if (!data || data.length > 20 * 1024 * 1024 || !/^[A-Za-z0-9+/=]+$/.test(data)) return null;
  return data;
}

function validRemoteEndpoint(value: unknown): string | null {
  if (typeof value !== 'string') return null;
  try {
    const url = new URL(value);
    const host = url.hostname.toLowerCase();
    const blocked = host === 'localhost' || host.endsWith('.local') || /^127\./.test(host) || /^10\./.test(host) || /^192\.168\./.test(host) || /^169\.254\./.test(host) || /^172\.(1[6-9]|2\d|3[0-1])\./.test(host) || host === '::1';
    return url.protocol === 'https:' && !blocked ? url.toString() : null;
  } catch {
    return null;
  }
}

app.post('/api/auth/login', rateLimit, (req, res) => {
  const password = typeof req.body?.password === 'string' ? req.body.password : '';
  const configuredPassword = process.env.APP_PASSWORD;
  if (!configuredPassword || !process.env.SESSION_SECRET) {
    res.status(503).json({ error: 'Authentication is not configured on the server.' });
    return;
  }
  const matches = password.length === configuredPassword.length && crypto.timingSafeEqual(Buffer.from(password), Buffer.from(configuredPassword));
  if (!matches) {
    res.status(401).json({ error: 'Invalid access code.' });
    return;
  }
  setSession(res);
  res.json({ authenticated: true });
});

app.post('/api/auth/logout', (req, res) => {
  clearSession(res);
  res.status(204).end();
});

app.get('/api/auth/session', (req, res) => {
  res.json({ authenticated: hasValidSession(req) });
});

app.get('/api/health', (req, res) => res.json({ status: 'ok' }));

app.use('/api', requireAuth, rateLimit);

app.post('/api/gemini/analyze-style', async (req, res) => {
  try {
    const image = cleanBase64(req.body?.imageBase64);
    if (!image) return res.status(400).json({ error: 'A valid image smaller than 15 MB is required.' });
    const apiKey = requireEnv('GEMINI_API_KEY');
    const ai = new GoogleGenAI({ apiKey });
    const response = await ai.models.generateContent({
      model: 'gemini-2.5-flash',
      contents: { parts: [{ inlineData: { data: image, mimeType: req.body?.mimeType || 'image/jpeg' } }, { text: 'Analyze this image for visual style, lighting, composition, color palette, and create English and Vietnamese generation prompts. Return JSON only.' }] },
      config: { responseMimeType: 'application/json', responseSchema: { type: Type.OBJECT, properties: { styleName: { type: Type.STRING }, genre: { type: Type.STRING }, styleDescription: { type: Type.STRING }, recommendedPromptEn: { type: Type.STRING }, recommendedPromptVi: { type: Type.STRING }, negativePrompt: { type: Type.STRING }, suggestedAspectRatio: { type: Type.STRING }, keyTags: { type: Type.ARRAY, items: { type: Type.STRING } } }, required: ['styleName', 'genre', 'styleDescription', 'recommendedPromptEn', 'recommendedPromptVi', 'negativePrompt', 'suggestedAspectRatio', 'keyTags'] } },
    });
    if (!response.text) throw new Error('Gemini returned no analysis.');
    res.json({ success: true, analysis: JSON.parse(response.text), source: 'Gemini 2.5 Flash' });
  } catch (error) {
    console.error('Style analysis failed:', error instanceof Error ? error.message : 'Unknown error');
    res.status(502).json({ error: 'Style analysis failed. Please try again.' });
  }
});

app.post('/api/generate-image', async (req, res) => {
  try {
    const prompt = typeof req.body?.prompt === 'string' ? req.body.prompt.trim() : '';
    const provider = req.body?.provider;
    const apiKey = typeof req.body?.apiKey === 'string' ? req.body.apiKey.trim() : '';
    const count = Math.min(Math.max(Number(req.body?.variations) || 1, 1), 4);
    if (!prompt || prompt.length > 8_000) return res.status(400).json({ error: 'A prompt of up to 8,000 characters is required.' });
    if (provider !== 'gemini' && provider !== 'openai') return res.status(400).json({ error: 'Unsupported provider.' });

    if (provider === 'gemini') {
      const ai = new GoogleGenAI({ apiKey: apiKey || requireEnv('GEMINI_API_KEY') });
      const images: { url: string; seed: string; modelUsed: string }[] = [];
      for (let index = 0; index < count; index += 1) {
        const parts: any[] = [];
        const source = cleanBase64(req.body?.sourceImageBase64);
        const reference = cleanBase64(req.body?.referenceImageBase64);
        if (source) parts.push({ inlineData: { mimeType: 'image/jpeg', data: source } });
        if (reference) parts.push({ inlineData: { mimeType: 'image/jpeg', data: reference } });
        parts.push({ text: `${prompt}${req.body?.negativePrompt ? `\nAvoid: ${req.body.negativePrompt}` : ''}` });
        const response = await ai.models.generateContent({ model: 'gemini-2.5-flash-image', contents: { parts }, config: { imageConfig: { aspectRatio: ['1:1', '16:9', '9:16', '4:3', '3:4'].includes(req.body?.aspectRatio) ? req.body.aspectRatio : '1:1' } } });
        const image = response.candidates?.[0]?.content?.parts?.find((part) => part.inlineData?.data)?.inlineData;
        if (!image?.data) throw new Error('The selected Gemini model returned no image.');
        images.push({ url: `data:${image.mimeType || 'image/png'};base64,${image.data}`, seed: String(req.body?.seed || ''), modelUsed: 'Gemini 2.5 Flash Image' });
      }
      res.json({ success: true, images });
      return;
    }

    const endpoint = validRemoteEndpoint(req.body?.apiEndpoint);
    if (!endpoint || !apiKey) return res.status(400).json({ error: 'A HTTPS endpoint and API key are required for a custom provider.' });
    let configuredHeaders: Record<string, string> = {};
    if (typeof req.body?.customHeaders === 'string' && req.body.customHeaders.length <= 4_000) {
      try { configuredHeaders = JSON.parse(req.body.customHeaders); } catch { return res.status(400).json({ error: 'Custom headers must be valid JSON.' }); }
    }
    const headers = Object.fromEntries(Object.entries(configuredHeaders).filter(([key, value]) => typeof value === 'string' && !['host', 'content-length', 'connection'].includes(key.toLowerCase()))) as Record<string, string>;
    const response = await fetch(endpoint, { method: 'POST', headers: { ...headers, 'Content-Type': 'application/json', Authorization: `Bearer ${apiKey}` }, body: JSON.stringify({ model: req.body?.model, prompt, n: count, size: req.body?.aspectRatio === '16:9' ? '1792x1024' : req.body?.aspectRatio === '9:16' ? '1024x1792' : '1024x1024' }) });
    if (!response.ok) throw new Error(`Provider responded with ${response.status}`);
    const payload = await response.json() as { data?: { url?: string; b64_json?: string }[] };
    const images = payload.data?.map((image) => ({ url: image.url || `data:image/png;base64,${image.b64_json}`, seed: '', modelUsed: 'Custom OpenAI-compatible provider' })).filter((image) => image.url && !image.url.endsWith('undefined')) ?? [];
    if (!images.length) throw new Error('The provider returned no images.');
    res.json({ success: true, images });
  } catch (error) {
    console.error('Image generation failed:', error instanceof Error ? error.message : 'Unknown error');
    res.status(502).json({ error: 'Image generation failed. Verify the provider configuration and try again.' });
  }
});

export default app;
