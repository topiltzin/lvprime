# Contract: Chat Panel UI

**Feature**: [../spec.md](../spec.md) | **Data model**: [../data-model.md](../data-model.md)

Component: `app/src/components/chat-panel.js` (`mountChatPanel(document.body)`), styles in `app/src/styles/chat.css` (imported from `main.css`), using only existing tokens from `tokens.css`.

## Mounting

- `main.js` calls `mountChatPanel(document.body)` once, right after the first `render()` resolves (next to `renderHeaderAccount`). It is never mounted on the sign-in screen (FR-001).
- It lives outside `#app` and `#sidebar`, so hash-route changes don't re-render or reset it (FR-011).

## Structure

```text
[ launcher button ]               fixed, bottom-right, pill, volt fill
  aria-label="Open coach assistant", aria-expanded, aria-controls="chat-panel"

┌ #chat-panel  role="dialog" aria-label="Coach assistant" ───────────┐
│ header:  "Coach assistant"        [Clear chat]  [Close ×]           │
│ log:     role="log" aria-live="polite"                              │
│   greeting (always first): "Hi! I'm your fitness coach assistant.   │
│            Ask me anything about training or nutrition."            │
│   coach bubble (right-aligned)                                      │
│   assistant bubble (left-aligned, white-space: pre-wrap)            │
│   pending: "Thinking..." (animated dots, respects reduced motion)   │
│   failed:  warning icon + "The coach assistant is unavailable right │
│            now. Try again."  [Retry]                                │
│ form:    <textarea maxlength=1000 rows=1..4>  [Send]                │
│          counter "940 / 1000" shown once length ≥ 900               │
└─────────────────────────────────────────────────────────────────────┘
```

## Behavior

| Trigger | Result |
|---|---|
| Click launcher | Toggles the panel. On open, focus moves to the textarea. `aria-expanded` updates. |
| Close button / `Esc` while panel focused | Closes the panel and returns focus to the launcher. A pending request keeps running. |
| Type text | Send is enabled only when the trimmed text is non-empty and no request is pending. |
| `Enter` | Sends. `Shift+Enter` inserts a newline. |
| Send | Appends the coach bubble (`pending`), clears the textarea, shows "Thinking...", disables Send, calls `askCoach`. Scrolls the log to the bottom. |
| `200 { answer }` | Marks the message `answered` and appends an assistant bubble with `answer` via `textContent`. Scrolls to bottom. Re-enables Send. |
| Any error (incl. 130 s client abort) | Marks the message `failed` and shows the friendly error + Retry under it. Re-enables Send. The text shown is always the fixed friendly line, never raw server text. |
| `401` | Handled by `api-client.js` (sign-in takeover + reload). The panel does nothing special. |
| Retry | Sets the same message back to `pending` and resends its text. |
| Clear chat | Aborts any pending request, empties the conversation, shows only the greeting. |

## Visual rules

- Colors and type come from existing tokens (`--surface-raised`, `--ink`, `--muted`, `--border`, `--accent-fill`, `--accent-contrast`, `--accent-tint`, `--danger`, `--danger-tint`, `--font-body`, `--radius-card`, `--radius-pill`, `--radius-input`), so light and dark follow the app automatically (FR-015).
- Coach bubbles use `--accent-tint`; assistant bubbles use `--surface`, bordered with `--border`.
- Z-index: above page content and header, below toasts (the `main.css` scale is header 100, toast 1000). Use 900.
- Desktop: panel 380 px wide, max-height `min(600px, 100dvh - 120px)`, anchored above the launcher.
- `≤ 480px`: the panel is full-width (16 px gutters) and full-height minus the header, with no horizontal scroll. The launcher stays reachable.
- Keyboard order follows the DOM: Clear chat → Close → (Retry) → textarea → Send. The panel is non-modal (no focus trap), so Tab can leave it.
- Touch targets ≥ 44 px. Body text stays 16 px, per the 40+ audience rule in `tokens.css`.
