const express = require("express");
const path = require("path");

const app = express();
const PORT = process.env.PORT || 10000;
const ROOT = __dirname;

app.disable("x-powered-by");
app.use(express.json({ limit: "10mb" }));

// Health check for Render
app.get("/api/health", (_req, res) => {
  res.status(200).json({
    ok: true,
    service: "NK Media Publisher",
    mode: "demo",
    publishingEnabled: false
  });
});

// Serve the front-end from the project root
app.use(express.static(ROOT));

// Friendly root route
app.get("/", (_req, res) => {
  res.sendFile(path.join(ROOT, "index.html"));
});

// Publishing is intentionally disabled until platform APIs and approvals exist.
app.post("/api/publish", (_req, res) => {
  res.status(501).json({
    ok: false,
    message: "লাইভ পোস্টিং এখনো চালু হয়নি। Facebook, YouTube ও TikTok API অনুমোদন এবং নিরাপদ OAuth সংযোগ প্রয়োজন।"
  });
});

app.listen(PORT, "0.0.0.0", () => {
  console.log(`NK Media Publisher running on port ${PORT}`);
});