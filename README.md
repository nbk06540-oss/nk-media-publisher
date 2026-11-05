# NK Media Publisher — starter project

This is the first responsive front-end prototype for Natorer Khonthoshor.

## Run locally
Open `public/index.html` in a browser. It works as a local UI demo and stores the draft queue in that browser's localStorage.

## Important
This prototype DOES NOT publish to Facebook, YouTube, or TikTok yet. Real publishing requires approved developer applications, OAuth consent, platform-specific permissions, secure token storage, and a hosted backend. Never put API secrets or access tokens in browser JavaScript.

## Platform integration requirements
- Meta / Facebook Pages: Meta Developer app, Facebook Login, Page access token and approved Page publishing permissions.
- YouTube: Google Cloud project, YouTube Data API v3, OAuth 2.0. Uploads may be restricted until the API project passes required compliance/audit.
- TikTok: TikTok for Developers app, Login Kit and Content Posting API access; direct posting is subject to app audit and user authorization. Until approved, use an upload/draft handoff flow where supported.

## Suggested production architecture
- Frontend: this responsive web app (can be installed as a PWA).
- Backend: Node.js + Express.
- Database: Supabase free tier or another suitable database.
- Media storage: provider storage with quota monitoring.
- Secrets: server environment variables only.
- Publishing: separate adapters for Meta, YouTube and TikTok; per-platform status and retry logs.

## Next implementation milestone
Create developer apps and obtain credentials. Then configure OAuth callback URLs and implement the platform adapters on the server. The platform account owner must authorize each connection.


## TikTok profile added
The workspace now displays the user's TikTok profile:
https://www.tiktok.com/@natorerkhonthoshor

The profile link is not an authenticated publishing connection. TikTok publishing still requires a TikTok for Developers app, Login Kit, Content Posting API access, required review/audit, OAuth consent, and secure server-side token handling.


## Render deployment (TikTok Login Kit Web)
1. Create a new Render Web Service from this project ZIP/repository.
2. Set Build Command: `npm install`; Start Command: `npm start`.
3. After Render gives you the HTTPS service URL, set:
   - `APP_BASE_URL` = your Render service URL (for example, `https://your-service.onrender.com`)
   - `TIKTOK_REDIRECT_URI` = `https://your-service.onrender.com/auth/tiktok/callback`
   - `TIKTOK_CLIENT_KEY` = Client Key from TikTok Developer Portal
   - `TIKTOK_CLIENT_SECRET` = Client Secret from TikTok Developer Portal
4. In TikTok Login Kit > Web, register exactly the same `TIKTOK_REDIRECT_URI`.
5. Redeploy/restart the service. Test by opening `/auth/tiktok/start`.

Security/limitations:
- Never place Client Secret or access/refresh tokens in the browser or share them in chat.
- This starter exchanges the authorization code but intentionally does not persist tokens. Add encrypted server-side token storage, user/session management, token refresh, and TikTok Content Posting API compliance before production publishing.
- Request only scopes enabled for your app. TikTok may require app review/audit before public video posting is available.
- OAuth state is held in process memory; use a persistent session store for production/multi-instance deployments.
