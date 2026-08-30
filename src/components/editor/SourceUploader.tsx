import React, { useRef, useState } from 'react';
import { X, Plus } from 'lucide-react';

interface SourceUploaderProps {
  sourceImage: string | null;
  sourceFile: File | null;
  onImageChange: (image: string | null, file: File | null) => void;
}

export const SourceUploader: React.FC<SourceUploaderProps> = ({
  sourceImage,
  sourceFile,
  onImageChange,
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

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
  };

  return (
    <div className="space-y-2.5">
      <div className="flex items-center justify-between">
        <label className="text-[10px] uppercase tracking-[0.18em] font-medium text-[#1C1B18] dark:text-[#8C8B84]">
          Source Image
        </label>
        <span className="text-[9px] uppercase tracking-widest text-[#9C988F] dark:text-[#5E5D57]">
          Chủ thể chính
        </span>
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

      {sourceImage ? (
        <div className="relative group border border-[#E2DDD5] dark:border-[#292925] bg-[#FFFFFF] dark:bg-[#111110] transition-colors hover:border-[#CCC7BE] dark:hover:border-[#3A3935] overflow-hidden">
          <div className="aspect-[4/3] w-full relative bg-[#F2EFE9] dark:bg-[#0E0E0D] flex items-center justify-center overflow-hidden">
            <img
              src={sourceImage}
              alt="Source subject"
              className="w-full h-full object-contain"
            />
            {/* Overlay actions on hover */}
            <div className="absolute inset-0 bg-[#0B0B0A]/60 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-3">
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                className="text-[10px] uppercase tracking-widest px-3 py-1.5 bg-[#F8F7F4] text-[#1C1B18] dark:bg-[#E8E7E2] dark:text-[#0B0B0A] font-medium hover:bg-white transition-colors cursor-pointer"
              >
                Đổi ảnh
              </button>
              <button
                type="button"
                onClick={() => onImageChange(null, null)}
                className="text-[10px] uppercase tracking-widest px-3 py-1.5 bg-[#292925] text-[#E8E7E2] hover:bg-[#3A3935] transition-colors cursor-pointer"
                title="Xóa ảnh"
              >
                Xóa
              </button>
            </div>
            {/* Quick delete button top right */}
            <button
              type="button"
              onClick={() => onImageChange(null, null)}
              className="absolute top-2 right-2 p-1.5 bg-[#0B0B0A]/70 text-[#E8E7E2] dark:text-[#8C8B84] hover:text-white transition-colors cursor-pointer"
              aria-label="Xóa ảnh gốc"
            >
              <X size={13} />
            </button>
          </div>

          <div className="p-3 flex items-center justify-between text-[10px] border-t border-[#EDE9E1] dark:border-[#1D1D1B]">
            <span className="text-[#1C1B18] dark:text-[#E8E7E2] truncate max-w-[180px] font-mono">
              {sourceFile?.name || 'source_portrait.jpg'}
            </span>
            <span className="text-[#9C988F] dark:text-[#5E5D57] font-mono">
              {sourceFile ? `${(sourceFile.size / 1024).toFixed(0)} KB` : 'High-Res'}
            </span>
          </div>
        </div>
      ) : (
        <div
          onClick={() => fileInputRef.current?.click()}
          onDrop={handleDrop}
          onDragOver={handleDragOver}
          onDragLeave={handleDragLeave}
          className={`cursor-pointer border border-dashed transition-all p-8 flex flex-col items-center justify-center min-h-[160px] text-center ${
            isDragging
              ? 'border-[#1C1B18] dark:border-[#E8E7E2] bg-[#F2EFE9] dark:bg-[#161614]'
              : 'border-[#E2DDD5] dark:border-[#292925] bg-[#FFFFFF]/80 dark:bg-[#111110]/60 hover:border-[#CCC7BE] dark:hover:border-[#3A3935] hover:bg-[#FFFFFF] dark:hover:bg-[#111110]'
          }`}
        >
          <div className="mb-3 text-[#9C988F] dark:text-[#5E5D57] group-hover:text-[#6E6B64] dark:group-hover:text-[#8C8B84] transition-colors">
            <Plus size={18} strokeWidth={1.5} />
          </div>
          <p className="text-xs text-[#1C1B18] dark:text-[#E8E7E2] font-normal dark:font-light mb-1">
            Kéo thả ảnh vào đây
          </p>
          <p className="text-[10px] text-[#9C988F] dark:text-[#5E5D57] tracking-wider uppercase">
            hoặc nhấp để tải ảnh lên
          </p>
        </div>
      )}
    </div>
  );
};
