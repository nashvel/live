# Nashvel Live

Self-hosted LiveKit media server and a Meet-style web app, deployed at
**https://live.nashvel.com**.

This repository contains the application and deployment configuration. The
SFU runs the [official LiveKit server](https://github.com/livekit/livekit)
Docker image; its upstream source is not vendored here.

## What it does

- Start an instant meeting or create a link for later.
- Join with a meeting code or link.
- Schedule a meeting and download an `.ics` calendar invite.
- Preview and select camera/microphone devices before joining.
- Video grid, audio, screen sharing, chat, device settings, share link, leave/rejoin.

Meetings use guest access: anyone with the link/code can join. The app does
not provide Google sign-in, host admission or automatic invitation emails.
Scheduled records persist on the server; recent links are saved on each
browser. Links expire 30 days after creation or the scheduled start. The
app limits each room to 12 participants; VPS capacity must be load-tested.

## Stack

React + Vite and LiveKit's official React components; a Node.js API using
LiveKit's server SDK and SQLite; Docker Compose; Caddy for TLS and routing.
Only three long-running containers: `livekit`, `caddy`, and `meet`. No
recording, agents, ingress, SIP, Redis or LiveKit Cloud services.

The server image is pinned to LiveKit v1.13.10 with its digest. Node and
Caddy base images are also pinned by digest; npm versions are locked.

## Repository layout

```text
src/                  Meeting website and call interface
public/               Static assets
server.mjs            Meeting registry and scoped token API
compose.yaml          SFU, TLS proxy, and meeting app
Dockerfile            Application image
deploy/caddy.yaml    TLS, TURN routing, and HTTP routing
deploy/livekit.yaml  SFU and embedded TURN settings
scripts/              Credential initialization and media checks
test/                 Unit tests and browser acceptance checks
docs/OPERATIONS.md    Existing VPS operations and validation notes
```

## Deploy on a new Ubuntu VPS

These configurations target `live.nashvel.com`, `turn.live.nashvel.com`,
public IPv4 `40.81.202.35`, and Azure Japan East. If using another host,
update the domains/IP in `deploy/`, `compose.yaml`, `server.mjs`, and the
`PUBLIC_ORIGIN` setting. The API deliberately enforces the expected origin.
Docker Engine and Docker Compose v2 are required. Host networking requires Linux.

```bash
git clone https://github.com/nashvel/live.git
cd live
sudo python3 scripts/init-secrets.py
sudo docker compose build meet
sudo docker compose up -d
```

Point both DNS A records at the VPS. Allow inbound TCP `80,443,7881` and UDP
`3478,50000-60000` in both the host firewall and cloud security group. Keep
SSH access. Ports `3000`, `7880`, `5349`, `8080`, and the Caddy admin API stay
private. Caddy provisions/renews trusted certificates automatically.

**Existing production VPS:** `/opt/livekit` remains the live deployment;
publishing this repository does not relocate it. Reuse its current keys
when switching a deployment to this checkout; do not generate replacement
credentials. Preserve the existing `livekit_caddy_data` and `livekit_meet_data`
Docker volumes. `compose.yaml` retains the `livekit` project name for them.

```bash
# Only when intentionally moving the existing deployment to this checkout:
sudo install -d -m 700 secrets
sudo install -o root -g root -m 600 /opt/livekit/keys.yaml secrets/keys.yaml
sudo install -o 1000 -g 1000 -m 400 /opt/livekit/keys.yaml secrets/meet-keys.yaml
sudo docker compose up -d --build
```

## Development and checks

### Local Docker backend (Windows or Linux)

Use Docker Desktop with its Linux container engine (Hyper-V is supported on
Windows Pro). On Windows, use the local launcher from this repository:

```powershell
.\scripts\start-local.ps1 -Recreate
```

It creates `secrets/local-keys.yaml` only when missing, preserves existing local
credentials and data, builds the app, and recreates the local containers. No key
values are displayed. The file stays ignored and must not use production keys.

For Linux, initialize local credentials before starting the same Compose stack:

```bash
node scripts/init-local-secrets.mjs
docker compose -f compose.local.yaml up -d --build
docker compose -f compose.local.yaml ps
```

Open **http://localhost:3000**. The image includes the frontend and API;
LiveKit runs alongside it. The health endpoint is `/api/health`. This setup
publishes ports only on loopback and is intended for calls on this computer.
It uses separate local credentials and a separate persistent data volume.
For embedded Chats calls against this same local media server, see
[Local Chats testing](docs/LOCAL_CHATS_TESTING.md). The API launcher reads the
protected file at runtime; it does not copy keys into Chats environment files.
Stop it with `docker compose -f compose.local.yaml stop`.

The optional server settings `BIND_ADDRESS`, `LIVEKIT_HTTP_URL`, and
`LIVEKIT_WS_URL` configure container networking. Their defaults retain the
production loopback binding and production LiveKit addresses.

Use Node 24. Run `npm ci`, `npm test`, and `npm run build`. Do not run the
server without its protected credentials and LiveKit dependency.

```bash
npm ci
npm test
npm run build
```

The browser checks use Playwright with synthetic camera/microphone devices:

```bash
npx playwright install --with-deps chromium
mkdir -p qa
node test/browser.mjs
node test/call.mjs
```

These checks default to `http://localhost:3000` and create synthetic local test
meetings. Remote targets require explicit `MEET_TEST_ORIGIN` and
`MEET_TEST_ALLOW_REMOTE=1`; a saved link must match the selected origin.
Run `browser.mjs` first; it saves the test link used by `call.mjs`. `qa/` is
ignored by Git. Tests cover create/copy/join links, prejoin, leaving,
scheduling, calendar export, persistence, mobile layout, two browser video
feeds, chat, and screen sharing. Unit tests cover code/link validation and
calendar escaping/UTC timing. Actual PH–US network conditions and production
capacity still need real-user validation.

## Secrets, data, and access

API secrets, TLS keys/certificates, databases, local dependencies, screenshots,
and runtime logs are excluded from the repository and Docker build context.
The browser receives 15-minute JWTs scoped to existing meeting rooms, with
random participant identities and no administrative grants. The API uses
same-origin mutation checks, rate limits, bounded requests, and prepared SQL.

Back up configuration, protected credentials, the Caddy certificate volume,
and a consistent SQLite backup of `livekit_meet_data`. Do not run
`docker compose down -v` for routine updates.

[Operational notes](docs/OPERATIONS.md) include the existing VPS paths and
known native Python SDK TURN/TLS trust limitations. Browser meeting tests
passed; that does not imply every native SDK/network path is verified.
