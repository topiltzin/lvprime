# Research: Welcome Motivation Popup

## Decisions

### 1. One row per customer, seen-state on the same row
- **Decision**: `welcome_messages` has one row per customer including `last_seen_week` (Monday date of the last week it was shown) and `last_seen_at`.
- **Rationale**: Spec allows one current message per customer; a separate delivery-history table adds nothing in v1. The primary-key read is the cheapest possible due-check.
- **Alternatives**: Message + deliveries tables (needed only if history is wanted later); reuse `customer_messages` rows (would keep customer-reply semantics and make "due" logic awkward).

### 2. Due logic uses the client's local date, validated by the server
- **Decision**: The client sends its local `today` (`YYYY-MM-DD`); the server rejects values more than 1 day from server UTC date, derives `weekStart` (Monday) and ISO weekday, and returns `due = weekday(today) >= deliveryWeekday && last_seen_week != weekStart` (for "once": `last_seen_week IS NULL`).
- **Rationale**: The server does not know the customer's time zone; the spec says "week" and "today" are local. The ±1 day check stops arbitrary dates from forcing re-delivery. Catch-up on later weekdays satisfies FR-005.
- **Alternatives**: Store a time zone per customer (extra setting nobody asked for); use server UTC (greets late-evening customers on the wrong day).

### 3. Fetch after render, never block sign-in
- **Decision**: `main.js` renders the route first, then (customer role only) calls the due endpoint; errors are swallowed silently.
- **Rationale**: SC-007; a failed or slow call must not degrade sign-in.

### 4. Native `<dialog>` + hand-written canvas fireworks
- **Decision**: `showModal()` dialog (as in 017) with a full-viewport `<canvas aria-hidden>` behind the card; 3 staggered bursts of ~28 particles each on open (~1.2 s), one burst on close (~0.5 s); colors from brand tokens (volt, chalk, a warm accent). Particle physics: velocity, gravity, fade; `requestAnimationFrame`; auto-cleanup.
- **Rationale**: Zero dependencies, CSP-safe, accessible modal behaviour for free. Burst count and particle size keep sustained flashing well below 3/s (additive glow is avoided; particles fade smoothly).
- **Alternatives**: canvas-confetti library (new dependency, minor gain); CSS-only particles (limited, heavy DOM); GSAP (heavy for one effect).

### 5. Reduced motion and low-power safeguards
- **Decision**: If `prefers-reduced-motion: reduce`, skip the canvas entirely and use a 150 ms opacity fade. Particle count halves when `navigator.hardwareConcurrency <= 2`; if a frame takes > 50 ms twice the animation stops early. Per the UI/UX Pro Max guidance: respect motion preferences, one hero animation per view, visible focus on modal controls.
- **Rationale**: FR-016, SC-004; the text card is fully usable at all times.

### 6. Fate of 016 messaging
- **Decision**: Keep `customer_messages` and a coach-only `GET /api/customers/:slug/messages` as read-only history; remove customer GET/POST/read/DELETE routes, the customer tab, tab badge, card badge and the `unreadMessages` payload fields.
- **Rationale**: FR-013 requires no history loss; shrinking the surface removes a path for customer-to-coach contact.
- **Alternatives**: Drop the table (loses data); migrate old coach messages as welcome text (spec says no).

### 7. Entry point for the coach
- **Decision**: Reuse the existing `messages` tab slot as a coach-only "Welcome message" tab with the editor on top and a collapsed "Earlier conversation (read-only)" section below.
- **Rationale**: Same tab pattern (FR-020); no new navigation concept.

## Unknowns resolved
All Technical Context fields are decided; no NEEDS CLARIFICATION remain.
