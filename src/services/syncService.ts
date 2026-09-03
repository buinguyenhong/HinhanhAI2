import { getAuthHeaders } from './authService';
import { loadAppSettings, writeSettingsLocally, AppSettings, DEFAULT_SETTINGS } from './storageService';
import { getStoredHistory, writeHistoryLocally } from './historyService';
import type { HistoryItem } from '../types';
import { SETTINGS_SAVED_EVENT, HISTORY_SAVED_EVENT } from './syncEvents';

// Meta ghi nhận trạng thái đồng bộ (localStorage)
interface SyncMetaEntry {
  updatedAt: number | null; // thời điểm server cập nhật lần cuối (đã biết)
  dirty: boolean; // có thay đổi local chưa đẩy thành công lên server
}

interface SyncMeta {
  settings: SyncMetaEntry;
  history: SyncMetaEntry;
}

export interface RemoteSyncState {
  settings: { updatedAt: number; data: AppSettings } | null;
  history: { updatedAt: number; data: HistoryItem[] } | null;
}

const META_KEY = 'hinhanhai_sync_meta_v1';
const PUSH_DEBOUNCE_MS = 1500;

const emptyMeta = (): SyncMeta => ({
  settings: { updatedAt: null, dirty: false },
  history: { updatedAt: null, dirty: false },
});

function readMeta(): SyncMeta {
  try {
    const raw = localStorage.getItem(META_KEY);
    if (!raw) return emptyMeta();
    const parsed = JSON.parse(raw);
    return {
      settings: {
        updatedAt: typeof parsed?.settings?.updatedAt === 'number' ? parsed.settings.updatedAt : null,
        dirty: Boolean(parsed?.settings?.dirty),
      },
      history: {
        updatedAt: typeof parsed?.history?.updatedAt === 'number' ? parsed.history.updatedAt : null,
        dirty: Boolean(parsed?.history?.dirty),
      },
    };
  } catch {
    return emptyMeta();
  }
}

function writeMeta(meta: SyncMeta): void {
  try {
    localStorage.setItem(META_KEY, JSON.stringify(meta));
  } catch (err) {
    console.warn('Không lưu được sync meta:', err);
  }
}

function isDefaultSettings(settings: AppSettings): boolean {
  try {
    return JSON.stringify(settings) === JSON.stringify(DEFAULT_SETTINGS);
  } catch {
    return false;
  }
}

// --- API helpers ---
async function fetchWithTimeout(url: string, init: RequestInit, ms = 10000): Promise<Response> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), ms);
  try {
    return await fetch(url, { ...init, signal: controller.signal });
  } finally {
    clearTimeout(timer);
  }
}

async function fetchRemoteState(): Promise<RemoteSyncState | null> {
  try {
    const response = await fetchWithTimeout(
      '/api/sync/state',
      { headers: { ...getAuthHeaders() } },
      4000
    );
    if (!response.ok) return null;
    const json = await response.json();
    if (!json?.success) return null;
    return {
      settings: json.settings ?? null,
      history: json.history ?? null,
    };
  } catch (err) {
    console.warn('Sync state fetch failed:', err);
    return null;
  }
}

async function pushSettingsRemote(settings: AppSettings): Promise<number | null> {
  try {
    const response = await fetchWithTimeout('/api/sync/settings', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json', ...getAuthHeaders() },
      body: JSON.stringify({ settings }),
    });
    if (!response.ok) return null;
    const json = await response.json();
    return typeof json?.updatedAt === 'number' ? json.updatedAt : Date.now();
  } catch (err) {
    console.warn('Settings push failed:', err);
    return null;
  }
}

async function pushHistoryRemote(history: HistoryItem[]): Promise<number | null> {
  try {
    const response = await fetchWithTimeout('/api/sync/history', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json', ...getAuthHeaders() },
      body: JSON.stringify({ history: history.slice(0, 100) }),
    });
    if (!response.ok) return null;
    const json = await response.json();
    return typeof json?.updatedAt === 'number' ? json.updatedAt : Date.now();
  } catch (err) {
    console.warn('History push failed:', err);
    return null;
  }
}

// --- Bộ đệm + debounce khi đẩy ---
let settingsTimer: ReturnType<typeof setTimeout> | null = null;
let settingsSnapshot: AppSettings | null = null;
let historyTimer: ReturnType<typeof setTimeout> | null = null;
let historySnapshot: HistoryItem[] | null = null;

function flushSettingsPush(): void {
  settingsTimer = null;
  const snapshot = settingsSnapshot;
  settingsSnapshot = null;
  if (!snapshot) return;
  void pushSettingsRemote(snapshot).then((updatedAt) => {
    const meta = readMeta();
    meta.settings.dirty = updatedAt === null;
    if (updatedAt !== null) meta.settings.updatedAt = updatedAt;
    writeMeta(meta);
  });
}

function flushHistoryPush(): void {
  historyTimer = null;
  const snapshot = historySnapshot;
  historySnapshot = null;
  if (!snapshot) return;
  void pushHistoryRemote(snapshot).then((updatedAt) => {
    const meta = readMeta();
    meta.history.dirty = updatedAt === null;
    if (updatedAt !== null) meta.history.updatedAt = updatedAt;
    writeMeta(meta);
  });
}

function scheduleSettingsPush(settings: AppSettings): void {
  const meta = readMeta();
  meta.settings.dirty = true;
  writeMeta(meta);
  settingsSnapshot = settings;
  if (settingsTimer) clearTimeout(settingsTimer);
  settingsTimer = setTimeout(flushSettingsPush, PUSH_DEBOUNCE_MS);
}

function scheduleHistoryPush(history: HistoryItem[]): void {
  const meta = readMeta();
  meta.history.dirty = true;
  writeMeta(meta);
  historySnapshot = history;
  if (historyTimer) clearTimeout(historyTimer);
  historyTimer = setTimeout(flushHistoryPush, PUSH_DEBOUNCE_MS);
}

// --- Gộp lịch sử: union theo id, không làm mất ảnh đã tạo ở máy khác ---
function mergeHistory(
  remote: HistoryItem[] | undefined | null,
  local: HistoryItem[]
): HistoryItem[] {
  const seen = new Set<string>();
  const merged: HistoryItem[] = [];
  const pushUnique = (item: HistoryItem) => {
    if (seen.has(item.id)) return;
    seen.add(item.id);
    merged.push(item);
  };
  // Ưu tiên giữ thứ tự local (mới nhất trước) rồi bổ sung mục remote chưa có.
  local.forEach(pushUnique);
  (remote ?? []).forEach(pushUnique);
  return merged.slice(0, 100);
}

let listenersInstalled = false;

function installLocalListeners(): void {
  if (listenersInstalled) return;
  listenersInstalled = true;
  window.addEventListener(SETTINGS_SAVED_EVENT, ((e: CustomEvent<AppSettings>) => {
    if (e.detail) scheduleSettingsPush(e.detail);
  }) as EventListener);
  window.addEventListener(HISTORY_SAVED_EVENT, ((e: CustomEvent<HistoryItem[]>) => {
    if (Array.isArray(e.detail)) scheduleHistoryPush(e.detail);
  }) as EventListener);
}

export interface InitialSyncResult {
  // settings hiệu lực sau khi đồng bộ (đã kéo từ server về), hoặc null nếu giữ local.
  mergedSettings: AppSettings | null;
}

// --- Đồng bộ ban đầu: kéo trạng thái từ server rồi hợp nhất vào local ---
// Policy:
//  - Settings: server mới hơn local thì lấy server; local có thay đổi (dirty) thì đẩy lên server.
//    KHÔNG seed server bằng settings mặc định (tránh máy "sạch" ghi đè dữ liệu máy khác).
//  - History: union theo id (ưu tiên không mất dữ liệu), rồi đẩy lên server.
export async function performInitialSync(): Promise<InitialSyncResult> {
  installLocalListeners();

  const meta = readMeta();
  const remote = await fetchRemoteState();
  let mergedSettings: AppSettings | null = null;

  // --- SETTINGS ---
  const localSettings = loadAppSettings();
  if (remote?.settings) {
    const remoteAt = remote.settings.updatedAt;
    const localAt = meta.settings.updatedAt ?? -1;
    if (remoteAt > localAt) {
      // Server có phiên bản mới hơn → áp lên máy này
      writeSettingsLocally(remote.settings.data);
      meta.settings.updatedAt = remoteAt;
      meta.settings.dirty = false;
      mergedSettings = remote.settings.data;
    } else if (meta.settings.dirty) {
      // Local có thay đổi chưa đẩy được → đẩy lên server
      const pushedAt = await pushSettingsRemote(localSettings);
      meta.settings.dirty = pushedAt === null;
      if (pushedAt !== null) meta.settings.updatedAt = pushedAt;
    }
  } else if (meta.settings.dirty && !isDefaultSettings(localSettings)) {
    // Server chưa có gì nhưng local đã được chỉnh sửa → seed từ local
    const pushedAt = await pushSettingsRemote(localSettings);
    meta.settings.dirty = pushedAt === null;
    if (pushedAt !== null) meta.settings.updatedAt = pushedAt;
  }
  writeMeta(meta);

  // --- HISTORY ---
  const localHistory = getStoredHistory();
  if (remote?.history) {
    const merged = mergeHistory(remote.history.data, localHistory);
    writeHistoryLocally(merged);
    const pushedAt = await pushHistoryRemote(merged);
    meta.history.dirty = pushedAt === null;
    if (pushedAt !== null) meta.history.updatedAt = pushedAt;
  } else if (
    meta.history.dirty ||
    (localHistory.length > 0 && meta.history.updatedAt === null)
  ) {
    // Server chưa có gì nhưng local có lịch sử thật → đẩy lên server
    const pushedAt = await pushHistoryRemote(localHistory);
    meta.history.dirty = pushedAt === null;
    if (pushedAt !== null) meta.history.updatedAt = pushedAt;
  }
  writeMeta(meta);

  return { mergedSettings };
}
