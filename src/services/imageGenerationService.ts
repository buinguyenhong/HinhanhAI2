import {
  GeneratedImage,
  AspectRatio,
  QualityMode,
} from '../types';
import { ApiProfile } from './storageService';
import { getAuthHeaders } from './authService';

async function fileOrUrlToBase64(fileOrUrl: File | string | null): Promise<string | null> {
  if (!fileOrUrl) return null;

  if (typeof fileOrUrl !== 'string') {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result as string);
      reader.onerror = reject;
      reader.readAsDataURL(fileOrUrl);
    });
  }

  if (fileOrUrl.startsWith('data:image/')) {
    return fileOrUrl;
  }

  try {
    const response = await fetch(fileOrUrl);
    const blob = await response.blob();
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result as string);
      reader.onerror = reject;
      reader.readAsDataURL(blob);
    });
  } catch (err) {
    console.warn('Could not convert image URL to base64:', err);
    return null;
  }
}

export interface GenerateImageParams {
  prompt: string;
  negativePrompt?: string;
  aspectRatio: AspectRatio;
  quality: QualityMode;
  variations: number;
  seed: string;
  sourceImage: string | null;
  sourceFile: File | null;
  referenceImage: string | null;
  referenceFile: File | null;
  activeProfile: ApiProfile;
}

export async function generateImages(params: GenerateImageParams): Promise<GeneratedImage[]> {
  const {
    prompt,
    negativePrompt,
    aspectRatio,
    quality,
    variations,
    seed,
    sourceImage,
    sourceFile,
    referenceImage,
    referenceFile,
    activeProfile,
  } = params;

  const sourceImageBase64 = await fileOrUrlToBase64(sourceFile || sourceImage);
  const referenceImageBase64 = await fileOrUrlToBase64(referenceFile || referenceImage);

  try {
    const response = await fetch('/api/generate-image', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...getAuthHeaders(),
      },
      body: JSON.stringify({
        prompt,
        negativePrompt,
        aspectRatio,
        variations,
        quality,
        seed,
        model: activeProfile.renderModel,
        provider: activeProfile.provider,
        apiKey: activeProfile.apiKey || undefined,
        apiEndpoint: activeProfile.apiEndpoint || undefined,
        sourceImageBase64,
        referenceImageBase64,
      }),
    });

    if (!response.ok) {
      const errData = await response.json().catch(() => ({}));
      throw new Error(errData.error || `Server responded with ${response.status}`);
    }

    const data = await response.json();
    if (!data.success) {
      throw new Error(data.error || 'Server returned unsuccessful response');
    }
    if (data.images && Array.isArray(data.images) && data.images.length > 0) {
      return data.images.map((img: { url: string; seed?: string; modelUsed?: string; isFallbackEngine?: boolean }, idx: number) => ({
        id: Math.random().toString(36).substring(2, 9).toUpperCase(),
        url: img.url,
        prompt: prompt,
        createdAt: new Date().toLocaleTimeString('vi-VN', {
          hour: '2-digit',
          minute: '2-digit',
        }),
        aspectRatio: aspectRatio,
        quality: quality,
        model: img.modelUsed || `${activeProfile.name} • ${activeProfile.renderModel}`,
        seed: img.seed || (seed !== '-1' ? seed : Math.floor(Math.random() * 999999).toString()),
        sourceImageName: sourceFile?.name,
        referenceImageName: referenceFile?.name,
        isFallbackEngine: Boolean(img.isFallbackEngine),
      }));
    }

    throw new Error('No images returned from generation server');
  } catch (error: any) {
    throw new Error(error?.message || 'Failed to generate image via API');
  }
}
