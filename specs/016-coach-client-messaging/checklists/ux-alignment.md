# UI/UX Alignment Review: Coach–Client Messaging

**Reviewer**: UI/UX Pro Max (searched `ux` domain: unread badge, compact label overflow, input labels, mobile keyboards; checked against `app/src` tabs, chat panel, tokens and styles)
**Date**: 2026-10-06
**Feature**: [spec.md](../spec.md)

## Findings (spec level)

- [x] **Entry point collision** — The app already has a floating 56 px "Coach assistant" (AI) button at bottom-right. A second floating button would clash and confuse real-coach vs. assistant. Resolved: messaging lives in a customer-page tab (FR-015) and is labeled distinctly (FR-016).
- [x] **Existing pattern reuse** — Customer page is tab-based (Program, Nutrition, Progress; coach also sees Feedback, Notes). A Messages tab matches it; coach unread cue goes on the customers list (FR-008, FR-015).
- [x] **Language** — App is Spanish/English; the first draft said Spanish only. Corrected in FR-012.
- [x] **Unread badge accessibility** — Must be count + label, announced as a phrase, one line, "9+" overflow (FR-017).
- [x] **Composer** — Visible label, 44 px send target (app already uses 44 px minimum), keyboard-safe, counter near limit (FR-018; matches existing chat counter behavior at 900/1000).
- [x] **Visual consistency & contrast** — Reuse existing tokens/cards; sender not by color alone; 4.5:1 (FR-019).
- [x] **Responsive & keyboard** — 360 px up, no horizontal scroll, focus visible (FR-020).
- [x] **Feedback & motion** — Sending/failed/empty states, reduced motion (FR-021; the app already honors `prefers-reduced-motion`).

## Open items for planning (not spec blockers)

- Final placement of the coach's per-customer unread cue (card badge vs. row indicator) to be settled in `/speckit-plan` against the customers list layout.
- Run the skill's pre-delivery checklist again on the built UI during implementation.

## Implementation check (2026-10-06, mock-API page, desktop browser; screenshots were unavailable)

- [x] Messages is a tab, not a floating button; AI assistant launcher untouched.
- [x] Composer: visible `<label>` tied to the field, Send button 44 px tall, counter from 900 of 1000, over-limit blocks send with an inline message and `aria-invalid`.
- [x] Failure keeps the typed text and shows an inline message with a 44 px Retry; resend reuses the same clientId.
- [x] Customer with no coach message sees "Tu coach aún no ha escrito" and no composer; coach-only delete with inline confirm; customer never sees delete.
- [x] Tab badge: shows "9+" for 12, with the hidden phrase "12 unread messages"; plural/singular phrases exist in es and en.
- [x] Message text rendered as plain text (a `<b>` typed in the field stays literal). No horizontal overflow with a 120-character unbroken word.
- [x] Bubble text uses the app ink color on tint / raised surfaces (light mode ~15:1 contrast).
- [ ] Not yet verified: screenshots at 360 px, dark appearance, real screen reader, `prefers-reduced-motion`, six-tab coach bar (the Messages tab can sit off-screen in the scrolling bar on a phone).
