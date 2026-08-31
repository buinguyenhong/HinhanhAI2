import React, { useState, useEffect } from 'react';
import {
  GenState,
  GeneratedImage,
  GenerationSettings,
  AspectRatio,
} from '../../types';
import { SourceUploader } from './SourceUploader';
import { ReferenceUploader } from './ReferenceUploader';
import { PromptEditor } from './PromptEditor';
import { OutputSettings } from './OutputSettings';
import { CanvasWorkspace } from './CanvasWorkspace';
import { ImageLightbox } from './ImageLightbox';
import { StyleAnalyzerModal } from './StyleAnalyzerModal';
import { ArrowUpRight, Loader2, Zap, AlertCircle } from 'lucide-react';
import { loadAppSettings, getRenderProfile, ApiProfile } from '../../services/storageService';
import { generateImages } from '../../services/imageGenerationService';
import { saveGeneratedToHistory } from '../../services/historyService';
import { uploadImageToDrive } from '../../services/googleDriveService';

export const EditorView: React.FC = () => {
  const [appSettings, setAppSettings] = useState(loadAppSettings);
  const activeRenderProfile = getRenderProfile(appSettings);

  // Inputs
  const [sourceImage, setSourceImage] = useState<string | null>(null);
  const [sourceFile, setSourceFile] = useState<File | null>(null);
  const [referenceImage, setReferenceImage] = useState<string | null>(null);
  const [referenceFile, setReferenceFile] = useState<File | null>(null);
  const [prompt, setPrompt] = useState('');

  // Settings initialized from persistent defaults
  const [settings, setSettings] = useState<GenerationSettings>({
    aspectRatio: appSettings.defaultRatio || 'original',
    quality: appSettings.defaultQuality || 'high',
    variations: appSettings.defaultVariations || 2,
    preserveStructure: true,
    controlNetWeight: 0.85,
    negativePrompt: '',
    seed: '-1',
    model: activeRenderProfile.renderModel || 'imagen-3.0-generate-002',
    cfgScale: 7.0,
  });

  // State
  const [genState, setGenState] = useState<GenState>('idle');
  const [results, setResults] = useState<GeneratedImage[]>([]);
  const [selectedImageIndex, setSelectedImageIndex] = useState<number | null>(null);
  const [lightboxImage, setLightboxImage] = useState<GeneratedImage | null>(null);
  const [isDriveSaved, setIsDriveSaved] = useState(false);
  const [isDriveSaving, setIsDriveSaving] = useState(false);
  const [isStyleAnalyzerOpen, setIsStyleAnalyzerOpen] = useState(false);
  const [generationError, setGenerationError] = useState<string | null>(null);

  const handleApplyAnalyzedPrompt = (
    promptText: string,
    suggestedRatio?: AspectRatio,
    negativePrompt?: string,
    mode: 'replace' | 'append' = 'replace'
  ) => {
    if (mode === 'append' && prompt.trim()) {
      setPrompt((prev) => `${prev.trim()}, ${promptText.trim()}`);
    } else {
      setPrompt(promptText);
    }
    if (suggestedRatio && suggestedRatio !== 'original') {
      setSettings((prev) => ({
        ...prev,
        aspectRatio: suggestedRatio,
        ...(negativePrompt ? { negativePrompt } : {}),
      }));
    } else if (negativePrompt) {
      setSettings((prev) => ({
        ...prev,
        negativePrompt,
      }));
    }
  };

  const handleActiveProfileChange = (profile: ApiProfile) => {
    const loaded = loadAppSettings();
    setAppSettings(loaded);
    setSettings((prev) => ({
      ...prev,
      model: profile.renderModel,
    }));
  };

  const handleGenerate = async () => {
    setGenState('generating');
    setSelectedImageIndex(null);
    setIsDriveSaved(false);
    setGenerationError(null);

    const currentConfig = loadAppSettings();
    const currentActiveProfile = getRenderProfile(currentConfig);

    const finalPrompt =
      prompt.trim() ||
      'Chân dung nghệ thuật, ánh sáng tự nhiên hắt qua cửa sổ, màu sắc tương phản tinh tế, phong cách editorial portrait.';

    try {
      const generatedList = await generateImages({
        prompt: finalPrompt,
        negativePrompt: settings.negativePrompt,
        aspectRatio: settings.aspectRatio,
        quality: settings.quality,
        variations: settings.variations,
        seed: settings.seed,
        sourceImage,
        sourceFile,
        referenceImage,
        referenceFile,
        activeProfile: currentActiveProfile,
      });

      if (generatedList && generatedList.length > 0) {
        setResults(generatedList);
        setGenState('done');
        setSelectedImageIndex(0); // Auto-select first variant

        // 1. Save directly into persistent History
        saveGeneratedToHistory(generatedList, finalPrompt, currentActiveProfile.name);

        // 2. Auto-sync to Google Drive if configured
        if (currentConfig.autoSync && currentConfig.driveConnected) {
          try {
            const firstVariant = generatedList[0];
            await uploadImageToDrive(
              firstVariant.url,
              `hinhanhai_${Date.now()}_01`,
              currentConfig.driveFolder || 'HinhanhAI'
            );
            setIsDriveSaved(true);
          } catch (driveErr) {
            console.warn('Auto drive sync notice:', driveErr);
          }
        }
      } else {
        throw new Error('Không nhận được phản hồi hình ảnh từ server.');
      }
    } catch (err: any) {
      console.error('Generation failure:', err);
      setGenerationError(err?.message || 'Có lỗi xảy ra trong quá trình sinh ảnh.');
      setGenState('idle');
    }
  };

  const handleReset = () => {
    setGenState('idle');
    setResults([]);
    setSelectedImageIndex(null);
    setIsDriveSaved(false);
    setGenerationError(null);
  };

  const handleSaveToDrive = async () => {
    if (selectedImageIndex === null || !results[selectedImageIndex]) return;
    const targetImg = results[selectedImageIndex];

    setIsDriveSaving(true);
    try {
      const currentConfig = loadAppSettings();
      const folderName = currentConfig.driveFolder || 'HinhanhAI';
      const fileName = `hinhanhai_${Date.now()}_v${selectedImageIndex + 1}`;
      
      await uploadImageToDrive(targetImg.url, fileName, folderName);
      setIsDriveSaved(true);
    } catch (err: any) {
      console.error('Drive save error:', err);
      alert(`Không thể lưu vào Google Drive: ${err?.message || 'Vui lòng kiểm tra quyền truy cập'}`);
    } finally {
      setIsDriveSaving(false);
    }
  };

  const handleDownload = (image: GeneratedImage) => {
    const link = document.createElement('a');
    link.href = image.url;
    link.download = `hinhanhai_${image.id}.jpg`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 lg:gap-12 xl:gap-16 items-start">
      {/* LEFT COLUMN: Controls & Setup (Span 4) */}
      <div className="lg:col-span-4 xl:col-span-4 space-y-8">
        {/* Source Image */}
        <SourceUploader
          sourceImage={sourceImage}
          sourceFile={sourceFile}
          onImageChange={(img, file) => {
            setSourceImage(img);
            setSourceFile(file);
          }}
        />

        {/* Style Reference Image */}
        <ReferenceUploader
          referenceImage={referenceImage}
          referenceFile={referenceFile}
          onImageChange={(img, file) => {
            setReferenceImage(img);
            setReferenceFile(file);
          }}
          onOpenAnalyzer={() => setIsStyleAnalyzerOpen(true)}
        />

        {/* Prompt Editor */}
        <PromptEditor
          prompt={prompt}
          setPrompt={setPrompt}
          hasReference={Boolean(referenceImage)}
          onOpenAnalyzer={() => setIsStyleAnalyzerOpen(true)}
        />

        {/* Output & Engine Settings with Active Profile Selector */}
        <OutputSettings
          settings={settings}
          onChange={setSettings}
          onActiveProfileChange={handleActiveProfileChange}
        />

        {/* Active Engine Badge */}
        <div className="p-3 border border-[#E2DDD5] dark:border-[#1D1D1B] bg-[#FFFFFF] dark:bg-[#111110] flex items-center justify-between text-[10px] font-mono">
          <div className="flex items-center gap-1.5 truncate text-[#6E6B64] dark:text-[#8C8B84]">
            <Zap size={12} className="text-[#1C1B18] dark:text-[#D8D3C5] shrink-0" />
            <span className="truncate">Render Engine: <b className="text-[#1C1B18] dark:text-[#E8E7E2] font-semibold">{activeRenderProfile.name}</b></span>
          </div>
          <span className="text-[9px] uppercase px-1.5 py-0.5 bg-[#22C55E]/15 text-[#15803D] dark:text-[#4ADE80] font-medium shrink-0">
            {activeRenderProfile.provider.toUpperCase()}
          </span>
        </div>

        {/* Error Notification if any */}
        {generationError && (
          <div className="p-3 border border-red-200 dark:border-red-900/40 bg-red-50 dark:bg-red-950/20 text-red-700 dark:text-red-400 text-xs flex items-start gap-2">
            <AlertCircle size={15} className="shrink-0 mt-0.5" />
            <div className="flex-1">
              <p className="font-semibold">Lỗi tạo ảnh</p>
              <p className="text-[11px] opacity-90 mt-0.5">{generationError}</p>
            </div>
          </div>
        )}

        {/* Generate Button */}
        <div className="pt-1">
          <button
            type="button"
            onClick={handleGenerate}
            disabled={genState === 'generating'}
            className="w-full h-12 bg-[#1C1B18] hover:bg-[#2F2E2B] text-[#F8F7F4] dark:bg-[#D8D3C5] dark:hover:bg-[#E8E7E2] dark:text-[#0B0B0A] text-xs uppercase tracking-[0.18em] font-medium flex items-center justify-between px-5 transition-all duration-200 disabled:opacity-40 cursor-pointer shadow-md dark:shadow-black/40"
          >
            <span>
              {genState === 'generating'
                ? 'Đang thực thi tác phẩm...'
                : settings.variations > 1
                ? `Tạo ${settings.variations} phiên bản biến thể`
                : 'Bắt đầu tạo hình ảnh'}
            </span>
            {genState === 'generating' ? (
              <Loader2 size={15} className="animate-spin text-inherit" />
            ) : (
              <ArrowUpRight size={16} strokeWidth={2} />
            )}
          </button>
        </div>
      </div>

      {/* RIGHT COLUMN: Canvas Workspace (Span 8) */}
      <div className="lg:col-span-8 xl:col-span-8">
        <CanvasWorkspace
          genState={genState}
          results={results}
          selectedImageIndex={selectedImageIndex}
          onSelectImage={setSelectedImageIndex}
          onOpenLightbox={(img) => setLightboxImage(img)}
          onReset={handleReset}
          onSaveToDrive={handleSaveToDrive}
          isDriveSaved={isDriveSaved}
          onDownload={handleDownload}
        />
      </div>

      {/* Lightbox Modal */}
      {lightboxImage && (
        <ImageLightbox
          image={lightboxImage}
          onClose={() => setLightboxImage(null)}
          onSaveToDrive={handleSaveToDrive}
          isDriveSaved={isDriveSaved}
        />
      )}

      {/* Style & Reference Analyzer Modal */}
      <StyleAnalyzerModal
        isOpen={isStyleAnalyzerOpen}
        onClose={() => setIsStyleAnalyzerOpen(false)}
        initialImage={referenceImage}
        initialFile={referenceFile}
        onApplyPrompt={handleApplyAnalyzedPrompt}
      />
    </div>
  );
};
