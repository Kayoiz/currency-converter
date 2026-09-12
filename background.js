

const PRIMARY  = "https://open.er-api.com/v6/latest/USD";
const FALLBACK = "https://cdn.jsdelivr.net/npm/@fawazahmed0/currency-api@latest/v1/currencies/usd.json";
const CACHE_KEY = "ratesCache";
const MAX_AGE_MS = 6 * 60 * 60 * 1000;

async function fetchJSON(url, ms) {
  const ctl = new AbortController();
  const timer = setTimeout(() => ctl.abort(), ms || 8000);
  try {
    const r = await fetch(url, { cache: "no-store", signal: ctl.signal });
    if (!r.ok) throw new Error("HTTP " + r.status);
    return await r.json();
  } finally {
    clearTimeout(timer);
  }
}

async function fetchPrimary() {
  const d = await fetchJSON(PRIMARY, 8000);
  if (d.result !== "success" || !d.rates) throw new Error("primary bad payload");
  return { rates: d.rates, source: "open.er-api.com" };
}

async function fetchFallback() {
  const d = await fetchJSON(FALLBACK, 8000);
  const rates = d && (d.usd || d.rates);
  if (!rates) throw new Error("fallback bad payload");
  const out = {};
  for (const k in rates) out[k.toUpperCase()] = rates[k];
  return { rates: out, source: "currency-api" };
}

let inFlight = null;

async function getBundle(force) {
  if (inFlight && !force) return inFlight;
  const p = loadBundle(force);
  if (!force) {
    inFlight = p;
    p.finally(() => { if (inFlight === p) inFlight = null; });
  }
  return p;
}

async function loadBundle(force) {
  const now = Date.now();
  const store = await chrome.storage.local.get(CACHE_KEY);
  const cache = store[CACHE_KEY];

  if (!force && cache && cache.rates && (now - cache.time) < MAX_AGE_MS) return cache;

  try {
    let fresh;
    try { fresh = await fetchPrimary(); }
    catch (e) { fresh = await fetchFallback(); }
    const bundle = { time: now, rates: fresh.rates, source: fresh.source };
    await chrome.storage.local.set({ [CACHE_KEY]: bundle });
    return bundle;
  } catch (e) {

    if (cache && cache.rates) { return cache; }
    throw e;
  }
}

let lastForce = 0;

chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
  if (!msg || msg.type !== "convert") return;

  const amount = Number(msg.amount);
  const from = typeof msg.from === "string" ? msg.from.toUpperCase().slice(0, 4) : "";
  const targets = Array.isArray(msg.targets)
    ? msg.targets.filter(x => typeof x === "string").slice(0, 8).map(x => x.toUpperCase().slice(0, 4))
    : [];

  if (!isFinite(amount) || !from || !targets.length) {
    sendResponse({ ok: false, error: "bad request" });
    return true;
  }

  const now = Date.now();
  const force = msg.force === true && (now - lastForce) > 30000;
  if (force) lastForce = now;

  getBundle(force)
    .then((b) => {
      const rFrom = b.rates[from];
      if (!rFrom) { sendResponse({ ok: false, error: "no rate for " + from }); return; }
      const out = {};
      for (const to of targets) {
        const rTo = b.rates[to];
        out[to] = rTo ? { value: amount * (rTo / rFrom), rate: rTo / rFrom } : null;
      }
      sendResponse({ ok: true, results: out, updatedAt: b.time, source: b.source });
    })
    .catch(() => sendResponse({ ok: false, error: "rates unavailable" }));

  return true;
});

function paintIcon(on) {
  if (chrome.action && chrome.action.setBadgeText) {
    chrome.action.setBadgeText({ text: on ? "" : "off" });
    if (chrome.action.setBadgeBackgroundColor) {
      chrome.action.setBadgeBackgroundColor({ color: "#5a5a5a" });
    }
  }
}

chrome.storage.onChanged.addListener((ch, area) => {
  if (area === "sync" && ch.enabled !== undefined) paintIcon(ch.enabled.newValue);
});

chrome.storage.sync.get("enabled", (s) => paintIcon(s.enabled !== false));

chrome.runtime.onInstalled.addListener(async () => {
  const s = await chrome.storage.sync.get(["targets", "sourceFallback", "enabled", "scale", "opacity"]);
  const patch = {};
  if (!s.targets) patch.targets = ["EUR", "GBP"];
  if (!s.sourceFallback) patch.sourceFallback = "USD";
  if (s.enabled === undefined) patch.enabled = true;
  if (s.scale === undefined) patch.scale = 50;
  if (s.opacity === undefined) patch.opacity = 19;
  if (Object.keys(patch).length) await chrome.storage.sync.set(patch);
});
