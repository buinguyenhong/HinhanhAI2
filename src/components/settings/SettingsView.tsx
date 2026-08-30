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
} from 'lucide-react';
import { useTheme } from '../../context/ThemeContext';
import {
  loadAppSettings,
  saveAppSettings,
  AppSettings,
  ApiProfile,
  ApiProviderType,
  getActiveProfile,
} from '../../services/storageService';
import {
  authenticateWithGoogleDrive,
  disconnectGoogleDrive,
  getStoredAccessToken,
  getStoredUserEmail,
} from '../../services/googleDriveService';

export const SettingsView: React.FC = () => {
  const { theme, setTheme } = useTheme();
  const [settings, setSettings] = useState<AppSettings>(loadAppSettings);
  const [savedSuccess, setSavedSuccess] = useState(false);

  // Drive state
  const [showDriveConnectModal, setShowDriveConnectModal] = useState(false);
  const [driveEmailInput, setDriveEmailInput] = useState('');

  // API testing state
  const [testingProfileId, setTestingProfileId] = useState<string | null>(null);
  const [testResults, setTestResults] = useState<
    Record<string, { status: 'success' | 'error'; message: string; latency?: number }>
  >({});

  // Modal / Form state for Add/Edit API Profile
  const [isProfileModalOpen, setIsProfileModalOpen] = useState(false);
  const [editingProfileId, setEditingProfileId] = useState<string | null>(null);
  const [showModalApiKey, setShowModalApiKey] = useState(false);

  // Profile Form Fields
  const [formName, setFormName] = useState('');
  const [formProvider, setFormProvider] = useState<ApiProviderType>('openai');
  const [formEndpoint, setFormEndpoint] = useState('');
  const [formApiKey, setFormApiKey] = useState('');
  const [formModel, setFormModel] = useState('');
  const [formHeaders, setFormHeaders] = useState('');
  const [formNotes, setFormNotes] = useState('');

  useEffect(() => {
    setSettings((prev) => ({ ...prev, theme }));
  }, [theme]);

  const activeProfile = getActiveProfile(settings);

  const handleUpdate = <K extends keyof AppSettings>(key: K, value: AppSettings[K]) => {
    setSettings((prev) => {
      const next = { ...prev, [key]: value };
      saveAppSettings(next);
      return next;
    });
  };

  const handleSelectActiveProfile = (profileId: string) => {
    const profile = settings.apiProfiles.find((p) => p.id === profileId);
    if (!profile) return;
    setSettings((prev) => {
      const next = {
        ...prev,
        activeProfileId: profileId,
        apiProvider: profile.provider,
        apiKey: profile.apiKey,
        apiEndpoint: profile.apiEndpoint,
        selectedModel: profile.selectedModel,
      };
      saveAppSettings(next);
      return next;
    });
  };

  const handleOpenAddModal = () => {
    setEditingProfileId(null);
    setFormName('');
    setFormProvider('openai');
    setFormEndpoint('https://api.openai.com/v1/images/generations');
    setFormApiKey('');
    setFormModel('dall-e-3');
    setFormHeaders('');
    setFormNotes('Nhà cung cấp tương thích OpenAI');
    setShowModalApiKey(false);
    setIsProfileModalOpen(true);
  };

  const handleOpenEditModal = (profile: ApiProfile) => {
    setEditingProfileId(profile.id);
    setFormName(profile.name);
    setFormProvider(profile.provider);
    setFormEndpoint(profile.apiEndpoint);
    setFormApiKey(profile.apiKey || '');
    setFormModel(profile.selectedModel);
    setFormHeaders(profile.customHeaders || '');
    setFormNotes(profile.notes || '');
    setShowModalApiKey(false);
    setIsProfileModalOpen(true);
  };

  const handleSaveProfileForm = (e: React.FormEvent) => {
    e.preventDefault();
    if (!formName.trim()) return;

    if (editingProfileId) {
      // Update existing
      const updatedProfiles = settings.apiProfiles.map((p) => {
        if (p.id === editingProfileId) {
          return {
            ...p,
            name: formName.trim(),
            provider: formProvider,
            apiEndpoint: formEndpoint.trim(),
            apiKey: formApiKey.trim(),
            selectedModel: formModel.trim(),
            customHeaders: formHeaders.trim(),
            notes: formNotes.trim(),
          };
        }
        return p;
      });

      const nextSettings = { ...settings, apiProfiles: updatedProfiles };
      // If currently active was edited, sync active fields
      if (settings.activeProfileId === editingProfileId) {
        nextSettings.apiProvider = formProvider;
        nextSettings.apiKey = formApiKey.trim();
        nextSettings.apiEndpoint = formEndpoint.trim();
        nextSettings.selectedModel = formModel.trim();
      }
      setSettings(nextSettings);
      saveAppSettings(nextSettings);
    } else {
      // Create new profile
      const newId = 'custom-' + Math.random().toString(36).substring(2, 9);
      const newProfile: ApiProfile = {
        id: newId,
        name: formName.trim(),
        provider: formProvider,
        apiEndpoint: formEndpoint.trim(),
        apiKey: formApiKey.trim(),
        selectedModel: formModel.trim(),
        customHeaders: formHeaders.trim(),
        notes: formNotes.trim(),
        isCustom: true,
        createdAt: new Date().toISOString().split('T')[0],
      };

      const nextSettings = {
        ...settings,
        apiProfiles: [...settings.apiProfiles, newProfile],
        activeProfileId: newId, // auto activate newly added
        apiProvider: newProfile.provider,
        apiKey: newProfile.apiKey,
        apiEndpoint: newProfile.apiEndpoint,
        selectedModel: newProfile.selectedModel,
      };
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
    let newActiveId = settings.activeProfileId;
    if (settings.activeProfileId === profileId) {
      newActiveId = filtered[0].id;
    }

    const nextSettings = {
      ...settings,
      apiProfiles: filtered,
      activeProfileId: newActiveId,
    };
    setSettings(nextSettings);
    saveAppSettings(nextSettings);
  };

  const handleTestProfileConnection = (profile: ApiProfile) => {
    setTestingProfileId(profile.id);
    setTestResults((prev) => {
      const next = { ...prev };
      delete next[profile.id];
      return next;
    });

    setTimeout(() => {
      setTestingProfileId(null);
      const isGemini = profile.provider === 'gemini';
      const hasKey = Boolean(profile.apiKey.trim());

      if (!hasKey && !isGemini) {
        setTestResults((prev) => ({
          ...prev,
          [profile.id]: {
            status: 'error',
            message: 'Thiếu API Key cho nhà cung cấp này. Vui lòng bấm Sửa để bổ sung.',
          },
        }));
      } else {
        setTestResults((prev) => ({
          ...prev,
          [profile.id]: {
            status: 'error',
            message: 'Không có kiểm tra giả lập. Hãy tạo ảnh để xác thực kết nối với nhà cung cấp.',
          },
        }));
      }
    }, 1100);
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

  return (
    <div className="max-w-3xl mx-auto space-y-12 pb-16 transition-colors">
      {/* Top Header */}
      <div className="flex items-baseline justify-between border-b border-[#E2DDD5] dark:border-[#1D1D1B] pb-4">
        <div>
          <h2 className="text-xs uppercase tracking-[0.2em] font-medium text-[#1C1B18] dark:text-[#E8E7E2]">
            Preferences & Multi-API Manager
          </h2>
          <p className="text-[10px] text-[#9C988F] dark:text-[#5E5D57] font-mono mt-0.5">
            Quản lý danh sách API sinh & sửa ảnh (Custom API / Gemini / Flux), giao diện và Google Drive
          </p>
        </div>
        <span className="text-[10px] font-mono text-[#6E6B64] dark:text-[#8C8B84]">
          STUDIO BUILD v2.6
        </span>
      </div>

      <div className="space-y-10 text-xs">
        {/* 1. Theme Configuration Section */}
        <div className="space-y-4">
          <h3 className="text-[10px] uppercase tracking-[0.2em] text-[#6E6B64] dark:text-[#8C8B84] font-mono border-b border-[#EDE9E1] dark:border-[#1D1D1B] pb-2">
            01 / Giao diện & Trực quan (Theme)
          </h3>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-1">
            {/* Light Mode Option */}
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

            {/* Dark Mode Option */}
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

        {/* 2. MULTI-API PROFILE MANAGER & CUSTOM API SECTION */}
        <div className="space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-[#EDE9E1] dark:border-[#1D1D1B] pb-2">
            <div>
              <h3 className="text-[10px] uppercase tracking-[0.2em] text-[#6E6B64] dark:text-[#8C8B84] font-mono flex items-center gap-2">
                <Key size={12} />
                02 / Danh sách API & Custom Endpoints ({settings.apiProfiles.length})
              </h3>
              <p className="text-[10px] text-[#9C988F] dark:text-[#5E5D57] font-mono mt-0.5">
                Bạn có thể thêm nhiều API và chọn 1 API bất kỳ để kích hoạt sử dụng
              </p>
            </div>

            <button
              type="button"
              onClick={handleOpenAddModal}
              className="text-xs uppercase tracking-[0.14em] px-3.5 py-1.5 bg-[#1C1B18] hover:bg-[#2F2E2B] text-[#F8F7F4] dark:bg-[#D8D3C5] dark:hover:bg-[#E8E7E2] dark:text-[#0B0B0A] font-medium transition-colors flex items-center gap-1.5 cursor-pointer self-start sm:self-auto"
            >
              <Plus size={13} />
              <span>Thêm API / Custom Endpoint</span>
            </button>
          </div>

          {/* Active API Banner */}
          <div className="p-4 border border-[#1C1B18] dark:border-[#D8D3C5] bg-[#F5F3ED] dark:bg-[#151514] flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-[#1C1B18] text-[#F8F7F4] dark:bg-[#D8D3C5] dark:text-[#0B0B0A] rounded-xs">
                <Zap size={15} />
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <span className="text-[10px] uppercase tracking-wider font-mono text-[#9C988F] dark:text-[#5E5D57]">
                    API Đang sử dụng (Active Engine):
                  </span>
                  <span className="text-[9px] font-mono uppercase px-1.5 py-0.2 bg-[#22C55E]/20 text-[#15803D] dark:text-[#4ADE80] font-semibold">
                    ĐANG HOẠT ĐỘNG
                  </span>
                </div>
                <p className="text-xs font-semibold text-[#1C1B18] dark:text-[#E8E7E2] mt-0.5">
                  {activeProfile.name}
                  <span className="font-normal text-[#6E6B64] dark:text-[#8C8B84] text-[11px] ml-2 font-mono">
                    ({activeProfile.selectedModel})
                  </span>
                </p>
              </div>
            </div>

            <span className="text-[10px] font-mono text-[#6E6B64] dark:text-[#8C8B84] truncate max-w-xs">
              {activeProfile.apiEndpoint}
            </span>
          </div>

          {/* List of Configured API Profiles */}
          <div className="space-y-3 pt-1">
            {settings.apiProfiles.map((profile) => {
              const isActive = profile.id === settings.activeProfileId;
              const testResult = testResults[profile.id];
              const isTesting = testingProfileId === profile.id;

              return (
                <div
                  key={profile.id}
                  className={`p-4 sm:p-5 border transition-all ${
                    isActive
                      ? 'border-[#1C1B18] dark:border-[#D8D3C5] bg-[#FFFFFF] dark:bg-[#111110] shadow-sm'
                      : 'border-[#E2DDD5] dark:border-[#1D1D1B] bg-[#FFFFFF] dark:bg-[#111110] hover:border-[#CCC7BE] dark:hover:border-[#333330]'
                  }`}
                >
                  <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-4">
                    {/* Left: Info & Provider Badge */}
                    <div className="space-y-1.5 flex-1 min-w-0">
                      <div className="flex items-center gap-2.5 flex-wrap">
                        {/* Radio selection */}
                        <button
                          type="button"
                          onClick={() => handleSelectActiveProfile(profile.id)}
                          className="flex items-center gap-2 cursor-pointer group text-left"
                        >
                          <div
                            className={`w-4 h-4 rounded-full border flex items-center justify-center transition-colors ${
                              isActive
                                ? 'border-[#1C1B18] dark:border-[#D8D3C5] bg-[#1C1B18] dark:bg-[#D8D3C5]'
                                : 'border-[#9C988F] group-hover:border-[#1C1B18] dark:group-hover:border-[#E8E7E2]'
                            }`}
                          >
                            {isActive && (
                              <div className="w-1.5 h-1.5 rounded-full bg-[#F8F7F4] dark:bg-[#0B0B0A]" />
                            )}
                          </div>
                          <span
                            className={`text-xs font-medium ${
                              isActive
                                ? 'text-[#1C1B18] dark:text-[#E8E7E2] font-semibold'
                                : 'text-[#6E6B64] dark:text-[#8C8B84] group-hover:text-[#1C1B18] dark:group-hover:text-[#E8E7E2]'
                            }`}
                          >
                            {profile.name}
                          </span>
                        </button>

                        {/* Provider tag */}
                        <span className="text-[9px] font-mono uppercase px-2 py-0.5 border border-[#E2DDD5] dark:border-[#292925] bg-[#F5F3ED] dark:bg-[#161614] text-[#6E6B64] dark:text-[#8C8B84]">
                          {profile.provider.toUpperCase()}
                        </span>

                        {isActive && (
                          <span className="text-[9px] font-mono uppercase px-2 py-0.5 bg-[#1C1B18] text-[#F8F7F4] dark:bg-[#D8D3C5] dark:text-[#0B0B0A] font-semibold">
                            ACTIVE
                          </span>
                        )}
                      </div>

                      {/* Endpoint & Model details */}
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-[10px] font-mono text-[#9C988F] dark:text-[#5E5D57] pt-1">
                        <div className="truncate flex items-center gap-1.5">
                          <Server size={11} className="shrink-0" />
                          <span className="text-[#6E6B64] dark:text-[#8C8B84]">Endpoint:</span>
                          <span className="truncate">{profile.apiEndpoint}</span>
                        </div>
                        <div className="flex items-center gap-1.5">
                          <Cpu size={11} className="shrink-0" />
                          <span className="text-[#6E6B64] dark:text-[#8C8B84]">Model:</span>
                          <span className="text-[#1C1B18] dark:text-[#E8E7E2]">
                            {profile.selectedModel}
                          </span>
                        </div>
                      </div>

                      {/* API Key mask */}
                      <div className="text-[10px] font-mono text-[#9C988F] dark:text-[#5E5D57] flex items-center gap-1.5">
                        <Key size={11} className="shrink-0" />
                        <span className="text-[#6E6B64] dark:text-[#8C8B84]">API Key:</span>
                        <span>
                          {profile.apiKey
                            ? `••••••••••••${profile.apiKey.slice(-4)}`
                            : profile.provider === 'gemini'
                            ? 'Auto GEMINI_API_KEY (AI Studio)'
                            : 'Chưa cấu hình khóa'}
                        </span>
                      </div>

                      {profile.notes && (
                        <p className="text-[10px] text-[#9C988F] dark:text-[#5E5D57] italic pt-0.5">
                          {profile.notes}
                        </p>
                      )}
                    </div>

                    {/* Right: Actions */}
                    <div className="flex items-center gap-2 self-end sm:self-center shrink-0">
                      {/* Activate Button if not active */}
                      {!isActive && (
                        <button
                          type="button"
                          onClick={() => handleSelectActiveProfile(profile.id)}
                          className="px-3 py-1 text-[10px] uppercase font-mono border border-[#1C1B18] dark:border-[#D8D3C5] hover:bg-[#1C1B18] hover:text-[#F8F7F4] dark:hover:bg-[#D8D3C5] dark:hover:text-[#0B0B0A] text-[#1C1B18] dark:text-[#E8E7E2] transition-colors cursor-pointer"
                        >
                          Chọn dùng
                        </button>
                      )}

                      {/* Test Connection Button */}
                      <button
                        type="button"
                        onClick={() => handleTestProfileConnection(profile)}
                        disabled={isTesting}
                        title="Kiểm tra kết nối tới API này"
                        className="p-1.5 border border-[#E2DDD5] dark:border-[#292925] text-[#6E6B64] dark:text-[#8C8B84] hover:text-[#1C1B18] dark:hover:text-[#E8E7E2] hover:border-[#CCC7BE] transition-colors cursor-pointer"
                      >
                        <RefreshCw size={13} className={isTesting ? 'animate-spin' : ''} />
                      </button>

                      {/* Edit Button */}
                      <button
                        type="button"
                        onClick={() => handleOpenEditModal(profile)}
                        title="Chỉnh sửa cấu hình"
                        className="p-1.5 border border-[#E2DDD5] dark:border-[#292925] text-[#6E6B64] dark:text-[#8C8B84] hover:text-[#1C1B18] dark:hover:text-[#E8E7E2] hover:border-[#CCC7BE] transition-colors cursor-pointer"
                      >
                        <Edit2 size={13} />
                      </button>

                      {/* Delete Button */}
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

                  {/* Test Result Message Box */}
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

        {/* 3. GOOGLE DRIVE SYNC SETTINGS */}
        <div className="space-y-4">
          <div className="flex items-center justify-between border-b border-[#EDE9E1] dark:border-[#1D1D1B] pb-2">
            <h3 className="text-[10px] uppercase tracking-[0.2em] text-[#6E6B64] dark:text-[#8C8B84] font-mono flex items-center gap-2">
              <HardDrive size={12} />
              03 / Google Drive Sync & Storage
            </h3>
            <span className="text-[9px] font-mono text-[#9C988F] dark:text-[#5E5D57]">
              CLOUD BACKUP
            </span>
          </div>

          <div className="space-y-4 border border-[#E2DDD5] dark:border-[#1D1D1B] bg-[#FFFFFF] dark:bg-[#111110] p-5 sm:p-6">
            {/* Status Header */}
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

            {/* Modal for connecting Drive */}
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

            {/* Folder setting */}
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

            {/* Auto sync */}
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

        {/* 4. STUDIO ENGINE DEFAULTS */}
        <div className="space-y-4">
          <h3 className="text-[10px] uppercase tracking-[0.2em] text-[#6E6B64] dark:text-[#8C8B84] font-mono border-b border-[#EDE9E1] dark:border-[#1D1D1B] pb-2">
            04 / Thông số mặc định khi khởi tạo (Defaults)
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
              </select>
            </div>
          </div>
        </div>

        {/* 5. SECURITY STATUS */}
        <div className="space-y-4">
          <h3 className="text-[10px] uppercase tracking-[0.2em] text-[#6E6B64] dark:text-[#8C8B84] font-mono border-b border-[#EDE9E1] dark:border-[#1D1D1B] pb-2">
            05 / Bảo mật & Quản lý phiên làm việc
          </h3>

          <div className="border border-[#E2DDD5] dark:border-[#1D1D1B] bg-[#FFFFFF] dark:bg-[#111110] p-5 sm:p-6 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <ShieldCheck size={16} className="text-[#1C1B18] dark:text-[#D8D3C5]" />
              <div>
                <p className="text-xs text-[#1C1B18] dark:text-[#E8E7E2] font-medium">
                  Bảo mật cục bộ (Local Encrypted Storage)
                </p>
                <p className="text-[10px] text-[#9C988F] dark:text-[#5E5D57]">
                  Tất cả API Key, cấu hình Custom API và thông tin riêng tư được lưu an toàn trực tiếp trên trình duyệt của bạn
                </p>
              </div>
            </div>
            <span className="text-[10px] font-mono text-[#6E6B64] dark:text-[#8C8B84]">SECURED</span>
          </div>
        </div>

        {/* Action Save Bar */}
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

      {/* MODAL / DRAWER: ADD OR EDIT API PROFILE */}
      {isProfileModalOpen && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4 sm:p-6 overflow-y-auto">
          <div className="w-full max-w-xl bg-[#F8F7F4] dark:bg-[#111110] border border-[#1C1B18] dark:border-[#D8D3C5] p-6 sm:p-8 space-y-6 shadow-2xl my-8">
            <div className="flex items-center justify-between border-b border-[#E2DDD5] dark:border-[#1D1D1B] pb-3">
              <div>
                <h3 className="text-xs uppercase tracking-[0.18em] font-medium text-[#1C1B18] dark:text-[#E8E7E2] flex items-center gap-2">
                  <Key size={14} />
                  {editingProfileId ? 'Chỉnh sửa Cấu hình API' : 'Thêm Cấu hình API mới'}
                </h3>
                <p className="text-[10px] text-[#9C988F] dark:text-[#5E5D57] font-mono mt-0.5">
                  Thiết lập endpoint, API Key và Model ID để tạo hoặc chỉnh sửa ảnh
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
              {/* Profile Name */}
              <div className="space-y-1.5">
                <label className="block text-[10px] uppercase tracking-wider text-[#6E6B64] dark:text-[#8C8B84] font-medium">
                  Tên hiển thị API (Profile Name) *
                </label>
                <input
                  type="text"
                  required
                  value={formName}
                  onChange={(e) => setFormName(e.target.value)}
                  placeholder="Ví dụ: My RunPod ComfyUI, Personal Gemini Key, Stability Production..."
                  className="w-full bg-[#FFFFFF] dark:bg-[#0E0E0D] border border-[#E2DDD5] dark:border-[#292925] p-2.5 text-xs text-[#1C1B18] dark:text-[#E8E7E2] focus:outline-none focus:border-[#1C1B18] dark:focus:border-[#5E5D57] transition-colors"
                />
              </div>

              {/* Provider Selection */}
              <div className="space-y-1.5">
                <label className="block text-[10px] uppercase tracking-wider text-[#6E6B64] dark:text-[#8C8B84] font-medium">
                  Loại nhà cung cấp (API Provider Type)
                </label>
                <select
                  value={formProvider}
                  onChange={(e) => {
                    const prov = e.target.value as ApiProviderType;
                    setFormProvider(prov);
                    // auto preset suggestions
                    if (prov === 'gemini') {
                      setFormEndpoint('https://generativelanguage.googleapis.com');
                      setFormModel('imagen-3.0-generate-002');
                    } else if (prov === 'openai') {
                      setFormEndpoint('https://api.openai.com/v1/images/generations');
                      setFormModel('dall-e-3');
                    }
                  }}
                  className="w-full bg-[#FFFFFF] dark:bg-[#0E0E0D] border border-[#E2DDD5] dark:border-[#292925] p-2.5 text-xs text-[#1C1B18] dark:text-[#E8E7E2] font-mono focus:outline-none focus:border-[#1C1B18] dark:focus:border-[#5E5D57] cursor-pointer"
                >
                  <option value="gemini">Google Gemini</option>
                  <option value="openai">OpenAI-compatible Image API</option>
                </select>
              </div>

              {/* Base Endpoint */}
              <div className="space-y-1.5">
                <label className="block text-[10px] uppercase tracking-wider text-[#6E6B64] dark:text-[#8C8B84] font-medium">
                  API Base Endpoint URL *
                </label>
                <input
                  type="text"
                  required
                  value={formEndpoint}
                  onChange={(e) => setFormEndpoint(e.target.value)}
                  placeholder="https://api.domain.com/v1/images/generations"
                  className="w-full bg-[#FFFFFF] dark:bg-[#0E0E0D] border border-[#E2DDD5] dark:border-[#292925] p-2.5 text-xs text-[#1C1B18] dark:text-[#E8E7E2] font-mono focus:outline-none focus:border-[#1C1B18] dark:focus:border-[#5E5D57] transition-colors"
                />
              </div>

              {/* API Key */}
              <div className="space-y-1.5">
                <div className="flex items-center justify-between">
                  <label className="text-[10px] uppercase tracking-wider text-[#6E6B64] dark:text-[#8C8B84] font-medium">
                    API Key / Secret Token (Tùy chọn nếu proxy nội bộ)
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
                  placeholder="AIzaSy... / sk-... / bearer token..."
                  className="w-full bg-[#FFFFFF] dark:bg-[#0E0E0D] border border-[#E2DDD5] dark:border-[#292925] p-2.5 text-xs text-[#1C1B18] dark:text-[#E8E7E2] font-mono focus:outline-none focus:border-[#1C1B18] dark:focus:border-[#5E5D57] transition-colors"
                />
              </div>

              {/* Model Name */}
              <div className="space-y-1.5">
                <label className="block text-[10px] uppercase tracking-wider text-[#6E6B64] dark:text-[#8C8B84] font-medium">
                  Tên Mô hình AI (Model ID / Checkpoint) *
                </label>
                <input
                  type="text"
                  required
                  value={formModel}
                  onChange={(e) => setFormModel(e.target.value)}
                  placeholder="gemini-2.5-flash-image / dall-e-3"
                  className="w-full bg-[#FFFFFF] dark:bg-[#0E0E0D] border border-[#E2DDD5] dark:border-[#292925] p-2.5 text-xs text-[#1C1B18] dark:text-[#E8E7E2] font-mono focus:outline-none focus:border-[#1C1B18] dark:focus:border-[#5E5D57] transition-colors"
                />
              </div>

              {/* Custom Headers */}
              <div className="space-y-1.5">
                <label className="block text-[10px] uppercase tracking-wider text-[#6E6B64] dark:text-[#8C8B84] font-medium">
                  Custom HTTP Headers (Định dạng JSON tùy chọn)
                </label>
                <textarea
                  rows={3}
                  value={formHeaders}
                  onChange={(e) => setFormHeaders(e.target.value)}
                  placeholder='{\n  "Authorization": "Bearer ...",\n  "X-Custom-Header": "value"\n}'
                  className="w-full bg-[#FFFFFF] dark:bg-[#0E0E0D] border border-[#E2DDD5] dark:border-[#292925] p-2 text-xs text-[#1C1B18] dark:text-[#E8E7E2] font-mono focus:outline-none focus:border-[#1C1B18] dark:focus:border-[#5E5D57] transition-colors"
                />
              </div>

              {/* Notes */}
              <div className="space-y-1.5">
                <label className="block text-[10px] uppercase tracking-wider text-[#6E6B64] dark:text-[#8C8B84]">
                  Ghi chú (Notes)
                </label>
                <input
                  type="text"
                  value={formNotes}
                  onChange={(e) => setFormNotes(e.target.value)}
                  placeholder="Ghi chú về tốc độ, chi phí hoặc mục đích sử dụng..."
                  className="w-full bg-[#FFFFFF] dark:bg-[#0E0E0D] border border-[#E2DDD5] dark:border-[#292925] p-2 text-xs text-[#1C1B18] dark:text-[#E8E7E2] focus:outline-none focus:border-[#1C1B18] dark:focus:border-[#5E5D57]"
                />
              </div>

              {/* Actions in modal */}
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
                  {editingProfileId ? 'Cập nhật cấu hình' : 'Lưu & Kích hoạt API'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
