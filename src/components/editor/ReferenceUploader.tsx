import React, { useRef, useState } from 'react';
import { X, Sparkles, Eye, Sliders } from 'lucide-react';

interface ReferenceUploaderProps {
  referenceImage: string | null;
  referenceFile: File | null;
  onImageChange: (image: string | null, file: File | null) => void;
  onOpenAnalyzer?: () => void;
}

export const ReferenceUploader: React.FC<ReferenceUploaderProps> = ({
  referenceImage,
  referenceFile,
  onImageChange,
  onOpenAnalyzer,
}) => {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [isDragging, setIsDragging] = useState(false);

  const handleFile = (file: File) => {
    if (file && file.type.startsWith('image/')) {
      const url = URL.createObjectURL(file);
      onImageChange(url, file);
    }
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      handleFile(e.dataTransfer.files[0]);
    }
  };

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <label className="text-[10px] uppercase tracking-[0.18em] font-medium text-[#1C1B18] dark:text-[#8C8B84] flex items-center gap-1.5">
          <span>Style Reference</span>
        </label>
        
        {onOpenAnalyzer && (
          <button
            type="button"
            onClick={onOpenAnalyzer}
            className="text-[10px] uppercase tracking-[0.12em] text-[#1C1B18] dark:text-[#D8D3C5] hover:opacity-80 transition-opacity flex items-center gap-1 cursor-pointer font-medium"
          >
            <Sparkles size={11} className="text-[#1C1B18] dark:text-[#D8D3C5]" />
            <span>AI Phân tích Style</span>
          </button>
        )}
      </div>

      <input
        ref={fileInputRef}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={(e) => {
          if (e.target.files && e.target.files[0]) {
            handleFile(e.target.files[0]);
          }
        }}
      />

      {referenceImage ? (
        <div className="space-y-2">
          <div className="flex items-center justify-between p-2.5 border border-[#E2DDD5] dark:border-[#292925] bg-[#FFFFFF] dark:bg-[#111110] hover:border-[#CCC7BE] dark:hover:border-[#3A3935] transition-colors">
            <div className="flex items-center gap-3 overflow-hidden">
              <div className="w-10 h-10 bg-[#F2EFE9] dark:bg-[#0E0E0D] flex-shrink-0 overflow-hidden border border-[#EDE9E1] dark:border-[#1D1D1B]">
                <img
                  src={referenceImage}
                  alt="Style reference"
                  className="w-full h-full object-cover"
                />
              </div>
              <div className="truncate">
                <p className="text-[11px] text-[#1C1B18] dark:text-[#E8E7E2] truncate font-mono">
                  {referenceFile?.name || 'style_reference.jpg'}
                </p>
                <p className="text-[9px] text-[#9C988F] dark:text-[#5E5D57] uppercase tracking-wider">
                  Visual Style & Lighting Source
                </p>
              </div>
            </div>

            <div className="flex items-center gap-1.5">
              {onOpenAnalyzer && (
                <button
                  type="button"
                  onClick={onOpenAnalyzer}
                  className="px-2 py-1 bg-[#EDE9E1] dark:bg-[#242421] text-[#1C1B18] dark:text-[#E8E7E2] hover:bg-[#1C1B18] hover:text-white dark:hover:bg-[#D8D3C5] dark:hover:text-black transition-colors text-[9px] uppercase tracking-wider font-semibold flex items-center gap-1 cursor-pointer"
                  title="Phân tích chi tiết Style, Background, Ánh sáng"
                >
                  <Eye size={10} />
                  <span>Phân tích</span>
                </button>
              )}
              
              <button
                type="button"
                onClick={() => onImageChange(null, null)}
                className="text-[#9C988F] dark:text-[#5E5D57] hover:text-[#1C1B18] dark:hover:text-[#E8E7E2] p-1 transition-colors cursor-pointer"
                title="Gỡ ảnh mẫu"
                aria-label="Gỡ ảnh mẫu"
              >
                <X size={13} />
              </button>
            </div>
          </div>
        </div>
      ) : (
        <div className="space-y-1.5">
          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            onDrop={handleDrop}
            onDragOver={(e) => {
              e.preventDefault();
              setIsDragging(true);
            }}
            onDragLeave={(e) => {
              e.preventDefault();
              setIsDragging(false);
            }}
            className={`w-full text-left py-2.5 px-3.5 border border-dashed text-[11px] flex items-center justify-between transition-all cursor-pointer ${
              isDragging
                ? 'border-[#1C1B18] dark:border-[#E8E7E2] bg-[#F2EFE9] dark:bg-[#161614] text-[#1C1B18] dark:text-[#E8E7E2]'
                : 'border-[#E2DDD5] dark:border-[#292925] text-[#6E6B64] dark:text-[#5E5D57] hover:text-[#1C1B18] dark:hover:text-[#8C8B84] hover:border-[#CCC7BE] dark:hover:border-[#3A3935] bg-[#FFFFFF]/60 dark:bg-[#111110]/40'
            }`}
          >
            <span className="font-normal dark:font-light">+ Thêm ảnh mẫu phong cách / ánh sáng</span>
            <span className="text-[9px] uppercase tracking-widest text-[#9C988F] dark:text-[#3E3D38]">
              Reference
            </span>
          </button>
        </div>
      )}
    </div>
  );
};

