const TOKEN_STORAGE_KEY = 'ai_studio_auth_token';
const AUTH_FLAG_KEY = 'ai_studio_auth';

export function getAuthToken(): string | null {
  try {
    return localStorage.getItem(TOKEN_STORAGE_KEY);
  } catch {
    return null;
  }
}

export function setAuthToken(token: string): void {
  try {
    localStorage.setItem(TOKEN_STORAGE_KEY, token);
    localStorage.setItem(AUTH_FLAG_KEY, 'true');
  } catch (e) {
    console.error('Failed to store auth token in localStorage', e);
  }
}

export const AUTH_EXPIRED_EVENT = 'hinhanhai_auth_expired';

export function handleAuthExpired(): void {
  clearAuthToken();
  if (typeof window !== 'undefined') {
    window.dispatchEvent(new CustomEvent(AUTH_EXPIRED_EVENT));
  }
}

export function clearAuthToken(): void {
  try {
    localStorage.removeItem(TOKEN_STORAGE_KEY);
    localStorage.removeItem(AUTH_FLAG_KEY);
  } catch (e) {
    console.error('Failed to clear auth token from localStorage', e);
  }
}

export function getAuthHeaders(): Record<string, string> {
  const token = getAuthToken();
  if (token) {
    return {
      Authorization: `Bearer ${token}`,
    };
  }
  return {};
}

// Đọc payload JWT (base64url) để kiểm tra thời hạn exp mà không cần thư viện.
function decodeJwtPayload(token: string): { exp?: number } | null {
  try {
    const part = token.split('.')[1];
    if (!part) return null;
    const normalized = part.replace(/-/g, '+').replace(/_/g, '/');
    const padded = normalized.padEnd(normalized.length + ((4 - (normalized.length % 4)) % 4), '=');
    return JSON.parse(decodeURIComponent(escape(atob(padded))));
  } catch {
    return null;
  }
}

// Token hết hạn (hoặc không đọc được) => coi như không hợp lệ.
export function isTokenExpired(token: string): boolean {
  const payload = decodeJwtPayload(token);
  if (!payload || typeof payload.exp !== 'number') return false;
  return payload.exp * 1000 <= Date.now();
}

export function isUserAuthenticated(): boolean {
  const token = getAuthToken();
  if (!token) return false;
  if (isTokenExpired(token)) {
    // Token cũ đã hết hạn — dọn luôn để không kẹt ở "zombie session".
    clearAuthToken();
    return false;
  }
  return true;
}

// Wrapper fetch có tự động gắn Bearer token và bắt 401 tập trung:
// khi token hết hạn/không hợp lệ, phát sự kiện để App đưa về màn hình đăng nhập.
export async function authFetch(input: RequestInfo | URL, init: RequestInit = {}): Promise<Response> {
  const headers = { ...(init.headers as Record<string, string> | undefined), ...getAuthHeaders() };
  const response = await fetch(input, { ...init, headers });
  if (response.status === 401) {
    handleAuthExpired();
  }
  return response;
}

export async function loginWithServer(password: string): Promise<{ success: boolean; error?: string }> {
  try {
    const response = await fetch('/api/login', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ password }),
    });

    const data = await response.json().catch(() => ({}));

    if (!response.ok) {
      return {
        success: false,
        error: data.error || (response.status === 429 ? 'Quá nhiều lần thử. Vui lòng đợi 15 phút.' : 'Mã truy cập không hợp lệ.'),
      };
    }

    if (data.token) {
      setAuthToken(data.token);
      return { success: true };
    }

    return {
      success: false,
      error: 'Không nhận được mã xác thực từ server.',
    };
  } catch (err: any) {
    console.error('Login request failed:', err);
    return {
      success: false,
      error: err?.message || 'Không thể kết nối đến máy chủ xác thực.',
    };
  }
}
