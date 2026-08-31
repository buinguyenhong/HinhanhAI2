import React, { useEffect } from 'react';
import { GeneratedImage } from '../../types';
import { X, Download, HardDrive, Check } from 'lucide-react';

interface ImageLightboxProps {
  image: GeneratedImage | null;
  onClose: () => void;
  onSaveToDrive?: (image: GeneratedImage) => void;
  isDriveSaved?: boolean;
}

export const ImageLightbox: React.FC<ImageLightboxProps> = ({
  image,
  onClose,
  onSaveToDrive,
  isDriveSaved = false,
}) => {
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [onClose]);

  if (!image) return null;

  const handleDownload = () => {
    const link = document.createElement('a');
    link.href = image.url;
    link.download = `hinhanhai_${image.id}.jpg`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <div className="fixed inset-0 z-50 bg-[#F8F7F4]/95 dark:bg-[#0B0B0A]/95 backdrop-blur-md flex flex-col justify-between p-4 sm:p-8 animate-in fade-in duration-200 transition-colors">
      {/* Top Header bar */}
      <div className="flex items-center justify-between z-10">
        <div className="flex items-center gap-3">
          <span className="text-[10px] uppercase tracking-[0.2em] font-mono text-[#6E6B64] dark:text-[#8C8B84]">
            ID: {image.id}
          </span>
          <span className="text-[10px] uppercase tracking-widest text-[#9C988F] dark:text-[#5E5D57]">
            • {image.quality.toUpperCase()} • {image.aspectRatio}
          </span>
        </div>

        <button
          onClick={onClose}
          className="text-[#6E6B64] dark:text-[#8C8B84] hover:text-[#1C1B18] dark:hover:text-[#E8E7E2] transition-colors p-2 cursor-pointer"
          title="Đóng (Esc)"
          aria-label="Đóng"
        >
          <X size={20} strokeWidth={1.5} />
        </button>
      </div>

      {/* Center Image Canvas Area */}
      <div className="flex-1 flex items-center justify-center my-4 overflow-hidden relative">
        <img
          src={image.url}
          alt={image.prompt}
          className="max-h-[82vh] max-w-[90vw] object-contain shadow-2xl transition-transform"
        />
      </div>

      {/* Bottom Info & Action Bar */}
      <div className="w-full max-w-5xl mx-auto border-t border-[#E2DDD5] dark:border-[#1D1D1B] pt-4 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div className="max-w-xl">
          <p className="text-xs text-[#1C1B18] dark:text-[#E8E7E2] line-clamp-1 font-light tracking-wide">
            {image.prompt}
          </p>
          <div className="flex items-center gap-2 mt-0.5">
            <p className="text-[10px] text-[#9C988F] dark:text-[#5E5D57] font-mono">
              Engine: {image.model}
            </p>
            {image.isFallbackEngine && (
              <span className="px-1.5 py-0.5 text-[8px] uppercase tracking-wider font-mono bg-[#FEF3C7] text-[#92400E] dark:bg-[#78350F]/40 dark:text-[#FDE68A] border border-[#FDE68A] dark:border-[#92400E]">
                Fallback Engine
              </span>
            )}
          </div>
        </div>

        <div className="flex items-center gap-3 w-full sm:w-auto justify-end">
          <button
            onClick={handleDownload}
            className="text-[11px] uppercase tracking-[0.14em] px-4 py-2 bg-[#FFFFFF] hover:bg-[#F2EFE9] text-[#1C1B18] border border-[#E2DDD5] dark:bg-[#161614] dark:hover:bg-[#242421] dark:text-[#E8E7E2] dark:border-[#292925] flex items-center gap-2 transition-colors cursor-pointer"
          >
            <Download size={13} strokeWidth={1.5} />
            <span>Tải về máy</span>
          </button>

          <button
            onClick={() => onSaveToDrive && onSaveToDrive(image)}
            className="text-[11px] uppercase tracking-[0.14em] px-4 py-2 bg-[#1C1B18] hover:bg-[#2F2E2B] text-[#F8F7F4] dark:bg-[#D8D3C5] dark:hover:bg-[#E8E7E2] dark:text-[#0B0B0A] font-medium flex items-center gap-2 transition-colors cursor-pointer"
          >
            {isDriveSaved ? (
              <>
                <Check size={13} strokeWidth={2} />
                <span>Đã lưu Drive</span>
              </>
            ) : (
              <>
                <HardDrive size={13} strokeWidth={1.5} />
                <span>Lưu vào Google Drive</span>
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
};
