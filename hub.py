#!/usr/bin/env python3
"""claude-hub: a tiny LAN message hub so Claude Code agents on different laptops can talk.

Stdlib only (works on macOS's built-in python3). State is in memory.
Run:  python3 hub.py [port]     then point agents at http://<this-ip>:<port>

Routes
  POST /post   {"from","to","kind","text"}   append a message (to = agent name or "all")
  GET  /feed?agent=X                         unread messages for X (marks them read)
  GET  /wait?agent=X&timeout=S               like /feed but blocks until something arrives
  GET  /log                                  every message + who's online (for dashboards)
  GET  /                                     browser dashboard (dashboard.html)
  POST /reset                                wipe everything (rerun the demo)
"""
import json
import os
import sys
import threading
import time
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from urllib.parse import parse_qs, urlparse

PORT = int(sys.argv[1]) if len(sys.argv) > 1 else 8765

msgs = []        # {"id", "ts", "from", "to", "kind", "text"}
cursors = {}     # agent -> index into msgs of the first message it hasn't seen
last_seen = {}   # agent -> unix time of last feed/wait call
cond = threading.Condition()

COLORS = {"say": "36", "ask": "33", "reply": "32", "help": "31;1"}


def unread(agent):
    start = cursors.get(agent, 0)
    return [m for m in msgs[start:] if m["from"] != agent and m["to"] in (agent, "all")]


def take(agent):
    """Return unread messages for agent and advance its cursor. Caller holds cond."""
    out = unread(agent)
    cursors[agent] = len(msgs)
    return out


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
        if url.path == "/log":
            with cond:
                return self.send_json({"messages": msgs, "agents": last_seen})
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
                msgs.clear(), cursors.clear(), last_seen.clear()
            print("\033[2m--- reset ---\033[0m", flush=True)
            return self.send_json({"ok": True})
        if url.path != "/post":
            return self.send_json({"error": "not found"}, 404)
        try:
            data = json.loads(self.rfile.read(int(self.headers.get("Content-Length", 0))) or b"{}")
        except ValueError:
            return self.send_json({"error": "bad json"}, 400)
        if not data.get("from") or not data.get("text"):
            return self.send_json({"error": "from and text required"}, 400)
        with cond:
            m = {"id": len(msgs) + 1, "ts": time.time(), "from": data["from"],
                 "to": data.get("to") or "all", "kind": data.get("kind") or "say",
                 "text": data["text"]}
            msgs.append(m)
            cond.notify_all()
        show(m)
        self.send_json(m)


if __name__ == "__main__":
    server = ThreadingHTTPServer(("0.0.0.0", PORT), Handler)
    server.daemon_threads = True
    print("claude-hub listening on 0.0.0.0:%d  (Ctrl-C to stop)" % PORT, flush=True)
    try:
        server.serve_forever()
    except KeyboardInterrupt:
        pass
