// ExpertAI background service worker: relays between content scripts and the side panel and does every
// network call (content scripts never talk to the server directly). All server calls fail open.

const DEFAULT_SERVER = "http://localhost:3000";
const CHECK_TIMEOUT_MS = 800;
const MAX_EVENTS = 100;

chrome.runtime.onInstalled.addListener(async () => {
  try {
    await chrome.sidePanel.setPanelBehavior({ openPanelOnActionClick: true });
  } catch {
    /* older Chrome: the panel is still reachable from the side panel menu */
  }
  const s = await chrome.storage.local.get(["server", "mode", "sites"]);
  await chrome.storage.local.set({
    server: s.server || DEFAULT_SERVER,
    mode: s.mode || "new_hire",
    sites: s.sites || {},
  });
});

// ---------- Settings / session ----------
async function settings() {
  const s = await chrome.storage.local.get(["server", "jobId", "mode"]);
  return {
    server: String(s.server || DEFAULT_SERVER).replace(/\/+$/, ""),
    jobId: s.jobId || "",
    mode: s.mode === "expert" ? "expert" : "new_hire",
  };
}

/** Same shape as the web app's audit ids: s_<yyyymmdd>_<6 random>. One per browser session. */
function newSessionId() {
  const d = new Date();
  const ymd = `${d.getFullYear()}${String(d.getMonth() + 1).padStart(2, "0")}${String(d.getDate()).padStart(2, "0")}`;
  const alphabet = "abcdefghijkmnpqrstuvwxyz23456789";
  const bytes = crypto.getRandomValues(new Uint8Array(6));
  let rand = "";
  for (const b of bytes) rand += alphabet[b % alphabet.length];
  return `s_${ymd}_${rand}`;
}

async function sessionId() {
  const { sessionId: cur } = await chrome.storage.session.get("sessionId");
  if (cur) return { id: cur, fresh: false };
  const id = newSessionId();
  await chrome.storage.session.set({ sessionId: id });
  return { id, fresh: true };
}

// ---------- Network ----------
async function fetchJson(url, init = {}, timeoutMs = 5000) {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), timeoutMs);
  try {
    const res = await fetch(url, { ...init, signal: ctrl.signal });
    const body = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(body.error || `HTTP ${res.status}`);
    return body;
  } finally {
    clearTimeout(timer);
  }
}

async function audit(type, payload) {
  const { server, mode } = await settings();
  const { id, fresh } = await sessionId();
  const actor = mode === "expert" ? "expert" : "new_hire";
  const post = (t, p, a) =>
    fetchJson(`${server}/api/audit`, {
      method: "POST",
      headers: { "Content-Type": "application/json", "x-expertai-session": id },
      body: JSON.stringify({ type: t, actor: a, payload: { source: "chrome_extension", ...p } }),
    }, 3000).catch(() => {});
  if (fresh) await post("session_start", { mode }, "system");
  return post(type, payload, actor);
}

// ---------- Per-tab state (chrome.storage.session survives the worker sleeping) ----------
async function pushEvent(tabId, event, page) {
  const key = `events:${tabId}`;
  const cur = (await chrome.storage.session.get(key))[key] || [];
  cur.push({ ...event, page });
  await chrome.storage.session.set({ [key]: cur.slice(-MAX_EVENTS) });
}

async function setCheck(tabId, check) {
  await chrome.storage.session.set({ [`check:${tabId}`]: check });
}

function toPanel(msg) {
  chrome.runtime.sendMessage(msg).catch(() => {}); // no panel open: nothing to do
}

// ---------- Content script -> background ----------
async function handleCheck(msg, tabId, page) {
  const { server, jobId } = await settings();
  const at = Date.now();
  if (!jobId) {
    const out = { status: "skipped", reason: "No job selected in the ExpertAI panel", action: msg.action, at };
    await setCheck(tabId, out);
    toPanel({ kind: "bg:check", tabId, check: out });
    return out;
  }
  let out;
  try {
    const body = await fetchJson(`${server}/api/check`, {
      method: "POST",
      headers: { "Content-Type": "application/json", "x-expertai-session": (await sessionId()).id },
      body: JSON.stringify({ job_id: jobId, action: msg.action, record: msg.record }),
    }, CHECK_TIMEOUT_MS);
    const result = body && typeof body.ok === "boolean" ? body : body && body.check;
    if (!result || typeof result.ok !== "boolean") throw new Error("unexpected response");
    out = { status: "checked", result, action: msg.action, label: msg.label, at, ms: Date.now() - at };
  } catch (err) {
    const reason = err && err.name === "AbortError" ? `No answer in ${CHECK_TIMEOUT_MS}ms` : "Server unreachable";
    out = { status: "fail_open", reason, action: msg.action, label: msg.label, at };
  }
  await setCheck(tabId, out);
  toPanel({ kind: "bg:check", tabId, check: out });
  if (out.status === "checked" && !out.result.ok) {
    audit("tutor_intervention", { action: msg.action, rule_id: out.result.rule?.id, standard: !!out.result.standard, page, decision: "paused" });
  }
  return out;
}

chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
  if (!msg || typeof msg.kind !== "string" || msg.kind.startsWith("bg:")) return;
  const tabId = sender.tab?.id;
  const page = sender.tab?.url ? sender.tab.url.split(/[?#]/)[0] : sender.url?.split(/[?#]/)[0];

  if (msg.kind === "screen_event" && tabId != null) {
    (async () => {
      await pushEvent(tabId, msg.event, page);
      toPanel({ kind: "bg:event", tabId, event: msg.event });
      const { jobId } = await settings();
      audit("screen_event", { event: msg.event, page, job_id: jobId || undefined });
    })();
    return;
  }
  if (msg.kind === "check" && tabId != null) {
    handleCheck(msg, tabId, page).then(sendResponse, () => sendResponse({ status: "fail_open", reason: "error" }));
    return true;
  }
  if (msg.kind === "override" && tabId != null) {
    audit("tutor_intervention", { action: msg.action, rule_id: msg.rule_id, page, decision: "saved_anyway" });
    toPanel({ kind: "bg:override", tabId, action: msg.action });
    return;
  }

  // ---------- Side panel -> background ----------
  if (msg.kind.startsWith("panel:")) {
    handlePanel(msg).then(sendResponse, (err) => sendResponse({ error: String(err && err.message ? err.message : err) }));
    return true;
  }
});

/** Make sure the tab has our content script (tabs opened before install or reload do not). */
async function ensureContent(tabId) {
  try {
    return await chrome.tabs.sendMessage(tabId, { kind: "hello" });
  } catch {
    await chrome.scripting.executeScript({ target: { tabId }, files: ["content.js"] });
    return chrome.tabs.sendMessage(tabId, { kind: "hello" });
  }
}

async function handlePanel(msg) {
  const { server } = await settings();
  switch (msg.kind) {
    case "panel:ping": {
      try {
        const body = await fetchJson(`${server}/api/jobs`, {}, 3000);
        return { connected: true, jobs: Array.isArray(body.jobs) ? body.jobs : [] };
      } catch (err) {
        return { connected: false, error: String(err.message || err), jobs: [] };
      }
    }
    case "panel:state": {
      const k = [`events:${msg.tabId}`, `check:${msg.tabId}`];
      const s = await chrome.storage.session.get([...k, "sessionId"]);
      return { events: s[k[0]] || [], check: s[k[1]] || null, sessionId: s.sessionId || null };
    }
    case "panel:hello": {
      try {
        return { page: await ensureContent(msg.tabId) };
      } catch {
        return { page: null }; // chrome:// pages, the Web Store and PDFs cannot be read
      }
    }
    case "panel:discover": {
      await ensureContent(msg.tabId);
      return { discovered: await chrome.tabs.sendMessage(msg.tabId, { kind: "discover" }) };
    }
    case "panel:learn": {
      const body = await fetchJson(`${server}/api/jobs/${encodeURIComponent(msg.jobId)}/screen`, {
        method: "POST",
        headers: { "Content-Type": "application/json", "x-expertai-session": (await sessionId()).id },
        body: JSON.stringify(msg.screen),
      }, 8000);
      audit("discovery", { job_id: msg.jobId, fields: msg.screen.fields.length, actions: msg.screen.actions.length, page: msg.page });
      return body;
    }
    case "panel:clear": {
      await chrome.storage.session.remove([`events:${msg.tabId}`, `check:${msg.tabId}`]);
      return { ok: true };
    }
    default:
      return { error: "unknown request" };
  }
}

chrome.tabs.onRemoved.addListener((tabId) => {
  chrome.storage.session.remove([`events:${tabId}`, `check:${tabId}`]).catch(() => {});
});
