import { HistoryItem, GeneratedImage } from '../types';

const STORAGE_KEY = 'hinhanhai_history_v2';

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
  return [];
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
