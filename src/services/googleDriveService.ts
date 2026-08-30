/**
 * Google Drive Integration Service (Real Workspace OAuth 2.0 Integration)
 * Uses Google Identity Services token flow to interact directly with Google Drive API v3.
 */

declare global {
  interface Window {
    google?: any;
    gapi?: any;
  }
}

const DRIVE_OAUTH_TOKEN_KEY = 'google_drive_access_token';
const DRIVE_USER_EMAIL_KEY = 'google_drive_user_email';
const DRIVE_EXPIRES_AT_KEY = 'google_drive_token_expires_at';

let tokenClient: any = null;

export interface DriveUserInfo {
  email: string;
  name?: string;
  picture?: string;
}

export interface DriveUploadResult {
  fileId: string;
  webViewLink?: string;
  webContentLink?: string;
  name: string;
}

/**
 * Load Google Identity Services library script dynamically
 */
export async function loadGsiScript(): Promise<void> {
  if (window.google?.accounts?.oauth2) {
    return;
  }

  return new Promise((resolve, reject) => {
    const existingScript = document.getElementById('gsi-client');
    if (existingScript) {
      existingScript.onload = () => resolve();
      existingScript.onerror = reject;
      return;
    }

    const script = document.createElement('script');
    script.id = 'gsi-client';
    script.src = 'https://accounts.google.com/gsi/client';
    script.async = true;
    script.defer = true;
    script.onload = () => resolve();
    script.onerror = () => reject(new Error('Không thể tải Google Identity Services client script'));
    document.head.appendChild(script);
  });
}

/**
 * Get cached access token if valid
 */
export function getStoredAccessToken(): string | null {
  const token = localStorage.getItem(DRIVE_OAUTH_TOKEN_KEY);
  const expiresAt = localStorage.getItem(DRIVE_EXPIRES_AT_KEY);
  if (!token || !expiresAt) return null;

  if (Date.now() > parseInt(expiresAt, 10)) {
    localStorage.removeItem(DRIVE_OAUTH_TOKEN_KEY);
    localStorage.removeItem(DRIVE_EXPIRES_AT_KEY);
    return null;
  }
  return token;
}

export function getStoredUserEmail(): string | null {
  return localStorage.getItem(DRIVE_USER_EMAIL_KEY);
}

/**
 * Initiates Google OAuth Login Flow for Google Drive permissions
 */
export async function authenticateWithGoogleDrive(): Promise<{ token: string; email: string }> {
  await loadGsiScript();

  return new Promise((resolve, reject) => {
    try {
      tokenClient = window.google.accounts.oauth2.initTokenClient({
        client_id: '', // Handled seamlessly via AI Studio OAuth environment
        scope: 'https://www.googleapis.com/auth/drive.file https://www.googleapis.com/auth/userinfo.email',
        callback: async (tokenResponse: any) => {
          if (tokenResponse.error) {
            console.error('Google OAuth error:', tokenResponse);
            reject(new Error(tokenResponse.error_description || tokenResponse.error));
            return;
          }

          const accessToken = tokenResponse.access_token;
          const expiresIn = parseInt(tokenResponse.expires_in || '3600', 10);
          const expiresAt = Date.now() + expiresIn * 1000;

          localStorage.setItem(DRIVE_OAUTH_TOKEN_KEY, accessToken);
          localStorage.setItem(DRIVE_EXPIRES_AT_KEY, expiresAt.toString());

          // Fetch user profile email
          let email = 'connected-user@google.com';
          try {
            const userInfoRes = await fetch('https://www.googleapis.com/oauth2/v3/userinfo', {
              headers: { Authorization: `Bearer ${accessToken}` },
            });
            if (userInfoRes.ok) {
              const userData = await userInfoRes.json();
              if (userData.email) {
                email = userData.email;
                localStorage.setItem(DRIVE_USER_EMAIL_KEY, email);
              }
            }
          } catch (e) {
            console.warn('Could not fetch user profile info:', e);
          }

          resolve({ token: accessToken, email });
        },
      });

      tokenClient.requestAccessToken({ prompt: 'consent' });
    } catch (err: any) {
      console.error('Failed to initialize token client:', err);
      reject(err);
    }
  });
}

/**
 * Disconnect Google Drive
 */
export function disconnectGoogleDrive(): void {
  const token = getStoredAccessToken();
  if (token && window.google?.accounts?.oauth2) {
    try {
      window.google.accounts.oauth2.revoke(token, () => {
        console.log('Google Drive Token revoked');
      });
    } catch (e) {}
  }
  localStorage.removeItem(DRIVE_OAUTH_TOKEN_KEY);
  localStorage.removeItem(DRIVE_USER_EMAIL_KEY);
  localStorage.removeItem(DRIVE_EXPIRES_AT_KEY);
}

/**
 * Helper to ensure folder exists in Google Drive
 */
async function getOrCreateFolder(folderName: string, accessToken: string): Promise<string | null> {
  try {
    const query = encodeURIComponent(`name = '${folderName}' and mimeType = 'application/vnd.google-apps.folder' and trashed = false`);
    const searchRes = await fetch(`https://www.googleapis.com/drive/v3/files?q=${query}&fields=files(id,name)`, {
      headers: { Authorization: `Bearer ${accessToken}` },
    });

    if (searchRes.ok) {
      const searchData = await searchRes.json();
      if (searchData.files && searchData.files.length > 0) {
        return searchData.files[0].id;
      }
    }

    // Create folder if not found
    const createRes = await fetch('https://www.googleapis.com/drive/v3/files', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        name: folderName,
        mimeType: 'application/vnd.google-apps.folder',
      }),
    });

    if (createRes.ok) {
      const folderData = await createRes.json();
      return folderData.id;
    }
  } catch (err) {
    console.warn('Could not check/create Drive folder:', err);
  }
  return null;
}

/**
 * Upload Image (URL or Base64 or Blob) to Google Drive
 */
export async function uploadImageToDrive(
  imageUrl: string,
  fileName: string,
  folderName: string = 'HinhanhAI'
): Promise<DriveUploadResult> {
  let token = getStoredAccessToken();
  if (!token) {
    // Attempt authentication if not already logged in
    const auth = await authenticateWithGoogleDrive();
    token = auth.token;
  }

  // 1. Fetch image binary blob
  let blob: Blob;
  if (imageUrl.startsWith('data:')) {
    const res = await fetch(imageUrl);
    blob = await res.blob();
  } else {
    const res = await fetch(imageUrl);
    blob = await res.blob();
  }

  // 2. Locate or create parent folder
  const parentFolderId = await getOrCreateFolder(folderName, token);

  // 3. Prepare multipart upload to Google Drive v3
  const metadata: any = {
    name: fileName.endsWith('.jpg') || fileName.endsWith('.png') ? fileName : `${fileName}.jpg`,
    mimeType: blob.type || 'image/jpeg',
  };
  if (parentFolderId) {
    metadata.parents = [parentFolderId];
  }

  const form = new FormData();
  form.append('metadata', new Blob([JSON.stringify(metadata)], { type: 'application/json' }));
  form.append('file', blob);

  const uploadRes = await fetch('https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart&fields=id,name,webViewLink,webContentLink', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
    },
    body: form,
  });

  if (!uploadRes.ok) {
    const errText = await uploadRes.text();
    throw new Error(`Tải lên Google Drive thất bại: ${errText}`);
  }

  const result = await uploadRes.json();
  return {
    fileId: result.id,
    webViewLink: result.webViewLink,
    webContentLink: result.webContentLink,
    name: result.name,
  };
}
