import { HistoryItem, GeneratedImage } from '../types';
import { HISTORY_SAVED_EVENT } from './syncEvents';

const STORAGE_KEY = 'hinhanhai_history_v2';

// Đọc danh sách đã lưu thật sự (không có demo seed). Trả [] khi chưa lưu gì.
function readStoredItems(): HistoryItem[] {
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

export function getSavedHistory(): HistoryItem[] {
  return readStoredItems();
}

// Alias rõ nghĩa cho sync: chỉ dữ liệu người dùng thật sự đã lưu.
export function getStoredHistory(): HistoryItem[] {
  return readStoredItems();
}

// Ghi thuần vào localStorage — không phát event (dùng khi sync kéo dữ liệu về).
// Có cơ chế tự động tỉa bớt ảnh cũ nếu gặp QuotaExceededError (do Base64 lớn).
export function writeHistoryLocally(items: HistoryItem[]): void {
  let toSave = items.slice(0, 100);
  while (toSave.length > 0) {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(toSave));
      return;
    } catch (err: any) {
      const isQuota =
        err?.name === 'QuotaExceededError' ||
        err?.name === 'NS_ERROR_DOM_QUOTA_REACHED' ||
        err?.code === 22 ||
        err?.code === 1014;
      if (isQuota && toSave.length > 1) {
        // Cắt bớt 25% số lượng ảnh cũ nhất để vừa hạn mức localStorage
        toSave = toSave.slice(0, Math.max(1, Math.floor(toSave.length * 0.75)));
      } else {
        console.error('Failed to write history to localStorage:', err);
        return;
      }
    }
  }
}

function dispatchHistorySaved(items: HistoryItem[]): void {
  window.dispatchEvent(new CustomEvent(HISTORY_SAVED_EVENT, { detail: items }));
}

export function saveGeneratedToHistory(
  images: GeneratedImage[],
  prompt: string,
  modelName: string
): HistoryItem[] {
  try {
    const current = readStoredItems();
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
    writeHistoryLocally(updated);
    dispatchHistorySaved(updated);
    return updated;
  } catch (err) {
    console.error('Failed to save to history:', err);
    return readStoredItems();
  }
}

export function deleteHistoryItem(id: string): HistoryItem[] {
  try {
    const current = readStoredItems();
    const updated = current.filter((item) => item.id !== id);
    writeHistoryLocally(updated);
    dispatchHistorySaved(updated);
    return updated;
  } catch (err) {
    console.error('Failed to delete history item:', err);
    return readStoredItems();
  }
}

export function clearAllHistory(): HistoryItem[] {
  try {
    localStorage.setItem(STORAGE_KEY, '[]');
  } catch (err) {
    console.error('Failed to clear history:', err);
  }
  dispatchHistorySaved([]);
  return [];
}
