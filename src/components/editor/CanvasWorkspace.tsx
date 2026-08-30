import React, { useState, useEffect } from 'react';
import { GenState, GeneratedImage } from '../../types';
import { Check, Maximize2, Download, HardDrive, RotateCcw } from 'lucide-react';

interface CanvasWorkspaceProps {
  genState: GenState;
  results: GeneratedImage[];
  selectedImageIndex: number | null;
  onSelectImage: (index: number) => void;
  onOpenLightbox: (image: GeneratedImage) => void;
  onReset: () => void;
  onSaveToDrive: () => void;
  isDriveSaved: boolean;
  onDownload: (image: GeneratedImage) => void;
}

export const CanvasWorkspace: React.FC<CanvasWorkspaceProps> = ({
  genState,
  results,
  selectedImageIndex,
  onSelectImage,
  onOpenLightbox,
  onReset,
  onSaveToDrive,
  isDriveSaved,
  onDownload,
}) => {
  const [activeStep, setActiveStep] = useState(0);

  // Creative generation animation steps
  useEffect(() => {
    if (genState === 'generating') {
      setActiveStep(0);
      const t1 = setTimeout(() => setActiveStep(1), 700);
      const t2 = setTimeout(() => setActiveStep(2), 1500);
      const t3 = setTimeout(() => setActiveStep(3), 2300);
      return () => {
        clearTimeout(t1);
        clearTimeout(t2);
        clearTimeout(t3);
      };
    }
  }, [genState]);

  const selectedImage = selectedImageIndex !== null ? results[selectedImageIndex] : null;

  return (
    <div className="w-full h-full min-h-[580px] lg:min-h-[750px] border border-[#E2DDD5] dark:border-[#1D1D1B] bg-[#F5F3ED] dark:bg-[#0E0E0D] relative flex flex-col justify-between p-6 sm:p-10 transition-colors">
      {/* 1. IDLE / EMPTY STATE */}
      {genState === 'idle' && (
        <div className="flex-1 flex flex-col items-center justify-center text-center p-6 my-auto">
          <div className="w-8 h-8 border border-[#CCC7BE] dark:border-[#292925] flex items-center justify-center text-[#9C988F] dark:text-[#5E5D57] mb-6 font-mono text-xs">
            +
          </div>
          <h3 className="text-xs uppercase tracking-[0.25em] text-[#6E6B64] dark:text-[#8C8B84] font-medium mb-2">
            Your Canvas
          </h3>
          <p className="text-xs text-[#9C988F] dark:text-[#5E5D57] max-w-xs font-light leading-relaxed">
            Tải ảnh gốc, tinh chỉnh chỉ thị và bắt đầu tạo các phiên bản hình ảnh nghệ thuật.
          </p>
        </div>
      )}

      {/* 2. GENERATING STATE */}
      {genState === 'generating' && (
        <div className="flex-1 flex flex-col items-center justify-center my-auto max-w-sm mx-auto w-full">
          <div className="w-full space-y-6">
            <div className="text-center mb-8">
              <span className="text-[10px] uppercase tracking-[0.3em] text-[#6E6B64] dark:text-[#8C8B84] font-mono block mb-1">
                Processing
              </span>
              <h3 className="text-sm font-normal dark:font-light text-[#1C1B18] dark:text-[#E8E7E2] tracking-wider uppercase">
                Đang tạo tác phẩm
              </h3>
            </div>

            {/* Creative Progress Steps */}
            <div className="space-y-3.5 border-t border-b border-[#E2DDD5] dark:border-[#1D1D1B] py-6 text-xs font-mono">
              <ProgressRow
                label="Preparing prompt & parameters"
                status={activeStep > 0 ? 'done' : activeStep === 0 ? 'active' : 'pending'}
              />
              <ProgressRow
                label="Analyzing visual reference"
                status={activeStep > 1 ? 'done' : activeStep === 1 ? 'active' : 'pending'}
              />
              <ProgressRow
                label="Rendering variations with ControlNet"
                status={activeStep > 2 ? 'done' : activeStep === 2 ? 'active' : 'pending'}
              />
              <ProgressRow
                label="Finalizing high-fidelity output"
                status={activeStep >= 3 ? 'active' : 'pending'}
              />
            </div>

            {/* Subtle pulse line */}
            <div className="w-full bg-[#E2DDD5] dark:bg-[#1A1A18] h-[1px] overflow-hidden">
              <div className="bg-[#1C1B18] dark:bg-[#D8D3C5] h-[1px] w-1/3 animate-pulse" />
            </div>
          </div>
        </div>
      )}

      {/* 3. DONE / RESULTS STATE */}
      {genState === 'done' && results.length > 0 && (
        <div className="flex-1 flex flex-col justify-between">
          {/* Header */}
          <div className="flex items-baseline justify-between mb-6 pb-4 border-b border-[#E2DDD5] dark:border-[#1D1D1B]">
            <div>
              <h3 className="text-xs uppercase tracking-[0.2em] text-[#1C1B18] dark:text-[#E8E7E2] font-medium">
                Results
              </h3>
              <p className="text-[10px] text-[#9C988F] dark:text-[#5E5D57] font-mono mt-0.5">
                {results.length} phiên bản • Nhấp để chọn ảnh xuất sắc nhất
              </p>
            </div>
            <span className="text-[10px] font-mono text-[#6E6B64] dark:text-[#8C8B84]">
              {selectedImageIndex !== null ? `0${selectedImageIndex + 1} SELECTED` : 'SELECT ONE'}
            </span>
          </div>

          {/* Image Grid */}
          <div
            className={`grid gap-4 sm:gap-6 flex-1 my-auto items-center ${
              results.length === 1
                ? 'grid-cols-1 max-w-xl mx-auto'
                : results.length === 2
                ? 'grid-cols-1 sm:grid-cols-2'
                : 'grid-cols-2 lg:grid-cols-2'
            }`}
          >
            {results.map((img, idx) => {
              const isSelected = selectedImageIndex === idx;
              return (
                <div
                  key={img.id}
                  onClick={() => onSelectImage(idx)}
                  className={`relative group cursor-pointer transition-all duration-200 border bg-[#FFFFFF] dark:bg-[#111110] overflow-hidden shadow-sm ${
                    isSelected
                      ? 'border-[#1C1B18] dark:border-[#D8D3C5] ring-1 ring-[#1C1B18]/30 dark:ring-[#D8D3C5]/20 shadow-xl'
                      : 'border-[#E2DDD5] dark:border-[#1D1D1B] hover:border-[#CCC7BE] dark:hover:border-[#3A3935]'
                  }`}
                >
                  <div className="aspect-[4/3] w-full relative overflow-hidden bg-[#F2EFE9] dark:bg-[#0A0A09]">
                    <img
                      src={img.url}
                      alt={img.prompt}
                      className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-[1.02]"
                    />

                    {/* Subtle Index badge */}
                    <div className="absolute top-3 left-3 bg-[#F8F7F4]/90 dark:bg-[#0B0B0A]/80 backdrop-blur-xs px-2 py-0.5 text-[9px] font-mono text-[#1C1B18] dark:text-[#8C8B84]">
                      0{idx + 1}
                    </div>

                    {/* Selected Check icon */}
                    {isSelected && (
                      <div className="absolute top-3 right-3 bg-[#1C1B18] text-[#F8F7F4] dark:bg-[#D8D3C5] dark:text-[#0B0B0A] p-1 shadow-lg">
                        <Check size={12} strokeWidth={2.5} />
                      </div>
                    )}

                    {/* Hover action toolbar */}
                    <div className="absolute inset-0 bg-[#0B0B0A]/50 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-3">
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          onOpenLightbox(img);
                        }}
                        className="p-2 bg-[#FFFFFF] dark:bg-[#111110] text-[#1C1B18] dark:text-[#E8E7E2] hover:bg-[#F2EFE9] dark:hover:bg-[#242421] border border-[#E2DDD5] dark:border-[#292925] transition-colors cursor-pointer"
                        title="Xem phóng to"
                        aria-label="Xem phóng to"
                      >
                        <Maximize2 size={13} />
                      </button>
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          onDownload(img);
                        }}
                        className="p-2 bg-[#FFFFFF] dark:bg-[#111110] text-[#1C1B18] dark:text-[#E8E7E2] hover:bg-[#F2EFE9] dark:hover:bg-[#242421] border border-[#E2DDD5] dark:border-[#292925] transition-colors cursor-pointer"
                        title="Tải ảnh này về"
                        aria-label="Tải về"
                      >
                        <Download size={13} />
                      </button>
                    </div>
                  </div>

                  {/* Caption line */}
                  <div className="p-2.5 flex items-center justify-between text-[10px] border-t border-[#EDE9E1] dark:border-[#1D1D1B] bg-[#FFFFFF] dark:bg-[#0E0E0D]">
                    <span className="text-[#6E6B64] dark:text-[#8C8B84] truncate max-w-[160px] font-mono">
                      {img.model}
                    </span>
                    <span className="text-[#9C988F] dark:text-[#5E5D57] font-mono font-medium">
                      {isSelected ? 'ĐÃ CHỌN' : 'CHỌN'}
                    </span>
                  </div>
                </div>
              );
            })}
          </div>

          {/* Action Bar Footer */}
          <div className="mt-8 pt-5 border-t border-[#E2DDD5] dark:border-[#1D1D1B] flex flex-col sm:flex-row items-center justify-between gap-4">
            <button
              type="button"
              onClick={onReset}
              className="text-xs uppercase tracking-[0.14em] text-[#9C988F] dark:text-[#5E5D57] hover:text-[#1C1B18] dark:hover:text-[#E8E7E2] flex items-center gap-2 transition-colors cursor-pointer"
            >
              <RotateCcw size={12} />
              <span>Thử nghiệm lại</span>
            </button>

            <div className="flex items-center gap-3 w-full sm:w-auto justify-end">
              {selectedImage && (
                <button
                  type="button"
                  onClick={() => onDownload(selectedImage)}
                  className="text-xs uppercase tracking-[0.14em] px-4 py-2 bg-[#FFFFFF] hover:bg-[#F2EFE9] text-[#1C1B18] border border-[#E2DDD5] dark:bg-[#161614] dark:hover:bg-[#242421] dark:text-[#E8E7E2] dark:border-[#292925] flex items-center gap-2 transition-colors cursor-pointer"
                >
                  <Download size={13} strokeWidth={1.5} />
                  <span>Tải ảnh đã chọn</span>
                </button>
              )}

              <button
                type="button"
                disabled={selectedImageIndex === null}
                onClick={onSaveToDrive}
                className="text-xs uppercase tracking-[0.14em] px-5 py-2 bg-[#1C1B18] hover:bg-[#2F2E2B] text-[#F8F7F4] dark:bg-[#D8D3C5] dark:hover:bg-[#E8E7E2] dark:text-[#0B0B0A] font-medium flex items-center gap-2 transition-all disabled:opacity-40 cursor-pointer"
              >
                {isDriveSaved ? (
                  <>
                    <Check size={13} strokeWidth={2} />
                    <span>Đã lưu vào Drive ✓</span>
                  </>
                ) : (
                  <>
                    <HardDrive size={13} strokeWidth={1.5} />
                    <span>Lưu lên Google Drive</span>
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

function ProgressRow({
  label,
  status,
}: {
  label: string;
  status: 'done' | 'active' | 'pending';
}) {
  return (
    <div className="flex items-center justify-between">
      <span
        className={`${
          status === 'active'
            ? 'text-[#1C1B18] dark:text-[#E8E7E2] font-medium'
            : status === 'done'
            ? 'text-[#6E6B64] dark:text-[#8C8B84]'
            : 'text-[#C4C0B6] dark:text-[#3E3D38]'
        }`}
      >
        {label}
      </span>
      <span>
        {status === 'done' && <span className="text-[#1C1B18] dark:text-[#D8D3C5]">✓</span>}
        {status === 'active' && <span className="text-[#1C1B18] dark:text-[#E8E7E2] animate-pulse">●</span>}
        {status === 'pending' && <span className="text-[#C4C0B6] dark:text-[#3E3D38]">○</span>}
      </span>
    </div>
  );
}
