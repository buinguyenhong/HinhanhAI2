import { SETTINGS_SAVED_EVENT } from './syncEvents';

export type ApiProviderType = 'gemini' | 'openai' | 'anthropic';
export type ApiProfileRole = 'render' | 'analyze' | 'both';

export interface ApiProfile {
  id: string;
  name: string;
  provider: ApiProviderType;
  role: ApiProfileRole;
  apiKey: string;
  apiEndpoint: string;
  renderModel: string;
  analyzeModel: string;
  notes?: string;
  isCustom?: boolean;
  createdAt: string;
}

export interface AppSettings {
  // Theme
  theme: 'dark' | 'light';
  // Active API Profiles (separate engine for render & analyze)
  renderProfileId: string;
  analyzeProfileId: string;
  // Multiple API Profiles list
  apiProfiles: ApiProfile[];
  // Legacy / fallback fields
  apiProvider: ApiProviderType;
  apiKey: string;
  apiEndpoint: string;
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

const STORAGE_KEY = 'hinhanhai_app_settings_v4';

export const DEFAULT_PROFILES: ApiProfile[] = [
  {
    id: 'gemini-default',
    name: 'Google Gemini (Mặc định)',
    provider: 'gemini',
    role: 'both',
    apiKey: '',
    apiEndpoint: 'https://generativelanguage.googleapis.com',
    renderModel: 'imagen-3.0-generate-002',
    analyzeModel: 'gemini-3.7-flash',
    notes: 'Dùng cho cả sinh ảnh (Imagen) và phân tích ảnh mẫu (Gemini Vision)',
    isCustom: false,
    createdAt: '2026-01-01',
  },
];

export const DEFAULT_SETTINGS: AppSettings = {
  theme: 'dark',
  renderProfileId: 'gemini-default',
  analyzeProfileId: 'gemini-default',
  apiProfiles: DEFAULT_PROFILES,
  apiProvider: 'gemini',
  apiKey: '',
  apiEndpoint: 'https://generativelanguage.googleapis.com',
  driveConnected: false,
  driveAccount: '',
  driveFolder: 'HinhanhAI/Exports',
  autoSync: false,
  defaultQuality: 'high',
  defaultRatio: 'original',
  defaultVariations: 2,
};

function normalizeProfile(p: any): ApiProfile {
  const provider: ApiProviderType =
    p.provider === 'gemini' || p.provider === 'openai' || p.provider === 'anthropic'
      ? p.provider
      : 'openai';
  const role: ApiProfileRole =
    p.role === 'render' || p.role === 'analyze' || p.role === 'both' ? p.role : 'both';
  const legacyModel = typeof p.selectedModel === 'string' ? p.selectedModel : '';

  let renderModel = typeof p.renderModel === 'string' ? p.renderModel : '';
  let analyzeModel = typeof p.analyzeModel === 'string' ? p.analyzeModel : '';

  if (!renderModel && legacyModel) renderModel = legacyModel;
  if (!analyzeModel) {
    analyzeModel =
      provider === 'gemini'
        ? 'gemini-3.7-flash'
        : provider === 'anthropic'
        ? 'claude-3-5-sonnet-latest'
        : 'gpt-4o';
  }
  if (!renderModel) {
    renderModel =
      provider === 'gemini'
        ? 'imagen-3.0-generate-002'
        : provider === 'anthropic'
        ? ''
        : 'gpt-image-1';
  }

  return {
    id: typeof p.id === 'string' ? p.id : 'profile-' + Math.random().toString(36).slice(2, 9),
    name: typeof p.name === 'string' && p.name.trim() ? p.name : 'API Profile',
    provider,
    role,
    apiKey: typeof p.apiKey === 'string' ? p.apiKey : '',
    apiEndpoint: typeof p.apiEndpoint === 'string' ? p.apiEndpoint : '',
    renderModel,
    analyzeModel,
    notes: typeof p.notes === 'string' ? p.notes : '',
    isCustom: Boolean(p.isCustom),
    createdAt: typeof p.createdAt === 'string' ? p.createdAt : '2026-01-01',
  };
}

export const loadAppSettings = (): AppSettings => {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      const profiles = (Array.isArray(parsed.apiProfiles) ? parsed.apiProfiles : [])
        .map(normalizeProfile)
        .filter((p: ApiProfile) => p.provider !== 'anthropic' || p.role !== 'render');
      const effectiveProfiles = profiles.length > 0 ? profiles : DEFAULT_PROFILES;

      const renderExists = effectiveProfiles.some(
        (p: ApiProfile) => p.id === parsed.renderProfileId && p.role !== 'analyze'
      );
      const analyzeExists = effectiveProfiles.some(
        (p: ApiProfile) => p.id === parsed.analyzeProfileId && p.role !== 'render'
      );

      return {
        ...DEFAULT_SETTINGS,
        ...parsed,
        apiProfiles: effectiveProfiles,
        renderProfileId: renderExists
          ? parsed.renderProfileId
          : (effectiveProfiles.find((p: ApiProfile) => p.role !== 'analyze') || effectiveProfiles[0]).id,
        analyzeProfileId: analyzeExists
          ? parsed.analyzeProfileId
          : (effectiveProfiles.find((p: ApiProfile) => p.role !== 'render') || effectiveProfiles[0]).id,
      };
    }
    return DEFAULT_SETTINGS;
  } catch {
    return DEFAULT_SETTINGS;
  }
};

export const saveAppSettings = (settings: AppSettings): void => {
  writeSettingsLocally(settings);
  // Thông báo để syncService đẩy lên server (lắng nghe qua window event).
  window.dispatchEvent(new CustomEvent(SETTINGS_SAVED_EVENT, { detail: settings }));
};

// Ghi thuần vào localStorage — không phát event (dùng khi sync kéo dữ liệu về).
export const writeSettingsLocally = (settings: AppSettings): void => {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(settings));
  } catch (err) {
    console.error('Failed to save settings to localStorage', err);
  }
};

export const getRenderProfile = (settings: AppSettings): ApiProfile => {
  const found = settings.apiProfiles.find(
    (p) => p.id === settings.renderProfileId && p.role !== 'analyze'
  );
  return (
    found ||
    settings.apiProfiles.find((p) => p.role !== 'analyze') ||
    settings.apiProfiles[0] ||
    DEFAULT_PROFILES[0]
  );
};

export const getAnalyzeProfile = (settings: AppSettings): ApiProfile => {
  const found = settings.apiProfiles.find(
    (p) => p.id === settings.analyzeProfileId && p.role !== 'render'
  );
  return (
    found ||
    settings.apiProfiles.find((p) => p.role !== 'render') ||
    settings.apiProfiles[0] ||
    DEFAULT_PROFILES[0]
  );
};

// Backward-compatible alias
export const getActiveProfile = getRenderProfile;
