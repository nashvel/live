# Nashvel Meet

Live at https://live.nashvel.com. A guest meeting app backed by the existing
self-hosted LiveKit SFU. This replaces the former static landing page.

## Features

- Instant meetings, create-a-link-for-later, join by code or this site's URL.
- Scheduled meetings with local time-zone display and downloadable .ics invites.
- Pre-join name, camera/microphone preview, device selection and toggles.
- LiveKit video grid, screen sharing, non-persistent chat, device settings,
  meeting link sharing, leave and rejoin.
- Recent meeting links saved in this browser only. Meeting records persist
  on the VPS in SQLite. No public meeting directory is exposed.

Guests do not need accounts. Anyone with a valid meeting link/code can join;
there is no host approval/waiting room, Google account login or moderator
role. This is an independently branded Meet-style app, not Google Meet.
Calendar invitations must be downloaded/imported/shared by the user; no
emails or server-side reminders are sent. Links remain valid for 30 days
from creation (or from the scheduled start). Meeting rooms allow up to 12
participants; this is a protective app setting, not a measured VPS capacity.

## Layout

- src/main.jsx: home, scheduling and share dialogs, client navigation.
- src/room.jsx: prejoin and LiveKit conference UI.
- src/utils.js: code normalization, calendar export and API helpers.
- server.mjs: same-origin API, SQLite meeting registry and JWT issuance.
- package-lock.json: exact npm dependency lock.
- Dockerfile: pinned Node 24 base, build stage, non-root runtime.
- /opt/livekit/compose.yaml: livekit, caddy and meet services.
- /opt/livekit/caddy.yaml: TLS, signaling/media API routes and app proxy.
- Docker volume livekit_meet_data: SQLite database and WAL files.

The Node API listens on 127.0.0.1:3000 only. Caddy exposes the app over
HTTPS and proxies /rtc and /twirp to LiveKit. PROXY protocol from the TLS
router preserves the client IP for rate limiting. The HTTP listener that
accepts these headers binds to loopback only.

## Security and operations

API signing secrets are not included in browser bundles. The app reads
/opt/livekit/meet-keys.yaml through a read-only file mount, and issues
15-minute JWTs scoped to the requested existing meeting with random user
identities and no admin/create-room grants. Server-side room creation uses
the protected service credentials. There are per-IP request limits,
strict mutation Origin checks, bounded bodies, prepared SQL, secure headers
and expired-record cleanup. Guest links are access credentials: distribute
them only to intended participants. There is no end-to-end encryption claim.

The container runs as UID 1000, drops all capabilities, has a read-only root
filesystem and 384 MiB memory ceiling. SQLite lives on a persistent Docker
volume. Service logs rotate, and Docker restarts the app automatically.
Back up meeting data and the LiveKit/Caddy config securely. Use a consistent
SQLite backup (SQLite backup API or stop meet before copying the database
and WAL), not an isolated copy of the live main database file.

Build and deploy:

    docker build -t nashvel-meet:1.0.2 /home/nacht/nashvel-meet
    sudo docker compose -f /opt/livekit/compose.yaml up -d meet

Compose currently refers to the deployed local image tag. After changing
tags, update image in Compose before running up. Builds pin the base image
digest and npm lockfile. Restarting only meet does not restart the SFU.

    sudo docker compose -f /opt/livekit/compose.yaml logs --tail 100 meet
    sudo docker compose -f /opt/livekit/compose.yaml ps

The preceding static page remains available as a rollback artifact under
/opt/livekit/landing and Caddy/Compose before-meet snapshots. Do not apply
old snapshots casually; they remove the app route.

## Verification

Unit tests cover code/link normalization, rejection of other-site links,
UTC calendar timing and calendar-content injection/line folding.
API checks cover invalid schedules, unknown rooms, cross-origin mutation
rejection, unique participant identities and room-scoped JWT grants.
Browser QA uses a temporary Playwright container with synthetic devices;
it is not a deployed service. Screenshots and test output are under qa/.
The app's browser tests do not measure PH-US network quality or prove
production capacity. Validate real microphones, cameras and screen sharing
from the intended end-user networks before a wider rollout.

Browser acceptance checks passed on the deployed application: create and copy
a meeting link; join by link; pre-join; leave; scheduling and .ics download;
reload persistence; mobile overflow check; two browser participants receiving
two decoded camera streams; chat delivery; screen sharing to the second
browser; both participants leaving cleanly. The browser context used fake
media devices for automation. API security checks and unit tests also passed.
