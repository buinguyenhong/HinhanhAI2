import React, { useState } from 'react';
import { GenerationSettings, AspectRatio, QualityMode } from '../../types';
import { ChevronDown, ChevronUp, Key, Cpu, Zap } from 'lucide-react';
import { loadAppSettings, saveAppSettings, ApiProfile } from '../../services/storageService';

interface OutputSettingsProps {
  settings: GenerationSettings;
  onChange: (settings: GenerationSettings) => void;
  onActiveProfileChange?: (profile: ApiProfile) => void;
}

export const OutputSettings: React.FC<OutputSettingsProps> = ({
  settings,
  onChange,
  onActiveProfileChange,
}) => {
  const [showAdvanced, setShowAdvanced] = useState(false);
  const appSettings = loadAppSettings();
  const [activeProfileId, setActiveProfileId] = useState(appSettings.activeProfileId);

  const update = <K extends keyof GenerationSettings>(
    key: K,
    value: GenerationSettings[K]
  ) => {
    onChange({ ...settings, [key]: value });
  };

  const handleSwitchProfile = (profileId: string) => {
    setActiveProfileId(profileId);
    const profile = appSettings.apiProfiles.find((p) => p.id === profileId);
    if (profile) {
      const nextSettings = {
        ...appSettings,
        activeProfileId: profileId,
        apiProvider: profile.provider,
        apiKey: profile.apiKey,
        apiEndpoint: profile.apiEndpoint,
        selectedModel: profile.selectedModel,
      };
      saveAppSettings(nextSettings);
      update('model', profile.selectedModel);
      if (onActiveProfileChange) {
        onActiveProfileChange(profile);
      }
    }
  };

  const activeProfile =
    appSettings.apiProfiles.find((p) => p.id === activeProfileId) ||
    appSettings.apiProfiles[0];

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <label className="text-[10px] uppercase tracking-[0.18em] font-medium text-[#1C1B18] dark:text-[#8C8B84]">
          Output & Engine Settings
        </label>
        <button
          type="button"
          onClick={() => setShowAdvanced(!showAdvanced)}
          className="text-[10px] uppercase tracking-[0.12em] text-[#9C988F] dark:text-[#5E5D57] hover:text-[#1C1B18] dark:hover:text-[#8C8B84] transition-colors flex items-center gap-1 cursor-pointer"
        >
          <span>{showAdvanced ? 'Thu gọn' : 'Advanced +'}</span>
          {showAdvanced ? <ChevronUp size={11} /> : <ChevronDown size={11} />}
        </button>
      </div>

      {/* Primary Clean Rows */}
      <div className="space-y-3 border-t border-[#EDE9E1] dark:border-[#1D1D1B] pt-3 text-xs">
        {/* Active API Selector */}
        <div className="flex items-center justify-between py-1 border-b border-[#EDE9E1] dark:border-[#1D1D1B] pb-2">
          <span className="text-[#6E6B64] dark:text-[#8C8B84] text-[11px] uppercase tracking-wider flex items-center gap-1.5 font-medium">
            <Key size={11} className="text-[#1C1B18] dark:text-[#D8D3C5]" />
            API Engine
          </span>
          <select
            value={activeProfileId}
            onChange={(e) => handleSwitchProfile(e.target.value)}
            className="bg-transparent text-right text-xs font-semibold text-[#1C1B18] dark:text-[#E8E7E2] focus:outline-none cursor-pointer border-b border-transparent hover:border-[#CCC7BE] dark:hover:border-[#3A3935] focus:border-[#1C1B18] dark:focus:border-[#5E5D57] transition-colors appearance-none font-mono py-0.5 max-w-[200px] truncate"
          >
            {appSettings.apiProfiles.map((p) => (
              <option
                key={p.id}
                value={p.id}
                className="bg-[#FFFFFF] text-[#1C1B18] dark:bg-[#111110] dark:text-[#E8E7E2]"
              >
                {p.name} {p.id === activeProfileId ? '(Active)' : ''}
              </option>
            ))}
          </select>
        </div>

        {/* Ratio */}
        <div className="flex items-center justify-between py-1">
          <span className="text-[#6E6B64] dark:text-[#8C8B84] text-[11px] uppercase tracking-wider">
            Tỷ lệ (Ratio)
          </span>
          <select
            value={settings.aspectRatio}
            onChange={(e) => update('aspectRatio', e.target.value as AspectRatio)}
            className="bg-transparent text-right text-xs text-[#1C1B18] dark:text-[#E8E7E2] focus:outline-none cursor-pointer border-b border-transparent hover:border-[#CCC7BE] dark:hover:border-[#3A3935] focus:border-[#1C1B18] dark:focus:border-[#5E5D57] transition-colors appearance-none font-mono py-0.5"
          >
            <option value="original" className="bg-[#FFFFFF] text-[#1C1B18] dark:bg-[#111110] dark:text-[#E8E7E2]">
              Theo ảnh gốc
            </option>
            <option value="1:1" className="bg-[#FFFFFF] text-[#1C1B18] dark:bg-[#111110] dark:text-[#E8E7E2]">
              1:1 — Vuông
            </option>
            <option value="16:9" className="bg-[#FFFFFF] text-[#1C1B18] dark:bg-[#111110] dark:text-[#E8E7E2]">
              16:9 — Ngang điện ảnh
            </option>
            <option value="9:16" className="bg-[#FFFFFF] text-[#1C1B18] dark:bg-[#111110] dark:text-[#E8E7E2]">
              9:16 — Khổ dọc Story
            </option>
            <option value="4:3" className="bg-[#FFFFFF] text-[#1C1B18] dark:bg-[#111110] dark:text-[#E8E7E2]">
              4:3 — Editorial
            </option>
            <option value="3:2" className="bg-[#FFFFFF] text-[#1C1B18] dark:bg-[#111110] dark:text-[#E8E7E2]">
              3:2 — Nhiếp ảnh 35mm
            </option>
          </select>
        </div>

        {/* Quality */}
        <div className="flex items-center justify-between py-1">
          <span className="text-[#6E6B64] dark:text-[#8C8B84] text-[11px] uppercase tracking-wider">
            Chất lượng (Quality)
          </span>
          <select
            value={settings.quality}
            onChange={(e) => update('quality', e.target.value as QualityMode)}
            className="bg-transparent text-right text-xs text-[#1C1B18] dark:text-[#E8E7E2] focus:outline-none cursor-pointer border-b border-transparent hover:border-[#CCC7BE] dark:hover:border-[#3A3935] focus:border-[#1C1B18] dark:focus:border-[#5E5D57] transition-colors appearance-none font-mono py-0.5"
          >
            <option value="standard" className="bg-[#FFFFFF] text-[#1C1B18] dark:bg-[#111110] dark:text-[#E8E7E2]">
              Standard (1024px)
            </option>
            <option value="high" className="bg-[#FFFFFF] text-[#1C1B18] dark:bg-[#111110] dark:text-[#E8E7E2]">
              High Definition (2048px)
            </option>
            <option value="raw" className="bg-[#FFFFFF] text-[#1C1B18] dark:bg-[#111110] dark:text-[#E8E7E2]">
              Raw Master (4096px / Lossless)
            </option>
          </select>
        </div>

        {/* Variations */}
        <div className="flex items-center justify-between py-1">
          <span className="text-[#6E6B64] dark:text-[#8C8B84] text-[11px] uppercase tracking-wider">
            Số lượng (Variations)
          </span>
          <div className="flex items-center gap-3">
            <input
              type="range"
              min={1}
              max={4}
              value={settings.variations}
              onChange={(e) => update('variations', parseInt(e.target.value))}
              className="w-20 accent-[#1C1B18] dark:accent-[#D8D3C5] cursor-pointer bg-[#EDE9E1] dark:bg-[#242421]"
            />
            <span className="text-xs font-mono text-[#1C1B18] dark:text-[#E8E7E2] w-3 text-right font-medium">
              {settings.variations}
            </span>
          </div>
        </div>
      </div>

      {/* Advanced Accordion Panel */}
      {showAdvanced && (
        <div className="border-t border-[#EDE9E1] dark:border-[#1D1D1B] pt-4 space-y-4 text-xs">
          {/* Structure preservation toggle */}
          <div className="flex items-center justify-between py-1">
            <div>
              <p className="text-[#6E6B64] dark:text-[#8C8B84] text-[11px] uppercase tracking-wider font-medium">
                Khóa cấu trúc (ControlNet)
              </p>
              <p className="text-[9px] text-[#9C988F] dark:text-[#5E5D57]">
                Giữ nguyên tỷ lệ khuôn mặt và tư thế
              </p>
            </div>
            <input
              type="checkbox"
              checked={settings.preserveStructure}
              onChange={(e) => update('preserveStructure', e.target.checked)}
              className="w-3.5 h-3.5 accent-[#1C1B18] dark:accent-[#D8D3C5] bg-[#FFFFFF] dark:bg-[#111110] border-[#E2DDD5] dark:border-[#292925] cursor-pointer"
            />
          </div>

          {/* Model info / override */}
          <div className="flex items-center justify-between py-1">
            <span className="text-[#6E6B64] dark:text-[#8C8B84] text-[11px] uppercase tracking-wider flex items-center gap-1">
              <Cpu size={11} /> Model Name
            </span>
            <span className="font-mono text-xs text-[#1C1B18] dark:text-[#E8E7E2]">
              {activeProfile ? activeProfile.selectedModel : settings.model}
            </span>
          </div>

          {/* CFG Scale slider */}
          <div className="space-y-1.5 py-1">
            <div className="flex justify-between text-[11px]">
              <span className="text-[#6E6B64] dark:text-[#8C8B84] uppercase tracking-wider">
                Prompt Fidelity (CFG)
              </span>
              <span className="font-mono text-[#1C1B18] dark:text-[#E8E7E2] font-medium">{settings.cfgScale}</span>
            </div>
            <input
              type="range"
              min={3}
              max={15}
              step={0.5}
              value={settings.cfgScale}
              onChange={(e) => update('cfgScale', parseFloat(e.target.value))}
              className="w-full accent-[#1C1B18] dark:accent-[#D8D3C5] cursor-pointer bg-[#EDE9E1] dark:bg-[#242421]"
            />
          </div>

          {/* Negative Prompt */}
          <div className="space-y-1.5 py-1">
            <label className="block text-[10px] uppercase tracking-wider text-[#6E6B64] dark:text-[#8C8B84]">
              Negative Prompt (Loại trừ)
            </label>
            <input
              type="text"
              value={settings.negativePrompt}
              onChange={(e) => update('negativePrompt', e.target.value)}
              placeholder="blurry, distorted face, low quality, oversaturated..."
              className="w-full bg-[#FFFFFF] dark:bg-[#111110] border border-[#E2DDD5] dark:border-[#292925] p-2 text-xs text-[#1C1B18] dark:text-[#E8E7E2] placeholder-[#A3A096] dark:placeholder-[#4A4944] focus:outline-none focus:border-[#1C1B18] dark:focus:border-[#5E5D57] transition-colors font-mono"
            />
          </div>

          {/* Seed */}
          <div className="flex items-center justify-between py-1">
            <span className="text-[#6E6B64] dark:text-[#8C8B84] text-[11px] uppercase tracking-wider">
              Seed
            </span>
            <input
              type="text"
              value={settings.seed}
              onChange={(e) => update('seed', e.target.value)}
              placeholder="Random (-1)"
              className="bg-[#FFFFFF] dark:bg-[#111110] border border-[#E2DDD5] dark:border-[#292925] px-2 py-1 text-xs text-[#1C1B18] dark:text-[#E8E7E2] placeholder-[#A3A096] dark:placeholder-[#4A4944] focus:outline-none focus:border-[#1C1B18] dark:focus:border-[#5E5D57] w-28 text-right font-mono"
            />
          </div>
        </div>
      )}
    </div>
  );
};
