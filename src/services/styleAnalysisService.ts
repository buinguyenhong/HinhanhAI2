import { StyleAnalysisResult, AspectRatio, BackgroundPropObject } from '../types';

// Helper to convert image URL or File to base64
export async function imageToBase64(imageSrc: string, file?: File | null): Promise<{ base64: string; mimeType: string }> {
  if (file) {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => {
        const result = reader.result as string;
        const mimeType = file.type || 'image/jpeg';
        resolve({ base64: result, mimeType });
      };
      reader.onerror = reject;
      reader.readAsDataURL(file);
    });
  }

  // If already base64 data URL
  if (imageSrc.startsWith('data:')) {
    const mimeMatch = imageSrc.match(/^data:([^;]+);base64,/);
    const mimeType = mimeMatch ? mimeMatch[1] : 'image/jpeg';
    return { base64: imageSrc, mimeType };
  }

  // If blob URL or external URL, load via image element or fetch
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => {
      try {
        const canvas = document.createElement('canvas');
        canvas.width = Math.min(img.naturalWidth || 800, 1024);
        canvas.height = Math.round((canvas.width / (img.naturalWidth || 1)) * (img.naturalHeight || 1));
        const ctx = canvas.getContext('2d');
        if (ctx) {
          ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
          const dataUrl = canvas.toDataURL('image/jpeg', 0.85);
          resolve({ base64: dataUrl, mimeType: 'image/jpeg' });
        } else {
          resolve({ base64: imageSrc, mimeType: 'image/jpeg' });
        }
      } catch (err) {
        resolve({ base64: imageSrc, mimeType: 'image/jpeg' });
      }
    };
    img.onerror = () => {
      resolve({ base64: imageSrc, mimeType: 'image/jpeg' });
    };
    img.src = imageSrc;
  });
}

// Client-side visual inspector used only for image metadata; AI analysis always comes from Gemini.
export async function extractImageVisualMetrics(imageSrc: string): Promise<{
  dominantColors: { hex: string; name: string; role: string }[];
  isDark: boolean;
  isWarm: boolean;
  aspectRatio: AspectRatio;
}> {
  return new Promise((resolve) => {
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => {
      try {
        const canvas = document.createElement('canvas');
        const ctx = canvas.getContext('2d');
        canvas.width = 64;
        canvas.height = 64;

        if (!ctx) {
          resolve(getDefaultVisualMetrics());
          return;
        }

        ctx.drawImage(img, 0, 0, 64, 64);
        const imageData = ctx.getImageData(0, 0, 64, 64);
        const data = imageData.data;

        let totalR = 0, totalG = 0, totalB = 0;
        let totalBrightness = 0;
        const colorBuckets: Record<string, number> = {};

        for (let i = 0; i < data.length; i += 16) {
          const r = data[i];
          const g = data[i + 1];
          const b = data[i + 2];

          totalR += r;
          totalG += g;
          totalB += b;
          totalBrightness += (r * 299 + g * 587 + b * 114) / 1000;

          // Bucket to 32-step hex
          const quantR = Math.round(r / 32) * 32;
          const quantG = Math.round(g / 32) * 32;
          const quantB = Math.round(b / 32) * 32;
          const hexKey = `#${((1 << 24) + (quantR << 16) + (quantG << 8) + quantB).toString(16).slice(1).toUpperCase()}`;
          colorBuckets[hexKey] = (colorBuckets[hexKey] || 0) + 1;
        }

        const count = data.length / 16;
        const avgBrightness = totalBrightness / count;
        const avgR = totalR / count;
        const avgB = totalB / count;

        const isDark = avgBrightness < 110;
        const isWarm = avgR > avgB + 10;

        // Sort top colors
        const sortedHexes = Object.entries(colorBuckets)
          .sort((a, b) => b[1] - a[1])
          .slice(0, 5)
          .map(([hex], idx) => {
            const role =
              idx === 0 ? 'Màu chủ đạo (Key Color)' :
              idx === 1 ? 'Màu nền (Background Tone)' :
              idx === 2 ? 'Ánh sáng hắt (Rim/Highlight)' :
              idx === 3 ? 'Bóng đổ (Shadows)' : 'Điểm nhấn (Accent)';
            
            return {
              hex,
              name: getColorName(hex),
              role,
            };
          });

        // Determine aspect ratio
        const w = img.naturalWidth || 1;
        const h = img.naturalHeight || 1;
        const ratio = w / h;
        let determinedRatio: AspectRatio = 'original';
        if (Math.abs(ratio - 1) < 0.1) determinedRatio = '1:1';
        else if (Math.abs(ratio - 16 / 9) < 0.2) determinedRatio = '16:9';
        else if (Math.abs(ratio - 9 / 16) < 0.2) determinedRatio = '9:16';
        else if (Math.abs(ratio - 4 / 3) < 0.15) determinedRatio = '4:3';
        else if (Math.abs(ratio - 3 / 2) < 0.15) determinedRatio = '3:2';

        resolve({
          dominantColors: sortedHexes.length >= 3 ? sortedHexes : getDefaultVisualMetrics().dominantColors,
          isDark,
          isWarm,
          aspectRatio: determinedRatio,
        });
      } catch (e) {
        resolve(getDefaultVisualMetrics());
      }
    };
    img.onerror = () => resolve(getDefaultVisualMetrics());
    img.src = imageSrc;
  });
}

function getColorName(hex: string): string {
  const r = parseInt(hex.slice(1, 3), 16) || 0;
  const g = parseInt(hex.slice(3, 5), 16) || 0;
  const b = parseInt(hex.slice(5, 7), 16) || 0;

  if (r > 200 && g > 200 && b > 200) return 'Trắng ngà / Soft Ivory';
  if (r < 40 && g < 40 && b < 40) return 'Đen mun / Deep Obsidian';
  if (r > g && r > b) {
    if (g > 150) return 'Hổ phách / Warm Amber';
    return 'Đỏ đồng / Terracotta';
  }
  if (b > r && b > g) return 'Xanh Chàm / Cyan Slate';
  if (g > r && g > b) return 'Xanh rêu / Olive Sage';
  return 'Xám xi măng / Neutral Gray';
}

function getDefaultVisualMetrics() {
  return {
    dominantColors: [
      { hex: '#2B2620', name: 'Đen khói cổ điển (Charcoal Black)', role: 'Màu nền & Bóng đổ' },
      { hex: '#D4A373', name: 'Vàng hổ phách (Golden Amber)', role: 'Ánh sáng hắt & Điểm nhấn' },
      { hex: '#8C7A6B', name: 'Nâu đất mộc (Earthy Sienna)', role: 'Màu chuyển tiếp' },
      { hex: '#F4EAE0', name: 'Trắng kem dịu (Cream Highlight)', role: 'Vùng sáng chủ đạo' },
    ],
    isDark: true,
    isWarm: true,
    aspectRatio: 'original' as AspectRatio,
  };
}

// Main API analysis function.
export async function analyzeImageStyle(
  imageSrc: string,
  file?: File | null,
  userFocus?: string
): Promise<StyleAnalysisResult> {
  try {
    const { base64, mimeType } = await imageToBase64(imageSrc, file);

    // Call server endpoint
    const response = await fetch('/api/gemini/analyze-style', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        imageBase64: base64,
        mimeType,
        userFocus,
      }),
    });

    const data = await response.json().catch(() => ({}));
    if (!response.ok || !data.success || !data.analysis) {
      throw new Error(data.error || 'Style analysis failed.');
    }
    return {
      ...data.analysis,
      analyzedAt: new Date().toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit', second: '2-digit' }),
      sourceImagePreview: imageSrc,
    };
  } catch (err) {
    console.error('Backend style analysis request failed:', err);
    throw err;
  }
}
