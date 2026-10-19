# Chats embedded calls: implementation plan and session handoff

Date: 2026-10-19  
Status: planning only; integration implementation was reverted at the user's request.

## Read this first in the next Codex session

The user asked for **read-only inspection**, then explicitly requested that the
initial implementation attempt be reverted. That rollback is complete. The user
subsequently authorized this documentation only. **Do not treat this plan as new
authorization to implement, install dependencies, migrate, commit, push, or deploy.**
Start by reading this document and the applicable repository `AGENTS.md` files.
Explain the proposed next step and wait for the user to authorize implementation.
Once implementation is authorized, carry the agreed work through without repeated
confirmation for routine reversible implementation choices.

At the end of the reverted attempt:

- `apps/chats-web` and `apps/chats-api` had no Git changes. This was checked again
  when this handoff was written.
- All tracked files changed by that attempt were restored; its two new call-panel
  files were removed.
- `livekit-client@2.23.0` was removed from Chats Web, and installed dependencies
  were restored using the original lockfile.
- No integration commit or push was made. No migrations or production deployment
  were performed.
- The separate Nashvel Live app and its previously requested improvements remain
  intact. Do not revert those as part of this task.
- Unrelated changes exist elsewhere in the platform repository. Preserve them.

## Desired behavior

Add Discord/Stoat-style calls directly inside a Chats conversation. The group
conversation remains the chat: its existing message history, composer, attachments,
and call records stay in place while the media panel is visible above it.

The first caller chooses one of two modes:

| User-facing choice | Provider | Experience |
| --- | --- | --- |
| **Standard call** | LiveKit | Join the call inside Chats, with a custom media UI and immediate entry for authorized conversation members. |
| **Admission mode** — **Recommended for webinars** | Existing Meet/Jitsi | Keep the current Meet launch and admission experience, including its existing JWT, attendance, and webhook logic. |

Use these product names in the picker. Provider names are implementation details,
not an additional independent choice. Avoid separate provider and admission radio
groups that permit contradictory combinations.

The call's provider is selected once, by the first successful starter, and stays
fixed for that active call. Other members see its selected mode and join that call
without choosing a different provider. After everyone leaves or the call otherwise
ends through its supported lifecycle, a new call may choose either mode.

The screenshots supplied by the user illustrate:

1. A compact media stage above the conversation, showing connection status and
   small centered controls.
2. A connected participant tile with an avatar/name when the camera is off.
3. An expanded media stage, while retaining the call's identity and controls.

The desired layout is inspiration, not a request to replace the entire chat app
with the standalone Nashvel Meet landing page or LiveKit's stock conference page.

## Repositories and boundaries

| Location | Responsibility |
| --- | --- |
| `C:/Users/user/Documents/opensource/live` | Separate Nashvel Live application and self-hosted LiveKit deployment configuration. This handoff lives here. |
| `C:/Users/user/Documents/opensource/hillbcs-digital-platform/apps/chats-web` | Authoritative Chats React frontend. |
| `C:/Users/user/Documents/opensource/hillbcs-digital-platform/apps/chats-api` | Authoritative Laravel Chats API, permissions, call records, attendance, and integration contracts. |
| `C:/Users/user/Documents/opensource/hillbcs-digital-platform/apps/video-conference` | Existing Hillbcs Meet implementation and its own LiveKit-related features. Do not assume its routes are the desired Chats media path. |

Read the platform root `AGENTS.md` and each affected app's `AGENTS.md` before editing.
The platform is a collection of app-local builds, not a root package-manager
workspace. Run installs, checks, and builds from the owning app.

The current session's writable workspace is the separate `live` repository.
Platform edits require the tool's filesystem approval; prior approval is not an
excuse to bypass current sandbox rules.

### Memory and data restrictions

At the beginning of a platform task, read:

`C:/Users/user/Documents/opensource/hillbcs-digital-platform/documentation/knowledge-vault/00-Home.md`

Follow only relevant linked notes. Treat notes and Graphify results as dated
navigation aids, and verify against current code. `07-Source-Index.md` documents
partial graph coverage; neither graph is a complete codebase index. The old Python
runtime path recorded there was unavailable during this session, although `python`
and `graphify` commands were present.

Never inspect or copy environment/credential values, tokens, private database rows,
database dumps, or authentication logs. Configuration variable names and code are
enough for planning. Do not change Git tracking, deployment behavior, or memory
indexing merely to maintain notes. Keep memory local and outside the commit.

## Verified source findings

These are observations from the source on 2026-10-19, not claims that a feature is
deployed or configured correctly. Recheck them in the next session.

### Chats Web

Paths below are relative to `apps/chats-web`:

- `src/features/calls/services/callService.ts`
  - Maps `provider`, `admission_enabled`, room names, signed call-shell URLs, and
    attendance fields into `CallSession`.
  - `getCallProviderOptions()` currently returns only the configured LiveKit
    option, labeled through runtime config.
  - `start()` already sends a `provider` field, plus `admission` and `direct: true`.
  - `join()` currently sends `direct: true`.
  - Contains Jitsi launch, signed-shell, popup, heartbeat, and leave helpers.
  - `shouldEmbedCallSurface()` currently returns `false`.
- `src/features/calls/components/PreCallModal.tsx`
  - Existing call-start dialog has provider and entry-mode concepts.
  - Replace the conflicting choices with the two requested modes.
- `src/features/calls/components/EmbeddedCallFrame.tsx`
  - Existing full-screen iframe host. Its lifecycle and host-origin handshake are
    useful references, but it is not the requested inline media panel.
- `src/features/calls/types.ts`
  - `MeetingProvider` already includes `jitsi` and `livekit`.
  - `CallSession` already has provider, admission, attendance, and launch fields.
- `src/infrastructure/store/ChatStoreContext.tsx`
  - Owns start/join, active versus actually joined calls, browser presence,
    pre-call confirmation, popup preparation, native call handling, and cleanup.
  - The non-LiveKit branch currently uses the direct Meet launch path.
  - The LiveKit branch still contains legacy native/iframe/popup logic; it does
    not establish an inline SDK-based call.
  - Do not pass LiveKit sessions into a native **Jitsi** bridge.
- `src/infrastructure/store/ChatPresenceContext.tsx`
  - Shared high-frequency call state and action contract.
- `src/infrastructure/store/ChatDataContext.tsx`
  - Conversation selection and shared message state.
- `src/features/chat/components/ChatArea.tsx`
  - Normal conversation header, message list, and composer. Potential inline-stage
    mount point above the message list.
- `src/modes/enterprise/EnterpriseShell.tsx`
  - Has a separate conversation/message layout, including
    `EnterpriseMessageListPane`. **Do not assume changing `ChatArea` covers this
    mode.** Inspect and support both applicable layouts.
- `src/features/chat/components/IncomingCallDialog.tsx`
  - Incoming call controls and ringtone. Add a clear call-mode description here.
- `src/infrastructure/realtime/inboxChannel.ts` and `callChannel.ts`
  - Already recognize provider fields in represented payloads. Ensure the API
    actually supplies those fields on all relevant events.
- `src/infrastructure/config/runtime.ts`
  - Has public enable/label configuration for both providers. Client flags are
    not authoritative server authorization or proof of working credentials.

Relevant existing frontend tests:

- `src/features/calls/components/PreCallModal.test.tsx`
- `src/features/calls/services/callService.test.ts`
- `src/features/calls/services/directMeeting.test.ts`
- `src/infrastructure/store/ChatStoreContext.calls.test.tsx`

Chats Web declares `pnpm@11.15.0`. Use its current app-local lockfile. It did not
have a direct `livekit-client` dependency after rollback.

### Chats API

Paths below are relative to `apps/chats-api`:

- `app/Http/Controllers/Api/React/CallController.php`
  - Owns the React start/join/active/ping/left/end call lifecycle.
  - Uses `CallActivityLock` to serialize operations per conversation.
  - At inspection, React start validation did **not** accept/persist the frontend's
    provider choice, even though some other paths inspect call metadata provider.
  - `active()` and the call response need a consistent authoritative provider.
  - The current `direct` path has Jitsi configuration gates and server attendance
    semantics. Those must not accidentally govern inline LiveKit calls.
  - The abandoned-call scan has a LiveKit skip based on assumptions about another
    lifecycle owner. Revisit this deliberately for inline calls; do not create
    permanent orphaned calls or terminate rooms merely from a transient heartbeat.
- `app/Services/Messaging/CallActivityLock.php`
  - Use the existing conversation lock to enforce one active call and first-writer
    provider selection, including retries and simultaneous starts.
- `app/Services/Messaging/CallParticipantRecord.php`
  - Existing participant/remaining-member lifecycle logic. Preserve its distinction
    between local departure and ending everyone's call.
- `app/Events/CallIncoming.php`
  - Broadcast payload currently has admission information but lacked an explicit
    provider field in the inspected implementation.
- `app/Http/Controllers/CallPageController.php`
  - Has a provider branch for an existing LiveKit/Meet handoff and the current
    Jitsi shell. That existing handoff is not proof it uses `live.nashvel.com`.
- `app/Meet/Services/LiveKitTokenService.php`
  - Existing server-side room-scoped JWT generator tied to `MeetSession`.
  - May be factored to expose a room-name-based method while preserving current
    callers. Do not duplicate secret handling or broaden token grants.
- `app/Meet/Http/Api/V1/MeetConnectionController.php`
  - Existing Meet-room connection/admission authorization; use as reference, not
    as permission to bypass Chats conversation membership.
- `config/meet.php`, `config/services.php`, and `.env.example`
  - Inspect code and placeholder variable names only. Runtime credentials and
    deployment configuration were not inspected.
- `routes/api.php`
  - React call endpoints live under `/api/react/v1/conversations/{conversationRef}/call/...`.
  - Preserve the React authentication/ability middleware. Mobile and session/web
    routes are different contracts; document intentional scope.

Relevant API regression suites:

- `tests/Feature/DirectCallLaunchTest.php`
- `tests/Feature/CallLeaveLifecycleTest.php`
- Jitsi token, presence, events, and chat-attendance tests under `tests/Feature`.

`phpunit.xml` configures SQLite `:memory:` and test-safe service drivers. Verify
the effective test setup before running tests; never point a migration or test
runner at a real database. Existing direct-launch tests passed during the reverted
attempt, but that does not validate any future implementation.

## Proposed architecture

### 1. Keep one conversation-owned call record

Use the existing call-start message/lifecycle unless source review reveals a
specific missing invariant. A new schema is not automatically necessary.

Persist at least:

- Authoritative `provider`: `livekit` or `jitsi`.
- Existing call type and admission state.
- Room identity and stable call instance identity.
- Starter identity and lifecycle timestamps through existing records.
- An explicit attendance/lifecycle source if needed to distinguish new inline
  calls from existing Meet handoff calls.

Do not expose internal numeric identifiers where the API uses public references.
For LiveKit, use a unique media room per call instance, so old tokens and delayed
events cannot affect a later call in the same group.

Serialize start, join, leave, end, and connection authorization through the
appropriate existing locks/transactions. A second start with another provider
must reuse the active call's saved mode, rather than creating a second room or
changing its admission state. Broadcast a new invitation only for a genuinely new
call.

Maintain backward compatibility: requests omitting provider should follow the
existing Jitsi contract unless an explicit migration decision changes that.
New frontend starts explicitly send the selected mode.

### 2. Keep the existing Jitsi path intact

For Admission mode, use the current Meet flow with admission enabled. Preserve:

- JWT signing, user identity, room/session binding, expiry, and refresh behavior.
- Current admission roles and host approval.
- Existing attendance source and records.
- Webhooks and their authentication/retry/idempotency behavior.
- Current meeting launch/navigation and supported wrapper behavior.
- Existing leave versus end-for-everyone semantics.

Do not route Jitsi attendance through a new LiveKit browser heartbeat, or label a
Jitsi call as server-attended merely because a generic client requested `direct`.

### 3. Authorize LiveKit through Chats API

Proposed additive endpoint:

`POST /api/react/v1/conversations/{conversationRef}/call/connection`

Proposed request: the expected active room/call identity. Proposed response:
`connection.server_url`, `connection.participant_token`, and expiry if useful.

Before issuing a token, enforce:

1. Valid existing Chats authentication and API ability.
2. Conversation membership and existing read-only/external-inbox restrictions.
3. Matching active call instance and `provider=livekit`.
4. Server-side provider availability and valid media-server configuration.
5. Any existing call-specific authorization rule.

Use names and identity derived from the authenticated server-side user, with a
unique connection identity if multiple devices are supported. Grant only joining,
publishing/subscribing, and data permissions needed for that specific room; no
browser room-admin grants. Return tokens with `Cache-Control: no-store, private`.
Do not log tokens or put them into public URLs, messages, browser persistence,
analytics, documentation, or realtime invitations.

The standalone Nashvel app's guest meeting API is **not** an authenticated Chats
authorization backend. Do not embed its guest landing page or reuse public guest
tokens as a shortcut. Chats API can issue room-scoped tokens for the selected
LiveKit media server when its server-side credentials are configured correctly.

The actual server URL, allowed origins, TURN reachability, and credential setup
remain unverified. Do not assume the production configuration points to
`live.nashvel.com`, or that the localhost Docker service is remotely reachable.

### 4. Give the room one durable frontend owner

Use the LiveKit client SDK with a custom Chats UI. Existing LiveKit React hooks
are also an option if explicitly chosen, but do not replace the conversation with
the stock `VideoConference` component and its separate chat panel.

Separate room/connection ownership from the media panel's placement:

- One connection per locally joined call.
- A compact stage in the active call's conversation.
- Expand, collapse, and fullscreen without reconnecting or losing devices.
- Preserve the connection during ordinary Chats navigation.
- When visiting another conversation, provide a small persistent call surface or
  another clear return-to-call control; do not render the call under the wrong GC.
- Explicit leave disconnects and records the departure once.
- Handle app logout, unmount, session expiry, failed connection, and browser exit.
- Do not let opening a second call silently abandon the first.

A stable portal container can be moved between inline and floating slots, or use
a stable room provider with carefully managed layout. Merely moving a media
component between different React roots/portal targets may remount it. Test this;
do not assume visual persistence proves connection persistence.

Support both the normal `ChatArea` and the Enterprise conversation layout.

### 5. Match the interaction model in the screenshots

First version:

- Connecting/reconnecting/error status.
- Participant video grid with name/avatar fallback.
- Microphone mute/unmute and camera on/off, with accessible pressed states.
- Screen sharing, including viewing remote shares.
- Audio playback enable prompt when the browser blocks playback.
- Device selection where supported.
- Compact, expanded, and fullscreen views with Escape handling as appropriate.
- Leave action; preserve any existing separate end-for-everyone authorization.
- Responsive touch targets and layout.

The group conversation remains the only main chat. Keep its message composer
usable in compact/expanded views. Fullscreen may temporarily cover it but must
have an obvious exit.

Hand raising, reactions, and sounds already exist in the separate Nashvel Live
app. They may be reused in a later agreed scope, but do not assume this integration
request automatically requires porting every standalone meeting feature.

### 6. Make lifecycle ownership explicit

Decide and document whether LiveKit membership/webhooks or a browser lifecycle
bridge is authoritative for attendance and room termination.

For a production-ready result, prefer verified media-server lifecycle signals
where available. Authenticate LiveKit webhooks, bind them to the active call
instance, handle retries and out-of-order events, and never apply Jitsi webhook
assumptions to LiveKit payloads.

If browser heartbeats are retained as an initial bridge, document their limits:

- Actually joined users heartbeat; merely viewing an active call never does.
- A token request is not proof of successful media connection.
- Transient reconnection or a page reload must not end everyone else's call.
- Drain in-flight presence writes before recording a leave.
- Browser close notifications are best-effort and may be cancelled; use existing
  stale-call recovery appropriately.
- The last participant leaving should close the call and allow the next starter
  to choose a different mode.
- A caller leaving while others remain must not end their call.
- Explicit end-for-everyone must terminate the actual media session as well as
  the chat record, or explain and fix the gap before calling the feature complete.
- Stale tokens and delayed events must not revive or terminate another instance.

Do not remove an existing LiveKit reaper exception broadly until the lifecycle
owner for those older rooms is understood. Scope new behavior to the new inline
call type if necessary.

## Implementation phases after authorization

### Phase A — confirm current contracts

1. Check scoped Git status and repository guidance.
2. Re-read the source paths above and relevant tests.
3. Trace both normal and Enterprise call launch paths, plus mobile wrapper
   handling. Establish the exact currently deployed behavior separately.
4. Decide media server and lifecycle ownership without reading secrets.
5. Produce an explicit additive API contract and targeted test cases.

### Phase B — backend contract and tests first

1. Persist/validate provider selection and preserve omission compatibility.
2. Return the saved mode consistently from start, join, active, and incoming events.
3. Add authorized, rate-limited LiveKit connection issuance.
4. Preserve Jitsi direct-launch and admission logic.
5. Add lifecycle handling for the new inline mode and media termination.
6. Update app-local API/operations documentation.

### Phase C — picker and embedded frontend

1. Replace the picker with Standard call and Admission mode.
2. Joiners automatically use the saved mode and see that mode before joining.
3. Skip popup reservation for known Standard calls. If a race reveals an existing
   Admission call, reserve/navigate through the supported launch flow or show a
   clear actionable join control; don't fail silently after user activation ends.
4. Add durable room ownership, custom media stage, and conversation slots for both
   normal and Enterprise modes.
5. Preserve existing conversation messages/composer and popup/Jitsi handling.
6. Prevent duplicate connections and handle permission/error paths.

### Phase D — verification and handoff

1. Run focused backend and frontend regression suites, then relevant broader checks.
2. Typecheck, scoped lint/format checks, and app-local builds.
3. Test real two-browser calls against an explicitly authorized local/test setup.
4. Review scoped diffs for unrelated work, credentials, or generated output.
5. Complete required app release notes and developer changelog.
6. Report exact implementation and deployment status. Do not commit/push/deploy
   unless newly authorized for this integration.

## Required validation matrix

| Area | Minimum cases |
| --- | --- |
| Mode selection | Standard default; Admission choice enables current approval flow; disabled mode cannot be selected; server availability enforced. |
| First caller | Simultaneous starts choosing different providers create one active call and one invitation; retries reuse it. |
| Joining | Existing members receive saved mode; start-as-join cannot switch it; stale room rejects; no active call rejects. |
| Security | Unauthenticated/invalid ability/nonmember/read-only external access denied; token scope/expiry/no admin grants; no secret leakage. |
| Jitsi regression | Existing JWT identity/session/refresh, attendance, webhooks, signed launch, admission, and end behavior pass. |
| LiveKit media | Two browsers publish/receive audio/video, mute/unmute, device changes, screen share, playback permission errors. |
| Layout | Normal and Enterprise views; 320/375/390/768/1024+ widths; stage sizes; composer visible/usable; keyboard focus. |
| Navigation | Same room survives conversation switch, collapse, expand, fullscreen, and return without duplicate connections. |
| Lifecycle | Starter leaves with others present; final leaver; close/reload; reconnect; explicit end; duplicate/out-of-order events; a fresh call can select another mode. |
| Errors | Disabled/unconfigured server, network/API failure, expired token, device denial, screen-share cancellation, blocked popup in Admission mode. |

Tests should validate behavior rather than just assert new CSS or mock away all
connection/lifecycle logic. Update obsolete popup expectations only where the
supported behavior intentionally changed; preserve unrelated regression coverage.

## Lessons from the reverted attempt

These are cautions, not changes that remain applied:

- Adding an early LiveKit return can make later `provider !== "livekit"` checks
  unreachable under TypeScript narrowing. The incomplete attempt hit TS2367 there.
  Refactor obsolete branches instead of piling on conditional paths.
- A single mount point in `ChatArea` misses the separate Enterprise message pane.
- A call-record update alone does not disconnect media for everyone.
- Browser-only presence needs a deliberately supported stale-call policy.
- A full-screen iframe is not the same feature as an inline GC call.
- Dependency installation, tests, and source edits were all rolled back. Do not
  assume the SDK or either new component file is still present in Chats Web.

## Documentation and changelog rules

When implementation is authorized and tracked changes exist:

- Run `node scripts/automation/resolve-developer.mjs` from the platform repository.
  Use its exact returned identity/path; do not infer ownership. It returned
  `nashvel` during this session, but run it again next time.
- Create/update the coherent task's developer changelog in the resolver's directory
  with UTC date, owner, app, type, status, domain, impact, summary, and actual checks,
  following the root guide. Do not alter another developer's entries.
- Add user-facing Chats Web release notes using the app's required JSON schema
  and `docs/RELEASE_VERSIONING.md`.
- Document API contract changes in Chats API docs before switching clients.
- Update the relevant local knowledge note with verified decisions and unresolved
  work, without storing credentials or private data.

## Suggested opening message for the next session

> Read `C:/Users/user/Documents/opensource/live/docs/CHAT_CALL_INTEGRATION_PLAN.md`.
> The previous Chats integration attempt was reverted. Stay read-only for now:
> verify the current Chats Web/API call flow and explain the implementation plan
> for Standard call (inline LiveKit) versus Admission mode (existing Meet/Jitsi).
> Preserve existing JWT, attendance, and webhook behavior, and all unrelated work.

If the user wants to begin coding instead, they can replace “Stay read-only for
now” with an explicit instruction to implement the documented plan.
