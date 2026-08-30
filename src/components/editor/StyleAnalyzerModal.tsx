import React, { useState, useEffect, useMemo } from 'react';
import {
  StyleAnalysisResult,
  AspectRatio,
  BackgroundPropObject,
} from '../../types';
import {
  X,
  Sparkles,
  Sun,
  Camera,
  Layers,
  Palette,
  User,
  Copy,
  Check,
  ArrowUpRight,
  Upload,
  RefreshCw,
  Maximize2,
  Image as ImageIcon,
  CheckSquare,
  Square,
  Plus,
  Building2,
  Boxes,
  Eye,
  Sliders,
  CheckCircle2,
} from 'lucide-react';
import { analyzeImageStyle } from '../../services/styleAnalysisService';

interface StyleAnalyzerModalProps {
  isOpen: boolean;
  onClose: () => void;
  initialImage: string | null;
  initialFile?: File | null;
  onApplyPrompt: (
    promptText: string,
    suggestedRatio?: AspectRatio,
    negativePrompt?: string,
    mode?: 'replace' | 'append'
  ) => void;
}

const SAMPLE_REFERENCE_PRESETS = [
  {
    name: 'Ancient Gothic Castle',
    url: 'https://images.unsplash.com/photo-1533158307587-828f0a76ef46?auto=format&fit=crop&w=900&q=80',
    desc: 'Lâu đài cổ kính, tường đá sa thạch, đèn chùm cổ điển và vòm đá',
  },
  {
    name: 'Raw Concrete Studio & Vintage Lamp',
    url: 'https://images.unsplash.com/photo-1513694203232-719a280e022f?auto=format&fit=crop&w=900&q=80',
    desc: 'Tường xi măng trần thô mộc, đèn rọi cổ điển và ánh sáng cửa vòm',
  },
  {
    name: 'Editorial Chiaroscuro Portrait',
    url: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&w=900&q=80',
    desc: 'Chân dung tạp chí cao cấp, ánh sáng Rembrandt tương phản sâu',
  },
  {
    name: 'Cyberpunk Neon Urban Loft',
    url: 'https://images.unsplash.com/photo-1508700115892-45ecd05ae2ad?auto=format&fit=crop&w=900&q=80',
    desc: 'Tường xi măng ẩm sẫm màu, đèn neon dạng ống, vệt sáng cyan - hồng',
  },
  {
    name: 'Golden Hour 35mm Analog',
    url: 'https://images.unsplash.com/photo-1517841905240-472988babdf9?auto=format&fit=crop&w=900&q=80',
    desc: 'Ánh nắng hoàng hôn xiên thấp, chất phim hạt vintage mộc mạc',
  },
];

type ComponentKey = 'style' | 'background' | 'lighting' | 'camera' | 'colors' | 'subject';

export const StyleAnalyzerModal: React.FC<StyleAnalyzerModalProps> = ({
  isOpen,
  onClose,
  initialImage,
  initialFile,
  onApplyPrompt,
}) => {
  const [currentImage, setCurrentImage] = useState<string | null>(initialImage);
  const [currentFile, setCurrentFile] = useState<File | null>(initialFile || null);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [analysisResult, setAnalysisResult] = useState<StyleAnalysisResult | null>(null);
  const [activeTab, setActiveTab] = useState<'all' | 'background' | 'lighting' | 'camera' | 'colors' | 'custom_prompt'>('all');
  const [copiedField, setCopiedField] = useState<string | null>(null);
  const [applied, setApplied] = useState(false);
  const [customFocus, setCustomFocus] = useState('');

  // Modular selection states (user can pick and choose components to inject)
  const [selectedComponents, setSelectedComponents] = useState<Record<ComponentKey, boolean>>({
    background: true,
    lighting: true,
    camera: true,
    colors: true,
    style: true,
    subject: true,
  });

  // Granular object/prop selection inside background
  const [selectedProps, setSelectedProps] = useState<string[]>([]);
  const [insertMode, setInsertMode] = useState<'replace' | 'append'>('replace');
  const [previewLanguage, setPreviewLanguage] = useState<'en' | 'vi'>('en');

  // Auto analyze when opened with an image
  useEffect(() => {
    if (isOpen && initialImage) {
      setCurrentImage(initialImage);
      setCurrentFile(initialFile || null);
      runAnalysis(initialImage, initialFile || null);
    } else if (isOpen && !initialImage) {
      const defaultSample = SAMPLE_REFERENCE_PRESETS[0];
      setCurrentImage(defaultSample.url);
      runAnalysis(defaultSample.url, null);
    }
  }, [isOpen, initialImage]);

  // When new analysis result arrives, initialize props selection with all found props
  useEffect(() => {
    if (analysisResult?.background?.objectsAndProps) {
      setSelectedProps(analysisResult.background.objectsAndProps.map((p) => p.name));
    } else if (analysisResult?.background?.elements) {
      setSelectedProps(analysisResult.background.elements);
    }
  }, [analysisResult]);

  const runAnalysis = async (imgSrc: string, file: File | null, focusReq?: string) => {
    setIsAnalyzing(true);
    try {
      const result = await analyzeImageStyle(imgSrc, file, focusReq || customFocus);
      setAnalysisResult(result);
    } catch (err) {
      console.error('Failed to analyze image style:', err);
    } finally {
      setIsAnalyzing(false);
    }
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      const file = e.target.files[0];
      const url = URL.createObjectURL(file);
      setCurrentImage(url);
      setCurrentFile(file);
      runAnalysis(url, file);
    }
  };

  const handleSelectPreset = (url: string) => {
    setCurrentImage(url);
    setCurrentFile(null);
    runAnalysis(url, null);
  };

  const copyToClipboard = (text: string, fieldKey: string) => {
    navigator.clipboard.writeText(text);
    setCopiedField(fieldKey);
    setTimeout(() => setCopiedField(null), 2000);
  };

  // Toggle component selection
  const toggleComponent = (key: ComponentKey) => {
    setSelectedComponents((prev) => ({
      ...prev,
      [key]: !prev[key],
    }));
  };

  // Toggle individual prop/object
  const toggleProp = (propName: string) => {
    setSelectedProps((prev) =>
      prev.includes(propName) ? prev.filter((p) => p !== propName) : [...prev, propName]
    );
  };

  // Select all or deselect all components
  const selectAllComponents = () => {
    setSelectedComponents({
      background: true,
      lighting: true,
      camera: true,
      colors: true,
      style: true,
      subject: true,
    });
    if (analysisResult?.background?.objectsAndProps) {
      setSelectedProps(analysisResult.background.objectsAndProps.map((p) => p.name));
    } else if (analysisResult?.background?.elements) {
      setSelectedProps(analysisResult.background.elements);
    }
  };

  const deselectAllComponents = () => {
    setSelectedComponents({
      background: false,
      lighting: false,
      camera: false,
      colors: false,
      style: false,
      subject: false,
    });
  };

  // Dynamic calculation of combined prompt based on current selections
  const dynamicCombinedPromptEn = useMemo(() => {
    if (!analysisResult) return '';
    const parts: string[] = [];

    // 1. Style & Master Aesthetics
    if (selectedComponents.style) {
      parts.push(
        `masterpiece fine-art photograph, ${analysisResult.styleName.toLowerCase()}, authentic 35mm film grain, 8k resolution, photorealistic micro-details`
      );
    }

    // 2. Camera & Optics
    if (selectedComponents.camera) {
      if (analysisResult.camera?.promptSnippetEn) {
        parts.push(analysisResult.camera.promptSnippetEn);
      } else {
        parts.push(
          `shot on ${analysisResult.camera?.lensSuggestion || '85mm f/1.4 lens'}, ${analysisResult.camera?.shotType?.toLowerCase() || 'medium close-up'}, ${analysisResult.camera?.compositionRule?.toLowerCase() || 'rule of thirds'}`
        );
      }
    }

    // 3. Lighting
    if (selectedComponents.lighting) {
      if (analysisResult.lighting?.promptSnippetEn) {
        parts.push(analysisResult.lighting.promptSnippetEn);
      } else {
        parts.push(
          `illuminated with ${analysisResult.lighting?.sourceType?.toLowerCase() || 'natural lighting'}, ${analysisResult.lighting?.direction?.toLowerCase() || '45 degree side light'}, ${analysisResult.lighting?.quality?.toLowerCase() || 'soft chiaroscuro'}`
        );
      }
    }

    // 4. Background & Props (with granular object selection)
    if (selectedComponents.background) {
      const bg = analysisResult.background;
      let bgDesc = `set in ${bg.settingType?.toLowerCase() || 'scenic background'}`;
      if (bg.architecturalStyle) {
        bgDesc += `, ${bg.architecturalStyle.toLowerCase()}`;
      }

      // Filter selected objects
      if (bg.objectsAndProps && bg.objectsAndProps.length > 0) {
        const activePropSnippets = bg.objectsAndProps
          .filter((p) => selectedProps.includes(p.name))
          .map((p) => p.promptSnippet || p.name.toLowerCase());
        if (activePropSnippets.length > 0) {
          bgDesc += `, featuring detailed ${activePropSnippets.join(', ')}`;
        }
      } else if (selectedProps.length > 0) {
        bgDesc += `, with ${selectedProps.join(', ')}`;
      }

      if (bg.materials && bg.materials.length > 0) {
        bgDesc += `, ${bg.materials.join(', ')} surface textures`;
      }
      if (bg.atmosphere) {
        bgDesc += `, ${bg.atmosphere.toLowerCase()}`;
      }
      bgDesc += `, ${bg.depthOfField?.toLowerCase() || 'shallow depth of field, creamy smooth bokeh'}`;
      parts.push(bgDesc);
    }

    // 5. Colors & Mood
    if (selectedComponents.colors) {
      if (analysisResult.colorPalette?.promptSnippetEn) {
        parts.push(analysisResult.colorPalette.promptSnippetEn);
      } else {
        parts.push(
          `cinematic color grading, ${analysisResult.colorPalette?.dominantMood?.toLowerCase() || 'atmospheric mood'}, ${analysisResult.colorPalette?.colorGrading?.toLowerCase() || 'rich tonal range'}`
        );
      }
    }

    // 6. Subject & Details
    if (selectedComponents.subject && analysisResult.subjectDetails) {
      if (analysisResult.subjectDetails.promptSnippetEn && !selectedComponents.style) {
        parts.push(analysisResult.subjectDetails.promptSnippetEn);
      } else {
        parts.push(
          `${analysisResult.subjectDetails.poseAndExpression?.toLowerCase() || 'natural aesthetic posture'}, ${analysisResult.subjectDetails.texturesAndMaterials?.toLowerCase() || 'detailed skin and fabric textures'}`
        );
      }
    }

    return parts.length > 0 ? parts.join(', ') : analysisResult.recommendedPromptEn;
  }, [analysisResult, selectedComponents, selectedProps]);

  // Dynamic Vietnamese Prompt
  const dynamicCombinedPromptVi = useMemo(() => {
    if (!analysisResult) return '';
    const parts: string[] = [];

    if (selectedComponents.style) {
      parts.push(`Phong cách nghệ thuật: ${analysisResult.styleName} (${analysisResult.genre}).`);
    }
    if (selectedComponents.camera) {
      parts.push(
        `Góc máy & Ống kính: Chụp bằng ${analysisResult.camera?.lensSuggestion || '85mm f/1.4'}, góc ${analysisResult.camera?.shotType}, ${analysisResult.camera?.compositionRule}.`
      );
    }
    if (selectedComponents.lighting) {
      parts.push(
        `Ánh sáng: Nguồn sáng ${analysisResult.lighting?.sourceType}, hướng chiếu ${analysisResult.lighting?.direction}, nhiệt độ ${analysisResult.lighting?.colorTemperature}.`
      );
    }
    if (selectedComponents.background) {
      const bg = analysisResult.background;
      let bgText = `Bối cảnh: ${bg.settingType}`;
      if (bg.architecturalStyle) bgText += `, kiến trúc ${bg.architecturalStyle}`;
      if (selectedProps.length > 0) bgText += `, gồm các vật thể chi tiết: ${selectedProps.join(', ')}`;
      if (bg.atmosphere) bgText += `. Bầu không khí: ${bg.atmosphere}`;
      parts.push(bgText + '.');
    }
    if (selectedComponents.colors) {
      parts.push(
        `Màu sắc & Mood: Tông cảm xúc ${analysisResult.colorPalette?.dominantMood}, xử lý màu ${analysisResult.colorPalette?.colorGrading}.`
      );
    }

    return parts.length > 0 ? parts.join(' ') : analysisResult.recommendedPromptVi;
  }, [analysisResult, selectedComponents, selectedProps]);

  const activeComponentsCount = Object.values(selectedComponents).filter(Boolean).length;

  const handleApplyToEditor = () => {
    if (!analysisResult) return;
    const finalPrompt = previewLanguage === 'en' ? dynamicCombinedPromptEn : dynamicCombinedPromptVi;

    onApplyPrompt(
      finalPrompt,
      analysisResult.suggestedAspectRatio,
      analysisResult.negativePrompt,
      insertMode
    );

    setApplied(true);
    setTimeout(() => {
      setApplied(false);
      onClose();
    }, 1000);
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-2 sm:p-4 md:p-6 bg-[#000000]/80 backdrop-blur-md animate-in fade-in duration-200">
      {/* Modal Container */}
      <div className="bg-[#FFFFFF] dark:bg-[#111110] text-[#1C1B18] dark:text-[#E8E7E2] w-full max-w-6xl max-h-[94vh] border border-[#E2DDD5] dark:border-[#292925] flex flex-col shadow-2xl overflow-hidden font-sans">
        
        {/* TOP BAR */}
        <div className="flex items-center justify-between px-4 sm:px-5 py-3 border-b border-[#EDE9E1] dark:border-[#1D1D1B] bg-[#F8F7F4] dark:bg-[#0B0B0A] shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 bg-[#1C1B18] text-[#F8F7F4] dark:bg-[#D8D3C5] dark:text-[#0B0B0A] flex items-center justify-center">
              <Sparkles size={15} />
            </div>
            <div>
              <div className="flex items-center gap-2 flex-wrap">
                <h2 className="text-xs uppercase tracking-[0.18em] font-semibold text-[#1C1B18] dark:text-[#E8E7E2]">
                  AI Visual Style & Reference Analyzer
                </h2>
                <span className="text-[9px] font-mono px-2 py-0.5 bg-[#22C55E]/15 text-[#15803D] dark:text-[#4ADE80] uppercase tracking-wider font-semibold">
                  Multimodal Vision
                </span>
              </div>
              <p className="text-[10px] text-[#6E6B64] dark:text-[#8C8B84]">
                Phân tích sâu bối cảnh kiến trúc, vật thể đạo cụ, ánh sáng & tích chọn thành phần tùy ý
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <label className="cursor-pointer text-[10px] uppercase tracking-wider font-medium px-3 py-1.5 border border-[#E2DDD5] dark:border-[#292925] bg-[#FFFFFF] dark:bg-[#161614] hover:border-[#1C1B18] dark:hover:border-[#E8E7E2] transition-colors flex items-center gap-1.5">
              <Upload size={12} />
              <span>Đổi ảnh khác</span>
              <input type="file" accept="image/*" className="hidden" onChange={handleFileUpload} />
            </label>
            
            <button
              type="button"
              onClick={onClose}
              className="p-1.5 text-[#6E6B64] dark:text-[#8C8B84] hover:text-[#1C1B18] dark:hover:text-[#E8E7E2] transition-colors cursor-pointer"
            >
              <X size={18} />
            </button>
          </div>
        </div>

        {/* MODAL BODY */}
        <div className="flex-1 overflow-y-auto grid grid-cols-1 lg:grid-cols-12 gap-0 divide-y lg:divide-y-0 lg:divide-x divide-[#EDE9E1] dark:divide-[#1D1D1B]">
          
          {/* LEFT PANEL: Image View & Sample Presets (Span 4) */}
          <div className="lg:col-span-4 p-4 sm:p-5 space-y-4 bg-[#FAFAF8] dark:bg-[#0E0E0D] overflow-y-auto">
            
            {/* Active Preview */}
            <div className="space-y-2">
              <div className="flex items-center justify-between text-[10px] uppercase tracking-wider text-[#6E6B64] dark:text-[#8C8B84] font-medium">
                <span>Ảnh mẫu đang phân tích</span>
                {analysisResult?.suggestedAspectRatio && (
                  <span className="font-mono text-[9px] bg-[#E2DDD5] dark:bg-[#242421] px-1.5 py-0.5 text-[#1C1B18] dark:text-[#E8E7E2]">
                    Ratio: {analysisResult.suggestedAspectRatio}
                  </span>
                )}
              </div>

              <div className="relative group aspect-square bg-[#EDE9E1] dark:bg-[#161614] border border-[#E2DDD5] dark:border-[#292925] overflow-hidden flex items-center justify-center">
                {currentImage ? (
                  <img
                    src={currentImage}
                    alt="Reference to analyze"
                    className="w-full h-full object-cover"
                  />
                ) : (
                  <div className="text-center p-4 text-[#9C988F] dark:text-[#5E5D57]">
                    <ImageIcon size={32} className="mx-auto mb-2 opacity-50" />
                    <p className="text-xs">Chưa có ảnh nào được tải lên</p>
                  </div>
                )}

                {isAnalyzing && (
                  <div className="absolute inset-0 bg-[#000000]/60 backdrop-blur-xs flex flex-col items-center justify-center gap-2 text-white">
                    <RefreshCw size={24} className="animate-spin text-white" />
                    <span className="text-[11px] uppercase tracking-widest font-mono">Đang quét bối cảnh & style...</span>
                  </div>
                )}
              </div>
            </div>

            {/* Quick Palette Swatches Bar */}
            {analysisResult?.colorPalette?.hexColors && (
              <div className="space-y-1.5 border-t border-[#EDE9E1] dark:border-[#1D1D1B] pt-2.5">
                <div className="flex items-center justify-between text-[10px] uppercase tracking-wider text-[#6E6B64] dark:text-[#8C8B84] font-medium">
                  <span>Màu sắc trích xuất (Palette)</span>
                  <span className="text-[9px] text-[#9C988F] dark:text-[#5E5D57]">Click để copy HEX</span>
                </div>
                <div className="grid grid-cols-5 gap-1.5">
                  {analysisResult.colorPalette.hexColors.map((color, idx) => (
                    <button
                      key={idx}
                      type="button"
                      onClick={() => copyToClipboard(color.hex, `color-${idx}`)}
                      className="group flex flex-col items-center cursor-pointer"
                      title={`${color.name} (${color.role})`}
                    >
                      <div
                        className="w-full h-6 border border-[#E2DDD5] dark:border-[#292925] relative transition-transform group-hover:scale-105"
                        style={{ backgroundColor: color.hex }}
                      >
                        {copiedField === `color-${idx}` && (
                          <div className="absolute inset-0 bg-black/70 flex items-center justify-center text-white">
                            <Check size={10} />
                          </div>
                        )}
                      </div>
                      <span className="text-[8px] font-mono text-[#6E6B64] dark:text-[#8C8B84] mt-0.5 truncate max-w-full">
                        {color.hex}
                      </span>
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* Sample References Picker */}
            <div className="space-y-2 border-t border-[#EDE9E1] dark:border-[#1D1D1B] pt-2.5">
              <label className="text-[10px] uppercase tracking-wider text-[#6E6B64] dark:text-[#8C8B84] font-medium block">
                Mẫu ảnh bối cảnh & phong cách tiêu biểu:
              </label>
              <div className="space-y-1.5 max-h-[160px] overflow-y-auto pr-1">
                {SAMPLE_REFERENCE_PRESETS.map((preset, idx) => (
                  <button
                    key={idx}
                    type="button"
                    onClick={() => handleSelectPreset(preset.url)}
                    className="w-full p-1.5 border border-[#E2DDD5] dark:border-[#292925] bg-[#FFFFFF] dark:bg-[#161614] hover:border-[#1C1B18] dark:hover:border-[#E8E7E2] transition-colors text-left group cursor-pointer flex gap-2 items-center"
                  >
                    <img
                      src={preset.url}
                      alt={preset.name}
                      className="w-8 h-8 object-cover shrink-0 border border-[#EDE9E1] dark:border-[#242421]"
                    />
                    <div className="overflow-hidden flex-1">
                      <p className="text-[10px] font-semibold text-[#1C1B18] dark:text-[#E8E7E2] truncate">
                        {preset.name}
                      </p>
                      <p className="text-[8px] text-[#9C988F] dark:text-[#5E5D57] truncate">
                        {preset.desc}
                      </p>
                    </div>
                  </button>
                ))}
              </div>
            </div>

            {/* Re-analyze with specific focus */}
            <div className="space-y-1.5 border-t border-[#EDE9E1] dark:border-[#1D1D1B] pt-2.5">
              <label className="text-[10px] uppercase tracking-wider text-[#6E6B64] dark:text-[#8C8B84] font-medium block">
                Yêu cầu AI tập trung phân tích thêm:
              </label>
              <div className="flex gap-1.5">
                <input
                  type="text"
                  value={customFocus}
                  onChange={(e) => setCustomFocus(e.target.value)}
                  placeholder="Ví dụ: bối cảnh lâu đài cổ, tường xi măng, đèn cổ điển..."
                  className="flex-1 bg-[#FFFFFF] dark:bg-[#161614] border border-[#E2DDD5] dark:border-[#292925] px-2.5 py-1 text-xs text-[#1C1B18] dark:text-[#E8E7E2] placeholder-[#A3A096] dark:placeholder-[#4A4944] focus:outline-none focus:border-[#1C1B18] dark:focus:border-[#5E5D57]"
                />
                <button
                  type="button"
                  onClick={() => currentImage && runAnalysis(currentImage, currentFile, customFocus)}
                  disabled={isAnalyzing || !currentImage}
                  className="px-3 py-1 bg-[#1C1B18] dark:bg-[#D8D3C5] text-[#F8F7F4] dark:text-[#0B0B0A] text-[10px] uppercase tracking-wider font-semibold cursor-pointer disabled:opacity-50"
                >
                  Quét
                </button>
              </div>
            </div>
          </div>

          {/* RIGHT PANEL: Modular Selection, Deep Background & Live Prompt (Span 8) */}
          <div className="lg:col-span-8 p-4 sm:p-5 space-y-5 overflow-y-auto">
            
            {/* 🌟 MODULAR COMPONENT SELECTOR BAR (TÍCH CHỌN THÀNH PHẦN THÊM VÀO) */}
            <div className="p-3.5 border-2 border-[#1C1B18] dark:border-[#D8D3C5] bg-[#F8F7F4] dark:bg-[#151513] space-y-3">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-[#EDE9E1] dark:border-[#242421] pb-2.5">
                <div className="flex items-center gap-2">
                  <Sliders size={14} className="text-[#1C1B18] dark:text-[#D8D3C5]" />
                  <span className="text-xs uppercase tracking-[0.15em] font-bold text-[#1C1B18] dark:text-[#E8E7E2]">
                    Tích chọn thành phần thêm vào Prompt
                  </span>
                  <span className="font-mono text-[10px] bg-[#1C1B18] text-[#F8F7F4] dark:bg-[#D8D3C5] dark:text-[#0B0B0A] px-2 py-0.5 font-semibold">
                    Đã chọn: {activeComponentsCount}/6 mục
                  </span>
                </div>

                {/* Quick Select All / None */}
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={selectAllComponents}
                    className="text-[10px] uppercase tracking-wider font-semibold text-[#1C1B18] dark:text-[#D8D3C5] hover:underline cursor-pointer flex items-center gap-1"
                  >
                    <CheckSquare size={12} />
                    <span>Chọn tất cả</span>
                  </button>
                  <span className="text-[#9C988F] dark:text-[#5E5D57]">|</span>
                  <button
                    type="button"
                    onClick={deselectAllComponents}
                    className="text-[10px] uppercase tracking-wider font-medium text-[#6E6B64] dark:text-[#8C8B84] hover:text-[#1C1B18] dark:hover:text-[#E8E7E2] cursor-pointer"
                  >
                    Bỏ chọn
                  </button>
                </div>
              </div>

              {/* Checkboxes Grid */}
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                
                {/* 1. Background & Props */}
                <button
                  type="button"
                  onClick={() => toggleComponent('background')}
                  className={`p-2 border text-left flex items-start gap-2 transition-all cursor-pointer ${
                    selectedComponents.background
                      ? 'border-[#3B82F6] bg-[#3B82F6]/10 dark:bg-[#3B82F6]/15 text-[#1C1B18] dark:text-[#E8E7E2]'
                      : 'border-[#E2DDD5] dark:border-[#292925] bg-[#FFFFFF] dark:bg-[#161614] text-[#8C8B84] opacity-75'
                  }`}
                >
                  <div className="mt-0.5">
                    {selectedComponents.background ? (
                      <CheckSquare size={14} className="text-[#3B82F6]" />
                    ) : (
                      <Square size={14} />
                    )}
                  </div>
                  <div>
                    <p className="text-[11px] font-bold">🏰 Bối cảnh & Đạo cụ</p>
                    <p className="text-[9px] opacity-80">Lâu đài, tường xi măng, đèn cổ...</p>
                  </div>
                </button>

                {/* 2. Lighting */}
                <button
                  type="button"
                  onClick={() => toggleComponent('lighting')}
                  className={`p-2 border text-left flex items-start gap-2 transition-all cursor-pointer ${
                    selectedComponents.lighting
                      ? 'border-[#EAB308] bg-[#EAB308]/10 dark:bg-[#EAB308]/15 text-[#1C1B18] dark:text-[#E8E7E2]'
                      : 'border-[#E2DDD5] dark:border-[#292925] bg-[#FFFFFF] dark:bg-[#161614] text-[#8C8B84] opacity-75'
                  }`}
                >
                  <div className="mt-0.5">
                    {selectedComponents.lighting ? (
                      <CheckSquare size={14} className="text-[#EAB308]" />
                    ) : (
                      <Square size={14} />
                    )}
                  </div>
                  <div>
                    <p className="text-[11px] font-bold">💡 Ánh sáng & Nguồn sáng</p>
                    <p className="text-[9px] opacity-80">Hướng sáng, Chiaroscuro, nhiệt độ</p>
                  </div>
                </button>

                {/* 3. Camera & Optics */}
                <button
                  type="button"
                  onClick={() => toggleComponent('camera')}
                  className={`p-2 border text-left flex items-start gap-2 transition-all cursor-pointer ${
                    selectedComponents.camera
                      ? 'border-[#10B981] bg-[#10B981]/10 dark:bg-[#10B981]/15 text-[#1C1B18] dark:text-[#E8E7E2]'
                      : 'border-[#E2DDD5] dark:border-[#292925] bg-[#FFFFFF] dark:bg-[#161614] text-[#8C8B84] opacity-75'
                  }`}
                >
                  <div className="mt-0.5">
                    {selectedComponents.camera ? (
                      <CheckSquare size={14} className="text-[#10B981]" />
                    ) : (
                      <Square size={14} />
                    )}
                  </div>
                  <div>
                    <p className="text-[11px] font-bold">📷 Góc máy & Bố cục</p>
                    <p className="text-[9px] opacity-80">Tiêu cự 85mm, khẩu độ, quy tắc 1/3</p>
                  </div>
                </button>

                {/* 4. Style & Aesthetics */}
                <button
                  type="button"
                  onClick={() => toggleComponent('style')}
                  className={`p-2 border text-left flex items-start gap-2 transition-all cursor-pointer ${
                    selectedComponents.style
                      ? 'border-[#8B5CF6] bg-[#8B5CF6]/10 dark:bg-[#8B5CF6]/15 text-[#1C1B18] dark:text-[#E8E7E2]'
                      : 'border-[#E2DDD5] dark:border-[#292925] bg-[#FFFFFF] dark:bg-[#161614] text-[#8C8B84] opacity-75'
                  }`}
                >
                  <div className="mt-0.5">
                    {selectedComponents.style ? (
                      <CheckSquare size={14} className="text-[#8B5CF6]" />
                    ) : (
                      <Square size={14} />
                    )}
                  </div>
                  <div>
                    <p className="text-[11px] font-bold">🎨 Phong cách nghệ thuật</p>
                    <p className="text-[9px] opacity-80">Chất phim 35mm, thể loại nghệ thuật</p>
                  </div>
                </button>

                {/* 5. Color Palette & Mood */}
                <button
                  type="button"
                  onClick={() => toggleComponent('colors')}
                  className={`p-2 border text-left flex items-start gap-2 transition-all cursor-pointer ${
                    selectedComponents.colors
                      ? 'border-[#EC4899] bg-[#EC4899]/10 dark:bg-[#EC4899]/15 text-[#1C1B18] dark:text-[#E8E7E2]'
                      : 'border-[#E2DDD5] dark:border-[#292925] bg-[#FFFFFF] dark:bg-[#161614] text-[#8C8B84] opacity-75'
                  }`}
                >
                  <div className="mt-0.5">
                    {selectedComponents.colors ? (
                      <CheckSquare size={14} className="text-[#EC4899]" />
                    ) : (
                      <Square size={14} />
                    )}
                  </div>
                  <div>
                    <p className="text-[11px] font-bold">🌈 Bảng màu & Mood</p>
                    <p className="text-[9px] opacity-80">Color grading, tông cảm xúc</p>
                  </div>
                </button>

                {/* 6. Subject & Textures */}
                <button
                  type="button"
                  onClick={() => toggleComponent('subject')}
                  className={`p-2 border text-left flex items-start gap-2 transition-all cursor-pointer ${
                    selectedComponents.subject
                      ? 'border-[#F97316] bg-[#F97316]/10 dark:bg-[#F97316]/15 text-[#1C1B18] dark:text-[#E8E7E2]'
                      : 'border-[#E2DDD5] dark:border-[#292925] bg-[#FFFFFF] dark:bg-[#161614] text-[#8C8B84] opacity-75'
                  }`}
                >
                  <div className="mt-0.5">
                    {selectedComponents.subject ? (
                      <CheckSquare size={14} className="text-[#F97316]" />
                    ) : (
                      <Square size={14} />
                    )}
                  </div>
                  <div>
                    <p className="text-[11px] font-bold">👤 Chi tiết chủ thể & da</p>
                    <p className="text-[9px] opacity-80">Vân da chân thực, sợi vải vi mô</p>
                  </div>
                </button>
              </div>
            </div>

            {/* Navigation Tabs */}
            <div className="flex items-center gap-1 border-b border-[#EDE9E1] dark:border-[#1D1D1B] pb-2 overflow-x-auto">
              {[
                { id: 'all', label: 'Tất cả phân tích', icon: Layers },
                { id: 'background', label: '🏰 Bối cảnh & Hậu cảnh', icon: Building2 },
                { id: 'lighting', label: '💡 Ánh sáng', icon: Sun },
                { id: 'camera', label: '📷 Góc máy & Bố cục', icon: Camera },
                { id: 'colors', label: '🌈 Màu sắc & Mood', icon: Palette },
                { id: 'custom_prompt', label: '✨ Prompt kết hợp live', icon: Sparkles },
              ].map((tab) => {
                const IconComponent = tab.icon;
                const isActive = activeTab === tab.id;
                return (
                  <button
                    key={tab.id}
                    type="button"
                    onClick={() => setActiveTab(tab.id as any)}
                    className={`px-3 py-1.5 text-[11px] uppercase tracking-wider font-medium flex items-center gap-1.5 whitespace-nowrap transition-colors cursor-pointer ${
                      isActive
                        ? 'bg-[#1C1B18] text-[#F8F7F4] dark:bg-[#D8D3C5] dark:text-[#0B0B0A]'
                        : 'text-[#6E6B64] dark:text-[#8C8B84] hover:text-[#1C1B18] dark:hover:text-[#E8E7E2] hover:bg-[#F2EFE9] dark:hover:bg-[#161614]'
                    }`}
                  >
                    <IconComponent size={12} />
                    <span>{tab.label}</span>
                  </button>
                );
              })}
            </div>

            {/* Analysis Loading State */}
            {isAnalyzing && (
              <div className="py-16 text-center space-y-3">
                <RefreshCw size={28} className="animate-spin mx-auto text-[#1C1B18] dark:text-[#D8D3C5]" />
                <p className="text-xs uppercase tracking-[0.18em] font-medium text-[#1C1B18] dark:text-[#E8E7E2]">
                  Đang phân tích bối cảnh, vật thể, kiến trúc & ánh sáng...
                </p>
                <p className="text-[11px] text-[#6E6B64] dark:text-[#8C8B84]">
                  Nhận diện chi tiết: lâu đài cổ, tường xi măng, đèn cổ điển, chất liệu bề mặt và bố cục
                </p>
              </div>
            )}

            {!isAnalyzing && analysisResult && (
              <div className="space-y-5">
                
                {/* 🏰 01. DEEP BACKGROUND & OBJECTS ANALYSIS CARD */}
                {(activeTab === 'all' || activeTab === 'background') && (
                  <div className="p-4 sm:p-5 border border-[#3B82F6]/40 bg-[#FFFFFF] dark:bg-[#161614] space-y-4 shadow-xs">
                    <div className="flex items-center justify-between border-b border-[#EDE9E1] dark:border-[#1D1D1B] pb-2.5">
                      <div className="flex items-center gap-2">
                        <Building2 size={16} className="text-[#3B82F6]" />
                        <h4 className="text-xs uppercase tracking-[0.15em] font-bold text-[#1C1B18] dark:text-[#E8E7E2]">
                          Phân tích bối cảnh, kiến trúc & vật thể (Background & Props)
                        </h4>
                      </div>
                      <label className="flex items-center gap-1.5 text-xs font-semibold cursor-pointer select-none">
                        <input
                          type="checkbox"
                          checked={selectedComponents.background}
                          onChange={() => toggleComponent('background')}
                          className="accent-[#3B82F6] w-3.5 h-3.5"
                        />
                        <span className="text-[10px] uppercase text-[#3B82F6]">
                          {selectedComponents.background ? 'Đang bật trong Prompt' : 'Bật vào Prompt'}
                        </span>
                      </label>
                    </div>

                    {/* Setting & Space metrics */}
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
                      <div className="p-2.5 bg-[#F8F7F4] dark:bg-[#0E0E0D] border border-[#EDE9E1] dark:border-[#242421]">
                        <span className="text-[#6E6B64] dark:text-[#8C8B84] text-[10px] uppercase tracking-wider block font-medium">
                          Không gian bối cảnh chính:
                        </span>
                        <p className="font-semibold text-[#1C1B18] dark:text-[#E8E7E2] mt-0.5">
                          {analysisResult.background.settingType}
                        </p>
                      </div>

                      <div className="p-2.5 bg-[#F8F7F4] dark:bg-[#0E0E0D] border border-[#EDE9E1] dark:border-[#242421]">
                        <span className="text-[#6E6B64] dark:text-[#8C8B84] text-[10px] uppercase tracking-wider block font-medium">
                          Phong cách kiến trúc:
                        </span>
                        <p className="font-semibold text-[#1C1B18] dark:text-[#E8E7E2] mt-0.5">
                          {analysisResult.background.architecturalStyle || 'Kiến trúc cổ điển kết hợp vật liệu tự nhiên'}
                        </p>
                      </div>

                      <div className="p-2.5 bg-[#F8F7F4] dark:bg-[#0E0E0D] border border-[#EDE9E1] dark:border-[#242421]">
                        <span className="text-[#6E6B64] dark:text-[#8C8B84] text-[10px] uppercase tracking-wider block font-medium">
                          Độ sâu trường ảnh (DOF):
                        </span>
                        <p className="text-[#1C1B18] dark:text-[#E8E7E2] mt-0.5">
                          {analysisResult.background.depthOfField}
                        </p>
                      </div>

                      <div className="p-2.5 bg-[#F8F7F4] dark:bg-[#0E0E0D] border border-[#EDE9E1] dark:border-[#242421]">
                        <span className="text-[#6E6B64] dark:text-[#8C8B84] text-[10px] uppercase tracking-wider block font-medium">
                          Bầu không khí môi trường:
                        </span>
                        <p className="text-[#1C1B18] dark:text-[#E8E7E2] mt-0.5">
                          {analysisResult.background.atmosphere || 'Tĩnh lặng, vệt sáng xiên tạo chiều sâu điện ảnh'}
                        </p>
                      </div>
                    </div>

                    {/* Granular Objects & Props interactive picker */}
                    <div className="space-y-2 pt-1 border-t border-[#EDE9E1] dark:border-[#1D1D1B]">
                      <div className="flex items-center justify-between">
                        <span className="text-[11px] uppercase tracking-wider font-bold text-[#1C1B18] dark:text-[#E8E7E2] flex items-center gap-1.5">
                          <Boxes size={13} className="text-[#3B82F6]" />
                          <span>Chi tiết vật thể & đạo cụ nhận diện được:</span>
                        </span>
                        <span className="text-[9px] text-[#6E6B64] dark:text-[#8C8B84]">
                          Click vào từng thẻ để thêm / bớt khỏi prompt
                        </span>
                      </div>

                      <div className="flex flex-wrap gap-1.5">
                        {/* If we have structured objectsAndProps */}
                        {analysisResult.background.objectsAndProps && analysisResult.background.objectsAndProps.length > 0 ? (
                          analysisResult.background.objectsAndProps.map((prop, idx) => {
                            const isPropSelected = selectedProps.includes(prop.name);
                            return (
                              <button
                                key={idx}
                                type="button"
                                onClick={() => toggleProp(prop.name)}
                                className={`px-2.5 py-1.5 border text-xs flex items-center gap-1.5 transition-all cursor-pointer ${
                                  isPropSelected
                                    ? 'border-[#3B82F6] bg-[#3B82F6]/15 text-[#1D4ED8] dark:text-[#93C5FD] font-semibold'
                                    : 'border-[#EDE9E1] dark:border-[#292925] bg-[#F8F7F4] dark:bg-[#1A1A18] text-[#8C8B84] line-through opacity-70'
                                }`}
                                title={prop.description || prop.name}
                              >
                                {isPropSelected ? (
                                  <Check size={12} className="text-[#3B82F6]" />
                                ) : (
                                  <Plus size={12} />
                                )}
                                <span>{prop.name}</span>
                              </button>
                            );
                          })
                        ) : (
                          // Fallback to elements array
                          analysisResult.background.elements.map((elem, idx) => {
                            const isPropSelected = selectedProps.includes(elem);
                            return (
                              <button
                                key={idx}
                                type="button"
                                onClick={() => toggleProp(elem)}
                                className={`px-2.5 py-1.5 border text-xs flex items-center gap-1.5 transition-all cursor-pointer ${
                                  isPropSelected
                                    ? 'border-[#3B82F6] bg-[#3B82F6]/15 text-[#1D4ED8] dark:text-[#93C5FD] font-semibold'
                                    : 'border-[#EDE9E1] dark:border-[#292925] bg-[#F8F7F4] dark:bg-[#1A1A18] text-[#8C8B84] line-through opacity-70'
                                }`}
                              >
                                {isPropSelected ? (
                                  <Check size={12} className="text-[#3B82F6]" />
                                ) : (
                                  <Plus size={12} />
                                )}
                                <span>{elem}</span>
                              </button>
                            );
                          })
                        )}
                      </div>
                    </div>

                    {/* Materials recognized */}
                    {analysisResult.background.materials && analysisResult.background.materials.length > 0 && (
                      <div className="space-y-1 pt-1">
                        <span className="text-[10px] uppercase tracking-wider text-[#6E6B64] dark:text-[#8C8B84] font-medium block">
                          Chất liệu & Kết cấu bề mặt (Materials):
                        </span>
                        <div className="flex flex-wrap gap-1">
                          {analysisResult.background.materials.map((mat, idx) => (
                            <span
                              key={idx}
                              className="text-[10px] font-mono bg-[#EDE9E1]/80 dark:bg-[#20201D] px-2 py-0.5 border border-[#E2DDD5] dark:border-[#292925] text-[#1C1B18] dark:text-[#E8E7E2]"
                            >
                              • {mat}
                            </span>
                          ))}
                        </div>
                      </div>
                    )}

                    {/* Detailed textual breakdown */}
                    <p className="text-[11px] text-[#3E3D38] dark:text-[#C4C2BA] leading-relaxed italic border-t border-[#EDE9E1] dark:border-[#1D1D1B] pt-2">
                      "{analysisResult.background.detailedAnalysis}"
                    </p>

                    {/* Dedicated Background Snippet Box */}
                    {analysisResult.background.promptSnippetEn && (
                      <div className="p-2.5 bg-[#F8F7F4] dark:bg-[#0E0E0D] border border-[#EDE9E1] dark:border-[#242421] space-y-1">
                        <div className="flex items-center justify-between text-[9px] uppercase tracking-wider text-[#6E6B64] dark:text-[#8C8B84]">
                          <span className="font-semibold">Mảnh Prompt bối cảnh độc lập (English snippet)</span>
                          <button
                            type="button"
                            onClick={() => copyToClipboard(analysisResult.background.promptSnippetEn!, 'bg-snippet')}
                            className="hover:text-[#1C1B18] dark:hover:text-[#E8E7E2] flex items-center gap-1 cursor-pointer"
                          >
                            {copiedField === 'bg-snippet' ? (
                              <span className="text-emerald-500 font-semibold">Đã copy</span>
                            ) : (
                              <>
                                <Copy size={10} />
                                <span>Copy mảnh này</span>
                              </>
                            )}
                          </button>
                        </div>
                        <p className="text-[11px] font-mono text-[#1C1B18] dark:text-[#E8E7E2] select-all">
                          {analysisResult.background.promptSnippetEn}
                        </p>
                      </div>
                    )}
                  </div>
                )}

                {/* 💡 02. LIGHTING ANALYSIS CARD */}
                {(activeTab === 'all' || activeTab === 'lighting') && (
                  <div className="p-4 border border-[#E2DDD5] dark:border-[#292925] bg-[#FFFFFF] dark:bg-[#161614] space-y-3">
                    <div className="flex items-center justify-between border-b border-[#EDE9E1] dark:border-[#1D1D1B] pb-2">
                      <div className="flex items-center gap-2">
                        <Sun size={14} className="text-[#EAB308]" />
                        <h4 className="text-xs uppercase tracking-[0.15em] font-semibold text-[#1C1B18] dark:text-[#E8E7E2]">
                          Ánh sáng & Kỹ thuật chiếu sáng (Lighting)
                        </h4>
                      </div>
                      <label className="flex items-center gap-1.5 text-xs font-semibold cursor-pointer select-none">
                        <input
                          type="checkbox"
                          checked={selectedComponents.lighting}
                          onChange={() => toggleComponent('lighting')}
                          className="accent-[#EAB308] w-3.5 h-3.5"
                        />
                        <span className="text-[10px] uppercase text-[#EAB308]">
                          {selectedComponents.lighting ? 'Đang bật trong Prompt' : 'Bật vào Prompt'}
                        </span>
                      </label>
                    </div>

                    <div className="grid grid-cols-2 gap-2 text-xs">
                      <div className="p-2 bg-[#F8F7F4] dark:bg-[#0E0E0D] border border-[#EDE9E1] dark:border-[#242421]">
                        <span className="text-[#6E6B64] dark:text-[#8C8B84] text-[10px]">Nguồn sáng:</span>
                        <p className="font-medium text-[#1C1B18] dark:text-[#E8E7E2]">{analysisResult.lighting.sourceType}</p>
                      </div>
                      <div className="p-2 bg-[#F8F7F4] dark:bg-[#0E0E0D] border border-[#EDE9E1] dark:border-[#242421]">
                        <span className="text-[#6E6B64] dark:text-[#8C8B84] text-[10px]">Hướng chiếu:</span>
                        <p className="font-medium text-[#1C1B18] dark:text-[#E8E7E2]">{analysisResult.lighting.direction}</p>
                      </div>
                      <div className="p-2 bg-[#F8F7F4] dark:bg-[#0E0E0D] border border-[#EDE9E1] dark:border-[#242421]">
                        <span className="text-[#6E6B64] dark:text-[#8C8B84] text-[10px]">Nhiệt độ màu:</span>
                        <p className="font-mono text-[#1C1B18] dark:text-[#E8E7E2]">{analysisResult.lighting.colorTemperature}</p>
                      </div>
                      <div className="p-2 bg-[#F8F7F4] dark:bg-[#0E0E0D] border border-[#EDE9E1] dark:border-[#242421]">
                        <span className="text-[#6E6B64] dark:text-[#8C8B84] text-[10px]">Độ tương phản:</span>
                        <p className="font-medium text-[#1C1B18] dark:text-[#E8E7E2]">{analysisResult.lighting.quality}</p>
                      </div>
                    </div>

                    <p className="text-[11px] text-[#6E6B64] dark:text-[#8C8B84] leading-relaxed italic">
                      "{analysisResult.lighting.detailedAnalysis}"
                    </p>
                  </div>
                )}

                {/* 📷 03. CAMERA, LENS & COMPOSITION */}
                {(activeTab === 'all' || activeTab === 'camera') && (
                  <div className="p-4 border border-[#E2DDD5] dark:border-[#292925] bg-[#FFFFFF] dark:bg-[#161614] space-y-3">
                    <div className="flex items-center justify-between border-b border-[#EDE9E1] dark:border-[#1D1D1B] pb-2">
                      <div className="flex items-center gap-2">
                        <Camera size={14} className="text-[#10B981]" />
                        <h4 className="text-xs uppercase tracking-[0.15em] font-semibold text-[#1C1B18] dark:text-[#E8E7E2]">
                          Góc máy, Ống kính & Bố cục (Camera & Optics)
                        </h4>
                      </div>
                      <label className="flex items-center gap-1.5 text-xs font-semibold cursor-pointer select-none">
                        <input
                          type="checkbox"
                          checked={selectedComponents.camera}
                          onChange={() => toggleComponent('camera')}
                          className="accent-[#10B981] w-3.5 h-3.5"
                        />
                        <span className="text-[10px] uppercase text-[#10B981]">
                          {selectedComponents.camera ? 'Đang bật trong Prompt' : 'Bật vào Prompt'}
                        </span>
                      </label>
                    </div>

                    <div className="grid grid-cols-3 gap-2 text-xs">
                      <div className="p-2 bg-[#F8F7F4] dark:bg-[#0E0E0D] border border-[#EDE9E1] dark:border-[#242421]">
                        <span className="text-[#6E6B64] dark:text-[#8C8B84] text-[10px]">Góc chụp:</span>
                        <p className="font-medium text-[#1C1B18] dark:text-[#E8E7E2]">{analysisResult.camera.shotType}</p>
                      </div>
                      <div className="p-2 bg-[#F8F7F4] dark:bg-[#0E0E0D] border border-[#EDE9E1] dark:border-[#242421]">
                        <span className="text-[#6E6B64] dark:text-[#8C8B84] text-[10px]">Ống kính đề xuất:</span>
                        <p className="font-mono font-medium text-[#1C1B18] dark:text-[#E8E7E2]">{analysisResult.camera.lensSuggestion}</p>
                      </div>
                      <div className="p-2 bg-[#F8F7F4] dark:bg-[#0E0E0D] border border-[#EDE9E1] dark:border-[#242421]">
                        <span className="text-[#6E6B64] dark:text-[#8C8B84] text-[10px]">Quy tắc bố cục:</span>
                        <p className="font-medium text-[#1C1B18] dark:text-[#E8E7E2]">{analysisResult.camera.compositionRule}</p>
                      </div>
                    </div>

                    <p className="text-[11px] text-[#6E6B64] dark:text-[#8C8B84] leading-relaxed italic">
                      "{analysisResult.camera.detailedAnalysis}"
                    </p>
                  </div>
                )}

                {/* 🌈 04. COLOR GRADING & MOOD */}
                {(activeTab === 'all' || activeTab === 'colors') && (
                  <div className="p-4 border border-[#E2DDD5] dark:border-[#292925] bg-[#FFFFFF] dark:bg-[#161614] space-y-3">
                    <div className="flex items-center justify-between border-b border-[#EDE9E1] dark:border-[#1D1D1B] pb-2">
                      <div className="flex items-center gap-2">
                        <Palette size={14} className="text-[#A855F7]" />
                        <h4 className="text-xs uppercase tracking-[0.15em] font-semibold text-[#1C1B18] dark:text-[#E8E7E2]">
                          Màu sắc & Tông cảm xúc (Mood & Color Grading)
                        </h4>
                      </div>
                      <label className="flex items-center gap-1.5 text-xs font-semibold cursor-pointer select-none">
                        <input
                          type="checkbox"
                          checked={selectedComponents.colors}
                          onChange={() => toggleComponent('colors')}
                          className="accent-[#A855F7] w-3.5 h-3.5"
                        />
                        <span className="text-[10px] uppercase text-[#A855F7]">
                          {selectedComponents.colors ? 'Đang bật trong Prompt' : 'Bật vào Prompt'}
                        </span>
                      </label>
                    </div>

                    <div className="p-2.5 bg-[#F8F7F4] dark:bg-[#0E0E0D] border border-[#EDE9E1] dark:border-[#242421] space-y-1">
                      <span className="text-[#6E6B64] dark:text-[#8C8B84] text-[10px] uppercase tracking-wider block font-medium">
                        Sắc thái cảm xúc chính (Dominant Mood):
                      </span>
                      <p className="font-semibold text-xs text-[#1C1B18] dark:text-[#E8E7E2]">
                        {analysisResult.colorPalette.dominantMood}
                      </p>
                      <p className="text-[11px] text-[#3E3D38] dark:text-[#C4C2BA] mt-1">
                        {analysisResult.colorPalette.colorGrading}
                      </p>
                    </div>
                  </div>
                )}

                {/* ✨ 05. DYNAMIC LIVE COMBINED PROMPT (KẾT HỢP THEO MỤC TÍCH CHỌN) */}
                <div className="p-4 sm:p-5 border-2 border-[#1C1B18] dark:border-[#D8D3C5] bg-[#F8F7F4] dark:bg-[#131311] space-y-4">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-[#EDE9E1] dark:border-[#242421] pb-2.5">
                    <div className="flex items-center gap-2">
                      <Sparkles size={16} className="text-[#1C1B18] dark:text-[#D8D3C5]" />
                      <h4 className="text-xs uppercase tracking-[0.18em] font-bold text-[#1C1B18] dark:text-[#E8E7E2]">
                        Prompt kết hợp theo các mục bạn đã chọn ({activeComponentsCount}/6 thành phần)
                      </h4>
                    </div>

                    {/* Language and Mode Toggles */}
                    <div className="flex items-center gap-2">
                      <div className="flex border border-[#E2DDD5] dark:border-[#292925] bg-[#FFFFFF] dark:bg-[#161614] p-0.5 text-[10px]">
                        <button
                          type="button"
                          onClick={() => setPreviewLanguage('en')}
                          className={`px-2 py-0.5 font-semibold cursor-pointer ${
                            previewLanguage === 'en'
                              ? 'bg-[#1C1B18] text-white dark:bg-[#D8D3C5] dark:text-black'
                              : 'text-[#6E6B64] dark:text-[#8C8B84]'
                          }`}
                        >
                          Tiếng Anh (Flux / Midjourney)
                        </button>
                        <button
                          type="button"
                          onClick={() => setPreviewLanguage('vi')}
                          className={`px-2 py-0.5 font-semibold cursor-pointer ${
                            previewLanguage === 'vi'
                              ? 'bg-[#1C1B18] text-white dark:bg-[#D8D3C5] dark:text-black'
                              : 'text-[#6E6B64] dark:text-[#8C8B84]'
                          }`}
                        >
                          Tiếng Việt
                        </button>
                      </div>
                    </div>
                  </div>

                  {/* Active Included Badges */}
                  <div className="flex flex-wrap items-center gap-1 text-[9px] font-mono">
                    <span className="text-[#6E6B64] dark:text-[#8C8B84] uppercase mr-1">Đang ghép:</span>
                    {selectedComponents.background && (
                      <span className="px-2 py-0.5 bg-[#3B82F6]/15 text-[#1D4ED8] dark:text-[#93C5FD] border border-[#3B82F6]/30">
                        + Bối cảnh & {selectedProps.length} vật thể
                      </span>
                    )}
                    {selectedComponents.lighting && (
                      <span className="px-2 py-0.5 bg-[#EAB308]/15 text-[#854D0E] dark:text-[#FDE047] border border-[#EAB308]/30">
                        + Ánh sáng
                      </span>
                    )}
                    {selectedComponents.camera && (
                      <span className="px-2 py-0.5 bg-[#10B981]/15 text-[#065F46] dark:text-[#6EE7B7] border border-[#10B981]/30">
                        + Góc máy {analysisResult.camera?.lensSuggestion || '85mm'}
                      </span>
                    )}
                    {selectedComponents.style && (
                      <span className="px-2 py-0.5 bg-[#8B5CF6]/15 text-[#5B21B6] dark:text-[#C4B5FD] border border-[#8B5CF6]/30">
                        + Style nghệ thuật
                      </span>
                    )}
                    {selectedComponents.colors && (
                      <span className="px-2 py-0.5 bg-[#EC4899]/15 text-[#9D174D] dark:text-[#F9A8D4] border border-[#EC4899]/30">
                        + Bảng màu
                      </span>
                    )}
                    {selectedComponents.subject && (
                      <span className="px-2 py-0.5 bg-[#F97316]/15 text-[#9A3412] dark:text-[#FDBA74] border border-[#F97316]/30">
                        + Chi tiết chủ thể
                      </span>
                    )}
                  </div>

                  {/* The Live Prompt Text Box */}
                  <div className="space-y-1.5">
                    <div className="flex items-center justify-between text-[10px] uppercase tracking-wider text-[#6E6B64] dark:text-[#8C8B84] font-medium">
                      <span>Nội dung Prompt xuất ra:</span>
                      <button
                        type="button"
                        onClick={() =>
                          copyToClipboard(
                            previewLanguage === 'en' ? dynamicCombinedPromptEn : dynamicCombinedPromptVi,
                            'combined-prompt'
                          )
                        }
                        className="hover:text-[#1C1B18] dark:hover:text-[#E8E7E2] flex items-center gap-1 cursor-pointer font-semibold"
                      >
                        {copiedField === 'combined-prompt' ? (
                          <>
                            <Check size={11} className="text-emerald-500" />
                            <span className="text-emerald-500 font-bold">Đã sao chép!</span>
                          </>
                        ) : (
                          <>
                            <Copy size={11} />
                            <span>Copy Prompt này</span>
                          </>
                        )}
                      </button>
                    </div>

                    <div className="p-3 bg-[#FFFFFF] dark:bg-[#0B0B0A] border border-[#E2DDD5] dark:border-[#292925] text-xs font-mono text-[#1C1B18] dark:text-[#E8E7E2] leading-relaxed select-all max-h-[140px] overflow-y-auto">
                      {previewLanguage === 'en' ? dynamicCombinedPromptEn : dynamicCombinedPromptVi}
                    </div>
                  </div>

                  {/* Insertion Mode Option */}
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pt-1 border-t border-[#EDE9E1] dark:border-[#242421] text-xs">
                    <span className="text-[11px] text-[#6E6B64] dark:text-[#8C8B84]">Cách chèn vào Editor:</span>
                    <div className="flex items-center gap-4">
                      <label className="flex items-center gap-1.5 cursor-pointer text-[11px]">
                        <input
                          type="radio"
                          name="insertMode"
                          checked={insertMode === 'replace'}
                          onChange={() => setInsertMode('replace')}
                          className="accent-[#1C1B18] dark:accent-[#D8D3C5]"
                        />
                        <span>Thay thế hoàn toàn Prompt</span>
                      </label>
                      <label className="flex items-center gap-1.5 cursor-pointer text-[11px]">
                        <input
                          type="radio"
                          name="insertMode"
                          checked={insertMode === 'append'}
                          onChange={() => setInsertMode('append')}
                          className="accent-[#1C1B18] dark:accent-[#D8D3C5]"
                        />
                        <span>Nối thêm vào sau Prompt hiện tại</span>
                      </label>
                    </div>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* BOTTOM ACTION BAR */}
        <div className="px-4 sm:px-5 py-3 border-t border-[#EDE9E1] dark:border-[#1D1D1B] bg-[#F8F7F4] dark:bg-[#0B0B0A] flex flex-col sm:flex-row items-center justify-between gap-3 shrink-0">
          <div className="flex items-center gap-2 text-[11px] text-[#6E6B64] dark:text-[#8C8B84]">
            <span>Đang chọn: <b className="text-[#1C1B18] dark:text-[#E8E7E2] font-semibold">{activeComponentsCount} thành phần</b></span>
            <span>•</span>
            <span>Bối cảnh: <b className="text-[#3B82F6]">{selectedProps.length} vật thể/đạo cụ</b></span>
          </div>

          <div className="flex items-center gap-2.5 w-full sm:w-auto">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 sm:flex-none px-4 py-2 border border-[#E2DDD5] dark:border-[#292925] text-xs uppercase tracking-wider font-medium text-[#1C1B18] dark:text-[#E8E7E2] hover:bg-[#EDE9E1] dark:hover:bg-[#1D1D1B] transition-colors cursor-pointer"
            >
              Đóng
            </button>

            <button
              type="button"
              onClick={handleApplyToEditor}
              disabled={!analysisResult || activeComponentsCount === 0}
              className="flex-1 sm:flex-none px-6 py-2.5 bg-[#1C1B18] hover:bg-[#2F2E2B] text-[#F8F7F4] dark:bg-[#D8D3C5] dark:hover:bg-[#E8E7E2] dark:text-[#0B0B0A] text-xs uppercase tracking-[0.18em] font-semibold flex items-center justify-center gap-2 transition-all cursor-pointer disabled:opacity-40 shadow-sm"
            >
              {applied ? (
                <>
                  <Check size={14} />
                  <span>Đã áp dụng vào Editor!</span>
                </>
              ) : (
                <>
                  <Sparkles size={14} />
                  <span>
                    {activeComponentsCount === 6
                      ? 'Áp dụng toàn bộ vào Editor'
                      : `Áp dụng ${activeComponentsCount} mục đã chọn vào Editor`}
                  </span>
                  <ArrowUpRight size={14} />
                </>
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
