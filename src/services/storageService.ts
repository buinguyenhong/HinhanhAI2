export type ApiProviderType = 'gemini' | 'openai';

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
    selectedModel: 'gemini-2.5-flash-image',
    notes: 'Sử dụng GEMINI_API_KEY cấu hình trên Vercel khi không nhập khóa riêng.',
    isCustom: false,
    createdAt: '2026-01-01',
  },
  {
    id: 'openai-custom',
    name: 'OpenAI-compatible API',
    provider: 'openai',
    apiKey: '',
    apiEndpoint: 'https://api.openai.com/v1/images/generations',
    selectedModel: 'dall-e-3',
    notes: 'Nhập HTTPS endpoint và API key riêng của nhà cung cấp tương thích OpenAI.',
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
  selectedModel: 'gemini-2.5-flash-image',
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
    // Provider credentials are session-only and must never be persisted in browser storage.
    const profiles = settings.apiProfiles.map(({ apiKey: _apiKey, ...profile }) => ({ ...profile, apiKey: '' }));
    localStorage.setItem(STORAGE_KEY, JSON.stringify({ ...settings, apiKey: '', apiProfiles: profiles }));
  } catch (err) {
    console.error('Failed to save settings to localStorage', err);
  }
};

export const getActiveProfile = (settings: AppSettings): ApiProfile => {
  const found = settings.apiProfiles.find((p) => p.id === settings.activeProfileId);
  return found || settings.apiProfiles[0] || DEFAULT_PROFILES[0];
};
