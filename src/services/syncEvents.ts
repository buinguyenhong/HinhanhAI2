// Tên các sự kiện local để storageService/historyService báo "đã ghi xong"
// và syncService lắng nghe đẩy lên server. Tách riêng để tránh import vòng.
export const SETTINGS_SAVED_EVENT = 'hinhanhai:settings-saved';
export const HISTORY_SAVED_EVENT = 'hinhanhai:history-saved';
