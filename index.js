require("dotenv").config();
const express = require("express");
const session = require("express-session");
const crypto = require("crypto");
const { Pool } = require("pg");
const path = require("path");

const app = express();
const PORT = process.env.PORT || 10000;
const BASE_URL = (process.env.BASE_URL || "").replace(/\/$/, "");
const pool = process.env.DATABASE_URL ? new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.DATABASE_URL.includes("localhost") ? false : { rejectUnauthorized: false }
}) : null;

app.disable("x-powered-by");
app.use(express.json({ limit: "2mb" }));
app.use(session({
  name: "nk.sid",
  secret: process.env.SESSION_SECRET || "replace-this-before-deploy",
  resave: false,
  saveUninitialized: false,
  cookie: {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    maxAge: 10 * 60 * 1000
  }
}));

function required(name) {
  const value = process.env[name];
  if (!value) throw new Error(`${name} is not configured`);
  return value;
}
function redirectUri(provider) {
  return `${BASE_URL}/auth/${provider}/callback`;
}
function encrypt(value) {
  const key = Buffer.from(required("TOKEN_ENCRYPTION_KEY"), "hex");
  if (key.length !== 32) throw new Error("TOKEN_ENCRYPTION_KEY must be 64 hex characters");
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv("aes-256-gcm", key, iv);
  const data = Buffer.concat([cipher.update(JSON.stringify(value), "utf8"), cipher.final()]);
  return JSON.stringify({ iv: iv.toString("hex"), tag: cipher.getAuthTag().toString("hex"), data: data.toString("hex") });
}
function decrypt(value) {
  const key = Buffer.from(required("TOKEN_ENCRYPTION_KEY"), "hex");
  const item = JSON.parse(value);
  const decipher = crypto.createDecipheriv("aes-256-gcm", key, Buffer.from(item.iv, "hex"));
  decipher.setAuthTag(Buffer.from(item.tag, "hex"));
  return JSON.parse(Buffer.concat([decipher.update(Buffer.from(item.data, "hex")), decipher.final()]).toString("utf8"));
}
async function initDb() {
  if (!pool) return;
  await pool.query(`CREATE TABLE IF NOT EXISTS social_accounts (
    provider TEXT PRIMARY KEY,
    encrypted_tokens TEXT NOT NULL,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
  )`);
}
async function saveTokens(provider, tokens) {
  if (!pool) throw new Error("DATABASE_URL is required to securely save OAuth tokens");
  await pool.query(
    `INSERT INTO social_accounts(provider, encrypted_tokens, updated_at)
     VALUES($1,$2,NOW())
     ON CONFLICT(provider) DO UPDATE SET encrypted_tokens=EXCLUDED.encrypted_tokens, updated_at=NOW()`,
    [provider, encrypt(tokens)]
  );
}
async function accountStatus(provider) {
  if (!pool) return { connected: false, setupRequired: true };
  const result = await pool.query("SELECT encrypted_tokens FROM social_accounts WHERE provider=$1", [provider]);
  if (!result.rowCount) return { connected: false };
  const tokens = decrypt(result.rows[0].encrypted_tokens);
  return { connected: true, connectedAt: tokens.saved_at || null };
}
function safeError(err) {
  console.error(err);
  return "OAuth সংযোগ সম্পন্ন হয়নি। Render-এর Environment Variables ও Developer App সেটিংস পরীক্ষা করুন।";
}
function startOAuth(provider, url) {
  return (req, res) => {
    try {
      const state = crypto.randomBytes(24).toString("hex");
      req.session.oauthState = { provider, state, created: Date.now() };
      req.session.save(err => {
        if (err) return res.status(500).send("Session error");
        res.redirect(url(state));
      });
    } catch (err) { res.status(500).send(safeError(err)); }
  };
}
function checkState(req, provider) {
  const saved = req.session.oauthState;
  delete req.session.oauthState;
  if (!saved || saved.provider !== provider || saved.state !== req.query.state ||
      Date.now() - saved.created > 10 * 60 * 1000) throw new Error("Invalid or expired OAuth state");
  if (req.query.error) throw new Error(String(req.query.error));
  if (!req.query.code) throw new Error("Authorization code missing");
  return String(req.query.code);
}

app.get("/api/health", (_req, res) => res.json({
  ok: true, service: "NK Media Publisher", providers: ["youtube", "tiktok"],
  databaseConfigured: !!pool, oauthConfigured: {
    youtube: !!(process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET),
    tiktok: !!(process.env.TIKTOK_CLIENT_KEY && process.env.TIKTOK_CLIENT_SECRET)
  },
  publishingEnabled: false
}));

app.get("/api/accounts", async (_req, res) => {
  try {
    const [youtube, tiktok] = await Promise.all([accountStatus("youtube"), accountStatus("tiktok")]);
    res.json({ youtube, tiktok });
  } catch (err) { res.status(500).json({ error: safeError(err) }); }
});

app.get("/auth/youtube", startOAuth("youtube", state => {
  const query = new URLSearchParams({
    client_id: required("GOOGLE_CLIENT_ID"),
    redirect_uri: redirectUri("youtube"),
    response_type: "code",
    scope: "https://www.googleapis.com/auth/youtube.readonly",
    access_type: "offline",
    prompt: "consent",
    state
  });
  return `https://accounts.google.com/o/oauth2/v2/auth?${query}`;
}));

app.get("/auth/youtube/callback", async (req, res) => {
  try {
    const code = checkState(req, "youtube");
    const body = new URLSearchParams({
      code, client_id: required("GOOGLE_CLIENT_ID"),
      client_secret: required("GOOGLE_CLIENT_SECRET"),
      redirect_uri: redirectUri("youtube"), grant_type: "authorization_code"
    });
    const response = await fetch("https://oauth2.googleapis.com/token", {
      method: "POST", headers: { "Content-Type": "application/x-www-form-urlencoded" }, body
    });
    const tokens = await response.json();
    if (!response.ok || !tokens.access_token) throw new Error(tokens.error_description || "Google token exchange failed");
    await saveTokens("youtube", { ...tokens, saved_at: new Date().toISOString() });
    res.redirect("/?connected=youtube");
  } catch (err) { res.status(400).send(safeError(err)); }
});

app.get("/auth/tiktok", startOAuth("tiktok", state => {
  const query = new URLSearchParams({
    client_key: required("TIKTOK_CLIENT_KEY"),
    redirect_uri: redirectUri("tiktok"),
    response_type: "code",
    scope: "user.info.basic",
    state
  });
  return `https://www.tiktok.com/v2/auth/authorize/?${query}`;
}));

app.get("/auth/tiktok/callback", async (req, res) => {
  try {
    const code = checkState(req, "tiktok");
    const body = new URLSearchParams({
      client_key: required("TIKTOK_CLIENT_KEY"),
      client_secret: required("TIKTOK_CLIENT_SECRET"),
      code, grant_type: "authorization_code",
      redirect_uri: redirectUri("tiktok")
    });
    const response = await fetch("https://open.tiktokapis.com/v2/oauth/token/", {
      method: "POST", headers: { "Content-Type": "application/x-www-form-urlencoded" }, body
    });
    const result = await response.json();
    if (!response.ok || result.error || !result.data?.access_token)
      throw new Error(result.error_description || result.error || "TikTok token exchange failed");
    await saveTokens("tiktok", { ...result.data, saved_at: new Date().toISOString() });
    res.redirect("/?connected=tiktok");
  } catch (err) { res.status(400).send(safeError(err)); }
});

app.post("/auth/:provider/disconnect", async (req, res) => {
  const provider = req.params.provider;
  if (!["youtube", "tiktok"].includes(provider)) return res.sendStatus(404);
  if (!pool) return res.status(503).json({ error: "DATABASE_URL is not configured" });
  try {
    await pool.query("DELETE FROM social_accounts WHERE provider=$1", [provider]);
    res.json({ ok: true });
  } catch (err) { res.status(500).json({ error: safeError(err) }); }
});

// Publishing is intentionally not implemented. OAuth scopes above only establish account connection.
app.post("/api/publish", (_req, res) => res.status(501).json({
  ok: false,
  message: "OAuth সংযোগের ভিত্তি প্রস্তুত। বাস্তব ভিডিও প্রকাশের জন্য আলাদা API permission, review এবং publishing workflow প্রয়োজন।"
}));

app.use(express.static(path.join(__dirname, "public")));
app.get("/", (_req, res) => res.sendFile(path.join(__dirname, "public", "index.html")));

initDb().then(() => app.listen(PORT, "0.0.0.0", () =>
  console.log(`NK Media Publisher listening on ${PORT}`)
)).catch(err => { console.error("Database initialization failed:", err); process.exit(1); });
