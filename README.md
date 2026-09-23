# Claude with Friends

Your crew's Claude Code agents, on different laptops, building one project together.
They share a goal, split it into parts, agree on interfaces, and answer each other's questions.
They only ping a human when a real decision is needed.

- **One shared goal, split into parts.** Each friend's agent claims a part (a top-level folder), publishes its interface first, and builds against friends' interfaces without waiting.
- **Agents talk directly.** `hub ask bob "…"` from one laptop shows up in bob's session on the next tool call.
- **Idle agents wake up.** A Stop hook with `asyncRewake` long-polls the hub, so a message wakes a Claude that's finished its turn.
- **Live dashboard** at `http://<hub-ip>:8765` shows the goal, the parts board, open questions, the conversation, and pixel Claudes animating what's happening.

No dependencies: `hub.py` is one stdlib Python file, `bin/hub` is the CLI the agents and hooks share.

## Quick start

On the laptop that hosts the hub:
```bash
git clone https://github.com/epaynter/claude-with-friends && cd claude-with-friends
python3 hub.py                      # hub + dashboard on :8765 (allow the macOS firewall prompt)
ipconfig getifaddr en0              # your LAN IP, for friends
bin/agent alice                     # in another terminal: Claude, joined to the hub
```

On each friend's laptop (same wifi):
```bash
git clone https://github.com/epaynter/claude-with-friends && cd claude-with-friends
curl -m 3 http://HUB-IP:8765/log    # must print JSON; venue wifi often blocks this, so use a phone hotspot
HUB_URL=http://HUB-IP:8765 bin/agent bob
```

Then:
1. One friend tells their Claude: *"Our goal is … Done = …"*. It sets the goal, splits it into parts, and claims one.
2. Everyone else types **go** (or *"go, I want web"*). Their agents claim parts and start building.
3. Watch the dashboard. `bin/hub reset` starts over.

Run Claude in auto mode (Shift-Tab) so agents aren't stalled by permission prompts.

## How it works

| Piece | Role |
|---|---|
| `hub.py` | HTTP hub: messages, per-agent unread cursors, long-poll `/wait`, the board (goal, parts, interfaces, status) |
| `bin/hub` | `goal`, `part`, `claim`, `contract`, `status`, `done`, `say`, `ask`, `reply`, `help`, `board`, `log` |
| `.claude/settings.json` | Hooks: `SessionStart`/`UserPromptSubmit`/`PostToolUse` inject new messages and the board; `Stop` + `asyncRewake` wakes idle agents |
| `CLAUDE.md` | The team protocol agents follow |
| `dashboard.html` | The live dashboard |

**Security:** hub messages are injected into every agent's context. Only run it on a network you trust.

MIT licensed.
