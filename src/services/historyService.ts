import { HistoryItem, GeneratedImage } from '../types';

const STORAGE_KEY = 'hinhanhai_history_v2';

const INITIAL_HISTORY: HistoryItem[] = [
  {
    id: 'H-901',
    title: 'Editorial Portrait in Golden Hour',
    prompt:
      'Chân dung nghệ thuật, ánh sáng tự nhiên hắt qua cửa sổ, màu sắc tương phản tinh tế, phong cách editorial portrait.',
    date: 'Today',
    timeAgo: '20 phút trước',
    imageUrl:
      'https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&w=800&q=80',
    aspectRatio: '4:3',
    model: 'Flux.1 Dev Editorial',
    variationsCount: 4,
  },
  {
    id: 'H-902',
    title: 'Cinematic Minimalist Fashion',
    prompt:
      'Chân dung góc nghiêng, phong cách quiet luxury, tông màu xám ấm, ánh sáng dịu nhẹ 85mm f/1.8.',
    date: 'Today',
    timeAgo: '2 giờ trước',
    imageUrl:
      'https://images.unsplash.com/photo-1517841905240-472988babdf9?auto=format&fit=crop&w=800&q=80',
    aspectRatio: '1:1',
    model: 'Flux.1 Dev Editorial',
    variationsCount: 2,
  },
];

export function getSavedHistory(): HistoryItem[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed)) {
        return parsed;
      }
    }
  } catch (err) {
    console.warn('Failed to parse history from localStorage', err);
  }
  return INITIAL_HISTORY;
}

export function saveGeneratedToHistory(
  images: GeneratedImage[],
  prompt: string,
  modelName: string
): HistoryItem[] {
  try {
    const current = getSavedHistory();
    const newItems: HistoryItem[] = images.map((img, idx) => ({
      id: `H-${Date.now()}-${idx}`,
      title: prompt.slice(0, 48) + (prompt.length > 48 ? '...' : ''),
      prompt: img.prompt || prompt,
      date: 'Hôm nay',
      timeAgo: 'Vừa xong',
      imageUrl: img.url,
      aspectRatio: img.aspectRatio || '1:1',
      model: img.model || modelName,
      variationsCount: images.length,
    }));

    const updated = [...newItems, ...current];
    localStorage.setItem(STORAGE_KEY, JSON.stringify(updated.slice(0, 100))); // Keep up to 100 items
    return updated;
  } catch (err) {
    console.error('Failed to save to history:', err);
    return getSavedHistory();
  }
}

export function deleteHistoryItem(id: string): HistoryItem[] {
  try {
    const current = getSavedHistory();
    const updated = current.filter((item) => item.id !== id);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(updated));
    return updated;
  } catch (err) {
    console.error('Failed to delete history item:', err);
    return getSavedHistory();
  }
}

export function clearAllHistory(): HistoryItem[] {
  try {
    localStorage.removeItem(STORAGE_KEY);
  } catch (err) {
    console.error('Failed to clear history:', err);
  }
  return [];
}
