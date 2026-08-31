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

export function isUserAuthenticated(): boolean {
  return Boolean(getAuthToken());
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
