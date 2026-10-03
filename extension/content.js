// ExpertAI content script. Reads the page's form straight from the DOM (no screenshots, no vision calls),
// emits ScreenEvent-shaped events (shared/contracts.ts) and pauses risky saves before they happen.
// Dormant until the user turns on "Watch this site" in the side panel; "Learn this page" works on demand.
(() => {
  if (window.__expertaiContentLoaded) return;
  window.__expertaiContentLoaded = true;

  const CHECK_TIMEOUT_MS = 900; // background aborts the fetch at 800ms; this is the safety net
  const SUBMIT_TEXT = /save|submit|approve|refund|send|confirm|post/i;
  const SENSITIVE = /card\s*(number|no|#)|credit\s*card|debit\s*card|cc[\s_-]*(num|number)|\bcvv\b|\bcvc\b|security\s*code|\bssn\b|social\s*security|password|passcode|\bpin\b|routing\s*(number|no)|account\s*(number|no)|\biban\b/i;
  const SENSITIVE_AUTOCOMPLETE = /^(cc-number|cc-csc|cc-exp|current-password|new-password|one-time-code)$/i;
  const RECORD_KEY = /(^|_)(receipt|order|invoice|case|ticket|claim|record|rma|reference|booking)(_(no|num|number|id))?$/;
  const MONEY_LABEL = /price|amount|total|refund_amount|cost|fee|balance|subtotal|paid|\$/i;
  const REDACTED = "[REDACTED]";

  const siteKey = location.protocol === "file:" ? "file://" : location.origin;
  const started = performance.now();
  let enabled = false;
  let mode = "new_hire";
  let seq = 0;
  let fields = new Map(); // element -> descriptor
  const last = new Map(); // key -> last seen value
  const bypass = new WeakSet(); // elements whose next click is let through untouched
  let allowSubmitOnce = false;
  let checking = false;

  // ---------- Helpers ----------
  const clean = (s) => String(s ?? "").replace(/\s+/g, " ").trim();
  function snake(s) {
    let k = clean(s).toLowerCase().replace(/&/g, " and ").replace(/#/g, " no ")
      .replace(/[^a-z0-9]+/g, "_").replace(/^_+|_+$/g, "").replace(/_+/g, "_");
    if (k.length > 40) k = k.slice(0, 40).replace(/_+$/, "");
    if (/^\d/.test(k)) k = "f_" + k;
    return k || "field";
  }
  const visible = (el) => !!(el.getClientRects().length && getComputedStyle(el).visibility !== "hidden");
  const textOf = (el) => clean(el.innerText ?? el.textContent ?? "");

  function controlText(el) {
    if (el.tagName === "INPUT") return clean(el.value || el.getAttribute("aria-label") || "");
    return clean(el.getAttribute("aria-label") || textOf(el) || el.getAttribute("title") || "");
  }

  /** The visible label a person reads next to this control. */
  function labelFor(el) {
    const ids = el.getAttribute("aria-labelledby");
    if (ids) {
      const t = clean(ids.split(/\s+/).map((id) => document.getElementById(id)).filter(Boolean).map(textOf).join(" "));
      if (t) return t;
    }
    const aria = clean(el.getAttribute("aria-label"));
    if (aria) return aria;
    if (el.id) {
      const l = document.querySelector(`label[for="${CSS.escape(el.id)}"]`);
      if (l && textOf(l)) return textOf(l);
    }
    const wrap = el.closest("label");
    if (wrap) {
      const copy = wrap.cloneNode(true);
      copy.querySelectorAll("input,select,textarea,button,option").forEach((n) => n.remove());
      const t = textOf(copy) || clean(copy.textContent);
      if (t) return t;
    }
    const ph = clean(el.getAttribute("placeholder"));
    if (ph) return ph;
    const near = precedingText(el);
    if (near) return near;
    return clean(el.getAttribute("name") || el.id || el.tagName.toLowerCase());
  }

  /** Nearest text before the control, walking back through siblings and up to three parents. */
  function precedingText(el) {
    let node = el;
    for (let depth = 0; depth < 4 && node && node !== document.body; depth++) {
      let sib = node.previousSibling;
      while (sib) {
        if (sib.nodeType === Node.TEXT_NODE) {
          const t = clean(sib.textContent);
          if (t) return t.slice(0, 60);
        } else if (sib.nodeType === Node.ELEMENT_NODE && !sib.matches("input,select,textarea,button,script,style")) {
          const t = clean(sib.innerText ?? sib.textContent);
          if (t && !sib.querySelector("input,select,textarea")) return t.slice(0, 60);
        }
        sib = sib.previousSibling;
      }
      node = node.parentElement;
    }
    return "";
  }

  function isSensitive(el, label) {
    if (el.tagName === "INPUT" && el.type === "password") return true;
    if (SENSITIVE_AUTOCOMPLETE.test(el.getAttribute("autocomplete") || "")) return true;
    return SENSITIVE.test(`${label} ${el.getAttribute("name") || ""} ${el.id || ""}`);
  }

  function inferType(el, label, key) {
    if (el.tagName === "SELECT") return "select";
    if (/status|state|stage/.test(key)) return "status";
    if (el.tagName === "INPUT" && /^(date|datetime-local|month)$/.test(el.type)) return "date";
    if (MONEY_LABEL.test(label) || MONEY_LABEL.test(key)) return "money";
    return "text";
  }

  // ---------- Discovery ----------
  const CONTROL_SEL = "input,select,textarea,[contenteditable=''],[contenteditable='true']";
  const SKIP_INPUT = /^(hidden|submit|button|reset|image|file)$/;

  function scan() {
    const next = new Map();
    const used = new Map();
    const radioGroups = new Set();
    for (const el of document.querySelectorAll(CONTROL_SEL)) {
      if (el.closest("#expertai-host")) continue;
      if (el.tagName === "INPUT" && SKIP_INPUT.test(el.type)) continue;
      if (!visible(el)) continue;
      let label;
      if (el.tagName === "INPUT" && el.type === "radio") {
        if (!el.name || radioGroups.has(el.name)) {
          if (el.name) next.set(el, next.get(document.querySelector(`input[type=radio][name="${CSS.escape(el.name)}"]`)));
          continue;
        }
        radioGroups.add(el.name);
        const legend = el.closest("fieldset")?.querySelector("legend");
        label = legend ? textOf(legend) : clean(el.getAttribute("aria-label") || el.name);
      } else {
        label = labelFor(el);
      }
      let key = snake(label);
      const n = (used.get(key) || 0) + 1;
      used.set(key, n);
      if (n > 1) key = `${key}_${n}`;
      const sensitive = isSensitive(el, label);
      const d = { el, key, label: label.slice(0, 80), type: inferType(el, label, key), sensitive };
      if (el.tagName === "SELECT") d.options = [...el.options].map((o) => clean(o.text)).filter(Boolean);
      next.set(el, d);
    }
    // radios after the first in a group were set to the first one's descriptor above (may be undefined if
    // the first was hidden); drop any undefined entries
    for (const [k, v] of next) if (!v) next.delete(k);
    fields = next;
    return fields;
  }

  function uniqueDescriptors() {
    return [...new Set(fields.values())];
  }

  function readRaw(el) {
    if (el.isContentEditable && el.tagName !== "INPUT" && el.tagName !== "TEXTAREA") return clean(el.innerText);
    if (el.tagName === "SELECT") return el.selectedIndex >= 0 ? clean(el.options[el.selectedIndex].text) : "";
    if (el.type === "checkbox") return el.checked ? "yes" : "no";
    if (el.type === "radio") {
      const on = el.name ? document.querySelector(`input[type=radio][name="${CSS.escape(el.name)}"]:checked`) : el.checked ? el : null;
      return on ? labelFor(on) : "";
    }
    return el.value ?? "";
  }

  function valueOf(d) {
    if (d.sensitive) return clean(readRaw(d.el)) === "" ? null : REDACTED;
    const raw = clean(readRaw(d.el));
    if (raw === "") return null;
    if (d.type === "money" || (d.el.tagName === "INPUT" && d.el.type === "number")) {
      const n = Number(raw.replace(/[$,£€\s]/g, ""));
      if (Number.isFinite(n)) return n;
    }
    return raw.slice(0, 500);
  }

  /** Change detection for redacted fields: a local fingerprint of the raw value. It never leaves this script. */
  function fingerprint(d) {
    const raw = String(readRaw(d.el) ?? "");
    let h = 0;
    for (let i = 0; i < raw.length; i++) h = (h * 31 + raw.charCodeAt(i)) | 0;
    return raw ? `${raw.length}:${h}` : "";
  }
  const lastPrint = new Map();

  function currentRecord() {
    const rec = {};
    for (const d of uniqueDescriptors()) rec[d.key] = valueOf(d);
    return rec;
  }

  function recordId() {
    for (const d of uniqueDescriptors()) {
      if (d.sensitive || !RECORD_KEY.test(d.key)) continue;
      const v = valueOf(d);
      if (v != null && v !== "") return String(v);
    }
    return undefined;
  }

  function buttons() {
    const out = [];
    const seen = new Set();
    for (const el of document.querySelectorAll("button,input[type=submit],input[type=button],[role=button]")) {
      if (el.closest("#expertai-host") || !visible(el)) continue;
      const label = controlText(el);
      if (!label) continue;
      const key = snake(label);
      if (seen.has(key)) continue;
      seen.add(key);
      out.push({ key, label: label.slice(0, 60), submit_like: isSubmitLike(el) });
    }
    return out;
  }

  function recordType() {
    const form = document.querySelector("form");
    const h = (form && form.querySelector("legend,h1,h2,h3")) || document.querySelector("h1,h2");
    return clean(h ? textOf(h) : document.title).slice(0, 60) || "record";
  }

  function discover() {
    scan();
    return {
      url: location.href.split(/[?#]/)[0],
      title: document.title,
      record_type: recordType(),
      fields: uniqueDescriptors().map((d) => ({
        key: d.key, label: d.label, type: d.type,
        ...(d.options ? { options: d.options } : {}),
        ...(d.sensitive ? { pii: true } : {}),
      })),
      actions: buttons(),
    };
  }

  // ---------- Events ----------
  function send(msg) {
    try {
      const p = chrome.runtime.sendMessage(msg);
      if (p && typeof p.catch === "function") p.catch(() => {});
      return p;
    } catch {
      return undefined; // extension reloaded: this page's script is orphaned, stay quiet
    }
  }

  function emit(type, partial) {
    const event = {
      id: `ext_${Date.now().toString(36)}_${(++seq).toString(36)}`,
      t: Math.round(performance.now() - started),
      type,
      confidence: 1,
      ...partial,
    };
    const rec = event.record ?? recordId();
    if (rec) event.record = rec;
    send({ kind: "screen_event", event });
  }

  const show = (v) => (v == null || v === "" ? "(empty)" : typeof v === "number" ? String(v) : `"${v}"`);

  function onFieldEvent(e) {
    if (!enabled) return;
    const target = e.target;
    if (!(target instanceof Element) || target.closest?.("#expertai-host")) return;
    if (!target.matches(CONTROL_SEL)) return;
    let d = fields.get(target);
    if (!d) {
      scan();
      d = fields.get(target);
      if (!d) return;
    }
    let to = valueOf(d);
    let from = last.has(d.key) ? last.get(d.key) : null;
    if (d.sensitive) {
      const before = lastPrint.get(d.key) || "";
      const now = fingerprint(d);
      if (before === now) return;
      lastPrint.set(d.key, now);
      from = before ? REDACTED : null;
      to = now ? REDACTED : null;
    } else if (from === to) return;
    last.set(d.key, to);
    const isRecord = !d.sensitive && RECORD_KEY.test(d.key);
    if (isRecord && to != null) {
      emit("record_opened", { record: String(to), field: d.key, from, to, detail: `${d.label} ${show(to)} opened` });
      return;
    }
    const type = d.type === "status" ? "status_changed" : "field_changed";
    emit(type, { field: d.key, from, to, detail: `${d.label}: ${show(from)} -> ${show(to)}` });
  }

  function primeValues() {
    scan();
    last.clear();
    lastPrint.clear();
    for (const d of uniqueDescriptors()) {
      last.set(d.key, valueOf(d));
      if (d.sensitive) lastPrint.set(d.key, fingerprint(d));
    }
  }

  function activate() {
    primeValues();
    emit("screen_opened", { detail: `Watching "${clean(document.title) || siteKey}" (${uniqueDescriptors().length} fields)` });
    const rec = recordId();
    if (rec) emit("record_opened", { record: rec, detail: `${recordType()} ${rec} on screen` });
  }

  // ---------- Save interception ----------
  function isSubmitLike(el) {
    if (el.tagName === "BUTTON" && el.type === "submit" && el.form) return true;
    if (el.tagName === "INPUT" && el.type === "submit") return true;
    return SUBMIT_TEXT.test(controlText(el));
  }

  function clickable(target) {
    if (!(target instanceof Element)) return null;
    return target.closest("button,input[type=submit],input[type=button],[role=button],a[href]");
  }

  function withTimeout(p, ms) {
    return Promise.race([Promise.resolve(p), new Promise((r) => setTimeout(() => r({ status: "fail_open", reason: "timeout" }), ms))]);
  }

  async function runCheck(actionLabel) {
    scan();
    const action = snake(actionLabel || "submit");
    const res = await withTimeout(send({ kind: "check", action, label: actionLabel, record: currentRecord() }), CHECK_TIMEOUT_MS);
    return { action, res: res || { status: "fail_open", reason: "no response" } };
  }

  async function guard(e, el, label, letThrough) {
    e.preventDefault();
    e.stopImmediatePropagation();
    if (checking) return;
    checking = true;
    let outcome;
    try {
      outcome = await runCheck(label);
    } catch {
      outcome = { action: snake(label), res: { status: "fail_open", reason: "error" } };
    } finally {
      checking = false;
    }
    const { res, action } = outcome;
    if (res.status === "checked" && res.result && res.result.ok === false) {
      showPause(res.result, label, () => {
        send({ kind: "override", action, rule_id: res.result.rule?.id });
        letThrough();
      });
      return;
    }
    letThrough(); // ok, no job chosen, server down or slow: fail open
  }

  function onClick(e) {
    const el = clickable(e.target);
    if (!el) return;
    if (bypass.has(el)) {
      bypass.delete(el);
      allowSubmitOnce = true;
      setTimeout(() => (allowSubmitOnce = false), 0);
      return;
    }
    if (!enabled || mode !== "new_hire" || el.closest("#expertai-host")) return;
    if (!isSubmitLike(el)) return;
    const label = controlText(el) || "submit";
    guard(e, el, label, () => {
      bypass.add(el);
      el.click();
    });
  }

  function onSubmit(e) {
    if (allowSubmitOnce) {
      allowSubmitOnce = false;
      return;
    }
    if (!enabled || mode !== "new_hire") return;
    const form = e.target;
    const submitter = e.submitter || null;
    const label = (submitter && controlText(submitter)) || "submit";
    guard(e, form, label, () => {
      allowSubmitOnce = true;
      if (submitter && typeof form.requestSubmit === "function") form.requestSubmit(submitter);
      else if (typeof form.requestSubmit === "function") form.requestSubmit();
      else form.submit();
      allowSubmitOnce = false;
    });
  }

  // ---------- Pause card (shadow DOM so the host page's CSS cannot touch it) ----------
  let host = null;

  const CARD_CSS = `
    :host { all: initial; }
    .wrap { position: fixed; top: 16px; right: 16px; z-index: 2147483647; width: min(380px, calc(100vw - 32px));
      font-family: system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", "Helvetica Neue", Arial, sans-serif;
      color-scheme: light dark; animation: in 240ms cubic-bezier(0.2, 0.8, 0.2, 1); }
    .card { box-sizing: border-box; border-radius: 16px; padding: 16px;
      background: light-dark(#fff4dd, #382b16); color: light-dark(#7a4b00, #ffd27d);
      border: 1px solid light-dark(#ecd9ae, #5a4520);
      box-shadow: light-dark(0 8px 24px rgb(0 0 0 / 12%), 0 8px 24px rgb(0 0 0 / 32%)); }
    .brand { display: flex; align-items: center; gap: 8px; font-size: 12px; line-height: 17px; font-weight: 500;
      letter-spacing: 0.06em; text-transform: uppercase; }
    .dot { width: 8px; height: 8px; border-radius: 999px; background: currentColor; }
    .rule { margin: 6px 0 0; font-size: 15px; line-height: 21px; font-weight: 600; }
    .note { margin: 4px 0 0; font-size: 13px; line-height: 18px; }
    blockquote { margin: 10px 0 0; padding-left: 12px; border-left: 2px solid currentColor; font-size: 15px;
      line-height: 21px; font-style: italic; opacity: 0.95; }
    .row { display: flex; flex-wrap: wrap; gap: 8px; margin-top: 14px; }
    button { font: inherit; font-size: 15px; line-height: 20px; font-weight: 500; min-height: 44px; padding: 0 16px;
      border-radius: 12px; cursor: pointer; transition: background-color 150ms cubic-bezier(0.2, 0.8, 0.2, 1); }
    button:focus-visible { outline: 2px solid light-dark(#0066cc, #64acff); outline-offset: 2px; }
    .primary { background: #0071e3; color: #fff; border: 1px solid transparent; }
    .primary:hover { background: #0066cc; }
    .primary:active { background: #005bb5; }
    .secondary { background: light-dark(#ffffff, #1c1c1e); color: light-dark(#1d1d1f, #f5f5f7); border: 1px solid #85858b; }
    .secondary:hover { background: light-dark(#efeff2, #333336); }
    @media (prefers-reduced-motion: reduce) { .wrap { animation: none; } }
    @keyframes in { from { opacity: 0; transform: translateY(-12px); } to { opacity: 1; transform: none; } }
  `;

  function hidePause() {
    if (host) host.remove();
    host = null;
  }

  function showPause(check, actionLabel, onAnyway) {
    hidePause();
    host = document.createElement("div");
    host.id = "expertai-host";
    const root = host.attachShadow({ mode: "open" });
    const style = document.createElement("style");
    style.textContent = CARD_CSS;
    const wrap = document.createElement("div");
    wrap.className = "wrap";
    wrap.setAttribute("role", "alertdialog");
    wrap.setAttribute("aria-labelledby", "expertai-rule");
    const card = document.createElement("div");
    card.className = "card";

    const el = (tag, cls, text) => {
      const n = document.createElement(tag);
      if (cls) n.className = cls;
      if (text != null) n.textContent = text;
      return n;
    };
    const brand = el("div", "brand");
    brand.append(el("span", "dot"), el("span", null, check.standard ? "Paused · industry standard" : "Paused before saving"));
    card.append(brand);
    const rule = el("p", "rule", check.rule?.text || check.explanation || `ExpertAI would stop here before "${actionLabel}".`);
    rule.id = "expertai-rule";
    card.append(rule);
    card.append(el("p", "note", check.standard
      ? `Most people in this job would stop before "${actionLabel}". Check with your manager if unsure.`
      : `Your expert would stop here before "${actionLabel}".`));
    if (check.rule?.reason_quote) card.append(el("blockquote", null, `“${check.rule.reason_quote}”`));
    if (check.rule?.then?.escalate_to) card.append(el("p", "note", `This one goes to the ${check.rule.then.escalate_to}.`));

    const row = el("div", "row");
    const got = el("button", "primary", "Got it");
    got.type = "button";
    const anyway = el("button", "secondary", "Save anyway");
    anyway.type = "button";
    got.addEventListener("click", hidePause);
    anyway.addEventListener("click", () => {
      hidePause();
      onAnyway();
    });
    row.append(got, anyway);
    card.append(row);
    wrap.append(card);
    root.append(style, wrap);
    wrap.addEventListener("keydown", (ev) => {
      if (ev.key === "Escape") hidePause();
    });
    document.documentElement.append(host);
    got.focus();
  }

  // ---------- Wiring ----------
  document.addEventListener("change", onFieldEvent, true);
  document.addEventListener("focusout", onFieldEvent, true);
  document.addEventListener("click", onClick, true);
  document.addEventListener("submit", onSubmit, true);

  chrome.runtime.onMessage.addListener((msg, _sender, sendResponse) => {
    if (!msg || typeof msg.kind !== "string") return;
    if (msg.kind === "discover") {
      sendResponse(discover());
    } else if (msg.kind === "hello") {
      scan();
      sendResponse({ site: siteKey, enabled, mode, title: document.title, fields: uniqueDescriptors().length });
    }
  });

  function apply(settings) {
    const was = enabled;
    mode = settings.mode === "expert" ? "expert" : "new_hire";
    enabled = !!(settings.sites && settings.sites[siteKey]);
    if (enabled && !was) activate();
    if (!enabled) hidePause();
  }

  let settings = { sites: {}, mode: "new_hire" };
  chrome.storage.local.get(["sites", "mode"]).then((s) => {
    settings = { ...settings, ...s };
    apply(settings);
  });
  chrome.storage.onChanged.addListener((changes, area) => {
    if (area !== "local") return;
    for (const k of ["sites", "mode"]) if (changes[k]) settings[k] = changes[k].newValue;
    if (changes.sites || changes.mode) apply(settings);
  });
})();
