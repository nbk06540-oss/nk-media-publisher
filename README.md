# NK Media Publisher — YouTube + TikTok

এই সংস্করণে Facebook সম্পূর্ণ বাদ। এতে YouTube ও TikTok OAuth connection flow, encrypted token storage এবং Render deployment configuration আছে।

## কী কাজ করে

- Google OAuth দিয়ে YouTube channel access অনুমোদন (scope: `youtube.readonly`)
- TikTok OAuth দিয়ে basic profile access অনুমোদন (scope: `user.info.basic`)
- OAuth token AES-256-GCM দিয়ে encrypt করে PostgreSQL-এ সংরক্ষণ
- `/api/accounts` দিয়ে সংযোগের অবস্থা দেখা
- Render Blueprint (`render.yaml`) প্রস্তুত
- Draft UI কেবল browser Local Storage-এ ড্রাফট রাখে

## এখনো কী কাজ করে না

এটি **ভিডিও প্রকাশ করে না**। YouTube upload এবং TikTok Content Posting API-এর প্রয়োজনীয় scope, platform approval/review, creator consent, upload workflow, privacy settings এবং publishing implementation আলাদাভাবে সম্পন্ন করতে হবে। বর্তমান OAuth scope কেবল account connection-এর প্রাথমিক অনুমতি।

## Render-এ Deploy

1. ZIP extract করে GitHub repository-তে project-এর ভেতরের সব ফাইল upload করুন।
2. Render-এ New → Blueprint অথবা Web Service তৈরি করুন।
3. Build command: `npm install`; Start command: `npm start`।
4. Render PostgreSQL database তৈরি করে Internal Database URL `DATABASE_URL` হিসেবে দিন।
5. Environment Variables-এ নিচের মানগুলো দিন:
   - `BASE_URL`: Render-এর সম্পূর্ণ HTTPS service URL, যেমন `https://your-service.onrender.com`
   - `SESSION_SECRET`: দীর্ঘ random secret
   - `TOKEN_ENCRYPTION_KEY`: 64 hexadecimal character (32 random bytes)
   - `DATABASE_URL`: Render PostgreSQL Internal URL
   - `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`
   - `TIKTOK_CLIENT_KEY`, `TIKTOK_CLIENT_SECRET`

### Encryption key তৈরি

Node.js-এ চালান:
```bash
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```
আউটপুটটি `TOKEN_ENCRYPTION_KEY`-এ দিন। এটি হারালে আগের encrypted token decrypt করা যাবে না। এটি কখনো GitHub বা কাউকে দেবেন না।

## Google / YouTube OAuth সেটআপ

1. Google Cloud Console-এ project তৈরি করুন।
2. YouTube Data API v3 enable করুন।
3. OAuth consent screen configure করুন; প্রয়োজন অনুযায়ী test users যোগ করুন।
4. OAuth Client ID (Web application) তৈরি করুন।
5. Authorized redirect URI দিন:
   `https://YOUR-RENDER-SERVICE.onrender.com/auth/youtube/callback`
6. Client ID ও Client Secret Render Environment Variables-এ বসান।

## TikTok OAuth সেটআপ

1. TikTok for Developers-এ app তৈরি করুন।
2. Login Kit configure ও প্রয়োজনীয় product/scope যোগ করুন।
3. `user.info.basic` scope এবং OAuth redirect URI configure করুন।
4. Redirect URI দিন:
   `https://YOUR-RENDER-SERVICE.onrender.com/auth/tiktok/callback`
5. App review/approval ও TikTok-এর প্রযোজ্য শর্ত পূরণ করুন।
6. Client Key ও Client Secret Render Environment Variables-এ বসান।

## Local run

```bash
npm install
cp .env.example .env
npm start
```
তারপর `http://localhost:10000` খুলুন। OAuth callback-এর জন্য Developer Console-এ localhost redirect URI-ও যুক্ত করতে হবে।

## API

- `GET /api/health` — health/config status
- `GET /api/accounts` — YouTube/TikTok connection status
- `GET /auth/youtube` — YouTube OAuth শুরু
- `GET /auth/tiktok` — TikTok OAuth শুরু
- `POST /auth/youtube/disconnect` — YouTube token record মুছুন
- `POST /auth/tiktok/disconnect` — TikTok token record মুছুন
- `POST /api/publish` — ইচ্ছাকৃতভাবে 501; publishing এখনো বাস্তবায়িত নয়

## Security / deployment notes

- `.env` কখনো commit করবেন না।
- OAuth client secrets server-side environment variable-এ রাখুন।
- PostgreSQL-এ token encrypted অবস্থায় রাখা হয়।
- Production-এ HTTPS ব্যবহার করুন।
- এই starter-এর Express session state store default MemoryStore; multi-instance/production scale-এ Redis বা PostgreSQL-backed session store যোগ করা উচিত।
- Google/TikTok API availability, scopes, app review, quota এবং platform policy পরিবর্তিত হতে পারে। Deploy-এর আগে Developer Console-এ বর্তমান শর্ত যাচাই করুন।
