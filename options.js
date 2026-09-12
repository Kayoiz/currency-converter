const PX_STEP = 7, PX_SIZE = 3, PX_LIFE = 620;

function pixelBurst(box, themeId) {
  const shades = (THEMES[themeId] || THEMES.blue).px;
  const w = box.clientWidth, h = box.clientHeight;
  if (!w || !h) return;
  const cols = Math.floor(w / PX_STEP), rows = Math.floor(h / PX_STEP);
  if (cols < 2 || rows < 2) return;

  box.querySelectorAll(".opx").forEach(n => n.remove());
  const frag = document.createDocumentFragment();
  const maxDepth = Math.min(cols, rows) / 2;

  for (let cx = 0; cx < cols; cx++) {
    for (let cy = 0; cy < rows; cy++) {
      const depth = Math.min(cx, cols - 1 - cx, cy, rows - 1 - cy);
      const t = Math.min(1, depth / maxDepth);
      let peak = Math.pow(1 - t, 3.4);
      const cX = Math.min(cx, cols - 1 - cx) / (cols / 2);
      const cY = Math.min(cy, rows - 1 - cy) / (rows / 2);
      peak = Math.min(1, peak + (1 - Math.min(1, Math.hypot(cX, cY))) * 0.65);
      if (peak < 0.16) continue;
      if (Math.random() > 0.55 + peak * 0.45) continue;

      const p = document.createElement("div");
      p.className = "opx";
      const size = PX_SIZE + (peak > 0.7 ? 1 : 0);
      p.style.width = size + "px";
      p.style.height = size + "px";
      p.style.left = Math.round(cx * PX_STEP + (PX_STEP - size) / 2) + "px";
      p.style.top = Math.round(cy * PX_STEP + (PX_STEP - size) / 2) + "px";
      let si = Math.round((1 - t) * (shades.length - 1) + (Math.random() * 2.4 - 1.2));
      si = Math.max(0, Math.min(shades.length - 1, si));
      p.style.background = shades[si];
      p.style.setProperty("--peak", (0.25 + peak * 0.75).toFixed(2));
      const delay = (1 - t) * 190 + Math.random() * 60;
      p.style.animation = "opxGrid " + (PX_LIFE - delay) + "ms ease-out " + delay.toFixed(0) + "ms forwards";
      frag.appendChild(p);
    }
  }
  box.appendChild(frag);
  setTimeout(() => box.querySelectorAll(".opx").forEach(n => n.remove()), PX_LIFE + 80);
}

const MAX_TARGETS = 6;
let placeSize = null, placeOp = null;
const TIP_URL = "https://ko-fi.com/kayoiz";
const state = { enabled: true, calcFrom: "USD", calcTo: "EUR", lang: "en", scale: 50, theme: "blue", opacity: 19, numFont: "inter", targets: ["EUR", "GBP"], sourceFallback: "USD" };

const byCode = {};
for (const c of CURRENCIES) byCode[c[0]] = c;

const flagUrl = (cc) => "https://flagcdn.com/w80/" + cc + ".png";
const t = (k) => (UI[state.lang] && UI[state.lang][k]) || UI.en[k];

const nameEn = (code) => NAMES.en[code] || code;
const nameLocal = (code) => (NAMES[state.lang] && NAMES[state.lang][code]) || "";

function on(id, evt, fn) {
  const el = document.getElementById(id);
  if (el) el.addEventListener(evt, fn);
}

function setText(id, value) {
  const el = document.getElementById(id);
  if (el) el.textContent = value;
}

function applyLanguage() {
  document.documentElement.dir = RTL[state.lang] ? "rtl" : "ltr";
  setText("h-lang", t("language"));
  setText("h-size", t("rowSize"));
  setText("h-src", t("from"));
  const th = document.getElementById("h-theme");
  if (th) th.textContent = t("theme");
  const fh = document.getElementById("h-font");
  if (fh) fh.textContent = t("numFont");
  const t1 = document.getElementById("tip1");
  const t2 = document.getElementById("tip2");
  const tb = document.getElementById("tipbtn");
  if (t1 && t2 && tb) {
    t1.textContent = t("tip1");
    t2.textContent = t("tip2");
    const lb = document.getElementById("tiplabel");
    if (lb) lb.textContent = t("tipBtn");

    const sec = tb.closest(".tipsec");
    if (TIP_URL) { tb.href = TIP_URL; sec.style.display = ""; }
    else sec.style.display = "none";
  }
  const exl = document.getElementById("lbl-ext");
  if (exl) exl.textContent = t("ext");
  const hc = document.getElementById("h-calc");
  if (hc) hc.textContent = t("calc");
  const amtIn = document.getElementById("calcAmt");
  if (amtIn) amtIn.placeholder = t("amount");
  const swBtn = document.getElementById("calcSwap");
  if (swBtn) swBtn.title = t("swap");
  const cr = document.getElementById("credit");
  if (cr) {
    cr.textContent = "";
    const a = document.createElement("b");
    a.textContent = "ExchangeRate-API";
    cr.append(t("ratesBy") + " ", a);
    cr.appendChild(document.createElement("br"));
    const b = document.createElement("b");
    b.textContent = "flagcdn.com";
    cr.append(t("flagsBy") + " ", b);
  }
  const nl = document.getElementById("noticelink");
  if (nl) nl.textContent = t("licenses");
  const opH = document.getElementById("h-op");
  if (opH) opH.textContent = t("opacity");
  setText("lbl-glass", t("glass"));
  setText("lbl-solid", t("solid"));
  setText("lbl-small", t("smaller"));
  setText("lbl-big", t("bigger"));
  setText("refresh", t("refresh"));

  renderPreview();
  document.title = "Currency Converter - " + t("settings");
}

function previewFit() {
  const wrap = document.getElementById("previewWrap");
  const bar = document.getElementById("pbar");
  if (!wrap || !bar) return;
  bar.style.transform = "none";
  bar.style.marginLeft = "0px";
  const avail = wrap.clientWidth - 20;
  const w = Math.max(bar.scrollWidth, bar.getBoundingClientRect().width);
  if (!avail || !w) return;
  const f = w > avail ? Math.max(0.5, avail / w) : 1;
  bar.style.transformOrigin = "left center";
  bar.style.transform = f === 1 ? "none" : "scale(" + f.toFixed(3) + ")";
  bar.style.marginLeft = Math.max(0, (avail - w * f) / 2) + "px";
  const h = bar.getBoundingClientRect().height;
  wrap.style.height = h > 0 ? Math.ceil(h + 26) + "px" : "";
}

function previewFitLater() {
  requestAnimationFrame(() => requestAnimationFrame(previewFit));
  if (document.fonts && document.fonts.ready) document.fonts.ready.then(() => setTimeout(previewFit, 30));
  setTimeout(previewFit, 150);
  setTimeout(previewFit, 500);
}

function applyScale() {
  applyScaleInner();
  previewFitLater();
}

function applyScaleInner() {
  const f = state.scale / 100;
  const px = (n, floor) => Math.round(Math.max(floor === undefined ? 0 : floor, n * f) * 100) / 100;
  document.querySelectorAll("#pbar .plbl").forEach(e => { e.style.fontSize = px(10.5, 7) + "px"; });
  document.querySelectorAll("#pbar .pval").forEach(e => { e.style.fontSize = px(19) + "px"; });
  document.querySelectorAll("#pbar .pcar").forEach(e => { e.style.fontSize = px(18, 13) + "px"; });
  document.querySelectorAll("#pbar .pslot").forEach(e => {
    e.style.padding = px(7) + "px " + px(12) + "px " + px(9) + "px";
    e.style.minWidth = px(95) + "px";
  });
}

function renderCurrencies() {
  const list = document.getElementById("curlist");
  list.textContent = "";

  const row = (code, isSrc, index) => {
    const c = byCode[code];
    const d = document.createElement("div");
    d.className = "curitem" + (isSrc ? " src" : "");

    const img = document.createElement("img");
    if (c) { img.src = flagUrl(c[1]); img.onerror = () => { img.style.visibility = "hidden"; }; }

    const code_ = document.createElement("div");
    code_.className = "code";
    code_.textContent = code;

    const nm = document.createElement("div");
    nm.className = "cname";
    nm.textContent = nameEn(code);
    const local = nameLocal(code);
    if (local && local !== nameEn(code)) {
      const sub = document.createElement("div");
      sub.className = "cnative";
      sub.textContent = local;
      nm.appendChild(sub);
    }

    d.append(img, code_, nm);

    if (isSrc) {
    } else if (state.targets.length > 1) {
      const del = document.createElement("div");
      del.className = "del";
      del.textContent = "\u00d7";
      del.title = t("removeCur");
      del.addEventListener("click", () => {
        state.targets.splice(index, 1);
        chrome.storage.sync.set({ targets: state.targets.slice() });
              redraw();
      });
      d.appendChild(del);
    }
    return d;
  };

  list.appendChild(row(state.sourceFallback, true, -1));


}

let gIndex = 0;









window.addEventListener("resize", () => previewFitLater());

function sanitizeAmount(el) {
  const before = el.value;
  const pos = el.selectionStart;
  let v = before.replace(/[^0-9.,]/g, "");
  const firstSep = v.search(/[.,]/);
  if (firstSep !== -1) {
    v = v.slice(0, firstSep + 1) + v.slice(firstSep + 1).replace(/[.,]/g, "");
  }
  if (v.length > 15) v = v.slice(0, 15);
  if (v !== before) {
    el.value = v;
    const drop = before.length - v.length;
    const p = Math.max(0, (pos === null ? v.length : pos) - drop);
    try { el.setSelectionRange(p, p); } catch (e) {}
  }
  return v;
}

function parseAmount(raw) {
  if (!raw) return null;
  let s = String(raw).replace(/[^\d.,\-]/g, "");
  if (!s) return null;
  const dots = (s.match(/\./g) || []).length, commas = (s.match(/,/g) || []).length;
  if (dots && commas) {
    if (s.lastIndexOf(",") > s.lastIndexOf(".")) s = s.replace(/\./g, "").replace(",", ".");
    else s = s.replace(/,/g, "");
  } else if (commas === 1) {
    s = (s.split(",")[1].length <= 2) ? s.replace(",", ".") : s.replace(/,/g, "");
  } else if (commas > 1) { s = s.replace(/,/g, ""); }
  else if (dots > 1) { s = s.replace(/\./g, ""); }
  const n = parseFloat(s);
  return isNaN(n) ? null : n;
}

const CALC_SYM = { USD:"$", EUR:"\u20ac", GBP:"\u00a3", JPY:"\u00a5", ILS:"\u20aa", INR:"\u20b9",
                   CHF:"CHF ", CAD:"C$", AUD:"A$", KRW:"\u20a9", RUB:"\u20bd", TRY:"\u20ba",
                   BRL:"R$", CNY:"\u00a5", MXN:"MX$", ZAR:"R", PLN:"z\u0142 ", SEK:"kr ", NOK:"kr " };

let calcTimer = null;

function runCalc() {
  const amtEl = document.getElementById("calcAmt");
  const out = document.getElementById("calcOut");
  const rate = document.getElementById("calcRate");
  if (!amtEl || !out) return;

  const n = parseAmount(amtEl.value);
  if (n === null) {
    out.className = "calcout dim";
    out.textContent = "-";
    if (rate) rate.textContent = "";
    return;
  }
  if (state.calcFrom === state.calcTo) {
    out.className = "calcout";
    out.textContent = (CALC_SYM[state.calcTo] || (state.calcTo + " ")) +
      n.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
    if (rate) rate.textContent = "";
    return;
  }

  chrome.runtime.sendMessage(
    { type: "convert", amount: n, from: state.calcFrom, targets: [state.calcTo] },
    (r) => {
      if (chrome.runtime.lastError || !r || !r.ok || !r.results || !r.results[state.calcTo]) {
        out.className = "calcout dim";
        out.textContent = t("noData");
        if (rate) rate.textContent = "";
        return;
      }
      const res = r.results[state.calcTo];
      out.className = "calcout";
      out.textContent = (CALC_SYM[state.calcTo] || (state.calcTo + " ")) +
        res.value.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
      if (rate) {
        rate.textContent = "1 " + state.calcFrom + " = " +
          res.rate.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 4 }) +
          " " + state.calcTo;
      }
    }
  );
}

function calcSoon() { clearTimeout(calcTimer); calcTimer = setTimeout(runCalc, 180); }

let tIndex = 0;

function tourSteps() { return TOUR[state.lang] || TOUR.en; }

function placeTour() {
  const steps = tourSteps();
  const step = steps[tIndex];
  const el = document.getElementById(step[0]);
  const card = document.getElementById("tourcard");
  if (!el || !card) return;

  const r = el.getBoundingClientRect();
  const cw = card.offsetWidth || 264;
  const ch = card.offsetHeight || 190;
  const gap = 12;
  const below = r.bottom + gap + ch <= window.innerHeight - 8;
  card.classList.toggle("below", below);
  card.classList.toggle("above", !below);

  let left = r.left + r.width / 2 - cw / 2;
  left = Math.max(10, Math.min(left, window.innerWidth - cw - 10));
  const top = below ? r.bottom + gap : Math.max(8, r.top - gap - ch);
  card.style.left = Math.round(left) + "px";
  card.style.top = Math.round(top) + "px";

  const arrow = Math.max(16, Math.min(cw - 16, r.left + r.width / 2 - left));
  card.style.setProperty("--arrow", Math.round(arrow) + "px");
}

function paintDots(count) {
  const dots = document.getElementById("tourdots");
  if (!dots) return;

  if (dots.childElementCount !== count) {
    dots.textContent = "";
    for (let k = 0; k < count; k++) {
      const d = document.createElement("div");
      d.className = "tourdot";
      d.addEventListener("click", () => { tIndex = k; renderTour(); });
      dots.appendChild(d);
    }
  }
  dots.querySelectorAll(".tourdot").forEach((d, k) => {
    d.classList.toggle("passed", k < tIndex);
    d.classList.toggle("on", k === tIndex);
  });
}

function renderTour() {
  const steps = tourSteps();
  tIndex = Math.max(0, Math.min(steps.length - 1, tIndex));
  const step = steps[tIndex];

  setText("tourtitle", step[1]);
  setText("tourbody", step[2]);
  setText("tourstep", t("gStep") + " " + (tIndex + 1) + " / " + steps.length);
  setText("tourskip", t("gSkip"));
  setText("tourback", t("gBack"));
  setText("tournext", tIndex === steps.length - 1 ? t("gDone") : t("gNext"));
  const back = document.getElementById("tourback");
  if (back) back.disabled = tIndex === 0;

  paintDots(steps.length);

  const el = document.getElementById(step[0]);
  if (el) {
    if (typeof el.scrollIntoView === "function") {
      try { el.scrollIntoView({ block: "center", behavior: "smooth" }); }
      catch (e) { el.scrollIntoView(true); }
    }
    setTimeout(placeTour, 330);
  }
  placeTour();
}

function openTour() {
  tIndex = 0;
  const tr = document.getElementById("tour");
  if (!tr) return;
  tr.hidden = false;
  renderTour();
}

function closeTour() {
  const tr = document.getElementById("tour");
  if (tr) tr.hidden = true;
  chrome.storage.sync.set({ guideSeen: true });
}

function wireSlider(id, suffix) {
  const el = document.getElementById(id);
  const wrap = document.getElementById("wrap-" + id);
  const bub = document.getElementById("bub-" + id);
  if (!el || !wrap || !bub) return;

  const place = () => {
    const min = Number(el.min), max = Number(el.max), v = Number(el.value);
    const pct = max === min ? 0 : (v - min) / (max - min);
    const w = el.getBoundingClientRect().width;
    const thumb = 15;
    bub.textContent = Math.round(v) + (suffix || "%");
    bub.style.left = Math.round(thumb / 2 + pct * (w - thumb)) + "px";
  };

  el.addEventListener("input", place);
  el.addEventListener("pointerdown", () => wrap.classList.add("dragging"));
  el.addEventListener("pointerenter", place);
  window.addEventListener("pointerup", () => wrap.classList.remove("dragging"));
  window.addEventListener("resize", place);
  place();
  return place;
}

function setPct(id, value, min, max) {
  const el = document.getElementById(id);
  if (!el) return;
  el.textContent = "";
  const s = document.createElement("span");
  s.textContent = value + "%";
  el.appendChild(s);
  el.style.setProperty("--fill", (((value - min) / (max - min)) * 100).toFixed(1) + "%");
}

function watchEnd(listId, lineId) {
  const list = document.getElementById(listId);
  const line = document.getElementById(lineId);
  if (!list || !line) return;
  const check = () => {
    const atEnd = list.scrollHeight - list.clientHeight - list.scrollTop <= 2;
    const scrollable = list.scrollHeight > list.clientHeight + 2;
    line.classList.toggle("on", scrollable && atEnd);
  };
  list.addEventListener("scroll", check);
  setTimeout(check, 60);
  return check;
}

function buildPicker(rootId, items, getValue, onPick, searchable) {
  const root = document.getElementById(rootId);
  const btn = root.querySelector(".pickbtn");
  const val = root.querySelector(".pickval");
  const list = root.querySelector(".picklist");
  let search = null;
  if (searchable && !root.querySelector(".picksearch")) {
    search = document.createElement("input");
    search.className = "picksearch";
    search.type = "text";
    search.autocomplete = "off";
    const wrap = document.createElement("div");
    wrap.className = "searchwrap";
    const inner = document.createElement("div");
    inner.appendChild(search);
    wrap.appendChild(inner);
    list.parentNode.insertBefore(wrap, list);
    search.addEventListener("click", (e) => e.stopPropagation());
    search.addEventListener("keydown", (e) => e.stopPropagation());
  }
  let endLine = root.querySelector(".endline");
  if (!endLine) {
    endLine = document.createElement("div");
    endLine.className = "endline";
    root.appendChild(endLine);
  }
  const checkEnd = () => {
    const scrollable = list.scrollHeight > list.clientHeight + 2;
    const atEnd = list.scrollHeight - list.clientHeight - list.scrollTop <= 2;
    endLine.classList.toggle("on", scrollable && atEnd);
  };
  list.addEventListener("scroll", checkEnd);

  function paint(filter) {
    const cur = items.find(i => i.id === getValue()) || items[0];
    val.textContent = cur.label;
    if (search) search.placeholder = t("search");
    const q = (filter || "").trim().toLowerCase();
    const shown = q
      ? items.filter(i => i.label.toLowerCase().includes(q) ||
                          (i.sub || "").toLowerCase().includes(q) ||
                          (i.alt || "").toLowerCase().includes(q))
      : items;
    list.textContent = "";
    if (!shown.length) {
      const e = document.createElement("div");
      e.className = "pickempty";
      e.textContent = t("noMatch");
      list.appendChild(e);
      return;
    }
    for (const it of shown) {
      const d = document.createElement("div");
      d.className = "pickitem" + (it.id === getValue() ? " on" : "");
      const left = document.createElement("div");
      left.textContent = it.label;
      if (it.sub) {
        const s = document.createElement("div");
        s.className = "sub";
        s.textContent = it.sub;
        left.appendChild(s);
      }
      const tick = document.createElement("span");
      tick.className = "tick";
      tick.textContent = "\u2713";
      d.append(left, tick);
      d.addEventListener("click", (e) => {
        e.stopPropagation();
        root.classList.remove("open");
        onPick(it.id);
        paint();
      });
      list.appendChild(d);
    }
  }

  if (search) search.addEventListener("input", () => { paint(search.value); checkEnd(); });

  btn.addEventListener("click", (e) => {
    e.stopPropagation();
    const wasOpen = root.classList.contains("open");
    document.querySelectorAll(".pick.open").forEach(p => p.classList.remove("open"));
    if (!wasOpen) {
      root.classList.add("open");
      if (search) { search.value = ""; paint(""); setTimeout(() => search.focus(), 360); }
      setTimeout(checkEnd, 60);
    } else endLine.classList.remove("on");
  });
  list.addEventListener("click", (e) => e.stopPropagation());
  paint();
  return { paint };
}

document.addEventListener("click", () => {
  document.querySelectorAll(".pick.open").forEach(p => p.classList.remove("open"));
});

function fontFamilyFor(id) {
  const f = NUM_FONTS.find(x => x[0] === id) || NUM_FONTS[0];
  return f[2] ? '"CvtNum-' + f[0] + '", "CvtDisplay", monospace' : '"CvtDisplay", monospace';
}

function applyFont() {
  const fam = fontFamilyFor(state.numFont);
  document.getElementById("fontsample").style.fontFamily = fam;
  document.querySelectorAll("#pbar .pval").forEach(e => { e.style.fontFamily = fam; });
}

function showRate() {
  const box = document.getElementById("rateline");
  if (!box) return;
  chrome.storage.local.get("ratesCache", (s) => {
    const c = s && s.ratesCache;
    if (!c || !c.time) { box.textContent = ""; return; }

    const mins = Math.round((Date.now() - c.time) / 60000);
    let when;
    if (mins < 1)            when = t("justNow");
    else if (mins < 60)      when = t("minAgo").replace("{n}", mins);
    else if (mins < 48 * 60) when = t("hrAgo").replace("{n}", Math.round(mins / 60));
    else                     when = t("dayAgo").replace("{n}", Math.round(mins / 1440));

    box.textContent = t("updated") + " ";
    const b = document.createElement("b");
    b.textContent = when;
    box.appendChild(b);
  });
}

function withAlpha(value, a) {
  if (a >= 1) return value;
  return String(value).replace(/#([0-9a-f]{6})/gi, (m, hex) => {
    const n = parseInt(hex, 16);
    return "rgba(" + ((n >> 16) & 255) + "," + ((n >> 8) & 255) + "," + (n & 255) + "," + a.toFixed(3) + ")";
  });
}

function buildStars() {
  const el = document.getElementById("tipstars");
  if (!el) return;
  const W = 90, H = 40, N = 26;
  let dots = "";
  let seed = 7;
  const rnd = () => { seed = (seed * 1103515245 + 12345) % 2147483648; return seed / 2147483648; };
  for (let i = 0; i < N; i++) {
    const x = (rnd() * W).toFixed(1);
    const y = (rnd() * H).toFixed(1);
    const r = (0.35 + rnd() * 0.75).toFixed(2);
    const a = (0.35 + rnd() * 0.65).toFixed(2);
    dots += '<circle cx="' + x + '" cy="' + y + '" r="' + r + '" fill="#fff" opacity="' + a + '"/>';
  }
  const svg = '<svg xmlns="http://www.w3.org/2000/svg" width="' + W + '" height="' + H + '">' + dots + '</svg>';
  el.style.backgroundImage = 'url("data:image/svg+xml,' + encodeURIComponent(svg) + '")';
}

function applyPower() {
  const btn = document.getElementById("power");
  const st = document.getElementById("lbl-state");
  if (!btn) return;
  btn.classList.toggle("on", state.enabled);
  btn.classList.toggle("off", !state.enabled);
  btn.setAttribute("aria-checked", String(state.enabled));
  const word = state.enabled ? t("onWord") : t("offWord");
  if (st) st.textContent = word;

  document.querySelectorAll(".sec").forEach(sec => {
    if (sec.classList.contains("powersec")) return;
    sec.classList.toggle("offdim", !state.enabled);
  });
}

function applyPageTheme() {
  const th = THEMES[state.theme] || THEMES.blue;
  const r = document.documentElement.style;
  r.setProperty("--o-edge", th.edge);
  r.setProperty("--o-bg", th.barBg);
  r.setProperty("--o-card", th.dropBg);
  r.setProperty("--o-border", th.dropBorder);
  r.setProperty("--o-line", th.slotLine);
  r.setProperty("--o-label", th.label_);
  r.setProperty("--o-value", th.value);
  r.setProperty("--o-muted", th.muted);
  r.setProperty("--o-accent", th.accent);
  r.setProperty("--o-accent2", th.accent2);
  r.setProperty("--o-hover", th.rowHover);
  r.setProperty("--o-srcBg", th.srcBg);
  r.setProperty("--o-srcLine", th.srcLine);
  r.setProperty("--o-srcText", th.srcText);
  r.setProperty("--o-srcLabel", th.srcLabel);
  r.setProperty("--o-xHover", th.xHover);
  const px = th.px || [];
  const ramp = th.pwr || [th.xHover || th.accent2, th.accent2, th.accent, px[7] || th.accent];
  r.setProperty("--pwr-1", ramp[0]);
  r.setProperty("--pwr-2", ramp[1]);
  r.setProperty("--pwr-3", ramp[2]);
  r.setProperty("--pwr-4", ramp[3]);
  r.setProperty("--pwr-halo", withAlpha(ramp[1], 0.42));
  r.setProperty("--pwr-halo2", withAlpha(ramp[3], 0.34));
  r.setProperty("--o-glow", withAlpha(th.accent, 0.55));
  r.setProperty("--o-glowSoft", withAlpha(th.accent, 0.30));
  const p = th.px || [];
  r.setProperty("--o-onTrack", "linear-gradient(90deg," + (p[7] || th.accent2) + "," + (p[4] || th.accent) + ")");
  r.setProperty("--o-offTrack", th.chipBorder || "#242a44");
  r.setProperty("--o-innerGlow", withAlpha(p[0] || th.value, 0.55));
  r.setProperty("--o-tipA", withAlpha(p[5] || th.accent2, 0.85));
  r.setProperty("--o-tipB", withAlpha(p[7] || th.accent, 0.85));
  r.setProperty("--o-tipText", "#ffffff");
  r.setProperty("--o-tipBase", withAlpha(p[7] || th.accent2, 0.9));
  r.setProperty("--o-tipBase2", withAlpha(p[8] || th.accent2, 0.9));
  r.setProperty("--o-tipEdge", th.accent);
  r.setProperty("--o-thumb", withAlpha(th.label_, 0.45));
  r.setProperty("--o-thumbHi", withAlpha(th.value, 0.6));
  r.setProperty("--o-tipIdle", state.theme === "light" ? "#3f4a68" : "#9aa6cf");
  r.setProperty("--o-knobOn",
    "radial-gradient(circle at 32% 28%," + (p[1] || "#7fd4ff") + "," + (p[5] || th.accent2) + ")");
  r.setProperty("--o-knobOff",
    "radial-gradient(circle at 32% 28%," + (th.label_ || "#4a5375") + "," + (th.chipBg || "#232840") + ")");
  const pale = state.theme === "light";
  r.setProperty("--o-ridge",   pale ? "rgba(0,0,0,.42)" : "rgba(255,255,255,.55)");
  r.setProperty("--o-ridgeHi", pale ? "rgba(0,0,0,.62)" : "rgba(255,255,255,.8)");
}

const PREV_SYM = { USD:"$", EUR:"\u20ac", GBP:"\u00a3", JPY:"\u00a5", ILS:"\u20aa", INR:"\u20b9",
                   CHF:"CHF", CAD:"C$", AUD:"A$", SEK:"kr", NOK:"kr", PLN:"z\u0142" };
const PREV_RATE = { EUR:0.862, GBP:0.744, JPY:151.2, ILS:3.72, INR:88.4, CHF:0.79,
                    CAD:1.36, AUD:1.49, SEK:9.6, NOK:10.4, PLN:3.9 };

function redraw() {
  renderPreview();
  previewFitLater();
  applyTheme();
  applyScale();
  applyFont();
  showRate();
}

function renderPreview() {
  const inner = document.getElementById("pinner");
  if (!inner) return;
  inner.textContent = "";
  const amount = 24.59;

  const slot = (label, value, isSrc) => {
    const d = document.createElement("div");
    d.className = "pslot" + (isSrc ? " psrc" : "");
    const top = document.createElement("div");
    top.className = "ptop";
    const l = document.createElement("span");
    l.className = "plbl";
    l.textContent = label;
    const c = document.createElement("span");
    c.className = "pcar";
    const svg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
    svg.setAttribute("viewBox", "0 0 24 24");
    const path = document.createElementNS("http://www.w3.org/2000/svg", "path");
    path.setAttribute("d", "M12 2.6 22.4 13h-5.9v8.4h-9V13H1.6z");
    path.setAttribute("fill", "currentColor");
    svg.appendChild(path);
    c.appendChild(svg);
    top.append(l, c);
    const v = document.createElement("div");
    v.className = "pval";
    v.textContent = value;
    d.append(top, v);
    return d;
  };

  for (const code of state.targets) {
    const rate = PREV_RATE[code] || 1;
    const sym = PREV_SYM[code] || (code + " ");
    const raw = (PREV_SYM[code] || "").trim();
    const label = raw ? raw + " " + code : code;
    inner.appendChild(slot(label,
      sym + (amount * rate).toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 }), false));
  }
  const s = state.sourceFallback;
  inner.appendChild(slot(t("from"), (PREV_SYM[s] || "") + " " + s, true));
}

function applyTheme() {
  const th = THEMES[state.theme] || THEMES.blue;
  const o = Math.max(0, Math.min(100, state.opacity)) / 100;
  const bgA = 0.06 + 0.94 * o;
  const bar = document.getElementById("pbar");
  bar.style.background = withAlpha(th.barBg, bgA);
  bar.style.backdropFilter = "blur(" + ((1 - o) * 22).toFixed(1) + "px) saturate(1.35)";
  bar.style.borderColor = th.barBorder;
  bar.querySelector(".pedge").style.background = th.edge;
  bar.querySelectorAll(".pslot").forEach(s => {
    const src = s.classList.contains("psrc");
    s.style.background = withAlpha(src ? th.srcBg : th.slotBg, bgA);
    s.style.borderRightColor = th.slotLine;
    if (src) s.style.borderLeft = "1px solid " + th.srcLine;
    s.querySelector(".plbl").style.color = src ? th.srcLabel : th.label_;
    s.querySelector(".pcar").style.color = src ? th.srcLabel : (th.arrow || th.value);
    s.querySelector(".pval").style.color = src ? th.srcText : th.value;
  });
  document.querySelectorAll(".theme").forEach(el => {
    el.classList.toggle("on", el.dataset.theme === state.theme);
  });
  applyPageTheme();
}

function renderThemes() {
  const box = document.getElementById("themes");
  box.textContent = "";
  for (const [id, label] of THEME_LIST) {
    const th = THEMES[id];
    const d = document.createElement("div");
    d.className = "theme" + (id === state.theme ? " on" : "");
    d.dataset.theme = id;
    const sw = document.createElement("div");
    sw.className = "swatch";
    sw.style.background = th.swatch || th.edge;
    const sp = document.createElement("span");
    sp.textContent = label;
    d.append(sw, sp);
    d.addEventListener("click", () => {
      pixelBurst(d, id);
      state.theme = id;
      chrome.storage.sync.set({ theme: id });
      setTimeout(applyTheme, 120);
    });
    box.appendChild(d);
  }
}

chrome.storage.sync.get(["enabled", "lang", "scale", "theme", "opacity", "numFont", "targets", "sourceFallback", "guideSeen", "calcFrom", "calcTo"], (s) => {
  if (typeof s.enabled === "boolean") state.enabled = s.enabled;
  if (s.lang) state.lang = s.lang;
  if (s.scale) state.scale = s.scale;
  if (s.theme && THEMES[s.theme]) state.theme = s.theme;
  if (typeof s.opacity === "number") state.opacity = s.opacity;
  if (s.numFont) state.numFont = s.numFont;
  if (s.calcFrom) state.calcFrom = s.calcFrom;
  if (s.calcTo) state.calcTo = s.calcTo;
  if (Array.isArray(s.targets) && s.targets.length) state.targets = s.targets;
  if (s.sourceFallback) state.sourceFallback = s.sourceFallback;

  buildPicker("langPick", LANGS.map(([id, label]) => ({ id, label })),
    () => state.lang,
    (id) => {
      state.lang = id;
      chrome.storage.sync.set({ lang: id });
      applyLanguage();
      applyPower();
          showRate();
    });

  buildPicker("fontPick", NUM_FONTS.map(f => ({
      id: f[0], label: f[1], sub: f[3] + "/18 currency symbols"
    })),
    () => state.numFont,
    (id) => {
      state.numFont = id;
      chrome.storage.sync.set({ numFont: id });
      applyFont();
    });

  const size = document.getElementById("size");
  size.value = String(state.scale);
  setPct("pct-size", state.scale, 50, 160);
  if (placeSize) placeSize();
  size.addEventListener("input", () => {
    state.scale = Number(size.value);
    setPct("pct-size", state.scale, 50, 160);
  if (placeSize) placeSize();
    applyScale();
  });
  size.addEventListener("change", () => {
    chrome.storage.sync.set({ scale: state.scale });
  });

  const op = document.getElementById("opacity");
  op.value = String(state.opacity);
  setPct("pct-op", state.opacity, 10, 100);
  if (placeOp) placeOp();
  op.addEventListener("input", () => {
    state.opacity = Number(op.value);
    setPct("pct-op", state.opacity, 10, 100);
  if (placeOp) placeOp();
    applyTheme();
  });
  op.addEventListener("change", () => { chrome.storage.sync.set({ opacity: state.opacity }); });


  on("refresh", "click", () => {
    const btn = document.getElementById("refresh");
    btn.disabled = true;
    btn.classList.add("busy");
    chrome.runtime.sendMessage(
      { type: "convert", amount: 1, from: "USD", targets: ["ILS"], force: true },
      () => { btn.disabled = false; btn.classList.remove("busy"); showRate(); }
    );
  });

  const calcItems = CURRENCIES.map(c => ({
    id: c[0], label: c[0],
    sub: NAMES.en[c[0]] || "",
    alt: (NAMES[state.lang] && NAMES[state.lang][c[0]]) || ""
  }));
  const cf = buildPicker("calcFromPick", calcItems, () => state.calcFrom, (id) => {
    state.calcFrom = id;
    chrome.storage.sync.set({ calcFrom: id });
    runCalc();
  }, true);
  const ct = buildPicker("calcToPick", calcItems, () => state.calcTo, (id) => {
    state.calcTo = id;
    chrome.storage.sync.set({ calcTo: id });
    runCalc();
  }, true);
  const amt = document.getElementById("calcAmt");
  if (amt) {
    amt.addEventListener("input", () => { sanitizeAmount(amt); calcSoon(); });
    amt.addEventListener("paste", (e) => {
      e.preventDefault();
      const txt = (e.clipboardData || window.clipboardData).getData("text") || "";
      const start = amt.selectionStart, end = amt.selectionEnd;
      amt.value = amt.value.slice(0, start) + txt + amt.value.slice(end);
      sanitizeAmount(amt);
      calcSoon();
    });
    amt.addEventListener("keydown", (e) => {
      if (e.ctrlKey || e.metaKey || e.altKey) return;
      const allow = ["Backspace","Delete","Tab","Escape","Enter","Home","End",
                     "ArrowLeft","ArrowRight","ArrowUp","ArrowDown"];
      if (allow.includes(e.key)) return;
      if (!/^[0-9.,]$/.test(e.key)) e.preventDefault();
    });
  }
  const sw = document.getElementById("calcSwap");
  if (sw) sw.addEventListener("click", () => {
    const a = state.calcFrom;
    state.calcFrom = state.calcTo;
    state.calcTo = a;
    chrome.storage.sync.set({ calcFrom: state.calcFrom, calcTo: state.calcTo });
    cf.paint(); ct.paint();
    runCalc();
  });

  const srcItems = CURRENCIES.map(c => ({
    id: c[0], label: c[0],
    sub: NAMES.en[c[0]] || "",
    alt: (NAMES[state.lang] && NAMES[state.lang][c[0]]) || ""
  }));
  const srcPicker = buildPicker("srcPick", srcItems, () => state.sourceFallback, (id) => {
    state.sourceFallback = id;
    chrome.storage.sync.set({ sourceFallback: id });
    redraw();
  }, true);

  placeSize = wireSlider("size");
  placeOp = wireSlider("opacity");

  const power = document.getElementById("power");
  if (power) {
    power.addEventListener("click", () => {
      power.classList.add("pressing");
      setTimeout(() => {
        state.enabled = !state.enabled;
        chrome.storage.sync.set({ enabled: state.enabled });
        applyPower();
        power.classList.remove("pressing");
      }, 190);
    });
  }

  on("tournext", "click", () => {
    if (tIndex >= tourSteps().length - 1) closeTour();
    else { tIndex++; renderTour(); }
  });
  on("tourback", "click", () => { tIndex--; renderTour(); });
  on("tourskip", "click", closeTour);
  on("helpbtn", "click", openTour);
  window.addEventListener("resize", () => {
    const tr = document.getElementById("tour");
    if (tr && !tr.hidden) placeTour();
  });

  buildStars();
  applyLanguage();
  applyPower();
  applyScale();
  renderPreview();
  applyFont();
  previewFitLater();
  renderThemes();
  applyTheme();
  showRate();

  runCalc();

  if (!s.guideSeen) setTimeout(openTour, 260);
});
