# VPS agent prompt: connect existing LiveKit to Chats

LiveKit is already deployed and live. Verify the existing deployment and prepare
its connection details for the Chats integration. Do not reinstall it or disrupt
existing services.

## Verify the existing deployment

- Read the applicable repository and deployment guidance.
- Identify the public LiveKit signaling URL (`wss://...`). Do not assume the
  standalone Live website and media server use the same hostname.
- Locate the existing server API key and secret without printing their values.
- Verify trusted TLS, WebSocket signaling, media connectivity, and TURN
  configuration.
- Verify authenticated RoomService `DeleteRoom` access, which Chats uses to end
  calls.

## Configure the Chats API connection

Chats API requires these server-side environment variables:

```dotenv
LIVEKIT_URL=wss://<existing-signaling-hostname>
LIVEKIT_API_KEY=<existing-server-api-key>
LIVEKIT_API_SECRET=<existing-server-api-secret>
MEET_PROVIDER_LIVEKIT_ENABLED=true
```

Chats API generates short-lived, room-scoped participant JWTs after authenticating
users and checking conversation membership. A manually generated participant JWT
is not a replacement for the server API key and secret.

If Chats API is hosted here, locate its deployment and applicable project
guidance, back up its environment securely, configure these variables, and follow
its documented configuration reload procedure. Preserve all other settings and
services.

If Chats API is elsewhere, prepare the credentials in a protected server-side
file and provide its location and secure transfer instructions. Never paste
credentials into chat, commits, or documentation, and never put them in frontend
`VITE_*` variables. Report credential presence with values redacted.

## Validate and report

Use synthetic test rooms and identities for verification. Remove temporary test
rooms afterward. Verify that authenticated `DeleteRoom` disconnects test clients.

Report:

- The public signaling URL.
- Whether Chats API configuration was completed.
- The protected credential-file location, if a transfer is required.
- Checks performed and their actual results.
- Anything remaining before a real two-browser Chats call can be tested.

Distinguish signaling success from verified audio/video connectivity. Clearly
identify tests that could not be performed.

Do not deploy Chats code, modify Jitsi/Admission mode, replace the standalone Live
website, rotate existing credentials, or change unrelated services. Ask only when
essential information or a disruptive change to an existing service requires my
decision.
