# Test Nashvel Live and embedded Chats calls locally

Use the existing `compose.local.yaml` stack. The production Compose file and VPS
deployment are separate and are not changed by these commands.

## Start the local containers

In PowerShell, from `C:/Users/user/Documents/opensource/live`:

```powershell
.\scripts\start-local.ps1 -Recreate
```

This checks Docker access, initializes local-only credentials only if the ignored
`secrets/local-keys.yaml` file is missing, builds the meeting app and recreates the
local containers. Existing credentials and persistent meeting data are preserved.
No Docker volumes are deleted. The helper and meeting app explicitly use the same
local image; the helper does not pull an image from a public registry.

Open Nashvel Live at **http://localhost:3000**. LiveKit signaling is exposed at
**ws://127.0.0.1:7880**, only on this computer. Both applications use this same
local media server; the standalone guest meeting API is not used to authorize Chats.

## Start Chats API

In a second PowerShell terminal, from `live`:

```powershell
.\scripts\start-chats-api.ps1
```

This runs Chats API in the foreground at **http://127.0.0.1:8001**. It passes
`LIVEKIT_URL`, `LIVEKIT_HTTP_URL`, `LIVEKIT_KEY_FILE` and provider availability to
the child process. The API reads the same protected credentials file at runtime.
No credential values are printed or copied into an environment file. Explicit
file credentials take precedence over any other configured LiveKit key/secret.

Port **8001** is the default for the existing local SSO setup. Stop any manually
started API on that port before running the launcher. It uses the selected port
explicitly and exits if it cannot bind; it does not switch to another port.

The launcher uses `--no-reload` because Laravel otherwise removes most process
overrides when it starts its PHP server child. Restart the launcher after changing
server configuration. It refuses to run against cached Laravel configuration;
resolve that deliberately if present rather than clearing it automatically.

Existing database, authentication, Reverb and Jitsi settings are unchanged.
Use your established local Chats setup and test accounts. The scripts do not
create databases, run migrations, seed users, or launch production services.

You can validate launcher paths without starting anything:

```powershell
.\scripts\start-local.ps1 -Check
.\scripts\start-chats-api.ps1 -Check
```

## Start Chats Web

In a third terminal:

```powershell
cd C:\Users\user\Documents\opensource\hillbcs-digital-platform\apps\chats-web
$env:VITE_MEET_PROVIDER_LIVEKIT_ENABLED = 'true'
pnpm dev
```

Use the local URL printed by Vite (configured port **8081**). Its development API
proxy targets `127.0.0.1:8001`. Keep the Chats API launcher running.

## Manual acceptance

1. Open two browser profiles using test members of the same Chats conversation.
2. Start **Standard call**. Verify the inline stage and saved mode for the joiner.
3. Enable microphone/camera and verify both members receive audio/video.
4. Share a screen and verify the other member sees it.
5. Collapse, expand, enter/exit fullscreen, switch conversations and return.
   Verify media remains connected and the composer stays usable outside fullscreen.
6. Leave one member while the other remains; then leave the final member. Verify
   the call ends and a new call can choose a different mode.
7. Start another Standard call and use the starter's **End for everyone** action.
   Verify both media connections close.
8. Test **Admission mode** using your existing Jitsi setup. This local LiveKit
   stack does not provision or replace Jitsi.
9. Independently test the standalone Live website at `localhost:3000`.

Use localhost for this workflow. Other devices cannot reach the loopback-only
ports or advertised local media addresses. LAN/phone testing needs a separately
configured reachable media address and trusted HTTPS.

## Automated standalone browser checks

With the local stack running and Playwright/Chromium installed:

```powershell
node test/browser.mjs
node test/call.mjs
```

These now default to `http://localhost:3000`, use synthetic media and write only
local QA artifacts. A saved meeting link must match that origin. Remote tests
require explicitly setting both `MEET_TEST_ORIGIN` and `MEET_TEST_ALLOW_REMOTE=1`.
The standalone tests do not establish that authenticated Chats integration works;
perform the manual Chats acceptance above too.

## Stop and troubleshooting

The container launcher searches PATH and the usual Docker Desktop installation
locations. For a custom installation, pass
`-DockerExecutable 'D:\Docker\resources\bin\docker.exe'`. If no executable is
found, repair/install Docker Desktop, start it, and open a new terminal before
retrying. An existing Docker data directory alone does not provide the CLI.

Stop the API/Vite processes with Ctrl+C in their terminals. Stop local containers
without removing their data:

```powershell
docker compose -f compose.local.yaml stop
```

If Docker reports `permission denied` for its named pipe, Docker Desktop being
started is not sufficient: the terminal/session also needs access to its API.
Run the launcher from a terminal with Docker access. Do not disable security or
expose the Docker API without authentication.

At preparation time, Compose validation, launcher checks, unit tests and the
focused API regressions passed. This agent session was denied Docker API access,
so container recreation and actual media verification could not be completed.
