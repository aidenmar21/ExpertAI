#!/usr/bin/env python3
"""Claude with Friends hub: a tiny LAN message hub so Claude Code agents on different laptops can talk.

Stdlib only (works on macOS's built-in python3). State is in memory.
Run:  python3 hub.py [port]     then point agents at http://<this-ip>:<port>

Routes
  POST /post   {"from","to","kind","text"}   append a message (to = agent name or "all")
  GET  /feed?agent=X                         unread messages for X (marks them read)
  GET  /wait?agent=X&timeout=S               like /feed but blocks until something arrives
  POST /board  {"from","action",...}          goal | part | claim | contract | done | status (see bin/hub)
  GET  /board                                the goal, parts, and each agent's status line
  GET  /log                                  messages + who's online + board (for dashboards)
  GET  /                                     browser dashboard (dashboard.html)
  POST /reset                                wipe everything (rerun the demo)
"""
import json
import os
import re
import sys
import threading
import time
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from urllib.parse import parse_qs, urlparse

PORT = int(sys.argv[1]) if len(sys.argv) > 1 else 8765

msgs = []        # {"id", "ts", "from", "to", "kind", "text"}
cursors = {}     # agent -> index into msgs of the first message it hasn't seen
last_seen = {}   # agent -> unix time of last feed/wait call
goal = {}        # {"text", "by", "ts"}
parts = {}       # id -> {"id", "desc", "owner", "status": open|building|done, "contract", "note"}
statuses = {}    # agent -> one-line "what I'm doing now"
cond = threading.Condition()

COLORS = {"say": "36", "ask": "33", "reply": "32", "help": "31;1", "goal": "35;1",
          "plan": "34", "claim": "34", "contract": "36;1", "done": "32;1", "shipped": "32;1"}
PART_ID = re.compile(r"^[a-z0-9][a-z0-9_-]{0,39}$")


def unread(agent):
    start = cursors.get(agent, 0)
    return [m for m in msgs[start:] if m["from"] != agent and m["to"] in (agent, "all")]


def take(agent):
    """Return unread messages for agent and advance its cursor. Caller holds cond."""
    out = unread(agent)
    cursors[agent] = len(msgs)
    return out


def add_msg(frm, to, kind, text):
    """Append a message and wake waiters. Caller holds cond."""
    m = {"id": len(msgs) + 1, "ts": time.time(), "from": frm, "to": to or "all",
         "kind": kind or "say", "text": text}
    msgs.append(m)
    cond.notify_all()
    show(m)
    return m


def board():
    return {"goal": goal, "parts": list(parts.values()), "statuses": statuses}


def board_action(frm, data):
    """Apply one board action. Caller holds cond. Returns (result, http_code)."""
    action, text, pid = data.get("action"), (data.get("text") or "").strip(), data.get("id", "")
    if action == "goal":
        if not text:
            return {"error": "goal text required"}, 400
        goal.clear(), goal.update(text=text, by=frm, ts=time.time())
        add_msg(frm, "all", "goal", text)
    elif action == "status":
        statuses[frm] = text
    elif not PART_ID.match(pid):
        return {"error": "part id must be lowercase letters, digits, - or _ (it's also the part's folder)"}, 400
    elif action == "part":
        new = pid not in parts
        part = parts.setdefault(pid, {"id": pid, "desc": "", "owner": None, "status": "open",
                                      "contract": "", "note": ""})
        part["desc"] = text or part["desc"]
        add_msg(frm, "all", "plan", "%s part %s/: %s" % ("new" if new else "updated", pid, part["desc"]))
    elif pid not in parts:
        return {"error": "no part %r; see hub board" % pid}, 404
    elif action == "claim":
        part = parts[pid]
        if part["owner"] and part["owner"] != frm:
            return {"error": "%s/ is already claimed by %s; pick another part or ask them" % (pid, part["owner"])}, 409
        part.update(owner=frm, status="building")
        add_msg(frm, "all", "claim", "claimed %s/: %s" % (pid, part["desc"]))
    elif action == "contract":
        if not text:
            return {"error": "contract text required"}, 400
        parts[pid]["contract"] = text
        add_msg(frm, "all", "contract", "%s/ interface: %s" % (pid, text))
    elif action == "done":
        parts[pid].update(status="done", note=text)
        add_msg(frm, "all", "done", "%s/ done%s" % (pid, ": " + text if text else ""))
        if all(p["status"] == "done" for p in parts.values()):
            add_msg("hub", "all", "shipped", "Every part is done. Goal reached: " + goal.get("text", ""))
    else:
        return {"error": "unknown action %r" % action}, 400
    return board(), 200


def show(m):
    color = COLORS.get(m["kind"], "0")
    print("\033[2m%s\033[0m \033[%sm%-5s\033[0m %s → %s: %s" % (
        time.strftime("%H:%M:%S", time.localtime(m["ts"])), color, m["kind"],
        m["from"], m["to"], m["text"]), flush=True)


class Handler(BaseHTTPRequestHandler):
    def log_message(self, *args):
        pass  # the message stream is the log

    def send_json(self, obj, code=200):
        body = json.dumps(obj).encode()
        self.send_response(code)
        self.send_header("Content-Type", "application/json")
        self.send_header("Content-Length", str(len(body)))
        self.end_headers()
        self.wfile.write(body)

    def do_GET(self):
        url = urlparse(self.path)
        q = {k: v[0] for k, v in parse_qs(url.query).items()}
        agent = q.get("agent", "")
        if url.path in ("/feed", "/wait") and not agent:
            return self.send_json({"error": "agent required"}, 400)
        if url.path == "/feed":
            with cond:
                last_seen[agent] = time.time()
                return self.send_json(take(agent))
        if url.path == "/wait":
            timeout = min(float(q.get("timeout", 60)), 3600)
            with cond:
                last_seen[agent] = time.time()
                cond.wait_for(lambda: unread(agent), timeout)
                last_seen[agent] = time.time()
                return self.send_json(take(agent))
        if url.path == "/board":
            with cond:
                return self.send_json(board())
        if url.path == "/log":
            with cond:
                return self.send_json({"messages": msgs, "agents": last_seen, "board": board()})
        if url.path == "/":
            with open(os.path.join(os.path.dirname(os.path.abspath(__file__)), "dashboard.html"), "rb") as f:
                body = f.read()
            self.send_response(200)
            self.send_header("Content-Type", "text/html; charset=utf-8")
            self.send_header("Content-Length", str(len(body)))
            self.end_headers()
            return self.wfile.write(body)
        self.send_json({"error": "not found"}, 404)

    def do_POST(self):
        url = urlparse(self.path)
        if url.path == "/reset":
            with cond:
                for d in (msgs, cursors, last_seen, goal, parts, statuses):
                    d.clear()
            print("\033[2m--- reset ---\033[0m", flush=True)
            return self.send_json({"ok": True})
        if url.path not in ("/post", "/board"):
            return self.send_json({"error": "not found"}, 404)
        try:
            data = json.loads(self.rfile.read(int(self.headers.get("Content-Length", 0))) or b"{}")
        except ValueError:
            return self.send_json({"error": "bad json"}, 400)
        if url.path == "/board":
            if not data.get("from"):
                return self.send_json({"error": "from required"}, 400)
            with cond:
                result, code = board_action(data["from"], data)
            return self.send_json(result, code)
        if not data.get("from") or not data.get("text"):
            return self.send_json({"error": "from and text required"}, 400)
        with cond:
            m = add_msg(data["from"], data.get("to"), data.get("kind"), data["text"])
        self.send_json(m)


if __name__ == "__main__":
    server = ThreadingHTTPServer(("0.0.0.0", PORT), Handler)
    server.daemon_threads = True
    print("Claude with Friends hub listening on 0.0.0.0:%d  (Ctrl-C to stop)" % PORT, flush=True)
    try:
        server.serve_forever()
    except KeyboardInterrupt:
        pass
