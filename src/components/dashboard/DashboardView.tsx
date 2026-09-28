import React, { useState, useEffect } from 'react';
import { Sparkles, HardDrive, Cpu, Eye, Activity } from 'lucide-react';
import { getSavedHistory } from '../../services/historyService';
import { loadAppSettings, getRenderProfile, getAnalyzeProfile, AppSettings } from '../../services/storageService';
import { HistoryItem } from '../../types';
import { HISTORY_SAVED_EVENT, SETTINGS_SAVED_EVENT } from '../../services/syncEvents';

export const DashboardView: React.FC = () => {
  const [history, setHistory] = useState<HistoryItem[]>(getSavedHistory);
  const [settings, setSettings] = useState<AppSettings>(loadAppSettings);

  useEffect(() => {
    const refreshData = () => {
      setHistory(getSavedHistory());
      setSettings(loadAppSettings());
    };
    refreshData();
    window.addEventListener(HISTORY_SAVED_EVENT, refreshData);
    window.addEventListener(SETTINGS_SAVED_EVENT, refreshData);
    return () => {
      window.removeEventListener(HISTORY_SAVED_EVENT, refreshData);
      window.removeEventListener(SETTINGS_SAVED_EVENT, refreshData);
    };
  }, []);

  const totalImages = history.length;
  const todayImages = history.filter(
    (h) => h.date === 'Hôm nay' || h.timeAgo?.toLowerCase().includes('vừa xong')
  ).length;

  const renderProfile = getRenderProfile(settings);
  const analyzeProfile = getAnalyzeProfile(settings);

  // Thống kê phân bổ model thực tế từ History
  const modelMap = new Map<string, number>();
  history.forEach((item) => {
    const modelKey = item.model?.trim() || renderProfile?.renderModel || 'Mô hình AI';
    modelMap.set(modelKey, (modelMap.get(modelKey) || 0) + 1);
  });
  const modelStats = Array.from(modelMap.entries())
    .map(([name, count]) => ({
      name,
      count,
      percentage: totalImages > 0 ? Math.round((count / totalImages) * 100) : 0,
    }))
    .sort((a, b) => b.count - a.count);

  return (
    <div className="max-w-5xl mx-auto space-y-12 pb-16 transition-colors">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-baseline justify-between border-b border-[#E2DDD5] dark:border-[#1D1D1B] pb-4 gap-2">
        <div>
          <h2 className="text-xs uppercase tracking-[0.2em] font-medium text-[#1C1B18] dark:text-[#E8E7E2]">
            Studio Metrics & Ledger
          </h2>
          <p className="text-[10px] text-[#9C988F] dark:text-[#5E5D57] font-mono mt-0.5">
            Dữ liệu hiệu suất kết xuất & trạng thái tài nguyên thực tế
          </p>
        </div>
        <div className="flex items-center gap-2">
          <span className="w-1.5 h-1.5 rounded-full bg-[#22C55E] animate-pulse" />
          <span className="text-[10px] font-mono text-[#6E6B64] dark:text-[#8C8B84]">
            LIVE METRICS • {settings.apiProfiles.length} CẤU HÌNH API
          </span>
        </div>
      </div>

      {/* Numerical Data Rows (Clean Editorial Minimal Grid) */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
        {/* Metric 1: Total Rendered */}
        <div className="border border-[#E2DDD5] dark:border-[#1D1D1B] bg-[#FFFFFF] dark:bg-[#111110] p-6 space-y-3">
          <span className="text-[9px] uppercase tracking-[0.2em] text-[#9C988F] dark:text-[#5E5D57] font-mono block">
            Tác phẩm đã lưu
          </span>
          <div className="text-3xl font-light text-[#1C1B18] dark:text-[#E8E7E2] tracking-tight font-sans">
            {totalImages.toLocaleString()}
          </div>
          <p className="text-[10px] text-[#6E6B64] dark:text-[#8C8B84] truncate">
            {todayImages > 0
              ? `+${todayImages} tác phẩm tạo trong hôm nay`
              : totalImages > 0
              ? 'Lưu trữ bền vững trong History'
              : 'Chưa có tác phẩm nào'}
          </p>
        </div>

        {/* Metric 2: Active Render Engine */}
        <div className="border border-[#E2DDD5] dark:border-[#1D1D1B] bg-[#FFFFFF] dark:bg-[#111110] p-6 space-y-3">
          <div className="flex items-center justify-between">
            <span className="text-[9px] uppercase tracking-[0.2em] text-[#9C988F] dark:text-[#5E5D57] font-mono block">
              Render Engine
            </span>
            <Cpu size={12} className="text-[#9C988F]" />
          </div>
          <div className="text-xl font-light text-[#1C1B18] dark:text-[#E8E7E2] tracking-tight font-sans truncate" title={renderProfile?.renderModel || 'Chưa thiết lập'}>
            {renderProfile?.renderModel || 'Chưa chọn'}
          </div>
          <p className="text-[10px] text-[#6E6B64] dark:text-[#8C8B84] truncate" title={renderProfile?.name || ''}>
            {renderProfile ? `${renderProfile.provider.toUpperCase()} • ${renderProfile.name}` : 'Cần cấu hình trong Settings'}
          </p>
        </div>

        {/* Metric 3: Active Analyze Engine */}
        <div className="border border-[#E2DDD5] dark:border-[#1D1D1B] bg-[#FFFFFF] dark:bg-[#111110] p-6 space-y-3">
          <div className="flex items-center justify-between">
            <span className="text-[9px] uppercase tracking-[0.2em] text-[#9C988F] dark:text-[#5E5D57] font-mono block">
              Style Analyzer
            </span>
            <Eye size={12} className="text-[#9C988F]" />
          </div>
          <div className="text-xl font-light text-[#1C1B18] dark:text-[#E8E7E2] tracking-tight font-sans truncate" title={analyzeProfile?.analyzeModel || 'Chưa thiết lập'}>
            {analyzeProfile?.analyzeModel || 'Chưa chọn'}
          </div>
          <p className="text-[10px] text-[#6E6B64] dark:text-[#8C8B84] truncate" title={analyzeProfile?.name || ''}>
            {analyzeProfile ? `${analyzeProfile.provider.toUpperCase()} • ${analyzeProfile.name}` : 'Cần cấu hình trong Settings'}
          </p>
        </div>

        {/* Metric 4: Drive Sync */}
        <div className="border border-[#E2DDD5] dark:border-[#1D1D1B] bg-[#FFFFFF] dark:bg-[#111110] p-6 space-y-3">
          <div className="flex items-center justify-between">
            <span className="text-[9px] uppercase tracking-[0.2em] text-[#9C988F] dark:text-[#5E5D57] font-mono block">
              Google Drive Sync
            </span>
            <HardDrive size={12} className={settings.driveConnected ? 'text-[#22C55E]' : 'text-[#9C988F]'} />
          </div>
          <div className="text-xl font-light text-[#1C1B18] dark:text-[#E8E7E2] tracking-tight font-sans">
            {settings.driveConnected ? 'Đã liên kết' : 'Chưa kết nối'}
          </div>
          <p className="text-[10px] text-[#6E6B64] dark:text-[#8C8B84] truncate" title={settings.driveAccount || ''}>
            {settings.driveConnected
              ? `${settings.driveAccount} (${settings.autoSync ? 'Auto' : 'Manual'})`
              : 'Vào Settings để liên kết Drive'}
          </p>
        </div>
      </div>

      {/* Model Utilization Breakdown */}
      <div className="border border-[#E2DDD5] dark:border-[#1D1D1B] bg-[#FFFFFF] dark:bg-[#111110] p-6 sm:p-8 space-y-6">
        <div className="flex items-center justify-between">
          <h3 className="text-xs uppercase tracking-[0.18em] text-[#1C1B18] dark:text-[#E8E7E2] font-medium">
            Phân bổ mô hình thực tế (Model Usage)
          </h3>
          <span className="text-[10px] font-mono text-[#9C988F] dark:text-[#5E5D57]">
            {totalImages > 0 ? `${totalImages} LẦN KẾT XUẤT` : 'CHƯA CÓ DỮ LIỆU'}
          </span>
        </div>

        {modelStats.length === 0 ? (
          <div className="border border-dashed border-[#E2DDD5] dark:border-[#292925] p-8 text-center space-y-2">
            <Sparkles size={16} className="mx-auto text-[#9C988F] dark:text-[#5E5D57]" />
            <p className="text-xs text-[#1C1B18] dark:text-[#E8E7E2]">Chưa có dữ liệu phân bổ mô hình</p>
            <p className="text-[10px] text-[#9C988F] dark:text-[#5E5D57] font-mono max-w-md mx-auto">
              Khi bạn tạo ảnh tại Workspace, hệ thống sẽ tự động tổng hợp tần suất sử dụng thực tế của từng mô hình AI tại đây.
            </p>
          </div>
        ) : (
          <div className="space-y-4">
            {modelStats.map((stat) => (
              <ModelBar
                key={stat.name}
                name={stat.name}
                percentage={stat.percentage}
                count={`${stat.count} ảnh`}
                desc={`Mô hình AI: ${stat.name}`}
              />
            ))}
          </div>
        )}
      </div>

      {/* Activity Logs Table */}
      <div className="border border-[#E2DDD5] dark:border-[#1D1D1B] bg-[#FFFFFF] dark:bg-[#111110] p-6 sm:p-8 space-y-5">
        <div className="flex items-center justify-between pb-3 border-b border-[#EDE9E1] dark:border-[#1D1D1B]">
          <h3 className="text-xs uppercase tracking-[0.18em] text-[#1C1B18] dark:text-[#E8E7E2] font-medium">
            Nhật ký tác vụ thực tế (Activity Ledger)
          </h3>
          <span className="text-[10px] font-mono text-[#9C988F] dark:text-[#5E5D57]">
            LIVE LOGS
          </span>
        </div>

        {history.length === 0 && !settings.driveConnected ? (
          <div className="border border-dashed border-[#E2DDD5] dark:border-[#292925] p-8 text-center space-y-2 font-mono">
            <Activity size={16} className="mx-auto text-[#9C988F] dark:text-[#5E5D57]" />
            <p className="text-xs text-[#1C1B18] dark:text-[#E8E7E2]">Chưa có nhật ký hoạt động nào</p>
            <p className="text-[10px] text-[#9C988F] dark:text-[#5E5D57]">
              Mọi hoạt động sinh ảnh và đồng bộ Drive sẽ được ghi nhận trực tiếp theo thời gian thực.
            </p>
          </div>
        ) : (
          <div className="space-y-3 font-mono text-xs">
            {/* System Status Row */}
            <LogRow
              time="Hệ thống"
              event="Active Engine Configuration"
              details={`Render: ${renderProfile?.renderModel || 'Chưa chọn'} • Analyze: ${analyzeProfile?.analyzeModel || 'Chưa chọn'}`}
              status="ACTIVE"
            />

            {/* Drive Row if connected */}
            {settings.driveConnected && (
              <LogRow
                time="Google Drive"
                event="Drive Cloud Linked"
                details={`Lưu tại /${settings.driveFolder || 'HinhanhAI'} (${settings.driveAccount})`}
                status="SYNCED"
              />
            )}

            {/* Real Render Logs from History */}
            {history.slice(0, 8).map((item) => (
              <LogRow
                key={item.id}
                time={item.timeAgo || item.date || 'Vừa xong'}
                event={`Render (${item.model || renderProfile?.renderModel || 'AI'})`}
                details={`Tỷ lệ: ${item.aspectRatio || '1:1'} • "${item.title || item.prompt.slice(0, 45)}"`}
                status="SUCCESS"
              />
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

const ModelBar: React.FC<{
  name: string;
  percentage: number;
  count: string;
  desc: string;
}> = ({ name, percentage, count, desc }) => {
  return (
    <div className="space-y-2">
      <div className="flex justify-between items-baseline text-xs">
        <div>
          <span className="text-[#1C1B18] dark:text-[#E8E7E2] font-medium font-sans">{name}</span>
          <span className="text-[10px] text-[#9C988F] dark:text-[#5E5D57] ml-2 hidden sm:inline">
            {desc}
          </span>
        </div>
        <span className="font-mono text-[11px] text-[#6E6B64] dark:text-[#8C8B84]">
          {count} ({percentage}%)
        </span>
      </div>
      <div className="w-full bg-[#EDE9E1] dark:bg-[#1A1A18] h-1 overflow-hidden">
        <div
          className="bg-[#1C1B18] dark:bg-[#D8D3C5] h-full transition-all duration-500"
          style={{ width: `${percentage}%` }}
        />
      </div>
    </div>
  );
};

const LogRow: React.FC<{
  time: string;
  event: string;
  details: string;
  status: string;
}> = ({ time, event, details, status }) => {
  return (
    <div className="flex flex-col sm:flex-row sm:items-center justify-between py-2 border-b border-[#EDE9E1] dark:border-[#161614] gap-1 text-[11px]">
      <div className="flex items-center gap-3">
        <span className="text-[#9C988F] dark:text-[#5E5D57]">{time}</span>
        <span className="text-[#1C1B18] dark:text-[#E8E7E2]">{event}</span>
      </div>
      <div className="flex items-center gap-4 text-[#6E6B64] dark:text-[#8C8B84]">
        <span className="truncate max-w-xs">{details}</span>
        <span className="text-[#1C1B18] dark:text-[#D8D3C5] font-semibold text-[9px]">{status}</span>
      </div>
    </div>
  );
};
