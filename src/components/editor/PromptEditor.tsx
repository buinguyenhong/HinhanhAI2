import React, { useState } from 'react';
import { ArrowUpRight, Loader2, Check, Sparkles } from 'lucide-react';

interface PromptEditorProps {
  prompt: string;
  setPrompt: (prompt: string) => void;
  hasReference: boolean;
  onOpenAnalyzer?: () => void;
}

interface RefinementTag {
  category: string;
  value: string;
}

export const PromptEditor: React.FC<PromptEditorProps> = ({
  prompt,
  setPrompt,
  hasReference,
  onOpenAnalyzer,
}) => {
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [refinementData, setRefinementData] = useState<{
    fullPrompt: string;
    tags: RefinementTag[];
  } | null>(null);
  const [applied, setApplied] = useState(false);

  const handleAnalyze = () => {
    if (hasReference && onOpenAnalyzer) {
      onOpenAnalyzer();
      return;
    }

    setIsAnalyzing(true);
    setApplied(false);
    setTimeout(() => {
      const generatedFullPrompt =
        'Chân dung nghệ thuật, chất lượng cao 8k, siêu chi tiết. Ánh sáng điện ảnh tự nhiên hắt qua cửa sổ, màu sắc tương phản tinh tế. Giữ nguyên tỷ lệ khuôn mặt và cấu trúc chủ thể gốc, áp dụng phong cách dark academia & editorial portrait photography với ống kính 85mm f/1.4.';

      const generatedTags: RefinementTag[] = [
        { category: 'Style', value: 'Editorial Portrait' },
        { category: 'Lighting', value: 'Natural Window Light' },
        { category: 'Optics', value: '85mm f/1.4 Lens' },
        { category: 'Tone', value: 'Neutral Cinematic' },
        { category: 'Shadow', value: 'Soft Gradation' },
        { category: 'Detail', value: 'Masterpiece 8K' },
      ];

      setRefinementData({
        fullPrompt: generatedFullPrompt,
        tags: generatedTags,
      });
      setIsAnalyzing(false);
    }, 1000);
  };

  const handleApply = () => {
    if (refinementData) {
      setPrompt(refinementData.fullPrompt);
      setApplied(true);
      setTimeout(() => setApplied(false), 2000);
    }
  };

  return (
    <div className="space-y-3">
      {/* Header & analyze action */}
      <div className="flex items-center justify-between">
        <label className="text-[10px] uppercase tracking-[0.18em] font-medium text-[#1C1B18] dark:text-[#8C8B84]">
          Prompt
        </label>
        <button
          type="button"
          onClick={handleAnalyze}
          disabled={isAnalyzing}
          className="text-[10px] uppercase tracking-[0.12em] text-[#6E6B64] dark:text-[#8C8B84] hover:text-[#1C1B18] dark:hover:text-[#E8E7E2] transition-colors flex items-center gap-1 disabled:opacity-40 cursor-pointer font-medium"
        >
          {isAnalyzing ? (
            <>
              <Loader2 size={11} className="animate-spin text-inherit" />
              <span>Đang phân tích...</span>
            </>
          ) : (
            <>
              <Sparkles size={11} className="text-[#1C1B18] dark:text-[#D8D3C5]" />
              <span>{hasReference ? 'AI Phân tích style ảnh mẫu' : 'AI gợi ý mô tả'}</span>
              <ArrowUpRight size={12} />
            </>
          )}
        </button>
      </div>

      {/* Writing canvas textarea */}
      <div className="relative">
        <textarea
          value={prompt}
          onChange={(e) => setPrompt(e.target.value)}
          rows={4}
          placeholder="Mô tả tác phẩm bạn muốn tạo...
Ví dụ: Chân dung điện ảnh, ánh sáng tự nhiên dịu nhẹ từ cửa sổ, bối cảnh studio tối giản, tông màu trung tính ấm áp..."
          className="w-full bg-[#FFFFFF] dark:bg-[#111110] border border-[#E2DDD5] dark:border-[#292925] p-3 text-xs sm:text-sm text-[#1C1B18] dark:text-[#E8E7E2] placeholder-[#A3A096] dark:placeholder-[#4A4944] focus:outline-none focus:border-[#1C1B18] dark:focus:border-[#5E5D57] transition-colors resize-none leading-relaxed font-sans"
        />
      </div>

      {/* AI Prompt Refinement Assistant Layer */}
      {refinementData && (
        <div className="border border-[#EDE9E1] dark:border-[#1D1D1B] bg-[#F2EFE9] dark:bg-[#0E0E0D] p-3.5 space-y-3">
          <div className="flex items-center justify-between text-[9px] uppercase tracking-[0.18em] text-[#9C988F] dark:text-[#5E5D57]">
            <span>AI Refined Synthesis</span>
            <button
              type="button"
              onClick={handleApply}
              className="text-[10px] tracking-wider text-[#1C1B18] dark:text-[#E8E7E2] hover:opacity-80 uppercase font-medium flex items-center gap-1 transition-colors cursor-pointer"
            >
              {applied ? (
                <>
                  <Check size={11} className="text-[#1C1B18] dark:text-[#D8D3C5]" />
                  <span>Đã áp dụng</span>
                </>
              ) : (
                <>
                  <span>Áp dụng</span>
                  <ArrowUpRight size={11} />
                </>
              )}
            </button>
          </div>

          {/* Tags preview */}
          <div className="flex flex-wrap gap-1.5">
            {refinementData.tags.map((tag, idx) => (
              <span
                key={idx}
                className="text-[10px] font-mono px-2 py-0.5 bg-[#FFFFFF] dark:bg-[#161614] border border-[#E2DDD5] dark:border-[#242421] text-[#1C1B18] dark:text-[#A8A7A0]"
              >
                {tag.value}
              </span>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};

