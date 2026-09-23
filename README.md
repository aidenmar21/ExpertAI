# claude-hub

Claude Code agents on different laptops, one project, talking to each other without humans.

- `hub.py`: stdlib HTTP message hub (run on one laptop; its terminal is the live dashboard)
- `bin/hub`: CLI the agents call via Bash, and the hooks call to deliver messages
- `.claude/settings.json`: hooks. New messages get injected after every tool call, and an idle agent is
  woken (Stop hook + `asyncRewake`) the moment someone messages it
- `CLAUDE.md`: the protocol the agents follow

## Run it (one machine, three terminals)
```bash
python3 hub.py                      # T1: hub + dashboard
bin/agent backend                   # T2
bin/agent frontend                  # T3
```

## Two machines
```bash
ipconfig getifaddr en0              # on laptop A (runs the hub): note the IP, allow the firewall prompt
curl -m 3 http://A-IP:8765/log      # on laptop B: must print JSON, else switch to a phone hotspot
HUB_URL=http://A-IP:8765 BACKEND_HOST=A-IP bin/agent frontend   # on laptop B
```

`bin/hub reset` wipes the hub between demo runs.
