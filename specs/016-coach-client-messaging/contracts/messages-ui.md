# Contract: Messages UI

Validated against UI/UX Pro Max guidance (see `checklists/ux-alignment.md`). Strings go through `src/lib/strings.js` in **es** and **en** (`messages.*` keys).

## Entry points
- **Customer page → "Messages" tab** (`Mensajes` in Spanish), id `messages`, order between Progress and Notes. Visible to both coach and customer (customer still has no Feedback/Notes tabs).
- **Tab badge**: when `unreadMessages > 0`, the tab shows a pill with the count ("9+" above 9) and an accessible name such as "3 unread messages" (visually hidden text). Never color alone.
- **Coach customer card**: a `signalBadge` ("N new messages") using the existing icon + text signal row. Hidden at 0.
- **No new floating button.** The AI "Coach assistant" launcher keeps its position; copy never calls human messages "chat with assistant" and vice versa.

## Thread
- Header: names the other party ("Your coach" for a customer; the customer's name for the coach).
- Messages oldest → newest, scrolled to the newest on open.
- Each bubble: sender label (Coach / You), body (plain text via `textContent`, `white-space: pre-wrap`, long words wrap), time. Coach vs customer distinguished by alignment **and** label; AA contrast from existing tokens.
- Coach's own messages show "Read"/"Not read yet" for the latest one (FR-009) and a delete action (labelled button, confirm via existing patterns, ≥ 44 px target).
- Date separators use `YYYY-MM-DD`-consistent formatting from `lib/format.js`.

## Composer
- Visible label ("Message"), multi-line field, `enterkeyhint="send"`, Enter = newline, explicit **Send** button (≥ 44×44 px); Ctrl/Cmd+Enter also sends.
- Counter shown from 900 of 1000 (same as the AI chat), over-limit blocks send with inline message near the field.
- Customer sees the composer only when `canReply`; otherwise a calm empty state ("Your coach hasn't written yet").
- Stays above the on-screen keyboard (dynamic viewport units); typed text is preserved on error.

## States
| State | Behavior |
|-------|----------|
| Loading | Skeleton consistent with `loading.css`, space reserved (no layout shift) |
| Empty (coach) | Friendly prompt to write the first message |
| Empty (customer) | "Your coach hasn't written yet", no composer |
| Sending | Send disabled, "Sending…" |
| Failed | Inline error with **Retry**; text and `clientId` kept (retry cannot duplicate) |
| New arrival while open | Announced once via a polite `role="status"` line ("New message"), not per poll |

## Behavior
- Fetch on tab open; refresh every ~20 s while the tab is visible and the page is not hidden; stop on tab change/unload.
- Opening the tab (with the page visible) calls `POST …/read`, then clears the badges.
- Responsive from 360 px; no horizontal scroll; full keyboard operation with visible focus rings; motion uses existing tokens (collapses under `prefers-reduced-motion`).
