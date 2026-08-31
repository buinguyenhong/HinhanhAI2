import React, { useState, useEffect } from 'react';
import {
  Check,
  HardDrive,
  ShieldCheck,
  Sun,
  Moon,
  Key,
  Cpu,
  Eye,
  EyeOff,
  RefreshCw,
  Link2,
  Unlink,
  ExternalLink,
  Sparkles,
  Plus,
  Trash2,
  Edit2,
  CheckCircle2,
  Radio,
  Sliders,
  Server,
  Zap,
  Info,
} from 'lucide-react';
import { useTheme } from '../../context/ThemeContext';
import {
  loadAppSettings,
  saveAppSettings,
  AppSettings,
  ApiProfile,
  ApiProviderType,
  ApiProfileRole,
  getAnalyzeProfile,
  getRenderProfile,
} from '../../services/storageService';
import {
  authenticateWithGoogleDrive,
  disconnectGoogleDrive,
} from '../../services/googleDriveService';

const PROVIDER_PRESETS: Record<
  ApiProviderType,
  { endpoint: string; renderModel: string; analyzeModel: string; notes: string }
> = {
  gemini: {
    endpoint: 'https://generativelanguage.googleapis.com',
    renderModel: 'imagen-3.0-generate-002',
    analyzeModel: 'gemini-3.7-flash',
    notes: 'Google Gemini (mặc định) — dùng SDK với key. Hỗ trợ cả sinh ảnh và phân tích.',
  },
  openai: {
    endpoint: 'https://api.openai.com/v1',
    renderModel: 'gpt-image-1',
    analyzeModel: 'gpt-4o',
    notes: 'OpenAI / OpenAI-compatible proxy. Hỗ trợ cả sinh ảnh và phân tích.',
  },
  anthropic: {
    endpoint: 'https://api.anthropic.com',
    renderModel: '',
    analyzeModel: 'claude-3-5-sonnet-latest',
    notes: 'Anthropic — CHỈ phân tích ảnh. Không hỗ trợ sinh ảnh (UI sẽ chặn role render).',
  },
};

const ROLE_OPTIONS: { value: ApiProfileRole; label: string; desc: string }[] = [
  { value: 'both', label: 'Cả hai (Phân tích + Sinh ảnh)', desc: 'Dùng cho cả render và analyze.' },
  { value: 'render', label: 'Chỉ sinh ảnh (Render)', desc: 'Chỉ dùng làm engine sinh ảnh.' },
  { value: 'analyze', label: 'Chỉ phân tích ảnh mẫu', desc: 'Chỉ dùng để phân tích ảnh mẫu.' },
];

export const SettingsView: React.FC = () => {
  const { theme, setTheme } = useTheme();
  const [settings, setSettings] = useState<AppSettings>(loadAppSettings);
  const [savedSuccess, setSavedSuccess] = useState(false);

  const [showDriveConnectModal, setShowDriveConnectModal] = useState(false);
  const [driveEmailInput, setDriveEmailInput] = useState('');

  const [testingProfileId, setTestingProfileId] = useState<string | null>(null);
  const [testResults, setTestResults] = useState<
    Record<string, { status: 'success' | 'error'; message: string; latency?: number }>
  >({});

  const [isProfileModalOpen, setIsProfileModalOpen] = useState(false);
  const [editingProfileId, setEditingProfileId] = useState<string | null>(null);
  const [showModalApiKey, setShowModalApiKey] = useState(false);

  // Profile Form Fields (new schema)
  const [formName, setFormName] = useState('');
  const [formProvider, setFormProvider] = useState<ApiProviderType>('openai');
  const [formRole, setFormRole] = useState<ApiProfileRole>('both');
  const [formEndpoint, setFormEndpoint] = useState('');
  const [formApiKey, setFormApiKey] = useState('');
  const [formRenderModel, setFormRenderModel] = useState('');
  const [formAnalyzeModel, setFormAnalyzeModel] = useState('');
  const [formNotes, setFormNotes] = useState('');

  useEffect(() => {
    setSettings((prev) => ({ ...prev, theme }));
  }, [theme]);

  const renderProfile = getRenderProfile(settings);
  const analyzeProfile = getAnalyzeProfile(settings);

  const handleUpdate = <K extends keyof AppSettings>(key: K, value: AppSettings[K]) => {
    setSettings((prev) => {
      const next = { ...prev, [key]: value };
      saveAppSettings(next);
      return next;
    });
  };

  const handleSelectRenderProfile = (profileId: string) => {
    const profile = settings.apiProfiles.find((p) => p.id === profileId && p.role !== 'analyze');
    if (!profile) return;
    handleUpdate('renderProfileId', profileId);
  };

  const handleSelectAnalyzeProfile = (profileId: string) => {
    const profile = settings.apiProfiles.find((p) => p.id === profileId && p.role !== 'render');
    if (!profile) return;
    handleUpdate('analyzeProfileId', profileId);
  };

  const resetForm = () => {
    setEditingProfileId(null);
    setFormName('');
    setFormProvider('openai');
    setFormRole('both');
    setFormEndpoint(PROVIDER_PRESETS.openai.endpoint);
    setFormApiKey('');
    setFormRenderModel(PROVIDER_PRESETS.openai.renderModel);
    setFormAnalyzeModel(PROVIDER_PRESETS.openai.analyzeModel);
    setFormNotes(PROVIDER_PRESETS.openai.notes);
    setShowModalApiKey(false);
  };

  const handleOpenAddModal = () => {
    resetForm();
    setIsProfileModalOpen(true);
  };

  const handleOpenEditModal = (profile: ApiProfile) => {
    setEditingProfileId(profile.id);
    setFormName(profile.name);
    setFormProvider(profile.provider);
    setFormRole(profile.role);
    setFormEndpoint(profile.apiEndpoint);
    setFormApiKey(profile.apiKey || '');
    setFormRenderModel(profile.renderModel);
    setFormAnalyzeModel(profile.analyzeModel);
    setFormNotes(profile.notes || '');
    setShowModalApiKey(false);
    setIsProfileModalOpen(true);
  };

  const applyProviderPreset = (provider: ApiProviderType) => {
    const preset = PROVIDER_PRESETS[provider];
    setFormEndpoint(preset.endpoint);
    setFormRenderModel(preset.renderModel);
    setFormAnalyzeModel(preset.analyzeModel);
    if (!formNotes) setFormNotes(preset.notes);
  };

  const handleProviderChange = (prov: ApiProviderType) => {
    setFormProvider(prov);
    applyProviderPreset(prov);
  };

  const handleSaveProfileForm = (e: React.FormEvent) => {
    e.preventDefault();
    if (!formName.trim()) return;

    // Anthropic cannot have render role
    const finalRole: ApiProfileRole =
      formProvider === 'anthropic' && (formRole === 'render' || formRole === 'both')
        ? 'analyze'
        : formRole;

    const sanitizedRenderModel = formProvider === 'anthropic' ? '' : formRenderModel.trim();

    if (editingProfileId) {
      const updatedProfiles = settings.apiProfiles.map((p) => {
        if (p.id === editingProfileId) {
          return {
            ...p,
            name: formName.trim(),
            provider: formProvider,
            role: finalRole,
            apiEndpoint: formEndpoint.trim(),
            apiKey: formApiKey.trim(),
            renderModel: sanitizedRenderModel,
            analyzeModel: formAnalyzeModel.trim(),
            notes: formNotes.trim(),
          };
        }
        return p;
      });

      const nextSettings = { ...settings, apiProfiles: updatedProfiles };
      setSettings(nextSettings);
      saveAppSettings(nextSettings);
    } else {
      const newId = 'profile-' + Math.random().toString(36).substring(2, 9);
      const newProfile: ApiProfile = {
        id: newId,
        name: formName.trim(),
        provider: formProvider,
        role: finalRole,
        apiEndpoint: formEndpoint.trim(),
        apiKey: formApiKey.trim(),
        renderModel: sanitizedRenderModel,
        analyzeModel: formAnalyzeModel.trim(),
        notes: formNotes.trim(),
        isCustom: true,
        createdAt: new Date().toISOString().split('T')[0],
      };

      const nextSettings = {
        ...settings,
        apiProfiles: [...settings.apiProfiles, newProfile],
      };

      // Auto-pick first eligible if current IDs no longer valid
      if (!nextSettings.apiProfiles.some((p) => p.id === nextSettings.renderProfileId && p.role !== 'analyze')) {
        const fallback = nextSettings.apiProfiles.find((p) => p.role !== 'analyze');
        if (fallback) nextSettings.renderProfileId = fallback.id;
      }
      if (!nextSettings.apiProfiles.some((p) => p.id === nextSettings.analyzeProfileId && p.role !== 'render')) {
        const fallback = nextSettings.apiProfiles.find((p) => p.role !== 'render');
        if (fallback) nextSettings.analyzeProfileId = fallback.id;
      }

      setSettings(nextSettings);
      saveAppSettings(nextSettings);
    }

    setIsProfileModalOpen(false);
  };

  const handleDeleteProfile = (profileId: string) => {
    if (settings.apiProfiles.length <= 1) {
      alert('Bạn cần giữ ít nhất 1 cấu hình API.');
      return;
    }
    const filtered = settings.apiProfiles.filter((p) => p.id !== profileId);
    const nextSettings: AppSettings = { ...settings, apiProfiles: filtered };

    if (!filtered.some((p) => p.id === nextSettings.renderProfileId && p.role !== 'analyze')) {
      const fallback = filtered.find((p) => p.role !== 'analyze');
      if (fallback) nextSettings.renderProfileId = fallback.id;
    }
    if (!filtered.some((p) => p.id === nextSettings.analyzeProfileId && p.role !== 'render')) {
      const fallback = filtered.find((p) => p.role !== 'render');
      if (fallback) nextSettings.analyzeProfileId = fallback.id;
    }

    setSettings(nextSettings);
    saveAppSettings(nextSettings);
  };

  const handleTestProfileConnection = async (profile: ApiProfile) => {
    setTestingProfileId(profile.id);
    setTestResults((prev) => {
      const next = { ...prev };
      delete next[profile.id];
      return next;
    });

    const hasKey = Boolean(profile.apiKey.trim()) || profile.provider === 'gemini';
    if (!hasKey) {
      setTestingProfileId(null);
      setTestResults((prev) => ({
        ...prev,
        [profile.id]: {
          status: 'error',
          message: 'Thiếu API Key cho nhà cung cấp này. Vui lòng bấm Sửa để bổ sung.',
        },
      }));
      return;
    }

    try {
      const { getAuthHeaders } = await import('../../services/authService');
      const response = await fetch('/api/test-profile', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...getAuthHeaders(),
        },
        body: JSON.stringify({
          provider: profile.provider,
          apiKey: profile.apiKey || undefined,
          apiEndpoint: profile.apiEndpoint || undefined,
          model: profile.role === 'analyze' ? profile.analyzeModel : profile.renderModel,
          role: profile.role,
        }),
      });
      const data = await response.json();
      const failed = (data.checks || []).filter((c: any) => !c.ok);
      if (response.ok && data.success) {
        setTestResults((prev) => ({
          ...prev,
          [profile.id]: {
            status: 'success',
            message: `Pass • ${(data.checks || []).map((c: any) => `${c.name}${c.latency ? ` (${c.latency}ms)` : ''}`).join(' | ')}`,
          },
        }));
      } else {
        const firstFail = failed[0];
        setTestResults((prev) => ({
          ...prev,
          [profile.id]: {
            status: 'error',
            message: firstFail?.detail || data.error || 'Test thất bại — xem chi tiết.',
          },
        }));
      }
    } catch (err: any) {
      setTestResults((prev) => ({
        ...prev,
        [profile.id]: {
          status: 'error',
          message: `L�i mạng khi test: ${err?.message || err}`,
        },
      }));
    } finally {
      setTestingProfileId(null);
    }
  };

  const handleConnectDrive = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    try {
      const auth = await authenticateWithGoogleDrive();
      handleUpdate('driveConnected', true);
      handleUpdate('driveAccount', auth.email || 'connected-user@google.com');
      setShowDriveConnectModal(false);
      setDriveEmailInput('');
    } catch (err: any) {
      console.error('Failed to authenticate with Google Drive:', err);
      alert(`Kết nối Google Drive thất bại: ${err?.message || 'Vui lòng cho phép quyền truy cập'}`);
    }
  };

  const handleDisconnectDrive = () => {
    disconnectGoogleDrive();
    handleUpdate('driveConnected', false);
    handleUpdate('driveAccount', '');
  };

  const handleSaveAll = () => {
    saveAppSettings(settings);
    setSavedSuccess(true);
    setTimeout(() => setSavedSuccess(false), 2500);
  };

  const renderProfiles = settings.apiProfiles.filter((p) => p.role !== 'analyze');
  const analyzeProfiles = settings.apiProfiles.filter((p) => p.role !== 'render');

  return (
    <div className="max-w-3xl mx-auto space-y-12 pb-16 transition-colors">
      <div className="flex items-baseline justify-between border-b border-[#E2DDD5] dark:border-[#1D1D1B] pb-4">
        <div>
          <h2 className="text-xs uppercase tracking-[0.2em] font-medium text-[#1C1B18] dark:text-[#E8E7E2]">
            Preferences & Multi-Provider Manager
          </h2>
          <p className="text-[10px] text-[#9C988F] dark:text-[#5E5D57] font-mono mt-0.5">
            Quản lý danh sách API (Gemini / OpenAI / Anthropic) với engine riêng cho Sinh ảnh & Phân tích ảnh mẫu
          </p>
        </div>
        <span className="text-[10px] font-mono text-[#6E6B64] dark:text-[#8C8B84]">
          STUDIO BUILD v2.7
        </span>
      </div>

      <div className="space-y-10 text-xs">
        {/* 1. Theme */}
        <div className="space-y-4">
          <h3 className="text-[10px] uppercase tracking-[0.2em] text-[#6E6B64] dark:text-[#8C8B84] font-mono border-b border-[#EDE9E1] dark:border-[#1D1D1B] pb-2">
            01 / Giao diện & Trực quan (Theme)
          </h3>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-1">
            <div
              onClick={() => setTheme('light')}
              className={`p-4 border transition-all cursor-pointer flex items-start gap-3.5 ${
                theme === 'light'
                  ? 'border-[#1C1B18] bg-[#FFFFFF] shadow-sm ring-1 ring-[#1C1B18]/20'
                  : 'border-[#E2DDD5] dark:border-[#1D1D1B] bg-[#FFFFFF] dark:bg-[#111110] hover:border-[#CCC7BE] dark:hover:border-[#3A3935]'
              }`}
            >
              <div className="p-2 bg-[#F2EFE9] text-[#1C1B18] rounded-xs mt-0.5">
                <Sun size={16} strokeWidth={1.5} />
              </div>
              <div className="space-y-1">
                <div className="flex items-center gap-2">
                  <span className="text-xs font-medium text-[#1C1B18]">Giao diện Sáng (Light)</span>
                  {theme === 'light' && (
                    <span className="text-[9px] font-mono uppercase px-1.5 py-0.2 bg-[#1C1B18] text-[#F8F7F4]">
                      Active
                    </span>
                  )}
                </div>
                <p className="text-[10px] text-[#6E6B64] leading-relaxed">
                  Tông màu giấy alabaster ấm áp, tương phản cao, lý tưởng cho môi trường ban ngày.
                </p>
              </div>
            </div>

            <div
              onClick={() => setTheme('dark')}
              className={`p-4 border transition-all cursor-pointer flex items-start gap-3.5 ${
                theme === 'dark'
                  ? 'border-[#D8D3C5] bg-[#111110] shadow-sm ring-1 ring-[#D8D3C5]/20'
                  : 'border-[#E2DDD5] dark:border-[#1D1D1B] bg-[#FFFFFF] dark:bg-[#111110] hover:border-[#CCC7BE] dark:hover:border-[#3A3935]'
              }`}
            >
              <div className="p-2 bg-[#1A1A18] text-[#D8D3C5] rounded-xs mt-0.5">
                <Moon size={16} strokeWidth={1.5} />
              </div>
              <div className="space-y-1">
                <div className="flex items-center gap-2">
                  <span className="text-xs font-medium text-[#E8E7E2]">Giao diện Tối (Dark)</span>
                  {theme === 'dark' && (
                    <span className="text-[9px] font-mono uppercase px-1.5 py-0.2 bg-[#D8D3C5] text-[#0B0B0A]">
                      Active
                    </span>
                  )}
                </div>
                <p className="text-[10px] text-[#8C8B84] leading-relaxed">
                  Phong cách phòng tối điện ảnh, đen sâu và xám ấm bảo vệ thị lực tập trung sáng tạo.
                </p>
              </div>
            </div>
          </div>
        </div>

        {/* 2. ACTIVE ENGINES (Render + Analyze) */}
        <div className="space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-[#EDE9E1] dark:border-[#1D1D1B] pb-2">
            <h3 className="text-[10px] uppercase tracking-[0.2em] text-[#6E6B64] dark:text-[#8C8B84] font-mono flex items-center gap-2">
              <Zap size={12} />
              02 / Engine đang sử dụng (Active Engines)
            </h3>
            <span className="text-[9px] font-mono text-[#9C988F] dark:text-[#5E5D57]">
              2 engine tách biệt
            </span>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-3 pt-1">
            {/* Render engine */}
            <div className="p-4 border border-[#1C1B18] dark:border-[#D8D3C5] bg-[#F5F3ED] dark:bg-[#151514] space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-[10px] uppercase tracking-wider font-mono text-[#9C988F] dark:text-[#5E5D57] flex items-center gap-1.5">
                  <Zap size={11} /> Render Engine (Sinh ảnh)
                </span>
                <span className="text-[9px] font-mono uppercase px-1.5 py-0.2 bg-[#22C55E]/20 text-[#15803D] dark:text-[#4ADE80] font-semibold">
                  ACTIVE
                </span>
              </div>
              <p className="text-xs font-semibold text-[#1C1B18] dark:text-[#E8E7E2]">
                {renderProfile.name}
              </p>
              <p className="text-[10px] font-mono text-[#6E6B64] dark:text-[#8C8B84] truncate">
                {renderProfile.provider.toUpperCase()} • Model: {renderProfile.renderModel || '(chưa cấu hình)'}
              </p>
              <select
                value={renderProfile.id}
                onChange={(e) => handleSelectRenderProfile(e.target.value)}
                disabled={renderProfiles.length === 0}
                className="w-full bg-[#FFFFFF] dark:bg-[#0E0E0D] border border-[#E2DDD5] dark:border-[#292925] px-2 py-1.5 text-[10px] font-mono text-[#1C1B18] dark:text-[#E8E7E2] focus:outline-none cursor-pointer"
              >
                {renderProfiles.length === 0 && <option value="">(không có profile render)</option>}
                {renderProfiles.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.name} — {p.renderModel || '(chưa có model)'}
                  </option>
                ))}
              </select>
            </div>

            {/* Analyze engine */}
            <div className="p-4 border border-[#1C1B18] dark:border-[#D8D3C5] bg-[#F5F3ED] dark:bg-[#151514] space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-[10px] uppercase tracking-wider font-mono text-[#9C988F] dark:text-[#5E5D57] flex items-center gap-1.5">
                  <Eye size={11} /> Analyze Engine (Phân tích ảnh mẫu)
                </span>
                <span className="text-[9px] font-mono uppercase px-1.5 py-0.2 bg-[#22C55E]/20 text-[#15803D] dark:text-[#4ADE80] font-semibold">
                  ACTIVE
                </span>
              </div>
              <p className="text-xs font-semibold text-[#1C1B18] dark:text-[#E8E7E2]">
                {analyzeProfile.name}
              </p>
              <p className="text-[10px] font-mono text-[#6E6B64] dark:text-[#8C8B84] truncate">
                {analyzeProfile.provider.toUpperCase()} • Model: {analyzeProfile.analyzeModel || '(chưa cấu hình)'}
              </p>
              <select
                value={analyzeProfile.id}
                onChange={(e) => handleSelectAnalyzeProfile(e.target.value)}
                disabled={analyzeProfiles.length === 0}
                className="w-full bg-[#FFFFFF] dark:bg-[#0E0E0D] border border-[#E2DDD5] dark:border-[#292925] px-2 py-1.5 text-[10px] font-mono text-[#1C1B18] dark:text-[#E8E7E2] focus:outline-none cursor-pointer"
              >
                {analyzeProfiles.length === 0 && <option value="">(không có profile analyze)</option>}
                {analyzeProfiles.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.name} — {p.analyzeModel || '(chưa có model)'}
                  </option>
                ))}
              </select>
            </div>
          </div>
        </div>

        {/* 3. API PROFILE MANAGER */}
        <div className="space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-[#EDE9E1] dark:border-[#1D1D1B] pb-2">
            <div>
              <h3 className="text-[10px] uppercase tracking-[0.2em] text-[#6E6B64] dark:text-[#8C8B84] font-mono flex items-center gap-2">
                <Key size={12} />
                03 / Danh sách API Profiles ({settings.apiProfiles.length})
              </h3>
              <p className="text-[10px] text-[#9C988F] dark:text-[#5E5D57] font-mono mt-0.5">
                Gemini mặc định • Thêm OpenAI / Anthropic với vai trò riêng
              </p>
            </div>

            <button
              type="button"
              onClick={handleOpenAddModal}
              className="text-xs uppercase tracking-[0.14em] px-3.5 py-1.5 bg-[#1C1B18] hover:bg-[#2F2E2B] text-[#F8F7F4] dark:bg-[#D8D3C5] dark:hover:bg-[#E8E7E2] dark:text-[#0B0B0A] font-medium transition-colors flex items-center gap-1.5 cursor-pointer self-start sm:self-auto"
            >
              <Plus size={13} />
              <span>Thêm API Profile</span>
            </button>
          </div>

          <div className="space-y-3 pt-1">
            {settings.apiProfiles.map((profile) => {
              const isRender = profile.id === settings.renderProfileId && profile.role !== 'analyze';
              const isAnalyze = profile.id === settings.analyzeProfileId && profile.role !== 'render';
              const testResult = testResults[profile.id];
              const isTesting = testingProfileId === profile.id;
              const isAnthropic = profile.provider === 'anthropic';

              return (
                <div
                  key={profile.id}
                  className={`p-4 sm:p-5 border transition-all ${
                    isRender || isAnalyze
                      ? 'border-[#1C1B18] dark:border-[#D8D3C5] bg-[#FFFFFF] dark:bg-[#111110] shadow-sm'
                      : 'border-[#E2DDD5] dark:border-[#1D1D1B] bg-[#FFFFFF] dark:bg-[#111110] hover:border-[#CCC7BE] dark:hover:border-[#333330]'
                  }`}
                >
                  <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-4">
                    <div className="space-y-1.5 flex-1 min-w-0">
                      <div className="flex items-center gap-2.5 flex-wrap">
                        <span
                          className={`text-xs font-medium ${
                            isRender || isAnalyze
                              ? 'text-[#1C1B18] dark:text-[#E8E7E2] font-semibold'
                              : 'text-[#6E6B64] dark:text-[#8C8B84]'
                          }`}
                        >
                          {profile.name}
                        </span>

                        <span className="text-[9px] font-mono uppercase px-2 py-0.5 border border-[#E2DDD5] dark:border-[#292925] bg-[#F5F3ED] dark:bg-[#161614] text-[#6E6B64] dark:text-[#8C8B84]">
                          {profile.provider.toUpperCase()}
                        </span>

                        <span className="text-[9px] font-mono uppercase px-2 py-0.5 border border-[#E2DDD5] dark:border-[#292925] bg-[#F5F3ED] dark:bg-[#161614] text-[#6E6B64] dark:text-[#8C8B84]">
                          {profile.role === 'render' ? 'Render' : profile.role === 'analyze' ? 'Analyze' : 'Both'}
                        </span>

                        {isRender && (
                          <span className="text-[9px] font-mono uppercase px-2 py-0.5 bg-[#1C1B18] text-[#F8F7F4] dark:bg-[#D8D3C5] dark:text-[#0B0B0A] font-semibold flex items-center gap-1">
                            <Zap size={9} /> RENDER
                          </span>
                        )}
                        {isAnalyze && (
                          <span className="text-[9px] font-mono uppercase px-2 py-0.5 bg-[#1C1B18] text-[#F8F7F4] dark:bg-[#D8D3C5] dark:text-[#0B0B0A] font-semibold flex items-center gap-1">
                            <Eye size={9} /> ANALYZE
                          </span>
                        )}
                      </div>

                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-[10px] font-mono text-[#9C988F] dark:text-[#5E5D57] pt-1">
                        <div className="truncate flex items-center gap-1.5">
                          <Server size={11} className="shrink-0" />
                          <span className="text-[#6E6B64] dark:text-[#8C8B84]">Endpoint:</span>
                          <span className="truncate">{profile.apiEndpoint || '(mặc định SDK)'}</span>
                        </div>
                        {!isAnthropic && (
                          <div className="flex items-center gap-1.5">
                            <Cpu size={11} className="shrink-0" />
                            <span className="text-[#6E6B64] dark:text-[#8C8B84]">Render Model:</span>
                            <span className="text-[#1C1B18] dark:text-[#E8E7E2]">
                              {profile.renderModel || '—'}
                            </span>
                          </div>
                        )}
                        <div className="flex items-center gap-1.5">
                          <Cpu size={11} className="shrink-0" />
                          <span className="text-[#6E6B64] dark:text-[#8C8B84]">Analyze Model:</span>
                          <span className="text-[#1C1B18] dark:text-[#E8E7E2]">
                            {profile.analyzeModel || '—'}
                          </span>
                        </div>
                      </div>

                      <div className="text-[10px] font-mono text-[#9C988F] dark:text-[#5E5D57] flex items-center gap-1.5">
                        <Key size={11} className="shrink-0" />
                        <span className="text-[#6E6B64] dark:text-[#8C8B84]">API Key:</span>
                        <span>
                          {profile.apiKey
                            ? `••••••••••••${profile.apiKey.slice(-4)}`
                            : profile.provider === 'gemini'
                            ? 'Auto GEMINI_API_KEY (server env)'
                            : 'Chưa cấu hình khóa'}
                        </span>
                      </div>

                      {isAnthropic && (
                        <p className="text-[10px] text-[#EAB308] dark:text-[#FACC15] italic pt-0.5 flex items-center gap-1">
                          <Info size={11} />
                          Anthropic chỉ hỗ trợ phân tích ảnh. Không thể dùng để sinh ảnh.
                        </p>
                      )}

                      {profile.notes && (
                        <p className="text-[10px] text-[#9C988F] dark:text-[#5E5D57] italic pt-0.5">
                          {profile.notes}
                        </p>
                      )}
                    </div>

                    <div className="flex items-center gap-2 self-end sm:self-center shrink-0">
                      {/* Quick pick as render */}
                      {profile.role !== 'analyze' && !isAnthropic && !isRender && (
                        <button
                          type="button"
                          onClick={() => handleSelectRenderProfile(profile.id)}
                          className="px-2 py-1 text-[10px] uppercase font-mono border border-[#E2DDD5] dark:border-[#292925] text-[#6E6B64] dark:text-[#8C8B84] hover:border-[#1C1B18] dark:hover:border-[#D8D3C5] hover:text-[#1C1B18] dark:hover:text-[#E8E7E2] transition-colors cursor-pointer flex items-center gap-1"
                          title="Đặt làm engine Sinh ảnh"
                        >
                          <Zap size={10} /> Render
                        </button>
                      )}
                      {profile.role !== 'render' && !isAnalyze && (
                        <button
                          type="button"
                          onClick={() => handleSelectAnalyzeProfile(profile.id)}
                          className="px-2 py-1 text-[10px] uppercase font-mono border border-[#E2DDD5] dark:border-[#292925] text-[#6E6B64] dark:text-[#8C8B84] hover:border-[#1C1B18] dark:hover:border-[#D8D3C5] hover:text-[#1C1B18] dark:hover:text-[#E8E7E2] transition-colors cursor-pointer flex items-center gap-1"
                          title="Đặt làm engine Phân tích"
                        >
                          <Eye size={10} /> Analyze
                        </button>
                      )}

                      <button
                        type="button"
                        onClick={() => handleTestProfileConnection(profile)}
                        disabled={isTesting}
                        title="Kiểm tra kết nối tới API này"
                        className="p-1.5 border border-[#E2DDD5] dark:border-[#292925] text-[#6E6B64] dark:text-[#8C8B84] hover:text-[#1C1B18] dark:hover:text-[#E8E7E2] hover:border-[#CCC7BE] transition-colors cursor-pointer"
                      >
                        <RefreshCw size={13} className={isTesting ? 'animate-spin' : ''} />
                      </button>

                      <button
                        type="button"
                        onClick={() => handleOpenEditModal(profile)}
                        title="Chỉnh sửa cấu hình"
                        className="p-1.5 border border-[#E2DDD5] dark:border-[#292925] text-[#6E6B64] dark:text-[#8C8B84] hover:text-[#1C1B18] dark:hover:text-[#E8E7E2] hover:border-[#CCC7BE] transition-colors cursor-pointer"
                      >
                        <Edit2 size={13} />
                      </button>

                      {profile.isCustom && (
                        <button
                          type="button"
                          onClick={() => handleDeleteProfile(profile.id)}
                          title="Xóa API này"
                          className="p-1.5 border border-[#E2DDD5] dark:border-[#292925] text-[#9C988F] hover:text-[#DC2626] dark:hover:text-[#F87171] hover:border-[#DC2626]/30 transition-colors cursor-pointer"
                        >
                          <Trash2 size={13} />
                        </button>
                      )}
                    </div>
                  </div>

                  {testResult && (
                    <div
                      className={`mt-3 text-[10px] font-mono px-3 py-1.5 border flex items-center gap-1.5 ${
                        testResult.status === 'success'
                          ? 'border-[#22C55E]/30 bg-[#22C55E]/10 text-[#15803D] dark:text-[#4ADE80]'
                          : 'border-[#EF4444]/30 bg-[#EF4444]/10 text-[#B91C1C] dark:text-[#F87171]'
                      }`}
                    >
                      {testResult.status === 'success' ? (
                        <CheckCircle2 size={12} />
                      ) : (
                        <ExternalLink size={12} />
                      )}
                      <span>{testResult.message}</span>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>

        {/* 4. Google Drive */}
        <div className="space-y-4">
          <div className="flex items-center justify-between border-b border-[#EDE9E1] dark:border-[#1D1D1B] pb-2">
            <h3 className="text-[10px] uppercase tracking-[0.2em] text-[#6E6B64] dark:text-[#8C8B84] font-mono flex items-center gap-2">
              <HardDrive size={12} />
              04 / Google Drive Sync & Storage
            </h3>
            <span className="text-[9px] font-mono text-[#9C988F] dark:text-[#5E5D57]">CLOUD BACKUP</span>
          </div>

          <div className="space-y-4 border border-[#E2DDD5] dark:border-[#1D1D1B] bg-[#FFFFFF] dark:bg-[#111110] p-5 sm:p-6">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div className="flex items-center gap-3">
                <div
                  className={`p-2.5 rounded-xs ${
                    settings.driveConnected
                      ? 'bg-[#22C55E]/10 text-[#15803D] dark:text-[#4ADE80]'
                      : 'bg-[#F2EFE9] dark:bg-[#161614] text-[#6E6B64] dark:text-[#8C8B84]'
                  }`}
                >
                  <HardDrive size={18} />
                </div>
                <div>
                  <p className="text-xs text-[#1C1B18] dark:text-[#E8E7E2] font-medium">
                    {settings.driveConnected
                      ? 'Tài khoản Google Drive đã liên kết'
                      : 'Chưa liên kết tài khoản Google Drive'}
                  </p>
                  <p className="text-[10px] text-[#9C988F] dark:text-[#5E5D57] font-mono">
                    {settings.driveConnected
                      ? `Tài khoản: ${settings.driveAccount || 'creator@google.com'}`
                      : 'Kết nối để tự động lưu ảnh phân giải gốc vào Drive'}
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-2">
                <span
                  className={`text-[9px] font-mono px-2.5 py-1 border ${
                    settings.driveConnected
                      ? 'border-[#22C55E]/40 bg-[#22C55E]/10 text-[#15803D] dark:text-[#4ADE80]'
                      : 'border-[#E2DDD5] dark:border-[#242421] text-[#9C988F] dark:text-[#5E5D57]'
                  }`}
                >
                  {settings.driveConnected ? 'CONNECTED' : 'DISCONNECTED'}
                </span>

                {settings.driveConnected ? (
                  <button
                    type="button"
                    onClick={handleDisconnectDrive}
                    className="text-[10px] font-mono uppercase px-3 py-1 border border-[#E2DDD5] dark:border-[#292925] text-[#9C988F] hover:text-[#DC2626] dark:hover:text-[#F87171] hover:border-[#DC2626]/30 transition-colors flex items-center gap-1 cursor-pointer"
                  >
                    <Unlink size={11} /> Ngắt kết nối
                  </button>
                ) : (
                  <button
                    type="button"
                    onClick={() => handleConnectDrive()}
                    className="text-[10px] font-mono uppercase px-3 py-1 bg-[#1C1B18] hover:bg-[#2F2E2B] text-[#F8F7F4] dark:bg-[#D8D3C5] dark:hover:bg-[#E8E7E2] dark:text-[#0B0B0A] transition-colors flex items-center gap-1 cursor-pointer font-medium"
                  >
                    <Link2 size={11} /> Đăng nhập Google Drive
                  </button>
                )}
              </div>
            </div>

            {showDriveConnectModal && (
              <form
                onSubmit={handleConnectDrive}
                className="p-4 border border-[#1C1B18] dark:border-[#D8D3C5] bg-[#F8F7F4] dark:bg-[#161614] space-y-3"
              >
                <div className="flex items-center justify-between">
                  <span className="text-[10px] uppercase font-medium text-[#1C1B18] dark:text-[#E8E7E2]">
                    Xác nhận tài khoản Google
                  </span>
                  <button
                    type="button"
                    onClick={() => setShowDriveConnectModal(false)}
                    className="text-[10px] text-[#9C988F] hover:text-[#1C1B18] dark:hover:text-[#E8E7E2] cursor-pointer"
                  >
                    Hủy
                  </button>
                </div>
                <div className="space-y-1">
                  <label className="block text-[9px] text-[#6E6B64] dark:text-[#8C8B84]">
                    Nhập email tài khoản Google Drive của bạn
                  </label>
                  <input
                    type="email"
                    required
                    value={driveEmailInput}
                    onChange={(e) => setDriveEmailInput(e.target.value)}
                    placeholder="user@gmail.com"
                    className="w-full bg-[#FFFFFF] dark:bg-[#0E0E0D] border border-[#E2DDD5] dark:border-[#292925] p-2 text-xs text-[#1C1B18] dark:text-[#E8E7E2] font-mono focus:outline-none"
                  />
                </div>
                <div className="flex justify-end gap-2 pt-1">
                  <button
                    type="button"
                    onClick={() => setShowDriveConnectModal(false)}
                    className="px-3 py-1.5 text-[10px] uppercase border border-[#E2DDD5] dark:border-[#292925] text-[#6E6B64] dark:text-[#8C8B84] cursor-pointer"
                  >
                    Đóng
                  </button>
                  <button
                    type="submit"
                    className="px-4 py-1.5 text-[10px] uppercase bg-[#1C1B18] text-[#F8F7F4] dark:bg-[#D8D3C5] dark:text-[#0B0B0A] font-medium cursor-pointer"
                  >
                    Xác nhận kết nối
                  </button>
                </div>
              </form>
            )}

            <div className="space-y-2 pt-2">
              <label className="block text-[10px] uppercase tracking-wider text-[#6E6B64] dark:text-[#8C8B84]">
                Thư mục đích lưu ảnh trên Google Drive
              </label>
              <input
                type="text"
                value={settings.driveFolder}
                onChange={(e) => handleUpdate('driveFolder', e.target.value)}
                placeholder="HinhanhAI/Exports"
                className="w-full bg-[#F5F3ED] dark:bg-[#0E0E0D] border border-[#E2DDD5] dark:border-[#292925] p-2.5 text-xs text-[#1C1B18] dark:text-[#E8E7E2] font-mono focus:outline-none focus:border-[#1C1B18] dark:focus:border-[#5E5D57] transition-colors"
              />
            </div>

            <div className="flex items-center justify-between pt-2">
              <div>
                <p className="text-xs text-[#1C1B18] dark:text-[#E8E7E2]">Tự động đồng bộ khi tạo ảnh xong</p>
                <p className="text-[10px] text-[#9C988F] dark:text-[#5E5D57]">
                  Lưu trực tiếp bản gốc độ phân giải cao vào thư mục Drive
                </p>
              </div>
              <input
                type="checkbox"
                checked={settings.autoSync}
                onChange={(e) => handleUpdate('autoSync', e.target.checked)}
                className="w-4 h-4 accent-[#1C1B18] dark:accent-[#D8D3C5] cursor-pointer"
              />
            </div>
          </div>
        </div>

        {/* 5. DEFAULTS */}
        <div className="space-y-4">
          <h3 className="text-[10px] uppercase tracking-[0.2em] text-[#6E6B64] dark:text-[#8C8B84] font-mono border-b border-[#EDE9E1] dark:border-[#1D1D1D] pb-2">
            05 / Thông số mặc định khi khởi tạo (Defaults)
          </h3>

          <div className="border border-[#E2DDD5] dark:border-[#1D1D1B] bg-[#FFFFFF] dark:bg-[#111110] p-5 sm:p-6 space-y-4">
            <div className="flex items-center justify-between">
              <span className="text-[#6E6B64] dark:text-[#8C8B84] uppercase tracking-wider text-[11px]">
                Độ phân giải mặc định
              </span>
              <select
                value={settings.defaultQuality}
                onChange={(e) => handleUpdate('defaultQuality', e.target.value as any)}
                className="bg-[#F5F3ED] dark:bg-[#161614] border border-[#E2DDD5] dark:border-[#292925] text-xs text-[#1C1B18] dark:text-[#E8E7E2] px-3 py-1.5 focus:outline-none font-mono cursor-pointer"
              >
                <option value="standard">Standard (1024px)</option>
                <option value="high">High Definition (2048px)</option>
                <option value="raw">Raw Master (4096px)</option>
              </select>
            </div>

            <div className="flex items-center justify-between">
              <span className="text-[#6E6B64] dark:text-[#8C8B84] uppercase tracking-wider text-[11px]">
                Tỷ lệ khung hình mặc định
              </span>
              <select
                value={settings.defaultRatio}
                onChange={(e) => handleUpdate('defaultRatio', e.target.value as any)}
                className="bg-[#F5F3ED] dark:bg-[#161614] border border-[#E2DDD5] dark:border-[#292925] text-xs text-[#1C1B18] dark:text-[#E8E7E2] px-3 py-1.5 focus:outline-none font-mono cursor-pointer"
              >
                <option value="original">Theo ảnh gốc</option>
                <option value="1:1">1:1 (Vuông)</option>
                <option value="16:9">16:9 (Điện ảnh)</option>
                <option value="9:16">9:16 (Story)</option>
                <option value="4:3">4:3 (Editorial)</option>
                <option value="3:2">3:2 (Nhiếp ảnh 35mm)</option>
                <option value="21:9">21:9 (Cinematic Scope)</option>
                <option value="3:4">3:4 (Chân dung dọc)</option>
                <option value="2:3">2:3 (Poster dọc)</option>
              </select>
            </div>
          </div>
        </div>

        {/* 6. Security */}
        <div className="space-y-4">
          <h3 className="text-[10px] uppercase tracking-[0.2em] text-[#6E6B64] dark:text-[#8C8B84] font-mono border-b border-[#EDE9E1] dark:border-[#1D1D1B] pb-2">
            06 / Bảo mật & Quản lý phiên làm việc
          </h3>

          <div className="border border-[#E2DDD5] dark:border-[#1D1D1B] bg-[#FFFFFF] dark:bg-[#111110] p-5 sm:p-6 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <ShieldCheck size={16} className="text-[#1C1B18] dark:text-[#D8D3C5]" />
              <div>
                <p className="text-xs text-[#1C1B18] dark:text-[#E8E7E2] font-medium">
                  Bảo mật cục bộ (Local Encrypted Storage)
                </p>
                <p className="text-[10px] text-[#9C988F] dark:text-[#5E5D57]">
                  Tất cả API Key và cấu hình được lưu an toàn trực tiếp trên trình duyệt của bạn
                </p>
              </div>
            </div>
            <span className="text-[10px] font-mono text-[#6E6B64] dark:text-[#8C8B84]">SECURED</span>
          </div>
        </div>

        {/* Save Bar */}
        <div className="flex items-center justify-end gap-4 pt-4 border-t border-[#E2DDD5] dark:border-[#1D1D1B]">
          {savedSuccess && (
            <span className="text-[11px] font-mono text-[#15803D] dark:text-[#4ADE80] flex items-center gap-1.5">
              <Check size={13} strokeWidth={2} /> Đã lưu tất cả cấu hình thành công
            </span>
          )}
          <button
            type="button"
            onClick={handleSaveAll}
            className="text-xs uppercase tracking-[0.14em] px-6 py-2.5 bg-[#1C1B18] hover:bg-[#2F2E2B] text-[#F8F7F4] dark:bg-[#D8D3C5] dark:hover:bg-[#E8E7E2] dark:text-[#0B0B0A] font-medium transition-colors cursor-pointer flex items-center gap-2"
          >
            <Sparkles size={13} />
            <span>Lưu tất cả thay đổi</span>
          </button>
        </div>
      </div>

      {/* MODAL: ADD/EDIT PROFILE */}
      {isProfileModalOpen && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4 sm:p-6 overflow-y-auto">
          <div className="w-full max-w-xl bg-[#F8F7F4] dark:bg-[#111110] border border-[#1C1B18] dark:border-[#D8D3C5] p-6 sm:p-8 space-y-6 shadow-2xl my-8">
            <div className="flex items-center justify-between border-b border-[#E2DDD5] dark:border-[#1D1D1B] pb-3">
              <div>
                <h3 className="text-xs uppercase tracking-[0.18em] font-medium text-[#1C1B18] dark:text-[#E8E7E2] flex items-center gap-2">
                  <Key size={14} />
                  {editingProfileId ? 'Chỉnh sửa API Profile' : 'Thêm API Profile mới'}
                </h3>
                <p className="text-[10px] text-[#9C988F] dark:text-[#5E5D57] font-mono mt-0.5">
                  Chọn provider, vai trò và model riêng cho sinh ảnh & phân tích
                </p>
              </div>
              <button
                type="button"
                onClick={() => setIsProfileModalOpen(false)}
                className="text-xs text-[#9C988F] hover:text-[#1C1B18] dark:hover:text-[#E8E7E2] font-mono cursor-pointer"
              >
                [ESC / ĐÓNG]
              </button>
            </div>

            <form onSubmit={handleSaveProfileForm} className="space-y-4 text-xs">
              <div className="space-y-1.5">
                <label className="block text-[10px] uppercase tracking-wider text-[#6E6B64] dark:text-[#8C8B84] font-medium">
                  Tên hiển thị (Profile Name) *
                </label>
                <input
                  type="text"
                  required
                  value={formName}
                  onChange={(e) => setFormName(e.target.value)}
                  placeholder="Ví dụ: My OpenAI Key, Personal Anthropic..."
                  className="w-full bg-[#FFFFFF] dark:bg-[#0E0E0D] border border-[#E2DDD5] dark:border-[#292925] p-2.5 text-xs text-[#1C1B18] dark:text-[#E8E7E2] focus:outline-none focus:border-[#1C1B18] dark:focus:border-[#5E5D57] transition-colors"
                />
              </div>

              <div className="space-y-1.5">
                <label className="block text-[10px] uppercase tracking-wider text-[#6E6B64] dark:text-[#8C8B84] font-medium">
                  Loại nhà cung cấp (Provider) *
                </label>
                <select
                  value={formProvider}
                  onChange={(e) => handleProviderChange(e.target.value as ApiProviderType)}
                  className="w-full bg-[#FFFFFF] dark:bg-[#0E0E0D] border border-[#E2DDD5] dark:border-[#292925] p-2.5 text-xs text-[#1C1B18] dark:text-[#E8E7E2] font-mono focus:outline-none focus:border-[#1C1B18] dark:focus:border-[#5E5D57] cursor-pointer"
                >
                  <option value="gemini">Google Gemini & Imagen</option>
                  <option value="openai">OpenAI / OpenAI-compatible</option>
                  <option value="anthropic">Anthropic (chỉ phân tích ảnh)</option>
                </select>
              </div>

              <div className="space-y-1.5">
                <label className="block text-[10px] uppercase tracking-wider text-[#6E6B64] dark:text-[#8C8B84] font-medium">
                  Vai trò (Role) *
                </label>
                <select
                  value={formRole}
                  onChange={(e) => setFormRole(e.target.value as ApiProfileRole)}
                  className="w-full bg-[#FFFFFF] dark:bg-[#0E0E0D] border border-[#E2DDD5] dark:border-[#292925] p-2.5 text-xs text-[#1C1B18] dark:text-[#E8E7E2] font-mono focus:outline-none focus:border-[#1C1B18] dark:focus:border-[#5E5D57] cursor-pointer"
                  disabled={formProvider === 'anthropic'}
                >
                  {ROLE_OPTIONS.map((opt) => (
                    <option
                      key={opt.value}
                      value={opt.value}
                      disabled={formProvider === 'anthropic' && opt.value !== 'analyze'}
                    >
                      {opt.label}
                    </option>
                  ))}
                </select>
                <p className="text-[10px] text-[#9C988F] dark:text-[#5E5D57] italic">
                  {formProvider === 'anthropic'
                    ? 'Anthropic chỉ hỗ trợ phân tích — role render/bị bỏ qua.'
                    : 'Cả hai: dùng được cho cả sinh ảnh và phân tích.'}
                </p>
              </div>

              <div className="space-y-1.5">
                <label className="block text-[10px] uppercase tracking-wider text-[#6E6B64] dark:text-[#8C8B84] font-medium">
                  API Endpoint URL
                </label>
                <input
                  type="text"
                  value={formEndpoint}
                  onChange={(e) => setFormEndpoint(e.target.value)}
                  placeholder={PROVIDER_PRESETS[formProvider].endpoint}
                  className="w-full bg-[#FFFFFF] dark:bg-[#0E0E0D] border border-[#E2DDD5] dark:border-[#292925] p-2.5 text-xs text-[#1C1B18] dark:text-[#E8E7E2] font-mono focus:outline-none focus:border-[#1C1B18] dark:focus:border-[#5E5D57] transition-colors"
                />
                {formProvider !== 'gemini' && (
                  <p className="text-[10px] text-[#9C988F] dark:text-[#5E5D57] italic">
                    Nhập endpoint OpenAI-compatible bất kỳ (VD: 1endpoint.dev, api.together.xyz, OpenRouter...).
                  </p>
                )}
              </div>

              <div className="space-y-1.5">
                <div className="flex items-center justify-between">
                  <label className="text-[10px] uppercase tracking-wider text-[#6E6B64] dark:text-[#8C8B84] font-medium">
                    API Key / Secret Token
                  </label>
                  <button
                    type="button"
                    onClick={() => setShowModalApiKey(!showModalApiKey)}
                    className="text-[10px] text-[#9C988F] hover:text-[#1C1B18] dark:hover:text-[#E8E7E2] font-mono cursor-pointer"
                  >
                    {showModalApiKey ? 'Ẩn khóa' : 'Hiện khóa'}
                  </button>
                </div>
                <input
                  type={showModalApiKey ? 'text' : 'password'}
                  value={formApiKey}
                  onChange={(e) => setFormApiKey(e.target.value)}
                  placeholder={formProvider === 'gemini' ? 'Để trống nếu muốn dùng GEMINI_API_KEY của server' : 'sk-... / API key...'}
                  className="w-full bg-[#FFFFFF] dark:bg-[#0E0E0D] border border-[#E2DDD5] dark:border-[#292925] p-2.5 text-xs text-[#1C1B18] dark:text-[#E8E7E2] font-mono focus:outline-none focus:border-[#1C1B18] dark:focus:border-[#5E5D57] transition-colors"
                />
              </div>

              {formProvider !== 'anthropic' && (
                <div className="space-y-1.5">
                  <label className="block text-[10px] uppercase tracking-wider text-[#6E6B64] dark:text-[#8C8B84] font-medium">
                    Model Sinh ảnh (Render Model) *
                  </label>
                  <input
                    type="text"
                    required
                    value={formRenderModel}
                    onChange={(e) => setFormRenderModel(e.target.value)}
                    placeholder={PROVIDER_PRESETS[formProvider].renderModel}
                    className="w-full bg-[#FFFFFF] dark:bg-[#0E0E0D] border border-[#E2DDD5] dark:border-[#292925] p-2.5 text-xs text-[#1C1B18] dark:text-[#E8E7E2] font-mono focus:outline-none focus:border-[#1C1B18] dark:focus:border-[#5E5D57] transition-colors"
                  />
                </div>
              )}

              <div className="space-y-1.5">
                <label className="block text-[10px] uppercase tracking-wider text-[#6E6B64] dark:text-[#8C8B84] font-medium">
                  Model Phân tích (Analyze Model) *
                </label>
                <input
                  type="text"
                  required
                  value={formAnalyzeModel}
                  onChange={(e) => setFormAnalyzeModel(e.target.value)}
                  placeholder={PROVIDER_PRESETS[formProvider].analyzeModel}
                  className="w-full bg-[#FFFFFF] dark:bg-[#0E0E0D] border border-[#E2DDD5] dark:border-[#292925] p-2.5 text-xs text-[#1C1B18] dark:text-[#E8E7E2] font-mono focus:outline-none focus:border-[#1C1B18] dark:focus:border-[#5E5D57] transition-colors"
                />
              </div>

              <div className="space-y-1.5">
                <label className="block text-[10px] uppercase tracking-wider text-[#6E6B64] dark:text-[#8C8B84]">
                  Ghi chú (Notes)
                </label>
                <input
                  type="text"
                  value={formNotes}
                  onChange={(e) => setFormNotes(e.target.value)}
                  placeholder="Ghi chú..."
                  className="w-full bg-[#FFFFFF] dark:bg-[#0E0E0D] border border-[#E2DDD5] dark:border-[#292925] p-2 text-xs text-[#1C1B18] dark:text-[#E8E7E2] focus:outline-none focus:border-[#1C1B18] dark:focus:border-[#5E5D57]"
                />
              </div>

              <div className="flex items-center justify-end gap-3 pt-4 border-t border-[#E2DDD5] dark:border-[#1D1D1B]">
                <button
                  type="button"
                  onClick={() => setIsProfileModalOpen(false)}
                  className="px-4 py-2 text-[10px] uppercase border border-[#E2DDD5] dark:border-[#292925] text-[#6E6B64] dark:text-[#8C8B84] hover:text-[#1C1B18] dark:hover:text-[#E8E7E2] cursor-pointer"
                >
                  Hủy bỏ
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 text-[10px] uppercase tracking-[0.14em] bg-[#1C1B18] hover:bg-[#2F2E2B] text-[#F8F7F4] dark:bg-[#D8D3C5] dark:hover:bg-[#E8E7E2] dark:text-[#0B0B0A] font-medium cursor-pointer"
                >
                  {editingProfileId ? 'Cập nhật' : 'Lưu profile'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
