export type ActiveTab = 'editor' | 'dashboard' | 'history' | 'settings';
export type ThemeMode = 'dark' | 'light';

export type AspectRatio = 'original' | '1:1' | '16:9' | '9:16' | '4:3' | '3:2';
export type QualityMode = 'standard' | 'high' | 'raw';
export type GenState = 'idle' | 'generating' | 'done';

export interface GenerationSettings {
  aspectRatio: AspectRatio;
  quality: QualityMode;
  variations: number;
  preserveStructure: boolean;
  controlNetWeight: number;
  negativePrompt: string;
  seed: string;
  model: string;
  cfgScale: number;
}

export interface GeneratedImage {
  id: string;
  url: string;
  prompt: string;
  createdAt: string;
  aspectRatio: AspectRatio;
  quality: QualityMode;
  model: string;
  seed?: string;
  sourceImageName?: string;
  referenceImageName?: string;
}

export interface HistoryItem {
  id: string;
  title: string;
  prompt: string;
  date: string;
  timeAgo: string;
  imageUrl: string;
  aspectRatio: string;
  model: string;
  variationsCount: number;
}

export interface StyleAnalysisColor {
  hex: string;
  name: string;
  role: string;
}

export interface BackgroundPropObject {
  name: string;
  category?: 'lighting_prop' | 'furniture' | 'architecture' | 'material' | 'nature' | 'decoration' | 'other' | string;
  description?: string;
  promptSnippet?: string;
}

export interface StyleAnalysisLighting {
  sourceType: string;
  direction: string;
  colorTemperature: string;
  quality: string;
  detailedAnalysis: string;
  promptSnippetEn?: string;
  promptSnippetVi?: string;
}

export interface StyleAnalysisBackground {
  settingType: string;
  architecturalStyle?: string;
  depthOfField: string;
  elements: string[];
  objectsAndProps?: BackgroundPropObject[];
  materials?: string[];
  atmosphere?: string;
  detailedAnalysis: string;
  promptSnippetEn?: string;
  promptSnippetVi?: string;
}

export interface StyleAnalysisCamera {
  shotType: string;
  lensSuggestion: string;
  compositionRule: string;
  detailedAnalysis: string;
  promptSnippetEn?: string;
  promptSnippetVi?: string;
}

export interface StyleAnalysisColorPalette {
  dominantMood: string;
  hexColors: StyleAnalysisColor[];
  colorGrading: string;
  promptSnippetEn?: string;
  promptSnippetVi?: string;
}

export interface StyleAnalysisSubject {
  subjectType: string;
  poseAndExpression: string;
  texturesAndMaterials: string;
  promptSnippetEn?: string;
  promptSnippetVi?: string;
}

export interface StyleAnalysisResult {
  styleName: string;
  genre: string;
  styleDescription: string;
  lighting: StyleAnalysisLighting;
  background: StyleAnalysisBackground;
  camera: StyleAnalysisCamera;
  colorPalette: StyleAnalysisColorPalette;
  subjectDetails: StyleAnalysisSubject;
  recommendedPromptEn: string;
  recommendedPromptVi: string;
  negativePrompt: string;
  suggestedAspectRatio: AspectRatio;
  keyTags: string[];
  analyzedAt?: string;
  sourceImagePreview?: string;
}

