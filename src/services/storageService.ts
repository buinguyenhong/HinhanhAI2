export type ApiProviderType = 'gemini' | 'flux' | 'stability' | 'openai' | 'custom';

export interface ApiProfile {
  id: string;
  name: string;
  provider: ApiProviderType;
  apiKey: string;
  apiEndpoint: string;
  selectedModel: string;
  customHeaders?: string;
  notes?: string;
  isCustom?: boolean;
  createdAt: string;
}

export interface AppSettings {
  // Theme
  theme: 'dark' | 'light';
  // Active API Profile
  activeProfileId: string;
  // Multiple API Profiles list
  apiProfiles: ApiProfile[];
  // Legacy / fallback fields
  apiProvider: ApiProviderType;
  apiKey: string;
  apiEndpoint: string;
  selectedModel: string;
  // Drive Settings
  driveConnected: boolean;
  driveAccount: string;
  driveFolder: string;
  autoSync: boolean;
  // Default Render Settings
  defaultQuality: 'standard' | 'high' | 'raw';
  defaultRatio: 'original' | '1:1' | '16:9' | '9:16' | '4:3' | '3:2';
  defaultVariations: number;
}

const STORAGE_KEY = 'hinhanhai_app_settings_v3';

export const DEFAULT_PROFILES: ApiProfile[] = [
  {
    id: 'gemini-default',
    name: 'Google Gemini & Imagen 3 (Mặc định)',
    provider: 'gemini',
    apiKey: '',
    apiEndpoint: 'https://generativelanguage.googleapis.com',
    selectedModel: 'imagen-3.0-generate-002',
    notes: 'Tích hợp sẵn qua Google AI Studio / Gemini API',
    isCustom: false,
    createdAt: '2026-01-01',
  },
  {
    id: 'flux-dev',
    name: 'Flux.1 Dev Editorial',
    provider: 'flux',
    apiKey: '',
    apiEndpoint: 'https://api.bfl.ml/v1/flux-pro-1.1',
    selectedModel: 'flux.1-dev',
    notes: 'Mô hình chi tiết cao Black Forest Labs',
    isCustom: false,
    createdAt: '2026-01-01',
  },
  {
    id: 'stability-sdxl',
    name: 'Stability AI SDXL Master',
    provider: 'stability',
    apiKey: '',
    apiEndpoint: 'https://api.stability.ai/v2beta/stable-image/generate/core',
    selectedModel: 'stable-diffusion-xl-1024-v1-0',
    notes: 'Chỉnh sửa và sinh ảnh nghệ thuật Stability',
    isCustom: false,
    createdAt: '2026-01-01',
  },
  {
    id: 'custom-webui',
    name: 'Custom Self-Hosted Proxy / ComfyUI',
    provider: 'custom',
    apiKey: '',
    apiEndpoint: 'http://127.0.0.1:8188/api/generate',
    selectedModel: 'custom-checkpoint-v1',
    customHeaders: '{\n  "X-API-Version": "2026-v1"\n}',
    notes: 'Endpoint máy chủ riêng hoặc Proxy Gateway',
    isCustom: true,
    createdAt: '2026-01-01',
  },
];

export const DEFAULT_SETTINGS: AppSettings = {
  theme: 'dark',
  activeProfileId: 'gemini-default',
  apiProfiles: DEFAULT_PROFILES,
  apiProvider: 'gemini',
  apiKey: '',
  apiEndpoint: 'https://generativelanguage.googleapis.com',
  selectedModel: 'imagen-3.0-generate-002',
  driveConnected: false,
  driveAccount: '',
  driveFolder: 'HinhanhAI/Exports',
  autoSync: false,
  defaultQuality: 'high',
  defaultRatio: 'original',
  defaultVariations: 2,
};

export const loadAppSettings = (): AppSettings => {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) {
      // Check legacy key
      const legacyRaw = localStorage.getItem('hinhanhai_app_settings');
      if (legacyRaw) {
        const parsed = JSON.parse(legacyRaw);
        return {
          ...DEFAULT_SETTINGS,
          ...parsed,
          activeProfileId: DEFAULT_SETTINGS.activeProfileId,
          apiProfiles: DEFAULT_PROFILES,
        };
      }
      return DEFAULT_SETTINGS;
    }
    const parsed = JSON.parse(raw);
    const profiles = Array.isArray(parsed.apiProfiles) && parsed.apiProfiles.length > 0
      ? parsed.apiProfiles
      : DEFAULT_PROFILES;
    
    // Ensure active profile exists
    const activeExists = profiles.some((p: ApiProfile) => p.id === parsed.activeProfileId);
    const activeProfileId = activeExists ? parsed.activeProfileId : profiles[0].id;

    return {
      ...DEFAULT_SETTINGS,
      ...parsed,
      apiProfiles: profiles,
      activeProfileId,
    };
  } catch {
    return DEFAULT_SETTINGS;
  }
};

export const saveAppSettings = (settings: AppSettings): void => {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(settings));
  } catch (err) {
    console.error('Failed to save settings to localStorage', err);
  }
};

export const getActiveProfile = (settings: AppSettings): ApiProfile => {
  const found = settings.apiProfiles.find((p) => p.id === settings.activeProfileId);
  return found || settings.apiProfiles[0] || DEFAULT_PROFILES[0];
};
