import React, { useState, useEffect } from 'react';
import { HistoryItem, GeneratedImage } from '../../types';
import { ImageLightbox } from '../editor/ImageLightbox';
import {
  getSavedHistory,
  deleteHistoryItem,
  clearAllHistory,
} from '../../services/historyService';
import {
  uploadImageToDrive,
  getStoredAccessToken,
} from '../../services/googleDriveService';
import {
  Maximize2,
  Trash2,
  HardDrive,
  Download,
  Check,
  RotateCcw,
  Sparkles,
  ExternalLink,
} from 'lucide-react';

interface HistoryViewProps {
  onReusePrompt?: (prompt: string) => void;
}

export const HistoryView: React.FC<HistoryViewProps> = ({ onReusePrompt }) => {
  const [historyItems, setHistoryItems] = useState<HistoryItem[]>(getSavedHistory);
  const [selectedImage, setSelectedImage] = useState<GeneratedImage | null>(null);
  const [savingId, setSavingId] = useState<string | null>(null);
  const [savedSuccessMap, setSavedSuccessMap] = useState<Record<string, boolean>>({});

  useEffect(() => {
    setHistoryItems(getSavedHistory());
  }, []);

  const handleDelete = (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    const updated = deleteHistoryItem(id);
    setHistoryItems(updated);
  };

  const handleClearAll = () => {
    if (window.confirm('Bạn có chắc muốn xóa toàn bộ lịch sử tạo ảnh không?')) {
      const empty = clearAllHistory();
      setHistoryItems(empty);
    }
  };

  const handleOpenLightbox = (item: HistoryItem) => {
    setSelectedImage({
      id: item.id,
      url: item.imageUrl,
      prompt: item.prompt,
      createdAt: item.timeAgo,
      aspectRatio: (item.aspectRatio as any) || '1:1',
      quality: 'high',
      model: item.model,
    });
  };

  const handleDownload = (item: HistoryItem, e: React.MouseEvent) => {
    e.stopPropagation();
    const link = document.createElement('a');
    link.href = item.imageUrl;
    link.download = `hinhanhai_${item.id}.jpg`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const handleSaveToDrive = async (item: HistoryItem, e: React.MouseEvent) => {
    e.stopPropagation();
    setSavingId(item.id);
    try {
      await uploadImageToDrive(item.imageUrl, `history_${item.id}`, 'HinhanhAI/History');
      setSavedSuccessMap((prev) => ({ ...prev, [item.id]: true }));
    } catch (err: any) {
      alert(`Không thể lưu vào Drive: ${err?.message || 'Lỗi kết nối'}`);
    } finally {
      setSavingId(null);
    }
  };

  // Group by date
  const groups = historyItems.reduce((acc, item) => {
    const key = item.date || 'Gần đây';
    if (!acc[key]) acc[key] = [];
    acc[key].push(item);
    return acc;
  }, {} as Record<string, HistoryItem[]>);

  return (
    <div className="max-w-6xl mx-auto space-y-10 pb-16 transition-colors">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-baseline justify-between border-b border-[#E2DDD5] dark:border-[#1D1D1B] pb-4 gap-3">
        <div>
          <h2 className="text-xs uppercase tracking-[0.2em] font-medium text-[#1C1B18] dark:text-[#E8E7E2]">
            Visual Archive & Generation History
          </h2>
          <p className="text-[10px] text-[#9C988F] dark:text-[#5E5D57] font-mono mt-0.5">
            Lưu trữ liên tục tất cả phiên bản tác phẩm đã tạo thực tế
          </p>
        </div>
        
        <div className="flex items-center gap-4">
          <span className="text-[10px] font-mono text-[#6E6B64] dark:text-[#5E5D57]">
            {historyItems.length} TÁC PHẨM ĐÃ LƯU
          </span>
          {historyItems.length > 0 && (
            <button
              type="button"
              onClick={handleClearAll}
              className="text-[10px] uppercase font-mono text-[#9C988F] hover:text-[#DC2626] dark:hover:text-[#F87171] transition-colors cursor-pointer flex items-center gap-1"
            >
              <Trash2 size={11} /> Xóa tất cả
            </button>
          )}
        </div>
      </div>

      {historyItems.length === 0 ? (
        <div className="border border-dashed border-[#E2DDD5] dark:border-[#292925] p-16 text-center space-y-3">
          <div className="w-10 h-10 border border-[#CCC7BE] dark:border-[#292925] mx-auto flex items-center justify-center text-[#9C988F] dark:text-[#5E5D57]">
            <Sparkles size={16} />
          </div>
          <p className="text-xs text-[#1C1B18] dark:text-[#E8E7E2]">Chưa có lịch sử hình ảnh nào</p>
          <p className="text-[10px] text-[#9C988F] dark:text-[#5E5D57] font-mono">
            Hãy bắt đầu tạo ảnh ở Studio Editor để tự động ghi lại lịch sử tại đây.
          </p>
        </div>
      ) : (
        /* Timeline Groups */
        (Object.entries(groups) as [string, HistoryItem[]][]).map(([dateGroup, items]) => (
          <div key={dateGroup} className="space-y-4">
            <div className="flex items-center gap-3">
              <span className="text-[10px] uppercase tracking-[0.2em] font-mono text-[#6E6B64] dark:text-[#8C8B84]">
                {dateGroup}
              </span>
              <div className="flex-1 h-[1px] bg-[#E2DDD5] dark:bg-[#1D1D1B]" />
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
              {items.map((item) => {
                const isSavedToDrive = savedSuccessMap[item.id];
                const isSaving = savingId === item.id;

                return (
                  <div
                    key={item.id}
                    onClick={() => handleOpenLightbox(item)}
                    className="group border border-[#E2DDD5] dark:border-[#1D1D1B] bg-[#FFFFFF] dark:bg-[#111110] hover:border-[#CCC7BE] dark:hover:border-[#3A3935] transition-all cursor-pointer flex flex-col justify-between overflow-hidden shadow-sm hover:shadow-md"
                  >
                    <div className="aspect-[4/3] w-full relative overflow-hidden bg-[#F2EFE9] dark:bg-[#0A0A09]">
                      <img
                        src={item.imageUrl}
                        alt={item.title}
                        className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-[1.03]"
                      />

                      {/* Top badges */}
                      <div className="absolute top-2 left-2 flex items-center gap-1">
                        <span className="bg-[#F8F7F4]/90 dark:bg-[#0B0B0A]/85 backdrop-blur-xs px-1.5 py-0.5 text-[8px] font-mono text-[#1C1B18] dark:text-[#8C8B84]">
                          {item.aspectRatio}
                        </span>
                        {isSavedToDrive && (
                          <span className="bg-[#22C55E]/90 text-white px-1.5 py-0.5 text-[8px] font-mono flex items-center gap-0.5">
                            <Check size={8} /> DRIVE
                          </span>
                        )}
                      </div>

                      {/* Hover actions */}
                      <div className="absolute inset-0 bg-[#0B0B0A]/60 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-2">
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            handleOpenLightbox(item);
                          }}
                          className="p-2 bg-[#FFFFFF] dark:bg-[#111110] text-[#1C1B18] dark:text-[#E8E7E2] hover:bg-[#F2EFE9] dark:hover:bg-[#242421] border border-[#E2DDD5] dark:border-[#292925] transition-colors cursor-pointer"
                          title="Xem toàn màn hình"
                        >
                          <Maximize2 size={12} />
                        </button>
                        <button
                          type="button"
                          onClick={(e) => handleDownload(item, e)}
                          className="p-2 bg-[#FFFFFF] dark:bg-[#111110] text-[#1C1B18] dark:text-[#E8E7E2] hover:bg-[#F2EFE9] dark:hover:bg-[#242421] border border-[#E2DDD5] dark:border-[#292925] transition-colors cursor-pointer"
                          title="Tải ảnh về máy"
                        >
                          <Download size={12} />
                        </button>
                        <button
                          type="button"
                          onClick={(e) => handleSaveToDrive(item, e)}
                          disabled={isSaving || isSavedToDrive}
                          className="p-2 bg-[#FFFFFF] dark:bg-[#111110] text-[#1C1B18] dark:text-[#E8E7E2] hover:bg-[#F2EFE9] dark:hover:bg-[#242421] border border-[#E2DDD5] dark:border-[#292925] transition-colors cursor-pointer disabled:opacity-50"
                          title="Lưu lên Google Drive"
                        >
                          {isSavedToDrive ? (
                            <Check size={12} className="text-[#22C55E]" />
                          ) : (
                            <HardDrive size={12} />
                          )}
                        </button>
                        <button
                          type="button"
                          onClick={(e) => handleDelete(item.id, e)}
                          className="p-2 bg-[#FFFFFF] dark:bg-[#111110] text-[#DC2626] dark:text-[#F87171] hover:bg-red-50 dark:hover:bg-red-950/30 border border-[#E2DDD5] dark:border-[#292925] transition-colors cursor-pointer"
                          title="Xóa khỏi lịch sử"
                        >
                          <Trash2 size={12} />
                        </button>
                      </div>
                    </div>

                    {/* Meta info */}
                    <div className="p-3 border-t border-[#EDE9E1] dark:border-[#1D1D1B] space-y-2 bg-[#FFFFFF] dark:bg-[#111110]">
                      <p className="text-[11px] text-[#1C1B18] dark:text-[#E8E7E2] line-clamp-2 leading-relaxed font-light">
                        {item.prompt}
                      </p>

                      <div className="flex items-center justify-between text-[9px] font-mono text-[#9C988F] dark:text-[#5E5D57] pt-1 border-t border-[#F2EFE9] dark:border-[#161614]">
                        <span className="truncate max-w-[120px]">{item.model}</span>
                        <span>{item.timeAgo}</span>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        ))
      )}

      {/* Lightbox Modal */}
      {selectedImage && (
        <ImageLightbox
          image={selectedImage}
          onClose={() => setSelectedImage(null)}
        />
      )}
    </div>
  );
};
