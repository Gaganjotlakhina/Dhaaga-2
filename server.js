// Dhaaga backend — buzzes (web push) + locations + chat thread.
// Persists to Supabase when SUPABASE_URL + SUPABASE_SERVICE_KEY are set; otherwise uses memory.
const express = require("express");
const webpush = require("web-push");
const path = require("path");

let supabase = null;
const SB_URL = process.env.SUPABASE_URL, SB_KEY = process.env.SUPABASE_SERVICE_KEY;
if (SB_URL && SB_KEY) {
  const { createClient } = require("@supabase/supabase-js");
  supabase = createClient(SB_URL, SB_KEY, { auth: { persistSession: false } });
  console.log("\u2705 Supabase storage enabled (messages + locations persist forever).");
} else {
  console.warn("\u26A0\uFE0F  No Supabase keys \u2014 using in-memory storage (clears on restart).");
}

const app = express();
app.use(express.json());
app.use(express.static(path.join(__dirname)));

const PUBLIC = process.env.VAPID_PUBLIC, PRIVATE = process.env.VAPID_PRIVATE;
if (PUBLIC && PRIVATE) webpush.setVapidDetails("mailto:you@example.com", PUBLIC, PRIVATE);
else console.warn("\u26A0\uFE0F  No VAPID keys set. Buzz push won't deliver until you add them.");

const other = (r) => (r === "toronto" ? "india" : "toronto");

// ---------- storage layer (Supabase or memory) ----------
const mem = { messages: {}, kv: {} };

async function kvGet(key) {
  if (supabase) { const { data } = await supabase.from("kv").select("value").eq("key", key).maybeSingle(); return data ? data.value : null; }
  return mem.kv[key] || null;
}
async function kvSet(key, value) {
  if (supabase) { await supabase.from("kv").upsert({ key, value }); return; }
  mem.kv[key] = value;
}
async function addMessage(m) {
  if (supabase) { await supabase.from("messages").upsert({ id: m.id, code: m.code, sender: m.from, kind: m.kind, body: m.body, ts: m.ts }); return; }
  mem.messages[m.code] = mem.messages[m.code] || [];
  if (!mem.messages[m.code].some((x) => x.id === m.id)) { mem.messages[m.code].push(m); mem.messages[m.code] = mem.messages[m.code].slice(-300); }
}
async function getMessages(code) {
  if (supabase) {
    const { data } = await supabase.from("messages").select("*").eq("code", code).order("ts", { ascending: true }).limit(300);
    return (data || []).map((r) => ({ id: r.id, from: r.sender, kind: r.kind, body: r.body, ts: Number(r.ts) }));
  }
  return mem.messages[code] || [];
}

// ---------- endpoints ----------
app.get("/api/health", (_q, r) => r.json({ ok: true }));
app.get("/api/vapidPublicKey", (_q, r) => r.json({ key: PUBLIC || "" }));

app.post("/api/subscribe", async (req, res) => {
  const { code, role, subscription } = req.body || {};
  if (!code || !role || !subscription) return res.status(400).end();
  const key = `sub:${code}:${role}`;
  const list = (await kvGet(key)) || [];
  if (!list.some((s) => s.endpoint === subscription.endpoint)) list.push(subscription);
  await kvSet(key, list);
  res.json({ ok: true });
});

app.post("/api/location", async (req, res) => {
  const { code, role, lat, lon, ts } = req.body || {};
  if (!code || !role) return res.status(400).end();
  await kvSet(`loc:${code}:${role}`, { lat, lon, ts: ts || Date.now() });
  res.json({ ok: true });
});

app.get("/api/state", async (req, res) => {
  const { code, role } = req.query;
  res.json({ partnerLocation: (await kvGet(`loc:${code}:${other(role)}`)) || null });
});

app.get("/api/messages", async (req, res) => {
  res.json({ messages: await getMessages(req.query.code) });
});

app.post("/api/buzz", async (req, res) => {
  const { code, from, kind, body, id, ts } = req.body || {};
  await addMessage({ id: id || (Date.now() + "-" + Math.random().toString(36).slice(2, 6)), code, from, kind: kind || "msg", body: body || "", ts: ts || Date.now() });
  const key = `sub:${code}:${other(from)}`;
  const targets = (await kvGet(key)) || [];
  const payload = JSON.stringify({ title: "Dhaaga \uD83D\uDC9B", body: body || "Thinking of you", kind: kind || "msg" });
  const alive = [];
  await Promise.all(targets.map(async (s) => {
    try { await webpush.sendNotification(s, payload); alive.push(s); }
    catch (e) { if (e.statusCode !== 404 && e.statusCode !== 410) alive.push(s); } // drop expired subs
  }));
  if (targets.length !== alive.length) await kvSet(key, alive);
  res.json({ ok: true, delivered: alive.length });
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log("Dhaaga running on :" + PORT));

// Keep-warm so Render's free tier never sleeps.
const SELF_URL = process.env.RENDER_EXTERNAL_URL || process.env.SELF_URL;
if (SELF_URL) { setInterval(() => fetch(SELF_URL + "/api/health").catch(() => {}), 14 * 60 * 1000); console.log("Keep-warm \u2192 " + SELF_URL); }
