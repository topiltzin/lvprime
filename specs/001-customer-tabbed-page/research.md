# Research Findings: Customer Tabbed Page Interface

**Created**: 2026-09-15  
**Status**: COMPLETE

---

## 1. Tab State Management Pattern

**Question**: Should active tab be managed via URL query params, React state (local component), or context provider?

**Decision**: React local state (useState hook) in CustomerTabContainer component

**Rationale**:
- Feature requirement specifies session-only state (reset on refresh) — this aligns perfectly with React component state lifecycle
- URL query params would persist across refreshes, violating the session-only requirement
- Context provider adds unnecessary complexity for a single-page feature
- Next.js provides server-side rendering; query params would require SSR-aware management (added complexity)
- Local state is simplest, most performant, and fully satisfies requirements

**Alternatives Considered**:
- URL query params: Would require careful SSR handling; would persist state across refreshes (violation)
- Context/Redux: Overkill for a single tab; would require provider wrapper and boilerplate
- localStorage: Explicitly rejected by spec (session-only scope)

**Implementation Detail**: Use `useState("program")` to track active tab, reset to default on component mount

---

## 2. Scroll Behavior & Content Overflow

**Question**: Should each tab have its own scrollable container, or should page scroll position reset per tab?

**Decision**: Each tab content area has `overflow: auto` (independent scrolling); main page does not scroll

**Rationale**:
- Requirement FR-007 explicitly states: "Each tab's content area MUST scroll independently if content exceeds viewport height"
- Independent scroll prevents janky page-level scroll jumps when switching tabs
- Consistent with common UX patterns (mobile-friendly, desktop-friendly)
- Easier to implement: CSS `overflow: auto` on tab panel, fixed header for tab buttons

**Alternatives Considered**:
- Page-level scroll + scroll-to-top on tab switch: Creates jarring experience; violates FR-007
- No scrolling (overflow: hidden): Content would be cut off; violates accessibility and requirement FR-007

**Implementation Detail**: Tab button header uses `position: sticky` or `position: fixed`; each TabPanel has max-height with `overflow-y: auto`

---

## 3. Data Loading Strategy

**Question**: Should all tab content be loaded on page mount, or lazy-loaded when tab is clicked?

**Decision**: Load all tab content on page mount (eager loading)

**Rationale**:
- Customer data is already loaded in the parent component from markdown files (`program.md`, `feedback.md`, `notes.md`)
- Data payload is small (fitness coaching data, not media); no performance penalty for eager load
- Requirement SC-002 specifies "Tab content loads and displays instantly (within 200ms)" — eager load guarantees this
- Lazy loading adds complexity (loading state indicators, error handling per tab) without proportional benefit
- Simpler implementation: Pass all data to TabContainer; each TabPanel receives its data slice

**Alternatives Considered**:
- Lazy loading: Would add loading spinners, potential network delays, error states per tab (unnecessary complexity)
- Server-side SSR fetch per tab: Would require additional API routes and server-side logic (out of scope per spec)

**Implementation Detail**: Parent component (customer page) fetches all markdown files; TabContainer receives parsed data object; each TabPanel receives pre-loaded data slice

---

## 4. Component Library & Styling Patterns

**Question**: Are there existing tab/accordion components or styling patterns in the project to reuse?

**Decision**: No existing tab components found; build custom TabContainer/TabPanel components using React hooks + CSS

**Rationale**:
- Lili Trainer project is a custom fitness coaching app; reviewed existing component structure
- No shadcn or material-ui tab components currently in use
- Custom implementation allows 100% consistency with project's design language
- Custom solution is lightweight: ~150 LOC for tab container + styling
- Avoids external dependencies; stays aligned with Vercel/Next.js ecosystem minimal approach

**Styling Approach**:
- Use CSS modules or inline styles (whichever matches project convention)
- Tab buttons: horizontal layout with active-state underline or background highlight
- Tab panels: fixed height with overflow-y: auto for content scrolling
- Mobile: horizontal flex layout with optional horizontal scroll for tab buttons if needed
- Accessibility: Semantic HTML (button elements for tabs, ARIA roles optional for MVP)

**Alternatives Considered**:
- Material-UI Tabs: Too heavy; not in project dependencies
- shadcn Tabs: Excellent but adds build tooling; project appears minimal
- Headless UI: Good option but not currently in stack; custom build is simpler

**Implementation Detail**: Create `CustomerTabContainer.tsx` with `useState` for active tab; render `TabHeader` (tab buttons) + `TabPanel` (content area) using conditional rendering

---

## Resolved Unknowns Summary

| Unknown | Decision | Implementation |
|---------|----------|-----------------|
| State management | React useState | Reset on mount |
| Scroll behavior | Each tab independent | CSS overflow: auto |
| Data loading | Eager (all on mount) | Parse files server-side |
| Components | Custom build | ~150 LOC React hooks |

---

## Design Implications

All four research decisions support the primary requirements:

1. **Session-only state** (spec requirement) ✅ — useState automatically resets on component remount
2. **Instant tab switching** (200ms target, SC-002) ✅ — Eager load + local state ensures <50ms render
3. **Mobile responsiveness** (SC-004, 320px+) ✅ — Flexible CSS layout, independent scrolling
4. **Consistency** (Constitution Principle III) ✅ — Single reusable component ensures identical behavior across all customer pages

Ready to proceed to Phase 1 design artifacts.
