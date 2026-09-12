

(function () {
  let targets = ["EUR", "GBP"];
  let sourceFallback = "USD";
  let favs = ["USD", "EUR", "GBP", "CAD"];
  let lang = "en";
  let scale = 50;
  let theme = "blue";
  let opacity = 19;
  let numFont = "inter";
  let enabled = true;
  let selfWrite = null;

  function saveOwn(obj) {
    if (!selfWrite) selfWrite = new Set();
    Object.keys(obj).forEach(k => selfWrite.add(k));
    chrome.storage.sync.set(obj);
    setTimeout(() => { selfWrite = null; }, 400);
  }

  const t = (k) => (UI[lang] && UI[lang][k]) || UI.en[k];
  const nameEn = (code) => NAMES.en[code] || code;
  const nameLocal = (code) => (NAMES[lang] && NAMES[lang][code]) || "";

  chrome.storage.sync.get(["targets", "sourceFallback", "favs", "enabled", "lang", "scale", "theme", "opacity", "numFont"], (s) => {
    if (s.lang) lang = s.lang;
    if (s.scale) scale = s.scale;
    if (s.theme && THEMES[s.theme]) theme = s.theme;
    if (typeof s.opacity === "number") opacity = s.opacity;
    if (s.numFont) numFont = s.numFont;
    if (typeof s.enabled === "boolean") enabled = s.enabled;
    if (Array.isArray(s.targets) && s.targets.length) targets = s.targets.slice(0, 6);
    if (s.sourceFallback) sourceFallback = s.sourceFallback;
    if (Array.isArray(s.favs)) favs = s.favs;
  });

  const IS_OPERA = (function () {
    const ua = navigator.userAgent || "";
    if (/\bOPR\/|\bOpera\b|\bOPT\//.test(ua)) return true;
    const brands = (navigator.userAgentData && navigator.userAgentData.brands) || [];
    return brands.some(b => /opera/i.test(b.brand || ""));
  })();

  let root = null, current = null, openSlot = null, anchor = null;
  let insidePanel = false;
  let shown = {};
  const MAX_TARGETS = 6;

  const byCode = {};
  for (const c of CURRENCIES) byCode[c[0]] = c;

  const flagUrl = (cc) => "https://flagcdn.com/w80/" + cc + ".png";
  const symOf = (c) => SYMBOLS[c] || (c + " ");
  const el = (tag, cls) => { const e = document.createElement(tag); if (cls) e.className = cls; return e; };

  function normalizeNumber(s) {
    s = s.replace(/[^\d.,]/g, "");
    if (!s) return null;
    const d = (s.match(/\./g) || []).length, c = (s.match(/,/g) || []).length;
    if (d && c) {
      if (s.lastIndexOf(",") > s.lastIndexOf(".")) s = s.replace(/\./g, "").replace(",", ".");
      else s = s.replace(/,/g, "");
    } else if (c === 1) {
      s = (s.split(",")[1].length <= 2) ? s.replace(",", ".") : s.replace(/,/g, "");
    } else if (c > 1) { s = s.replace(/,/g, ""); }
    else if (d > 1) { s = s.replace(/\./g, ""); }
    const n = parseFloat(s);
    return isNaN(n) ? null : n;
  }

  const CODES = new Set(CURRENCIES.map(c => c[0]).concat(["NIS"]));

  function parsePrice(raw) {
    if (!raw) return null;
    const text = raw.trim();
    if (!text || text.length > 60) return null;

    const numMatch = text.match(/\d[\d.,\s]*\d|\d/);
    if (!numMatch) return null;
    const amount = normalizeNumber(numMatch[0].replace(/\s/g, ""));
    if (amount === null) return null;

    let rest = text.slice(0, numMatch.index) + " " + text.slice(numMatch.index + numMatch[0].length);

    let currency = null;
    for (const [sy, cc] of DETECT_SYMBOLS) {
      if (rest.includes(sy)) { if (!currency) currency = cc; rest = rest.split(sy).join(" "); }
    }

    rest = rest.replace(/[.,:;()\[\]\-\u2013\u2014+*/\\|~"'`]/g, " ");

    for (const w of rest.split(/\s+/).filter(Boolean)) {
      const up = w.toUpperCase(), low = w.toLowerCase();
      if (CODES.has(up)) { if (!currency) currency = (up === "NIS" ? "ILS" : up); continue; }
      if (WORDS[low])    { if (!currency) currency = WORDS[low]; continue; }
      return null;
    }

    const detected = !!currency;
    if (!currency) currency = sourceFallback;
    return { amount, currency, detected };
  }

  const fmt = (n) => n.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

  const WORD_INDEX = (function () {
    const m = {};
    for (const w in WORDS) {
      const code = WORDS[w];
      (m[code] || (m[code] = [])).push(w);
    }
    return m;
  })();

  function matches(code, q) {
    if (!q) return true;
    if (code.toLowerCase().includes(q)) return true;
    if (nameEn(code).toLowerCase().includes(q)) return true;
    if (nameLocal(code).toLowerCase().includes(q)) return true;
    const words = WORD_INDEX[code];
    if (words) {
      for (const w of words) if (w.includes(q)) return true;
    }
    return false;
  }

  function withPanelAlpha(hex, a) {
    const m = /^#?([0-9a-f]{6})$/i.exec(hex || "");
    if (!m) return hex;
    const n = parseInt(m[1], 16);
    return "rgba(" + ((n >> 16) & 255) + "," + ((n >> 8) & 255) + "," + (n & 255) + "," + a + ")";
  }

  function lighten(hex, amt) {
    const m = /^#?([0-9a-f]{6})$/i.exec(hex || "");
    if (!m) return hex;
    const n = parseInt(m[1], 16);
    const r = Math.min(255, Math.round(((n >> 16) & 255) + (255 - ((n >> 16) & 255)) * amt));
    const g = Math.min(255, Math.round(((n >> 8) & 255) + (255 - ((n >> 8) & 255)) * amt));
    const b = Math.min(255, Math.round((n & 255) + (255 - (n & 255)) * amt));
    return "#" + ((1 << 24) | (r << 16) | (g << 8) | b).toString(16).slice(1);
  }

  function bookmarkSVG(filled) {
    const NS = "http://www.w3.org/2000/svg";
    const s = document.createElementNS(NS, "svg");
    s.setAttribute("viewBox", "0 0 24 24");
    s.setAttribute("class", "cvt-bm");
    const p = document.createElementNS(NS, "path");
    p.setAttribute("d", "M6.5 3.2h11a1.3 1.3 0 0 1 1.3 1.3v16.1l-6.8-4.4-6.8 4.4V4.5a1.3 1.3 0 0 1 1.3-1.3z");
    p.setAttribute("fill", filled ? "currentColor" : "none");
    p.setAttribute("stroke", "currentColor");
    p.setAttribute("stroke-width", "1.7");
    p.setAttribute("stroke-linejoin", "round");
    s.appendChild(p);
    return s;
  }

  function arrowSVG() {
    const NS = "http://www.w3.org/2000/svg";
    const s = document.createElementNS(NS, "svg");
    s.setAttribute("viewBox", "0 0 24 24");
    s.setAttribute("class", "cvt-arrow");
    const p = document.createElementNS(NS, "path");
    p.setAttribute("d", "M12 2.6 22.4 13h-5.9v8.4h-9V13H1.6z");
    p.setAttribute("fill", "currentColor");
    s.appendChild(p);
    return s;
  }

  function buildDrop(slotKey) {
    const drop = el("div", "cvt-drop");

    const head = el("div", "cvt-dhead");
    const title = el("div", "cvt-dtitle");
    title.textContent = slotKey === "src" ? t("pickBase") : t("pick");
    const x = el("div", "cvt-x");
    x.textContent = "\u2715";
    x.addEventListener("click", (e) => { e.stopPropagation(); closeDrop(); });
    head.append(title, x);

    const sw = el("div", "cvt-searchwrap");
    const mag = el("div", "cvt-mag");
    const input = el("input", "cvt-search");
    input.type = "text";
    input.placeholder = t("search");
    sw.append(mag, input);

    const favLbl = el("div", "cvt-favlbl");
    favLbl.textContent = "";
    const lblIcon = bookmarkSVG(true);
    lblIcon.setAttribute("class", "cvt-bm cvt-bmlbl");
    favLbl.appendChild(lblIcon);
    favLbl.appendChild(document.createTextNode(" " + t("favs")));
    const favRow = el("div", "cvt-favrow");
    const list = el("div", "cvt-list");

    const endLine = el("div", "cvt-endline");
    drop.append(head, sw, favLbl, favRow, list, endLine);

    const checkEnd = () => {
      const scrollable = list.scrollHeight > list.clientHeight + 2;
      const atEnd = list.scrollHeight - list.clientHeight - list.scrollTop <= 2;
      endLine.classList.toggle("cvt-on", scrollable && atEnd);
    };
    list.addEventListener("scroll", checkEnd);
    drop._checkEnd = checkEnd;
    drop._input = input; drop._favRow = favRow; drop._list = list; drop._key = slotKey;

    input.addEventListener("input", () => {
      const topBefore = drop.getBoundingClientRect().top;
      const rootTop = root.getBoundingClientRect().top;
      fillList(drop, input.value);
      drop.style.bottom = "auto";
      drop.style.top = Math.round(topBefore - rootTop) + "px";
      const r = drop.getBoundingClientRect();
      const over = r.bottom - (window.innerHeight - 8);
      const list = drop._list;
      if (over > 0 && list) {
        const cap = list.getBoundingClientRect().height - over;
        list.style.maxHeight = Math.max(90, Math.round(cap)) + "px";
      }
      if (drop._checkEnd) drop._checkEnd();
    });
    input.addEventListener("keydown", (e) => {
      e.stopPropagation();
      if (e.key === "Escape") closeDrop();
    });
    drop.addEventListener("click", (e) => e.stopPropagation());
    return drop;
  }

  const PX_STEP = 7;
  const PX_SIZE = 3;
  const PX_LIFE = 620;

  const pxShades = () => (THEMES[theme] || THEMES.blue).px;

  function pixelBurst(row) {
    const w = row.clientWidth, h = row.clientHeight;
    if (!w || !h) return;

    const cols = Math.floor(w / PX_STEP);
    const rows = Math.floor(h / PX_STEP);
    if (cols < 2 || rows < 2) return;

    const frag = document.createDocumentFragment();
    const maxDepth = Math.min(cols, rows) / 2;

    for (let cx = 0; cx < cols; cx++) {
      for (let cy = 0; cy < rows; cy++) {

        const depth = Math.min(cx, cols - 1 - cx, cy, rows - 1 - cy);
        const t = Math.min(1, depth / maxDepth);

        let peak = Math.pow(1 - t, 3.4);
        const cornerX = Math.min(cx, cols - 1 - cx) / (cols / 2);
        const cornerY = Math.min(cy, rows - 1 - cy) / (rows / 2);
        const corner = 1 - Math.min(1, Math.hypot(cornerX, cornerY));
        peak = Math.min(1, peak + corner * 0.65);

        if (peak < 0.16) continue;
        if (Math.random() > 0.55 + peak * 0.45) continue;

        const p = el("div", "cvt-px");
        const size = PX_SIZE + (peak > 0.7 ? 1 : 0);
        p.style.width = size + "px";
        p.style.height = size + "px";
        p.style.left = Math.round(cx * PX_STEP + (PX_STEP - size) / 2) + "px";
        p.style.top = Math.round(cy * PX_STEP + (PX_STEP - size) / 2) + "px";

        const SH = pxShades();
        let si = Math.round((1 - t) * (SH.length - 1) + (Math.random() * 2.4 - 1.2));
        si = Math.max(0, Math.min(SH.length - 1, si));
        p.style.background = SH[si];
        p.style.setProperty("--peak", (0.25 + peak * 0.75).toFixed(2));

        const delay = (1 - t) * 190 + Math.random() * 60;
        p.style.animation = "cvtPixelGrid " + (PX_LIFE - delay) + "ms ease-out " + delay.toFixed(0) + "ms forwards";
        frag.appendChild(p);
      }
    }

    row.appendChild(frag);
    row.classList.add("cvt-burst");
    setTimeout(() => {
      row.querySelectorAll(".cvt-px").forEach(n => n.remove());
      row.classList.remove("cvt-burst");
    }, PX_LIFE + 80);
  }

  let denyTimer = null;

  function denyFlash(dupIndex, row) {
    const slot = root && root.querySelector('.cvt-slot[data-key="' + dupIndex + '"]');

    if (denyTimer) { clearTimeout(denyTimer); denyTimer = null; }
    if (slot) {
      slot.classList.remove("cvt-deny");
      void slot.offsetWidth;
      slot.classList.add("cvt-deny");
    }
    if (row) {
      row.classList.remove("cvt-denyrow");
      void row.offsetWidth;
      row.classList.add("cvt-denyrow");
    }
    denyTimer = setTimeout(() => {
      if (slot) slot.classList.remove("cvt-deny");
      if (row) row.classList.remove("cvt-denyrow");
      denyTimer = null;
    }, 1000);
  }

  const codeOf = (key) => key === "src" ? sourceFallback : targets[key];

  function choose(key, code, row) {

    if (key !== "src") {
      const dup = targets.indexOf(code);
      if (dup !== -1 && dup !== key) { denyFlash(dup, row); return; }
    }
    if (row) {
      pixelBurst(row);
      setTimeout(() => applyChoice(key, code), 470);
      return;
    }
    applyChoice(key, code);
  }

  function applyChoice(key, code) {
    if (key === "src") {
      sourceFallback = code;
      shown = {};
      saveOwn({ sourceFallback: code });
      if (current) { current.currency = code; current.detected = false; }
    } else {
      targets[key] = code;
      delete shown[key];
      saveOwn({ targets: targets.slice() });
    }
    closeDrop();
    render();
    convert();
  }

  function toggleFav(code) {
    const i = favs.indexOf(code);
    if (i >= 0) favs.splice(i, 1); else favs.push(code);
    saveOwn({ favs: favs.slice() });
  }

  function favsChanged(drop) {
    const list = drop.querySelector(".cvt-list");
    const keepScroll = list ? list.scrollTop : 0;
    const topBefore = drop.getBoundingClientRect().top;
    const rootTop = root.getBoundingClientRect().top;
    drop.style.bottom = "auto";
    drop.style.top = Math.round(topBefore - rootTop) + "px";

    fillFavs(drop);

    if (list) list.scrollTop = keepScroll;
    const r = drop.getBoundingClientRect();
    const over = r.bottom - (window.innerHeight - 8);
    if (over > 0 && list) {
      const cap = list.getBoundingClientRect().height - over;
      list.style.maxHeight = Math.max(90, Math.round(cap)) + "px";
    }
    if (drop._checkEnd) drop._checkEnd();
  }

  function fillFavs(drop) {
    const row = drop._favRow;
    row.textContent = "";
    if (!favs.length) { drop.querySelector(".cvt-favlbl").style.display = "none"; return; }
    drop.querySelector(".cvt-favlbl").style.display = "";
    for (const code of favs) {
      const c = byCode[code];
      if (!c) continue;
      const chip = el("div", "cvt-chip");
      const img = el("img", "cvt-flag");
      img.style.width = "18px"; img.style.height = "18px"; img.style.borderRadius = "4px";
      img.src = flagUrl(c[1]);
      img.onerror = () => { img.classList.add("cvt-flag-off"); };
      const sp = el("span");
      sp.textContent = code;
      chip.append(img, sp);
      chip.addEventListener("click", (e) => { e.stopPropagation(); choose(drop._key, code); });
      row.appendChild(chip);
    }
  }

  function fillList(drop, filter) {
    const list = drop._list;
    const q = (filter || "").trim().toLowerCase();
    const cur = codeOf(drop._key);

    let rows = CURRENCIES.filter(c => matches(c[0], q));

    rows = rows.filter(c => c[0] !== cur);
    if (byCode[cur] && matches(cur, q)) {
      rows.unshift(byCode[cur]);
    }

    list.textContent = "";
    if (!rows.length) {
      const e = el("div", "cvt-empty");
      e.textContent = t("noMatch");
      list.appendChild(e);
      return;
    }

    const makeRow = (c) => {
      const isCur = c[0] === cur;
      const row = el("div", "cvt-row" + (isCur ? " cvt-cur" : ""));

      const img = el("img", "cvt-flag");
      img.src = flagUrl(c[1]);
      img.alt = "";
      img.loading = "lazy";
      img.onerror = () => { img.classList.add("cvt-flag-off"); };

      const txt = el("div", "cvt-rtxt");
      const code = el("div", "cvt-rcode");
      code.textContent = c[0];
      const name = el("div", "cvt-rname");
      name.textContent = nameEn(c[0]);
      txt.append(code, name);
      const loc = nameLocal(c[0]);
      if (loc && loc !== nameEn(c[0])) {
        const sub = el("div", "cvt-rlocal");
        sub.textContent = loc;
        txt.appendChild(sub);
      }

      row.append(img, txt);

      if (isCur) {
        const tag = el("div", "cvt-cur-tag");
        tag.textContent = t("current");
        row.appendChild(tag);
      }

      const star = el("div", "cvt-star" + (favs.includes(c[0]) ? " cvt-fav" : ""));
      star.appendChild(bookmarkSVG(favs.includes(c[0])));
      star.title = t("favs");
      star.addEventListener("click", (e) => {
        e.stopPropagation();
        toggleFav(c[0]);
        const on = favs.includes(c[0]);
        star.classList.toggle("cvt-fav", on);
        star.textContent = "";
        star.appendChild(bookmarkSVG(on));
        favsChanged(drop);
      });
      row.appendChild(star);

      row.addEventListener("click", (ev) => choose(drop._key, c[0], row, ev));
      return row;
    };

    const FIRST = 14;
    const head = document.createDocumentFragment();
    for (let i = 0; i < Math.min(FIRST, rows.length); i++) head.appendChild(makeRow(rows[i]));
    list.appendChild(head);

    if (drop._fillTimer) { cancelAnimationFrame(drop._fillTimer); drop._fillTimer = null; }
    if (rows.length > FIRST) {
      let i = FIRST;
      const step = () => {
        const frag = document.createDocumentFragment();
        const stop = Math.min(i + 30, rows.length);
        for (; i < stop; i++) frag.appendChild(makeRow(rows[i]));
        list.appendChild(frag);
        if (i < rows.length) drop._fillTimer = requestAnimationFrame(step);
        else { drop._fillTimer = null; if (drop._checkEnd) drop._checkEnd(); }
      };
      drop._fillTimer = requestAnimationFrame(step);
    }

  }

  function withAlpha(value, a) {
    if (a >= 1) return value;
    return String(value).replace(/#([0-9a-f]{6})/gi, (m, hex) => {
      const n = parseInt(hex, 16);
      return "rgba(" + ((n >> 16) & 255) + "," + ((n >> 8) & 255) + "," + (n & 255) + "," + a.toFixed(3) + ")";
    });
  }

  function applyTheme() {
    if (!root) return;
    const th = THEMES[theme] || THEMES.blue;
    const o = Math.max(0, Math.min(100, opacity)) / 100;
    const bgA = 0.06 + 0.94 * o;
    const blur = (1 - o) * 22;
    root.style.setProperty("--cvt-blur", blur.toFixed(1) + "px");
    root.style.setProperty("--cvt-glass", (1 - o).toFixed(3));
    root.style.setProperty("--cvt-peekBg", withAlpha(th.barBg, 0.06));
    root.classList.toggle("cvt-peek", opacity < 20);
    root.style.setProperty("--cvt-edge", th.edge);
    root.style.setProperty("--cvt-edgeTop", th.accent2 || th.accent);
    root.style.setProperty("--cvt-barBg", withAlpha(th.barBg, bgA));
    root.style.setProperty("--cvt-barBorder", th.barBorder);
    root.style.setProperty("--cvt-slotLine", th.slotLine);
    root.style.setProperty("--cvt-slotBg", withAlpha(th.slotBg, bgA));
    root.style.setProperty("--cvt-srcBg", withAlpha(th.srcBg, bgA));
    root.style.setProperty("--cvt-srcLine", th.srcLine);
    root.style.setProperty("--cvt-srcText", th.srcText);
    root.style.setProperty("--cvt-srcLabel", th.srcLabel);
    root.style.setProperty("--cvt-label", th.label_);
    root.style.setProperty("--cvt-labelStrong", th.labelStrong || lighten(th.label_, 0.30));
    root.style.setProperty("--cvt-menuText", lighten(th.label_, 0.55));
    root.style.setProperty("--cvt-menuDim", lighten(th.label_, 0.34));
    root.style.setProperty("--cvt-thumb", withPanelAlpha(th.label_, 0.45));
    root.style.setProperty("--cvt-thumbHi", withPanelAlpha(lighten(th.label_, 0.35), 0.75));
    root.style.setProperty("--cvt-arrowCol", th.arrow || th.value);
    root.style.setProperty("--cvt-value", th.value);
    root.style.setProperty("--cvt-muted", th.muted);
    root.style.setProperty("--cvt-accent", th.accent);
    root.style.setProperty("--cvt-accent2", th.accent2);
    root.style.setProperty("--cvt-dropBg", withAlpha(th.dropBg, Math.min(1, bgA + 0.10)));
    root.style.setProperty("--cvt-dropBorder", th.dropBorder);
    root.style.setProperty("--cvt-rowHover", withAlpha(th.rowHover, bgA));
    root.style.setProperty("--cvt-rowCur", withAlpha(th.rowCur, bgA));
    root.style.setProperty("--cvt-chipBg", withAlpha(th.chipBg, bgA));
    root.style.setProperty("--cvt-chipBorder", th.chipBorder);
    root.style.setProperty("--cvt-star", th.star);
    root.style.setProperty("--cvt-xHover", th.xHover);
    const pale = theme === "light";
    root.style.setProperty("--cvt-ridge",   pale ? "rgba(0,0,0,.42)" : "rgba(255,255,255,.55)");
    root.style.setProperty("--cvt-ridgeHi", pale ? "rgba(0,0,0,.62)" : "rgba(255,255,255,.8)");
    th.flash.forEach((v, i) => root.style.setProperty("--cvt-flash" + i, v));
  }

  function applyScale() {
    if (!root) return;
    const f = scale / 100;
    const px = (n, floor) => (Math.round(Math.max(floor === undefined ? 0 : floor, n * f) * 100) / 100) + "px";
    root.style.setProperty("--cvt-lbl",  px(11.5, 8));
    root.style.setProperty("--cvt-val",  px(19));
    root.style.setProperty("--cvt-wait", px(15));
    root.style.setProperty("--cvt-car",  px(18, 13));
    root.style.setProperty("--cvt-padv", px(7));
    root.style.setProperty("--cvt-padh", px(12));
    root.style.setProperty("--cvt-padb", px(9));
    root.style.setProperty("--cvt-minw", px(95));
    root.style.setProperty("--cvt-x",    px(14, 10));
  }

  function injectFont() {
    if (document.getElementById("cvt-font-style")) return;
    const s = document.createElement("style");
    s.id = "cvt-font-style";
    let css =
      '@font-face{font-family:"CvtDisplay";src:url("' + chrome.runtime.getURL("fonts/orbitron-400.woff2") + '") format("woff2");font-weight:400;font-display:block;}' +
      '@font-face{font-family:"CvtDisplay";src:url("' + chrome.runtime.getURL("fonts/orbitron-700.woff2") + '") format("woff2");font-weight:700;font-display:block;}';
    for (const sub of ["hebrew", "latin", "latin-ext"]) {
      for (const w of [400, 700]) {
        css += '@font-face{font-family:"CvtUI";src:url("' +
               chrome.runtime.getURL("fonts/heebo-" + sub + "-" + w + ".woff2") +
               '") format("woff2");font-weight:' + w + ';font-display:swap;}';
      }
    }
    for (const f of NUM_FONTS) {
      if (!f[2]) continue;
      for (const sub of ["latin", "latin-ext"]) {
        css += '@font-face{font-family:"CvtNum-' + f[0] + '";src:url("' +
               chrome.runtime.getURL("fonts/" + f[2] + "-" + sub + ".woff2") +
               '") format("woff2");font-weight:700;font-display:block;}';
      }
    }
    s.textContent = css;
    (document.head || document.documentElement).appendChild(s);
  }

  function applyFont() {
    if (!root) return;
    const f = NUM_FONTS.find(x => x[0] === numFont) || NUM_FONTS[0];
    root.style.setProperty("--cvt-numfont",
      f[2] ? '"CvtNum-' + f[0] + '", "CvtDisplay", monospace' : '"CvtDisplay", monospace');
  }

  function ensure() {
    if (root && document.documentElement.contains(root)) return root;
    root = el("div");
    root.id = "cvt-root";
    root.setAttribute("dir", RTL[lang] ? "rtl" : "ltr");
    root._bar = el("div", "cvt-bar");
    const tail = el("div", "cvt-tail"), tailIn = el("div", "cvt-tail-in");
    root.append(root._bar, tail, tailIn);

    root.addEventListener("mousedown", (e) => { insidePanel = true; e.stopPropagation(); });
    root.addEventListener("mouseup", (e) => e.stopPropagation());
    root.addEventListener("mouseenter", () => { insidePanel = true; });
    root.addEventListener("mouseleave", () => { insidePanel = false; });
    document.documentElement.appendChild(root);
    applyScale();
    applyTheme();
    applyFont();
    return root;
  }

  let hintEl = null, hintTimer = null;

  function attachHint(slot, code) {
    slot.addEventListener("mouseenter", () => {
      clearTimeout(hintTimer);
      hintTimer = setTimeout(() => {
        const c = byCode[code];
        if (!c || !root) return;
        if (!hintEl) { hintEl = el("div", "cvt-hint"); root.appendChild(hintEl); }
        hintEl.innerHTML = "";
        const b = document.createElement("b");
        b.textContent = code;
        hintEl.appendChild(b);
        const loc = nameLocal(code);
        hintEl.appendChild(document.createTextNode("  " + nameEn(code) + (loc && loc !== nameEn(code) ? "  \u00b7  " + loc : "")));
        hintEl.classList.add("cvt-show");

        hintEl.style.left = "0px";
        hintEl.style.top = (slot.offsetTop + slot.offsetHeight + 5) + "px";
        const hr = hintEl.getBoundingClientRect();
        let l = slot.offsetLeft;
        if (hr.left + (l - 0) + hr.width > window.innerWidth - 8) {
          l = Math.max(0, l - hr.width + slot.offsetWidth);
        }
        hintEl.style.left = l + "px";
      }, 1000);
    });
    slot.addEventListener("mouseleave", () => {
      clearTimeout(hintTimer);
      if (hintEl) hintEl.classList.remove("cvt-show");
    });
  }

  let copyTimer = null;

  function copyValue(el, text) {
    const done = () => {
      el.classList.remove("cvt-copied");
      void el.offsetWidth;
      el.classList.add("cvt-copied");
      clearTimeout(copyTimer);
      copyTimer = setTimeout(() => el.classList.remove("cvt-copied"), 900);
    };
    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(text).then(done, () => fallbackCopy(text, done));
    } else {
      fallbackCopy(text, done);
    }
  }

  function fallbackCopy(text, done) {
    const ta = document.createElement("textarea");
    ta.value = text;
    ta.style.cssText = "position:fixed;top:-9999px;opacity:0";
    document.documentElement.appendChild(ta);
    ta.select();
    try { document.execCommand("copy"); done(); } catch (e) {}
    ta.remove();
  }

  function slotLabel(code) {
    const s = symOf(code);
    return s && s !== code ? s + " " + code : code;
  }

  function swapBtn(a, b) {
    const w = el("div", "cvt-swap");
    w.title = t("swapWith");
    const NS = "http://www.w3.org/2000/svg";
    const svg = document.createElementNS(NS, "svg");
    svg.setAttribute("viewBox", "0 0 24 24");
    svg.setAttribute("class", "cvt-swapicon");
    const top = document.createElementNS(NS, "path");
    top.setAttribute("d", "M4 9h13.5M14 5.5 17.8 9 14 12.5");
    const bot = document.createElementNS(NS, "path");
    bot.setAttribute("d", "M20 15H6.5M10 11.5 6.2 15 10 18.5");
    for (const pth of [top, bot]) {
      pth.setAttribute("fill", "none");
      pth.setAttribute("stroke", "currentColor");
      pth.setAttribute("stroke-width", "2.4");
      pth.setAttribute("stroke-linecap", "round");
      pth.setAttribute("stroke-linejoin", "round");
      svg.appendChild(pth);
    }
    const box = el("div", "cvt-swapbox");
    box.appendChild(svg);
    w.appendChild(box);
    w.addEventListener("click", (e) => {
      e.stopPropagation();
      swapPair(a, b);
    });
    return w;
  }

  function swapPair(a, b) {
    if (b === "src") {
      const t0 = targets[a];
      if (!t0) return;
      targets[a] = current.currency;
      current.currency = t0;
      current.detected = false;
      sourceFallback = t0;
      saveOwn({ targets: targets.slice(), sourceFallback: t0 });
    } else {
      const t0 = targets[a];
      targets[a] = targets[b];
      targets[b] = t0;
      saveOwn({ targets: targets.slice() });
    }
    shown = {};
    openSlot = null;
    render();
    place();
    convert();
  }

  function makeSlot(key, label, value, isSrc) {
    const slot = el("div", "cvt-slot" + (isSrc ? " cvt-src" : ""));
    slot.dataset.key = String(key);

    const top = el("div", "cvt-slot-top");
    const lbl = el("div", "cvt-slot-lbl");
    lbl.textContent = label;
    const caret = el("div", "cvt-caret" + (openSlot === key ? " cvt-on" : ""));
    caret.appendChild(arrowSVG());
    caret.addEventListener("click", (e) => {
      e.stopPropagation();
      openSlot === key ? closeDrop() : openDrop(key);
    });
    top.append(lbl, caret);

    const val = el("div", "cvt-val" + (value === null ? " cvt-wait" : ""));
    val.dataset.slot = String(key);
    val.textContent = value === null ? "\u2022\u2022\u2022" : value;
    if (isSrc && current && current.detected) {
      const a = el("span", "cvt-auto");
      a.textContent = t("auto");
      val.appendChild(a);
    }

    if (!isSrc) {
      val.classList.add("cvt-copyable");
      val.title = t("copyHint");
      val.dataset.copied = t("copied");
      val.addEventListener("click", (e) => {
        e.stopPropagation();
        const txt = (shown[key] !== undefined ? shown[key] : val.textContent) || "";
        const clean = txt.replace(/\s+/g, " ").trim();
        if (!clean || clean === "\u2022\u2022\u2022" || clean === t("noData") || clean === "N/A") return;
        copyValue(val, clean);
      });
    }

    slot.append(top, val);

    if (!isSrc && targets.length > 1) {
      const rm = el("div", "cvt-slot-x");
      rm.textContent = "\u2715";
      rm.title = t("removeCur");
      rm.addEventListener("click", (e) => {
        e.stopPropagation();
        targets.splice(key, 1);
        const next = {};
        Object.keys(shown).forEach(k => {
          const i = Number(k);
          if (i < key) next[i] = shown[k];
          else if (i > key) next[i - 1] = shown[k];
        });
        shown = next;
        saveOwn({ targets: targets.slice() });
        openSlot = null;
        render(); place(); convert();
      });
      slot.appendChild(rm);
    }

    attachHint(slot, isSrc ? current.currency : targets[key]);

    if (openSlot === key) slot.dataset.anchorSlot = "1";
    return slot;
  }

  function render() {
    if (!current) return;
    const bar = ensure()._bar;
    bar.textContent = "";
    const edge = el("div", "cvt-edge");

    const inner = el("div", "cvt-inner");

    targets.forEach((code, i) => {
      inner.appendChild(makeSlot(i, slotLabel(code), shown[i] !== undefined ? shown[i] : null, false));
      if (i + 1 < targets.length) inner.appendChild(swapBtn(i, i + 1));
    });
    if (targets.length < MAX_TARGETS) {
      const add = el("div", "cvt-add cvt-stack");
      const addBtn = el("div", "cvt-addbtn");
      addBtn.textContent = "+";
      const addWrap = el("div", "cvt-stacktop");
      addWrap.appendChild(addBtn);
      addWrap.title = t("addCur");
      add.appendChild(addWrap);
      addWrap.addEventListener("click", (e) => {
        e.stopPropagation();
        if (targets.length >= MAX_TARGETS) return;

        const pick = ["USD","EUR","GBP","JPY","CAD","AUD","CHF"]
          .concat(CURRENCIES.map(c => c[0]))
          .find(c => !targets.includes(c) && c !== current.currency && c !== sourceFallback);
        if (!pick) return;
        targets.push(pick);
        saveOwn({ targets: targets.slice() });
        openSlot = targets.length - 1;
        render(); place(); placeDrop(true); convert();
      });
      if (targets.length) {
        const sw = swapBtn(targets.length - 1, "src");
        sw.classList.add("cvt-stackbot");
        add.appendChild(sw);
      }
      inner.appendChild(add);
    } else if (targets.length) {
      const col = el("div", "cvt-add cvt-stack cvt-stackonly");
      const sw = swapBtn(targets.length - 1, "src");
      sw.classList.add("cvt-stackbot");
      col.appendChild(sw);
      inner.appendChild(col);
    }
    inner.appendChild(makeSlot("src", t("from"), symOf(current.currency) + " " + current.currency, true));

    bar.style.display = "block";
    bar.append(edge, inner);

    if (hintEl) { hintEl.classList.remove("cvt-show"); root.appendChild(hintEl); }
    if (root._drop) { root._drop.remove(); root._drop = null; }
    if (openSlot !== null) {
      const drop = buildDrop(openSlot);
      drop.classList.add("cvt-open");
      root.appendChild(drop);
      root._drop = drop;
      root._anchorSlot = inner.querySelector('[data-anchor-slot="1"]');
      fillFavs(drop);
      fillList(drop, "");
      setTimeout(() => { if (drop._checkEnd) drop._checkEnd(); }, 50);
    }
  }

  function openDrop(key) {
    openSlot = key;
    if (root) root._dropSide = null;
    render();
    place();
    placeDrop(true);
    const d = root._drop;
    if (d) {
      d._input.focus();
      const cur = d._list.querySelector(".cvt-cur");
      if (cur && cur.scrollIntoView) cur.scrollIntoView({ block: "nearest" });
    }
  }

  function closeDrop() {
    openSlot = null;
    if (root) { root._dropSide = null; root._dropRoom = 0; }
    render();
    place();
  }

  function place() {
    if (!root || !anchor) return;
    root.style.left = "-9999px";
    root.style.top = "0px";
    const r = root.getBoundingClientRect();

    let left = anchor.cx - r.width / 2;
    left = Math.max(8, Math.min(left, window.innerWidth - r.width - 8));

    let top;
    if (IS_OPERA) {
      top = anchor.bottom + 12;
      if (top + r.height > window.innerHeight - 8) {
        top = anchor.top - r.height - 4;
      }
    } else {
      top = anchor.top - r.height - 4;
      if (top < 8) top = Math.min(anchor.bottom + 10, window.innerHeight - r.height - 8);
    }
    top = Math.max(8, top);

    root.style.left = Math.round(left) + "px";
    root.style.top = Math.round(top) + "px";
    root.classList.toggle("cvt-below", top > anchor.top);
  }

  function placeDrop(decideSide) {
    const d = root && root._drop;
    if (!d) return;

    const slot = root._anchorSlot;
    const baseLeft = slot ? slot.offsetLeft : 0;
    const list = d.querySelector(".cvt-list");
    const bar = root._bar;
    if (!bar) return;

    const barRect = bar.getBoundingClientRect();
    const GAP = 8, EDGE = 8;
    const spaceAbove = barRect.top - GAP - EDGE;
    const spaceBelow = window.innerHeight - barRect.bottom - GAP - EDGE;

    if (decideSide || !root._dropSide) {
      if (list) list.style.maxHeight = "";
      const natural = d.offsetHeight || 300;
      if (natural <= spaceAbove) root._dropSide = "up";
      else if (natural <= spaceBelow) root._dropSide = "down";
      else root._dropSide = spaceAbove >= spaceBelow ? "up" : "down";
      root._dropRoom = root._dropSide === "up" ? spaceAbove : spaceBelow;
    }

    if (root._dropSide === "up") {
      d.style.bottom = "calc(100% + " + GAP + "px)";
      d.style.top = "auto";
    } else {
      d.style.top = "calc(100% + " + GAP + "px)";
      d.style.bottom = "auto";
    }

    if (list) {
      list.style.maxHeight = "";
      const chrome_ = d.offsetHeight - list.offsetHeight;
      const room = Math.max(90, (root._dropRoom || 240) - chrome_);
      list.style.maxHeight = Math.min(236, room) + "px";
    }

    d.style.left = baseLeft + "px";
    const r1 = d.getBoundingClientRect();
    let shift = 0;
    if (r1.right > window.innerWidth - EDGE) shift = window.innerWidth - EDGE - r1.right;
    if (r1.left + shift < EDGE) shift = EDGE - r1.left;
    d.style.left = (baseLeft + Math.round(shift)) + "px";
  }

  function hide(reason) {
    if (!root) return;
    insidePanel = false;
    if (denyTimer) { clearTimeout(denyTimer); denyTimer = null; }
    clearTimeout(hintTimer);
    if (hintEl) hintEl.classList.remove("cvt-show");
    root.style.display = "none";
    openSlot = null;
  }

  let convertSeq = 0;

  function convert() {
    if (!current) return;
    const want = targets.slice();
    const seq = ++convertSeq;
    let answered = false;

    const setAll = (txt) => {
      if (!root) return;
      root.querySelectorAll(".cvt-val").forEach(v => {
        if (v.dataset.slot === "src") return;
        v.className = "cvt-val cvt-wait";
        v.textContent = txt;
      });
    };

    const giveUp = setTimeout(() => {
      if (answered || seq !== convertSeq) return;
      if (!root || root.style.display === "none") return;
      answered = true;
      setAll(t("noData"));
      place();
    }, 9000);

    chrome.runtime.sendMessage(
      { type: "convert", amount: current.amount, from: current.currency, targets: want },
      (resp) => {
        clearTimeout(giveUp);
        if (answered || seq !== convertSeq) return;
        answered = true;
        if (!root || root.style.display === "none") return;

        if (chrome.runtime.lastError || !resp || !resp.ok || !resp.results) {
          setAll(t("noData"));
          place();
          return;
        }
        want.forEach((code, i) => {
          const v = root.querySelector('.cvt-val[data-slot="' + i + '"]');
          if (!v) return;
          const r = resp.results[code];
          if (!r) { shown[i] = "N/A"; v.className = "cvt-val cvt-wait"; v.textContent = "N/A"; return; }
          shown[i] = symOf(code) + fmt(r.value);
          v.className = "cvt-val";
          v.textContent = shown[i];
        });
        place();
      }
    );
  }


  function onSelection() {
    if (!enabled) { hide("extension off"); return; }
    if (openSlot !== null) return;
    const sel = window.getSelection();
    const text = sel ? sel.toString() : "";
    if (!text || !text.trim()) { hide("selection empty"); return; }

    const p = parsePrice(text);
    if (!p) { hide("not a price"); return; }

    let rect;
    try { rect = sel.getRangeAt(0).getBoundingClientRect(); } catch (e) { return; }
    if (!rect || (!rect.width && !rect.height)) return;

    current = p;
    shown = {};
    anchor = { cx: rect.left + rect.width / 2, top: rect.top, bottom: rect.bottom };
    ensure().style.display = "block";
    render();
    place();
    convert();
  }

  document.addEventListener("mouseup", () => setTimeout(onSelection, 10));

  let selWatch = null;
  document.addEventListener("selectionchange", () => {
    if (openSlot !== null) return;
    if (insidePanel) return;
    clearTimeout(selWatch);
    selWatch = setTimeout(() => {
      if (!root || root.style.display === "none") return;
      if (openSlot !== null || insidePanel) return;
      const s = window.getSelection();
      const txt = s ? s.toString() : "";
      if (!txt || !txt.trim()) {
        hide("selectionchange emptied");
      }
    }, 60);
  });

  const closeIfOutside = (e) => {
    if (!root || root.style.display === "none") return;
    if (e.target && root.contains(e.target)) return;
    hide("clicked outside");
  };
  document.addEventListener("mousedown", closeIfOutside, true);
  document.addEventListener("click", closeIfOutside, true);
  document.addEventListener("contextmenu", closeIfOutside, true);

  window.addEventListener("blur", () => hide("window lost focus"));
  document.addEventListener("scroll", (e) => {
    if (root && e.target && root.contains(e.target)) return;
    hide("page scrolled");
  }, true);
  document.addEventListener("keydown", (e) => { if (e.key === "Escape") hide("escape pressed"); });
  window.addEventListener("resize", () => hide("window resized"));

  chrome.storage.onChanged.addListener((ch, area) => {
    if (area !== "sync") return;
    const keys = Object.keys(ch);
    if (selfWrite && keys.every(k => selfWrite.has(k))) {
      keys.forEach(k => selfWrite.delete(k));
      if (!selfWrite.size) selfWrite = null;
      if (ch.favs && Array.isArray(ch.favs.newValue)) favs = ch.favs.newValue;
      if (ch.targets && Array.isArray(ch.targets.newValue)) targets = ch.targets.newValue;
      if (ch.sourceFallback) sourceFallback = ch.sourceFallback.newValue;
      return;
    }
    if (ch.targets && Array.isArray(ch.targets.newValue)) targets = ch.targets.newValue;
    if (ch.sourceFallback) sourceFallback = ch.sourceFallback.newValue;
    if (ch.favs && Array.isArray(ch.favs.newValue)) favs = ch.favs.newValue;
    if (ch.lang) { lang = ch.lang.newValue; if (root) root.setAttribute("dir", RTL[lang] ? "rtl" : "ltr"); }
    if (ch.scale) { scale = ch.scale.newValue; applyScale(); }
    if (ch.theme && THEMES[ch.theme.newValue]) { theme = ch.theme.newValue; applyTheme(); }
    if (ch.opacity !== undefined) { opacity = ch.opacity.newValue; applyTheme(); }
    if (ch.numFont) { numFont = ch.numFont.newValue; applyFont(); }
    if (ch.enabled !== undefined) {
      enabled = ch.enabled.newValue;
      if (!enabled) hide("extension switched off");
    }
    if (root && root.style.display === "block" && current) { render(); place(); }
  });

  const stale = document.querySelectorAll("#cvt-root");
  if (stale.length) {
    stale.forEach(n => n.remove());
  }

  injectFont();
})();
