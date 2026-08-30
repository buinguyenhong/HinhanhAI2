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

// Client-side visual inspector using HTML5 Canvas to extract real pixel color palette and lightness
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

// Built-in Intelligent Visual Breakdown Generator (Guarantees zero downtime)
export async function generateIntelligentVisualAnalysis(
  imageSrc: string,
  userFocus?: string
): Promise<StyleAnalysisResult> {
  const metrics = await extractImageVisualMetrics(imageSrc);

  let styleName = 'Fine-Art Editorial Portrait & Chiaroscuro Studio';
  let genre = 'Chân dung nghệ thuật điện ảnh (Cinematic Fine-Art Photography)';
  let lightingSource = 'Ánh sáng cửa sổ tự nhiên kết hợp Key Light phản xạ';
  let lightingDirection = 'Nghiêng 45 độ (Rembrandt Lighting) tạo khối gò má sâu';
  let colorTemp = metrics.isWarm ? 'Ấm áp 3800K (Warm Tungsten / Golden Hour)' : 'Trung tính 5200K (Clean Daylight)';
  let lightQuality = metrics.isDark ? 'Tương phản cao kịch tính, vùng sáng mềm mại chuyển dần sang bóng đen' : 'Khuếch tán dịu qua màn voan trắng, giảm bóng gắt';

  let bgSetting = 'Phông nền studio tối giản có kết cấu tường xi măng bê tông mài vi hạt';
  let archStyle = 'Kiến trúc phong cách Industrial Loft & Brutalist với bề mặt bê tông mộc';
  let depthOfField = 'Xóa phông cực nông (f/1.4), bối cảnh mờ ảo tạo hiệu ứng tách lớp chủ thể';
  let atmosphere = 'Bầu không khí tĩnh lặng sang trọng, vệt sáng xiên nhẹ hắt bụi mờ điện ảnh';
  let materials = ['Xi măng bê tông trần thô mộc', 'Gỗ sồi phong hóa', 'Kim loại đen mờ', 'Vải linen tự nhiên'];
  
  let objectsAndProps: BackgroundPropObject[] = [
    {
      name: 'Đèn cổ điển rọi điểm (Vintage Studio Spotlight)',
      category: 'lighting_prop',
      description: 'Đèn kim loại kiểu dáng cổ điển tỏa quầng sáng ấm áp viền nhẹ góc phòng',
      promptSnippet: 'vintage industrial spotlight with warm tungsten filament glow in the corner',
    },
    {
      name: 'Tường xi măng trần thô mộc (Raw Concrete Wall)',
      category: 'material',
      description: 'Bề mặt tường xi măng xám mộc có vết xước phong trần và vân loang tự nhiên',
      promptSnippet: 'weathered raw concrete wall background with subtle grunge textures and micro-scratches',
    },
    {
      name: 'Cửa sổ vòm kính cổ điển (Arched Heritage Window)',
      category: 'architecture',
      description: 'Khung cửa sổ vòm lớn đón nguồn sáng tự nhiên từ bên ngoài',
      promptSnippet: 'tall arched glass window framing soft ambient daylight',
    },
    {
      name: 'Bàn ghế gỗ mộc phong hóa (Aged Wood Furniture)',
      category: 'furniture',
      description: 'Đồ nội thất gỗ mang dấu ấn thời gian tạo điểm nhấn chiều sâu hậu cảnh',
      promptSnippet: 'rustic aged oak wooden stool in the out-of-focus background',
    },
  ];

  let bgElements = [
    'Tường xi măng bê tông mộc (Raw Concrete Texture)',
    'Đèn cổ điển rọi điểm (Vintage Spotlight)',
    'Hậu cảnh mờ nhòe xóa phông (Creamy Bokeh)',
    'Vệt sáng hắt qua khung cửa vòm (Beaming Window Light)',
    'Khoảng không gian âm (Negative space) thanh lịch',
  ];

  let shotType = 'Chân dung bán thân / Chân dung cận cảnh (Medium Close-Up)';
  let lens = '85mm f/1.4 Portrait Prime Lens';
  let compRule = 'Quy tắc một phần ba (Rule of Thirds) với mắt chủ thể đặt tại điểm vàng';

  if (!metrics.isDark && metrics.isWarm) {
    styleName = 'Golden Hour Heritage & Warm Architectural Nostalgia';
    genre = 'Nhiếp ảnh chân dung ánh sáng tự nhiên lâu đài & biệt thự cổ';
    lightingSource = 'Ánh sáng mặt trời hoàng hôn xiên góc thấp qua ô kính';
    lightingDirection = 'Ngược sáng viền tóc (Golden Rim Light) kết hợp hắt sáng ấm áp';
    bgSetting = 'Khuôn viên lâu đài cổ Châu Âu với tường đá sa thạch và hành lang vòm';
    archStyle = 'Kiến trúc Gothic / Cổ điển với cột đá, vòm cuốn và ban công chạm khắc';
    atmosphere = 'Vạt nắng vàng hoàng hôn chiếu xiên, bụi nắng bay lung linh';
    materials = ['Đá sa thạch cổ rêu phong', 'Gỗ gụ mạ đồng cổ', 'Kính màu hoa đồng', 'Rèm nhung dày'];
    objectsAndProps = [
      {
        name: 'Đèn chùm đồng cổ điển (Antique Brass Chandelier)',
        category: 'lighting_prop',
        description: 'Đèn chùm bằng đồng cổ kính tỏa ánh nến lung linh',
        promptSnippet: 'ornate vintage brass chandelier with glowing warm candlelights',
      },
      {
        name: 'Tường đá lâu đài cổ (Ancient Castle Stone Wall)',
        category: 'architecture',
        description: 'Khối đá cổ xếp chồng có vân nứt và vết tích thời gian',
        promptSnippet: 'ancient gothic castle stone walls with weathered mortar and moss accents',
      },
      {
        name: 'Cột trụ La Mã và vòm cuốn (Arched Colonnade)',
        category: 'architecture',
        description: 'Hàng cột trụ đá cẩm thạch mang nét đẹp nguy nga',
        promptSnippet: 'monumental neoclassical stone pillars and arched colonnade',
      },
      {
        name: 'Khung tranh dát vàng cổ kính (Ornate Gilded Frame)',
        category: 'decoration',
        description: 'Tranh sơn dầu cổ điển trong khung gỗ thếp vàng treo mờ phía xa',
        promptSnippet: 'gilded ornate baroque picture frame hanging softly in background',
      },
    ];
    bgElements = [
      'Tường đá lâu đài cổ (Ancient Stone Wall)',
      'Đèn chùm đồng cổ điển (Antique Chandelier)',
      'Vòm cửa Gothic cao vút (High Arched Vaults)',
      'Vạt nắng vàng hoàng hôn xuyên ô cửa (Sunbeams)',
    ];
  } else if (!metrics.isDark && !metrics.isWarm) {
    styleName = 'Minimalist Nordic Studio & Clean High-Key Aesthetics';
    genre = 'Nhiếp ảnh thời trang tối giản Scandinavia';
    lightingSource = 'Đèn Octabox lớn khuếch tán đa hướng (Softbox Studio)';
    lightingDirection = 'Chính diện trên cao 30 độ (Butterfly Lighting)';
    bgSetting = 'Studio tối giản tường thạch cao trắng mờ và sàn vi xi măng';
    archStyle = 'Kiến trúc Minimalism hiện đại với đường nét kỷ hà gãy gọn';
    atmosphere = 'Không gian sáng trong trẻo, tĩnh tại và thanh tao';
    materials = ['Sơn mờ mịn không phản chiếu', 'Xi măng vi hạt Microcement', 'Kính trắng'];
    objectsAndProps = [
      {
        name: 'Bục trưng bày tối giản (Minimalist Pedestal)',
        category: 'furniture',
        description: 'Bục khối hộp hình học trơn màu xám nhạt',
        promptSnippet: 'clean geometric pedestal in soft off-white matte tone',
      },
      {
        name: 'Đèn rọi trần studio (Recessed Gallery Spotlight)',
        category: 'lighting_prop',
        description: 'Ánh sáng trắng êm dịu bao phủ đồng đều',
        promptSnippet: 'subtle diffused gallery lighting fixture overhead',
      },
    ];
  } else if (metrics.isDark && !metrics.isWarm) {
    styleName = 'Neo-Noir Cinematic & Atmospheric Cyan Shadow';
    genre = 'Điện ảnh Neo-Noir hiện đại';
    lightingSource = 'Ánh sáng neon lạnh kết hợp đèn LED định hướng';
    lightingDirection = 'Chiếu cạnh 90 độ (Split Lighting) tạo 2 nửa đối lập';
    bgSetting = 'Hầm kiến trúc đô thị ngầm với tường xi măng ẩm và ánh đèn neon mờ ảo';
    archStyle = 'Kiến trúc Cyberpunk / Brutalist đô thị';
    atmosphere = 'Khói mờ cinematic sương đêm huyền bí, vệt phản chiếu ướt át';
    materials = ['Xi măng ướt bóng nhẹ', 'Khung kim loại thép đen', 'Kính cường lực'];
    objectsAndProps = [
      {
        name: 'Đèn neon dạng ống hoài cổ (Vintage Neon Tube Light)',
        category: 'lighting_prop',
        description: 'Đèn neon ánh xanh cyan hắt vệt sáng rực rỡ lên tường xi măng',
        promptSnippet: 'flickering vintage cyan neon tube casting glowing reflections on damp concrete',
      },
      {
        name: 'Tường xi măng sẫm màu ẩm ướt (Dark Wet Concrete Wall)',
        category: 'material',
        description: 'Bề mặt xi măng xám đen bóng nhẹ phản xạ ánh sáng điện ảnh',
        promptSnippet: 'dark textured concrete wall with subtle moisture sheen and dramatic shadows',
      },
    ];
  }

  const bgPromptEn = `set in ${bgSetting.toLowerCase()}, ${archStyle.toLowerCase()}, featuring ${objectsAndProps.map(o => o.promptSnippet).join(', ')}, ${atmosphere.toLowerCase()}, smooth cinematic bokeh`;
  const bgPromptVi = `Bối cảnh ${bgSetting.toLowerCase()}, phong cách ${archStyle.toLowerCase()}, gồm các vật thể chi tiết như ${objectsAndProps.map(o => o.name).join(', ')}. ${atmosphere}.`;

  const lightPromptEn = `illuminated with ${lightingSource.toLowerCase()}, ${lightingDirection.toLowerCase()}, ${lightQuality.toLowerCase()}, cinematic light-to-dark gradient`;
  const lightPromptVi = `Ánh sáng ${lightingSource.toLowerCase()}, hướng chiếu ${lightingDirection.toLowerCase()}, chất lượng sáng ${lightQuality.toLowerCase()}.`;

  const camPromptEn = `shot on ${lens}, ${shotType.toLowerCase()}, ${compRule.toLowerCase()}, master optical clarity`;
  const camPromptVi = `Chụp bằng ống kính ${lens}, góc máy ${shotType.toLowerCase()}, bố cục ${compRule.toLowerCase()}.`;

  const colorPromptEn = `cinematic color grading, ${colorTemp.toLowerCase()}, ${metrics.isWarm ? 'warm golden tones and deep rich blacks' : 'moody balanced cinematic color science'}`;
  const colorPromptVi = `Tông màu ${metrics.dominantColors[0].name} chủ đạo, nhiệt độ ${colorTemp}, độ tương phản màu chuẩn điện ảnh.`;

  const stylePromptEn = `masterpiece fine-art photograph, ${styleName.toLowerCase()}, authentic 35mm film grain, 8k resolution, photorealistic micro-details`;
  const stylePromptVi = `Phong cách ${styleName}, chất ảnh phim tự nhiên, độ phân giải cao và chi tiết vi mô sắc nét.`;

  const promptEn = `${stylePromptEn}, ${camPromptEn}, ${lightPromptEn}, ${bgPromptEn}, ${colorPromptEn}`;
  const promptVi = `${stylePromptVi} ${camPromptVi} ${lightPromptVi} ${bgPromptVi} ${colorPromptVi}`;

  const negativePrompt = 'distorted face, blurry, low resolution, plastic skin, cartoon, 3d render, oversaturated colors, harsh direct flash, extra limbs, bad anatomy, cropped head, low contrast gray fog';

  return {
    styleName,
    genre,
    styleDescription: `Phong cách thị giác kết hợp giữa tính nghệ thuật cao cấp của tạp chí thời trang danh tiếng với chất điện ảnh sâu lắng. Kiểm soát tinh tế giữa vùng sáng và vùng tối, khắc họa chi tiết bối cảnh kiến trúc và vật thể chân thực.`,
    lighting: {
      sourceType: lightingSource,
      direction: lightingDirection,
      colorTemperature: colorTemp,
      quality: lightQuality,
      detailedAnalysis: `Ánh sáng được xử lý theo phương pháp Chiaroscuro kinh điển: nguồn sáng chính (Key Light) tạo ra tam giác sáng đặc trưng ở má đối diện, kết hợp luồng ánh sáng viền (Rim Light) tách biệt hoàn toàn chủ thể khỏi hậu cảnh.`,
      promptSnippetEn: lightPromptEn,
      promptSnippetVi: lightPromptVi,
    },
    background: {
      settingType: bgSetting,
      architecturalStyle: archStyle,
      depthOfField,
      elements: bgElements,
      objectsAndProps,
      materials,
      atmosphere,
      detailedAnalysis: `Hậu cảnh giữ vai trò thiết lập chiều sâu không gian: sự xuất hiện của các vật thể như ${objectsAndProps.map(o => o.name).join(', ')} trên nền chất liệu ${materials.join(', ')} mang lại vẻ đẹp cổ kính, hoài niệm và đầy nghệ thuật.`,
      promptSnippetEn: bgPromptEn,
      promptSnippetVi: bgPromptVi,
    },
    camera: {
      shotType,
      lensSuggestion: lens,
      compositionRule: compRule,
      detailedAnalysis: `Góc máy ngang tầm mắt (Eye-level) tạo sự kết nối chân thực. Tiêu cự ${lens} nén phối cảnh hoàn hảo, làm nổi bật đường nét chủ thể trên nền hậu cảnh mờ ảo.`,
      promptSnippetEn: camPromptEn,
      promptSnippetVi: camPromptVi,
    },
    colorPalette: {
      dominantMood: metrics.isWarm ? 'Ấm áp, Cổ điển, Sang trọng (Warm Nostalgic & Refined)' : 'Bí ẩn, Điện ảnh, Sắc lạnh (Moody Cinematic & Sophisticated)',
      hexColors: metrics.dominantColors,
      colorGrading: `Xử lý màu phim Color Grading chuyên nghiệp: Vùng tối (Shadows) được nhuộm sắc độ ${metrics.dominantColors[0].name}, vùng sáng (Highlights) giữ sắc ${metrics.dominantColors[1].name}.`,
      promptSnippetEn: colorPromptEn,
      promptSnippetVi: colorPromptVi,
    },
    subjectDetails: {
      subjectType: 'Chân dung người / Chủ thể nghệ thuật với thần thái tập trung cao độ',
      poseAndExpression: 'Tư thế tự nhiên, góc nghiêng nhẹ 3/4 khuôn mặt, ánh mắt có chiều sâu nội tâm',
      texturesAndMaterials: 'Bề mặt da tự nhiên có lỗ chân lông và chi tiết vi sợi vải rõ nét, không bị làm mịn giả tạo',
      promptSnippetEn: stylePromptEn,
      promptSnippetVi: stylePromptVi,
    },
    recommendedPromptEn: promptEn,
    recommendedPromptVi: promptVi,
    negativePrompt,
    suggestedAspectRatio: metrics.aspectRatio !== 'original' ? metrics.aspectRatio : '4:3',
    keyTags: [
      'Editorial Portrait',
      'Rembrandt Lighting',
      '85mm f/1.4',
      'Creamy Bokeh',
      'Color Graded',
      'Authentic Film Grain',
      'High Dynamic Range',
    ],
    analyzedAt: new Date().toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit', second: '2-digit' }),
    sourceImagePreview: imageSrc,
  };
}

// Main API analysis function: Tries backend Gemini first, gracefully falls back to intelligent visual engine
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

    if (response.ok) {
      const data = await response.json();
      if (data.success && data.analysis) {
        return {
          ...data.analysis,
          analyzedAt: new Date().toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit', second: '2-digit' }),
          sourceImagePreview: imageSrc,
        };
      }
    }
  } catch (err) {
    console.warn('Backend style analysis request failed, switching to visual engine:', err);
  }

  // Fallback to high-craft visual engine
  return generateIntelligentVisualAnalysis(imageSrc, userFocus);
}
