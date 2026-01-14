# PRD: Shareable Playground Sessions via Stateful URL

## Summary
Enable **shareable and restorable Playground sessions via the URL**. As a user makes changes that modify the current `SessionData`, the app serializes that session into the route `/play/:session`, so the URL can be copied and opened elsewhere to load the same session.

## Goals
- **Shareability**: Copy/paste a URL to share an exact Playground session.
- **Restoration**: Opening a shared URL loads the session, not the default state.
- **Non-intrusive navigation**: Session URL updates do not pollute browser history (Back behaves normally).
- **Mobile viewing**: Mobile users can open shared sessions in a “view-only” mode.

## Non-goals
- Server-side session storage, accounts, ownership, or permissions.
- Real-time collaboration.
- Guaranteeing arbitrarily large sessions fit in URL limits (oversize should fail gracefully).

## Terminology
- **SessionData**: The serializable session model defined in `packages/playground/src/types/session.ts`.
- **Persisted session change**: Any change that would be saved by `packages/playground/src/utils/sessionManager.ts`.

## Primary user stories
- As a user, when I change the session, the URL updates so I can share it.
- As a recipient, when I open a shared URL, I land directly in the Playground with that session loaded.
- As a user, pressing Back does not step through prior session states.
- As a mobile recipient, I can open a shared URL and view the session even though editing is not supported.

## Functional requirements

### 1) Session-to-URL updates are driven by persisted session changes
- **Trigger rule**: Regenerate the shareable URL **for every change that would be persisted by** `packages/playground/src/utils/sessionManager.ts`.
- **Non-trigger rule**: Do **not** regenerate the URL for Redux-only actions that do not correspond to persisted session changes (for example: UI toggles, sidebar state, transient selections, etc.).

### 2) URL format & serialization strategy
- **Route pattern**: `/play/:session`
- **Serialization**:
  - Construct a `SessionData` object representing the current session.
  - To minimize URL size, include **only enabled modules** in the `SessionData` that is serialized into the URL (exclude any disabled module entries).
  - Serialize using `JSON.stringify(sessionData)`.
  - Store the serialized string in `:session`.
  - Note: because `:session` is a path segment, the serialized string must be transported in a URL-safe way (e.g., URL-encoding on write and decoding before parsing), while preserving the exact JSON payload produced by `JSON.stringify`.

### 3) History behavior
- When updating the session URL due to a persisted session change, update the browser URL via **replace** semantics (not push).
- **Acceptance intent**: Clicking Back should not iterate through prior session-state URLs.

### 4) App behavior when opened via `/play/:session`
- If the app is opened at `/play/:session`:
  - **Skip homepage** and enter the Playground route directly.
  - After initialization completes, **load the decoded session** instead of the default grid/home session.

### 5) Decode/parse errors must fall back to current behavior
- If the session URL cannot be decoded/parsed into valid JSON (e.g., invalid JSON, unexpected token, truncated URL):
  - Log the error (console or existing logging mechanism).
  - Replace the URL to **`/play`**.
  - Load the homepage/demo **exactly as the app behaves today** when opening the regular URL.

### 6) Mobile behavior when opened via `/play/:session`
When opened on mobile:
- The Playground should load the session but in a special **“FullScreen mode”**:
  - Sidebars are hidden using the UI behavior in `packages/playground/src/slices/ui.ts`.
  - Do **not** use the browser’s native fullscreen API.
- Force the selected tool to **`interact`**.
- The user can **view** the shared session; editing remains unsupported on mobile.
- **In-app browser blocking** must remain unchanged:
  - The `InAppBrowserBlocker` must still work.
  - If opened in an in-app browser with no WebGPU support, show the same blocking UX as the regular `/play` flow.

### 7) Resetting the Playground must revert to `/play`
- Using the **Reset button** in the **ModulesSidebar** must:
  - Replace the URL back to **`/play`**.
  - Keep the URL at `/play` until the user makes a new persisted session change (at which point serialization resumes and `/play/:session` is produced again).

### 8) Clicking “Party” in the TopBar exits to homepage
- Clicking the **“Party”** header in the top-left corner of the TopBar must:
  - Replace the URL back to **`/play`**.
  - Take the user back to the homepage/demo (i.e., exit the playground), matching today’s regular entry flow.

## UX requirements
- **Desktop/supported**: URL updates silently as the session changes.
- **Session URL entry**: No intermediate homepage screen; session loads once initialization completes.
- **Mobile session URL entry**: Enter FullScreen UI (sidebars hidden) + `interact` tool selected.
- **Reset / Party exit**: Both actions should use replace semantics and return to the normal `/play` homepage/demo behavior.

## Error cases & constraints
- **Oversized session URLs**: If the serialized session cannot be stored due to URL length constraints, the system must fail gracefully (no crash). (Exact UX can be a minimal logged warning; this should not break the ability to use `/play` normally.)
- **Initialization ordering**: Session application must occur only after required initialization to avoid partial loads or races with default state.

## Acceptance criteria (testable)
1. **URL update trigger correctness**
   - Given a persisted session change, the URL becomes `/play/:session` representing the latest `SessionData`.
   - Given a Redux-only UI change that is not persisted, the URL does not change.
2. **Correct format & restoration**
   - Opening `/play/:session` skips homepage and loads the encoded session after initialization.
3. **Replace semantics**
   - After multiple session updates, Back does not step through previous session URLs.
4. **Invalid session fallback**
   - Opening an invalid `/play/:session` logs an error, replaces URL to `/play`, and loads the homepage/demo like today.
5. **Mobile behavior**
   - Opening `/play/:session` on mobile hides sidebars (FullScreen UI), forces `interact`, loads the session, and preserves existing InAppBrowserBlocker behavior.
6. **Reset behavior**
   - Clicking Reset replaces URL to `/play` and keeps it there until the next persisted session change.
7. **Party exit behavior**
   - Clicking the Party header replaces URL to `/play` and returns to homepage/demo.

