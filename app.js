// ---------- Dhaaga PWA front-end ----------
const ROLES = {
  toronto: { who: "You", place: "Toronto", tz: "America/Toronto", lat: 43.6532, lon: -79.3832, flag: "\uD83C\uDDE8\uD83C\uDDE6" },
  india:   { who: "Ma",  place: "Sri Ganganagar", tz: "Asia/Kolkata", lat: 29.9094, lon: 73.88, flag: "\uD83C\uDDEE\uD83C\uDDF3" },
};
const other = (r) => (r === "toronto" ? "india" : "toronto");
const $ = (id) => document.getElementById(id);
let state = { code: localStorage.getItem("dh_code") || "", role: localStorage.getItem("dh_role") || "" };
let map, meMarker, themMarker, partner = null, lastBuzzTs = 0;

const urlB64ToUint8 = (b64) => {
  const pad = "=".repeat((4 - (b64.length % 4)) % 4);
  const s = (b64 + pad).replace(/-/g, "+").replace(/_/g, "/");
  const raw = atob(s); return Uint8Array.from([...raw].map((c) => c.charCodeAt(0)));
};

async function api(path, body) {
  const r = await fetch("/api/" + path, body ? { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) } : {});
  return r.ok ? r.json().catch(() => ({})) : {};
}

function clockOf(tz) {
  const now = new Date();
  const time = new Intl.DateTimeFormat("en-GB", { timeZone: tz, hour: "2-digit", minute: "2-digit" }).format(now);
  const h = parseInt(new Intl.DateTimeFormat("en-GB", { timeZone: tz, hour: "2-digit", hour12: false }).format(now), 10);
  return { time, awake: h >= 6 && h < 23 };
}

// ---------- screens ----------
function renderSetup() {
  $("app").innerHTML = `
    <h1 style="text-align:center;font-size:40px">\u0927\u093E\u0917\u093E</h1>
    <div class="sub" style="text-align:center;margin-bottom:26px">Dhaaga \u2014 the thread between you</div>
    <div class="sub" style="opacity:.85;margin-bottom:8px">1 \u00B7 A secret code you both type in</div>
    <input id="code" placeholder="e.g. MA-TORONTO-7421" value="${state.code}" style="margin-bottom:22px"/>
    <div class="sub" style="opacity:.85;margin-bottom:8px">2 \u00B7 Who is on this phone?</div>
    <div class="skies" style="margin-bottom:24px">
      ${Object.entries(ROLES).map(([r, v]) => `
        <button class="role" data-role="${r}" style="border:${state.role===r?'2px solid #ff8a6b':'1px solid rgba(255,255,255,.15)'};background:${state.role===r?'rgba(255,138,107,.18)':'rgba(255,255,255,.05)'}">
          <div style="font-size:22px">${v.flag}</div>
          <div style="font-weight:700;margin-top:4px">${v.who}</div>
          <div class="pill">${v.place}</div>
        </button>`).join("")}
    </div>
    <button class="btn" id="go">Connect the thread</button>
    <div class="sub" style="margin-top:16px;line-height:1.5">Install this app (Share \u2192 Add to Home Screen), then open it on Ma's phone with the same code and pick "Ma".</div>`;
  document.querySelectorAll(".role").forEach((b) => b.onclick = () => { state.role = b.dataset.role; renderSetup(); });
  $("go").onclick = () => {
    const c = $("code").value.trim().toUpperCase();
    if (c.length < 3 || !state.role) return alert("Pick a code (3+ chars) and who you are.");
    state.code = c; localStorage.setItem("dh_code", c); localStorage.setItem("dh_role", state.role);
    start();
  };
}

function renderApp() {
  const meC = clockOf(ROLES[state.role].tz), themC = clockOf(ROLES[other(state.role)].tz);
  const meR = ROLES[state.role], themR = ROLES[other(state.role)];
  $("app").innerHTML = `
    <div style="display:flex;justify-content:space-between;align-items:center">
      <div><h1 style="font-size:26px">\u0927\u093E\u0917\u093E</h1><div class="sub">thread: ${state.code}</div></div>
      <div class="pill" style="text-align:right">connected as<br><b>${meR.who}</b></div>
    </div>
    <div class="skies">
      <div class="sky ${meC.awake?'awake':'asleep'}"><div style="font-size:12.5px;font-weight:700">${meR.flag} ${meR.who}</div><div class="time">${meC.time}</div><div class="pill" style="margin-top:6px">${meC.awake?'awake now':'asleep'}</div></div>
      <div class="sky ${themC.awake?'awake':'asleep'}"><div style="font-size:12.5px;font-weight:700">${themR.flag} ${themR.who}</div><div class="time">${themC.time}</div><div class="pill" id="seen" style="margin-top:6px">${themC.awake?'awake now':'asleep'}</div></div>
    </div>
    <div id="map"></div>
    <div style="display:flex;justify-content:center;margin:6px 0"><button class="buzz" id="buzz"><span style="font-size:30px">\uD83D\uDC93</span><span style="font-size:12px;font-weight:700">BUZZ</span></button></div>
    <div class="sub" style="text-align:center;margin:8px 0 14px">one tap \u2192 ${themR.who}'s phone buzzes, even if the app is closed</div>
    <div class="pings">
      <button class="ping" data-t="wants to call over chai \u2615">\u2615 Chai time?</button>
      <button class="ping" data-t="asked you to call \uD83D\uDCDE">\uD83D\uDCDE Call me</button>
      <button class="ping" data-t="reached home safe \u2705">\u2705 Reached safe</button>
      <button class="ping" data-t="misses you \uD83D\uDC9B">\uD83D\uDC9B Miss you</button>
    </div>
    <div style="display:flex;gap:8px"><input id="msg" placeholder="say something\u2026"/><button class="btn" id="send" style="width:auto;padding:0 18px">\u2192</button></div>`;

  initMap();
  $("buzz").onclick = () => { sendBuzz("buzz", ROLES[state.role].who + " sent you a heartbeat \uD83D\uDC93"); flash($("buzz")); };
  document.querySelectorAll(".ping").forEach((b) => b.onclick = () => sendBuzz("ping", ROLES[state.role].who + " " + b.dataset.t));
  const send = () => { const m = $("msg").value.trim(); if (m) { sendBuzz("msg", ROLES[state.role].who + ": " + m); $("msg").value = ""; } };
  $("send").onclick = send;
  $("msg").addEventListener("keydown", (e) => { if (e.key === "Enter") send(); });
}

function flash(el) {
  const r = document.createElement("span");
  r.style.cssText = "position:absolute;inset:0;border-radius:50%;border:2px solid #ff9a76;animation:ring .9s ease-out";
  el.style.position = "relative"; el.appendChild(r); setTimeout(() => r.remove(), 900);
}

// ---------- map ----------
function initMap() {
  const a = ROLES[state.role], b = ROLES[other(state.role)];
  map = L.map("map", { zoomControl: false, attributionControl: false }).fitBounds([[a.lat, a.lon], [b.lat, b.lon]], { padding: [30, 30] });
  L.tileLayer("https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png").addTo(map);
  const dot = (c) => L.divIcon({ className: "", html: `<div style="width:16px;height:16px;border-radius:50%;background:${c};border:2px solid #fff;box-shadow:0 0 12px ${c}"></div>` });
  meMarker = L.marker([a.lat, a.lon], { icon: dot("#ff7e5f") }).addTo(map);
  themMarker = L.marker([b.lat, b.lon], { icon: dot("#9b8cff") }).addTo(map);
}

// ---------- networking ----------
async function sendBuzz(kind, body) {
  await api("buzz", { code: state.code, from: state.role, kind, body });
}

async function shareLocation() {
  if (!navigator.geolocation) return;
  navigator.geolocation.getCurrentPosition(
    (p) => api("location", { code: state.code, role: state.role, lat: p.coords.latitude, lon: p.coords.longitude, ts: Date.now() }),
    () => {}, { enableHighAccuracy: true, maximumAge: 15000, timeout: 12000 }
  );
}

async function poll() {
  const s = await api("state?code=" + encodeURIComponent(state.code) + "&role=" + state.role);
  if (s && s.partnerLocation && themMarker) {
    const { lat, lon, ts } = s.partnerLocation;
    themMarker.setLatLng([lat, lon]);
    const mins = Math.round((Date.now() - ts) / 60000);
    if ($("seen")) $("seen").textContent = mins < 2 ? "live now \uD83D\uDFE2" : "seen " + mins + "m ago";
  }
}

// ---------- push setup ----------
async function setupPush(reg) {
  try {
    if (Notification.permission !== "granted") { const p = await Notification.requestPermission(); if (p !== "granted") return; }
    const { key } = await api("vapidPublicKey");
    if (!key) return;
    let sub = await reg.pushManager.getSubscription();
    if (!sub) sub = await reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: urlB64ToUint8(key) });
    await api("subscribe", { code: state.code, role: state.role, subscription: sub });
  } catch (e) { console.warn("push setup failed", e); }
}

// ---------- boot ----------
async function start() {
  renderApp();
  let reg = null;
  if ("serviceWorker" in navigator) { try { reg = await navigator.serviceWorker.register("service-worker.js"); } catch (e) {} }
  if (reg) setupPush(reg);
  shareLocation(); poll();
  setInterval(shareLocation, 30000); // refresh my location while the app is open
  setInterval(poll, 5000);           // check partner's location + clocks
  setInterval(renderClocksOnly, 1000);
}
function renderClocksOnly() {
  const meC = clockOf(ROLES[state.role].tz), themC = clockOf(ROLES[other(state.role)].tz);
  const t = document.querySelectorAll(".time");
  if (t[0]) t[0].textContent = meC.time; if (t[1]) t[1].textContent = themC.time;
}

if (state.code && state.role) start(); else renderSetup();
