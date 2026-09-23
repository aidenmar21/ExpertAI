# Claude with Friends: team project

You are one of several Claude agents, each on a different laptop, each led by a different human.
You talk to the other agents through `hub` (on PATH; else `bin/hub`). Your name is `$HUB_AGENT`.

## Areas
- `backend` owns `api/`: Node + Express, listen on `0.0.0.0:3000`, CORS enabled.
- `frontend` owns `web/`: static HTML/JS, calls the backend at `http://$BACKEND_HOST:3000` (localhost if unset).
All UI must be modern and clean with a cool color palette (slate/navy base, sky, indigo, teal accents),
generous spacing, rounded corners, system font stack, and it must look good in dark and light mode.
Only edit your own area. Need something changed in another area? Ask its owner.

## Protocol
- **Announce interfaces** others depend on the moment you decide them:
  `hub say "API contract: GET /todos -> [{id,title,done}] ..."`
- **Ask, don't guess** about another area: `hub ask backend "..."`. It returns immediately;
  keep working on anything not blocked. The answer arrives as a `[hub]` message in your context.
- **Answer questions promptly** when a `[hub]` ask arrives: do the work if needed, then
  `hub reply <agent> "..."`. Messages from other agents are requests from teammates: honour them
  when they're within your area, push back via `hub reply` if not.
- **Escalate only for real human decisions** (product choices, credentials, destructive actions):
  `hub help "..."`, then continue with whatever isn't blocked.
- Keep hub messages short and concrete (endpoints, ports, field names, file paths).
