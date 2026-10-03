// ExpertAI side panel: connection, job, who is working, live events for the active tab, latest check,
// and "Learn this page". Talks only to the background worker.

const $ = (id) => document.getElementById(id);
const ask = (msg) => chrome.runtime.sendMessage(msg);
const FIELD_TYPES = ["text", "money", "date", "select", "status"];

const state = { tabId: null, site: null, jobs: [], jobId: "", mode: "new_hire", sites: {}, events: [], discovered: null };

function h(tag, attrs = {}, ...kids) {
  const el = document.createElement(tag);
  for (const [k, v] of Object.entries(attrs)) {
    if (v == null || v === false) continue;
    if (k === "class") el.className = v;
    else if (k === "text") el.textContent = v;
    else if (k.startsWith("on")) el.addEventListener(k.slice(2), v);
    else if (k in el && typeof v !== "string") el[k] = v;
    else el.setAttribute(k, v === true ? "" : v);
  }
  for (const kid of kids.flat()) if (kid != null) el.append(kid);
  return el;
}

function fmtT(ms) {
  const s = Math.max(0, Math.round(ms / 1000));
  return `${String(Math.floor(s / 60)).padStart(2, "0")}:${String(s % 60).padStart(2, "0")}`;
}

// ---------- Connection + jobs ----------
async function ping() {
  const conn = $("conn");
  const res = await ask({ kind: "panel:ping" }).catch(() => ({ connected: false, jobs: [] }));
  conn.className = `pill ${res.connected ? "success" : "danger"}`;
  conn.textContent = res.connected ? "Connected" : "Offline";
  conn.title = res.connected ? "ExpertAI server reachable" : `Cannot reach the server${res.error ? `: ${res.error}` : ""}. Saves are let through.`;
  state.jobs = res.jobs || [];
  renderJobs(res.connected);
}

function renderJobs(connected) {
  const sel = $("job");
  sel.replaceChildren();
  if (!connected) {
    sel.append(h("option", { value: state.jobId, text: state.jobId ? `${state.jobId} (offline)` : "Server offline" }));
    sel.disabled = !state.jobId;
    return;
  }
  sel.disabled = false;
  sel.append(h("option", { value: "", text: "Choose a job…" }));
  for (const j of state.jobs) {
    sel.append(h("option", { value: j.id, text: `${j.name}${j.software?.length ? ` · ${j.software.map((s) => s.name).join(", ")}` : ""}` }));
  }
  sel.value = state.jobs.some((j) => j.id === state.jobId) ? state.jobId : "";
  $("job-help").textContent = sel.value
    ? "Rules and pauses come from this job's Work Map."
    : "Pick the job this page is part of. Without one, saves are never paused.";
}

// ---------- Mode + watch toggle ----------
function renderMode() {
  for (const r of document.querySelectorAll('input[name="mode"]')) r.checked = r.value === state.mode;
  $("mode-help").textContent = state.mode === "new_hire"
    ? "Saves are checked against the expert's rules before they go through."
    : "The expert is teaching: changes are logged, saves are never paused.";
}

function renderWatch() {
  const sw = $("watch");
  const on = !!(state.site && state.sites[state.site]);
  sw.disabled = !state.site;
  sw.setAttribute("aria-checked", String(on));
  $("site-line").textContent = !state.site
    ? "This page cannot be read (browser pages, the Web Store, PDFs)."
    : on ? `Watching ${state.site}. Field values are read from the page; passwords and card numbers are redacted.`
      : `Off for ${state.site}. Nothing is read until you turn it on.`;
}

// ---------- Events + check ----------
function eventItem(e) {
  const tone = e.type === "record_opened" ? "info" : e.type === "status_changed" ? "warning" : e.type === "screen_opened" ? "neutral" : "success";
  return h("li", {},
    h("div", { class: "head" },
      h("span", { class: `pill ${tone} plain`, text: e.type.replace(/_/g, " ") }),
      h("span", { class: "t", text: `${fmtT(e.t)}${e.record ? ` · ${e.record}` : ""}` })),
    h("p", { class: "detail", text: e.detail || `${e.field ?? ""} ${e.from ?? ""} -> ${e.to ?? ""}` }));
}

function renderEvents() {
  const list = $("events");
  list.replaceChildren(...state.events.slice().reverse().slice(0, 50).map(eventItem));
  $("events-empty").hidden = state.events.length > 0;
  $("event-count").textContent = state.events.length ? `· ${state.events.length}` : "";
}

function renderCheck(c) {
  const box = $("check");
  if (!c) {
    box.replaceChildren(h("p", { class: "empty", text: "No save attempted on this tab yet." }));
    return;
  }
  const when = new Date(c.at).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", second: "2-digit" });
  const action = c.label || c.action;
  if (c.status === "checked" && c.result.ok === false) {
    const r = c.result.rule;
    box.replaceChildren(h("div", { class: "banner warning" },
      h("p", { class: "eyebrow", style: "margin:0;color:inherit", text: c.result.standard ? "Paused · industry standard" : "Paused before saving" }),
      h("p", { class: "title", text: r?.text || c.result.explanation || `Paused "${action}"` }),
      r?.reason_quote ? h("blockquote", { text: `“${r.reason_quote}”` }) : null,
      r?.then?.escalate_to ? h("p", { class: "small", text: `This one goes to the ${r.then.escalate_to}.` }) : null,
      h("p", { class: "small", text: `"${action}" at ${when}${c.ms != null ? ` · answered in ${c.ms}ms` : ""}` })));
  } else if (c.status === "checked") {
    box.replaceChildren(h("div", { class: "banner success" },
      h("p", { class: "title", style: "margin:0", text: `Clear to ${action}` }),
      h("p", { class: "small", text: `No rule stops this. ${when}${c.ms != null ? ` · ${c.ms}ms` : ""}` })));
  } else {
    box.replaceChildren(h("div", { class: "banner neutral" },
      h("p", { class: "title", style: "margin:0", text: `Let "${action}" through` }),
      h("p", { class: "small", text: `${c.reason}. ExpertAI fails open so work never stops. ${when}` })));
  }
}

async function loadTabState() {
  const s = await ask({ kind: "panel:state", tabId: state.tabId }).catch(() => null);
  state.events = s?.events || [];
  renderEvents();
  renderCheck(s?.check || null);
  if (s?.sessionId) $("session").textContent = s.sessionId;
}

// ---------- Active tab ----------
async function refreshTab() {
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  state.tabId = tab?.id ?? null;
  state.discovered = null;
  $("review").hidden = true;
  $("learn-status").textContent = "";
  if (state.tabId == null) return;
  const res = await ask({ kind: "panel:hello", tabId: state.tabId }).catch(() => null);
  state.site = res?.page?.site || null;
  $("page-line").textContent = res?.page ? `${res.page.title || state.site} · ${res.page.fields} fields` : "This page cannot be read";
  $("scan").disabled = !res?.page;
  renderWatch();
  await loadTabState();
}

// ---------- Learn this page ----------
function reviewRow(item, kind) {
  const include = h("input", { type: "checkbox", checked: kind === "field" ? true : !!item.submit_like, "aria-label": `Include ${item.label}` });
  const name = h("input", { class: "field compact", value: item.label, "aria-label": `${kind} label` });
  const key = h("div", { class: "key", text: item.key });
  name.addEventListener("input", () => {
    item.label = name.value;
  });
  include.addEventListener("change", () => (item.include = include.checked));
  item.include = include.checked;
  let right = null;
  if (kind === "field") {
    right = h("select", { class: "field compact", "aria-label": `Type of ${item.label}` },
      FIELD_TYPES.map((t) => h("option", { value: t, text: t, selected: t === item.type })));
    right.addEventListener("change", () => (item.type = right.value));
  } else if (item.submit_like) {
    right = h("span", { class: "pill info plain", text: "checked" });
  }
  const mid = h("div", { class: "name" }, name, key, item.pii ? h("span", { class: "pill warning plain", text: "redacted" }) : null);
  return h("li", {}, include, mid, right);
}

async function scan() {
  $("learn-status").textContent = "Reading the page…";
  try {
    const res = await ask({ kind: "panel:discover", tabId: state.tabId });
    if (res?.error || !res?.discovered) throw new Error(res?.error || "no answer from the page");
    state.discovered = res.discovered;
    const d = state.discovered;
    $("record-type").value = d.record_type;
    $("review-fields").replaceChildren(...d.fields.map((f) => reviewRow(f, "field")));
    $("review-actions").replaceChildren(...d.actions.map((a) => reviewRow(a, "action")));
    $("review").hidden = false;
    $("learn-status").textContent = `Found ${d.fields.length} fields and ${d.actions.length} buttons. Untick anything that is not part of the job.`;
  } catch (err) {
    $("learn-status").textContent = `Could not read this page: ${err.message}`;
  }
}

async function send() {
  if (!state.jobId) {
    $("learn-status").textContent = "Choose a job first.";
    $("job").focus();
    return;
  }
  const d = state.discovered;
  const screen = {
    record_type: $("record-type").value.trim() || d.record_type,
    fields: d.fields.filter((f) => f.include).map((f) => ({
      key: f.key, label: f.label.trim() || f.key, type: f.type,
      ...(f.options && f.type === "select" ? { options: f.options } : {}),
      ...(f.pii ? { pii: true } : {}),
    })),
    actions: d.actions.filter((a) => a.include).map((a) => ({ key: a.key, label: a.label.trim() || a.key, sets: {} })),
  };
  $("send").disabled = true;
  $("learn-status").textContent = "Sending…";
  try {
    const res = await ask({ kind: "panel:learn", jobId: state.jobId, screen, page: d.url });
    if (res?.error) throw new Error(res.error);
    $("review").hidden = true;
    $("learn-status").textContent = `Saved ${res.fields} fields and ${res.actions} actions to ${state.jobId}. Open the Work Map in the web app to see them.`;
  } catch (err) {
    $("learn-status").textContent = `Not saved: ${err.message}`;
  } finally {
    $("send").disabled = false;
  }
}

// ---------- Wiring ----------
$("job").addEventListener("change", async (e) => {
  state.jobId = e.target.value;
  await chrome.storage.local.set({ jobId: state.jobId });
  renderJobs(true);
});
for (const r of document.querySelectorAll('input[name="mode"]')) {
  r.addEventListener("change", async () => {
    state.mode = r.value;
    await chrome.storage.local.set({ mode: state.mode });
    renderMode();
  });
}
$("watch").addEventListener("click", async () => {
  if (!state.site) return;
  const sites = { ...state.sites };
  if (sites[state.site]) delete sites[state.site];
  else sites[state.site] = true;
  state.sites = sites;
  await chrome.storage.local.set({ sites });
  renderWatch();
});
$("clear").addEventListener("click", async () => {
  await ask({ kind: "panel:clear", tabId: state.tabId });
  await loadTabState();
});
$("scan").addEventListener("click", scan);
$("send").addEventListener("click", send);
$("cancel").addEventListener("click", () => {
  $("review").hidden = true;
  $("learn-status").textContent = "";
});
$("save-server").addEventListener("click", async () => {
  const v = $("server").value.trim().replace(/\/+$/, "") || "http://localhost:3000";
  $("server").value = v;
  await chrome.storage.local.set({ server: v });
  await ping();
});

chrome.runtime.onMessage.addListener((msg) => {
  if (!msg || typeof msg.kind !== "string" || !msg.kind.startsWith("bg:") || msg.tabId !== state.tabId) return;
  if (msg.kind === "bg:event") {
    state.events.push(msg.event);
    renderEvents();
    if (msg.event.type === "screen_opened") ask({ kind: "panel:state", tabId: state.tabId }).then((s) => s?.sessionId && ($("session").textContent = s.sessionId)).catch(() => {});
  } else if (msg.kind === "bg:check") {
    renderCheck(msg.check);
  }
});
chrome.tabs.onActivated.addListener(refreshTab);
chrome.tabs.onUpdated.addListener((tabId, info) => {
  if (tabId === state.tabId && info.status === "complete") refreshTab();
});
chrome.storage.onChanged.addListener((changes, area) => {
  if (area === "local" && changes.sites) {
    state.sites = changes.sites.newValue || {};
    renderWatch();
  }
});

(async () => {
  const s = await chrome.storage.local.get(["server", "jobId", "mode", "sites"]);
  state.jobId = s.jobId || "";
  state.mode = s.mode === "expert" ? "expert" : "new_hire";
  state.sites = s.sites || {};
  $("server").value = s.server || "http://localhost:3000";
  renderMode();
  await Promise.all([ping(), refreshTab()]);
  setInterval(ping, 15000);
})();
