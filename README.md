<div align="center">
<img width="1200" height="475" alt="GHBanner" src="https://ai.google.dev/static/site-assets/images/share-ais-513315318.png" />
</div>

# HinhanhAI

AI image generation workspace with server-side authentication and Gemini integration.

## Run Locally

**Prerequisites:**  Node.js


1. Install dependencies:
   `npm install`
2. Copy `.env.example` to `.env.local`, then set `APP_PASSWORD`, `SESSION_SECRET`, and `GEMINI_API_KEY`.
3. Run the app:
    `npm run dev`

## Vercel

Set these Production environment variables in Vercel. Do not use the `VITE_` prefix for secrets.

- `APP_PASSWORD`: a long unique access password.
- `SESSION_SECRET`: generate with `openssl rand -base64 48`.
- `GEMINI_API_KEY`: Gemini API key used by the server.

Google Drive upload remains disabled until server-side OAuth is configured. When enabling it, set `GOOGLE_CLIENT_ID` and `GOOGLE_CLIENT_SECRET`, then register `https://<your-domain>/api/google-drive/callback` as the Google OAuth redirect URI.

Custom providers are limited to OpenAI-compatible image-generation HTTPS endpoints. The browser can hold a user-supplied provider key for the current profile, but this is not equivalent to a server secret. Do not store shared production provider keys in a browser profile; put shared keys in Vercel environment variables.
