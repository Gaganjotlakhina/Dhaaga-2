// Dhaaga backend — relays buzzes (web push) and locations between two phones.
// Run: npm install && npm start   (set VAPID keys first, see README)
const express = require("express");
const webpush = require("web-push");
const path = require("path");

const app = express();
app.use(express.json());
app.use(express.static(path.join(__dirname)));

const PUBLIC = process.env.VAPID_PUBLIC, PRIVATE = process.env.VAPID_PRIVATE;
if (PUBLIC && PRIVATE) {
  webpush.setVapidDetails("mailto:you@example.com", PUBLIC, PRIVATE);
} else {
  console.warn("\u26A0\uFE0F  No VAPID keys set. Run `npx web-push generate-vapid-keys` and set VAPID_PUBLIC / VAPID_PRIVATE.");
}

// in-memory store (fine for two people; swap for a DB to persist across restarts)
const subs = {};       // subs[code][role] = [subscription, ...]
const locations = {};  // locations[code][role] = { lat, lon, ts }
const other = (r) => (r === "toronto" ? "india" : "toronto");

app.get("/api/health", (_req, res) => res.json({ ok: true }));

app.get("/api/vapidPublicKey", (_req, res) => res.json({ key: PUBLIC || "" }));

app.post("/api/subscribe", (req, res) => {
  const { code, role, subscription } = req.body || {};
  if (!code || !role || !subscription) return res.status(400).end();
  subs[code] = subs[code] || {}; subs[code][role] = subs[code][role] || [];
  if (!subs[code][role].some((s) => s.endpoint === subscription.endpoint)) subs[code][role].push(subscription);
  res.json({ ok: true });
});

app.post("/api/location", (req, res) => {
  const { code, role, lat, lon, ts } = req.body || {};
  if (!code || !role) return res.status(400).end();
  locations[code] = locations[code] || {};
  locations[code][role] = { lat, lon, ts: ts || Date.now() };
  res.json({ ok: true });
});

app.get("/api/state", (req, res) => {
  const { code, role } = req.query;
  const partnerLocation = locations[code] && locations[code][other(role)] || null;
  res.json({ partnerLocation });
});

app.post("/api/buzz", async (req, res) => {
  const { code, from, kind, body } = req.body || {};
  const targets = (subs[code] && subs[code][other(from)]) || [];
  const payload = JSON.stringify({ title: "Dhaaga \uD83D\uDC9B", body: body || "Thinking of you", kind: kind || "msg" });
  const alive = [];
  await Promise.all(targets.map(async (s) => {
    try { await webpush.sendNotification(s, payload); alive.push(s); }
    catch (e) { if (e.statusCode !== 404 && e.statusCode !== 410) alive.push(s); } // drop expired subs
  }));
  if (subs[code]) subs[code][other(from)] = alive;
  res.json({ ok: true, delivered: alive.length });
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log("Dhaaga running on :" + PORT));

// Keep-warm: ping ourselves every 14 min so Render's free tier never spins down.
// (Render provides RENDER_EXTERNAL_URL automatically; nothing else to set up.)
const SELF_URL = process.env.RENDER_EXTERNAL_URL || process.env.SELF_URL;
if (SELF_URL) {
  setInterval(() => {
    fetch(SELF_URL + "/api/health").catch(() => {});
  }, 14 * 60 * 1000);
  console.log("Keep-warm enabled \u2192 " + SELF_URL);
}
