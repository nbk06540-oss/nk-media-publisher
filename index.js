// NK Media Publisher backend — TikTok Login Kit web OAuth starter
// Secrets must be configured as Render environment variables, never in frontend code.
const express = require('express');
const path = require('path');
const crypto = require('crypto');

const app = express();
app.use(express.json({ limit: '20mb' }));
app.use(express.static(path.join(__dirname, '../public')));

const states = new Map(); // short-lived OAuth state; use a persistent session store for multi-instance production
const PORT = process.env.PORT || 3000;
const CLIENT_KEY = process.env.TIKTOK_CLIENT_KEY;
const CLIENT_SECRET = process.env.TIKTOK_CLIENT_SECRET;
const BASE_URL = (process.env.APP_BASE_URL || '').replace(/\/+$/, '');
const REDIRECT_URI = process.env.TIKTOK_REDIRECT_URI || (BASE_URL ? `${BASE_URL}/auth/tiktok/callback` : '');

app.get('/api/health', (req, res) => res.json({
  ok: true,
  service: 'NK Media Publisher',
  tiktokConfigured: Boolean(CLIENT_KEY && CLIENT_SECRET && REDIRECT_URI),
  publishingEnabled: false
}));

app.get('/auth/tiktok/start', (req, res) => {
  if (!CLIENT_KEY || !REDIRECT_URI) {
    return res.status(503).send('TikTok setup incomplete. Configure TIKTOK_CLIENT_KEY and TIKTOK_REDIRECT_URI on the server.');
  }
  const state = crypto.randomBytes(24).toString('hex');
  states.set(state, Date.now());
  // Expire old state entries.
  for (const [key, created] of states.entries()) {
    if (Date.now() - created > 10 * 60 * 1000) states.delete(key);
  }
  const params = new URLSearchParams({
    client_key: CLIENT_KEY,
    response_type: 'code',
    scope: 'user.info.basic,video.publish',
    redirect_uri: REDIRECT_URI,
    state
  });
  res.redirect(`https://www.tiktok.com/v2/auth/authorize/?${params.toString()}`);
});

app.get('/auth/tiktok/callback', async (req, res) => {
  const { code, state, error, error_description } = req.query;
  if (error) return res.status(400).send(`TikTok authorization failed: ${String(error_description || error)}`);
  if (!code || !state || !states.has(String(state))) {
    return res.status(400).send('Invalid or expired TikTok authorization response. Please start again.');
  }
  states.delete(String(state));
  if (!CLIENT_KEY || !CLIENT_SECRET || !REDIRECT_URI) {
    return res.status(503).send('TikTok server credentials are not configured.');
  }
  try {
    const body = new URLSearchParams({
      client_key: CLIENT_KEY,
      client_secret: CLIENT_SECRET,
      code: String(code),
      grant_type: 'authorization_code',
      redirect_uri: REDIRECT_URI
    });
    const response = await fetch('https://open.tiktokapis.com/v2/oauth/token/', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded', 'Cache-Control': 'no-cache' },
      body
    });
    const data = await response.json();
    if (!response.ok || data.error) {
      return res.status(400).send('TikTok token exchange failed. Check app configuration and granted scopes.');
    }
    // Do not display or log tokens. Durable encrypted server-side storage is a required next step.
    res.type('html').send(`<!doctype html><html lang="en"><meta charset="utf-8"><meta name="viewport" content="width=device-width"><title>TikTok connection</title><body style="font:16px system-ui;max-width:620px;margin:40px auto;padding:20px"><h2>TikTok authorization completed</h2><p>Authorization code exchanged successfully. This starter does not yet save tokens permanently or publish videos.</p><p>You can close this page and return to NK Media Publisher.</p></body></html>`);
  } catch (e) {
    res.status(500).send('Could not complete TikTok token exchange. Please try again later.');
  }
});

app.post('/api/publish', (req, res) => res.status(501).json({
  ok: false,
  message: 'Publishing is not enabled yet. TikTok Content Posting API approval, secure token storage, and upload workflow are still required.'
}));

app.listen(PORT, () => console.log(`NK Media Publisher running on port ${PORT}`));
