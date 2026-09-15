# Implementation Plan: Customer Tabbed Page Interface

**Branch**: `001-customer-tabbed-page` | **Date**: 2026-09-15 | **Spec**: [spec.md](spec.md)

**Input**: Feature specification from `/specs/001-customer-tabbed-page/spec.md`

## Summary

Replace the scrolling customer profile page with a tabbed interface organizing customer information (Program, Feedback, History, Notes) into separate, instantly-switchable sections. Coaches can navigate between categories without page reload, improving information discovery and reducing cognitive load.

## Technical Context

**Language/Version**: TypeScript/JavaScript (React with Next.js on Vercel)

**Primary Dependencies**: React (component-based UI), Next.js (routing/framework), Vercel (hosting/deployment)

**Storage**: Markdown files on filesystem (`customers/[customer-name]/*.md`); no database changes required

**Testing**: Manual verification before save (per constitution); no automated test suite; UI testing via browser interaction

**Target Platform**: Web (responsive, 320px+ screens)

**Project Type**: Web application (Next.js frontend + customer data file management)

**Performance Goals**: Tab content load within 200ms; instant visual feedback on tab click

**Constraints**: No backend API changes; tabs are pure frontend reorganization; file formats unchanged

**Scale/Scope**: Single feature affecting customer profile page rendering

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

**Gate Status**: PASS (with notation)

- ✅ **Principle I (Content & Program Quality)**: No violation. Markdown file formats (`program.md`, `feedback.md`, `notes.md`) remain unchanged; this is purely a UI/presentation layer change.

- ⚠️ **Principle III (User Experience Consistency)**: CRITICAL COMPLIANCE REQUIRED. Tab interface must be implemented identically across all customer pages. Tab labels, order (Program → Feedback → History → Notes), styling, and behavior must be consistent. This is a material UX change affecting how users navigate — inconsistency here directly violates "all customer-facing output MUST be consistent in structure, tone, and terminology."

- ✅ **Principle IV (Performance & Responsiveness)**: No violation expected if tabs load cached content instantly. Requirement is already in spec (200ms target).

**Action**: Implement tab component as a single, reusable module used on all customer pages to ensure consistency.

## Project Structure

### Documentation (this feature)

```text
specs/[###-feature]/
├── plan.md              # This file (/speckit-plan command output)
├── research.md          # Phase 0 output (/speckit-plan command)
├── data-model.md        # Phase 1 output (/speckit-plan command)
├── quickstart.md        # Phase 1 output (/speckit-plan command)
├── contracts/           # Phase 1 output (/speckit-plan command)
└── tasks.md             # Phase 2 output (/speckit-tasks command - NOT created by /speckit-plan)
```

### Source Code (repository structure)

The tabbed interface will be implemented as React components integrated into the existing Next.js frontend. No new top-level projects; changes are additive to existing structure:

```text
[project-root]/
├── app/customers/[customer-id]/  # Existing customer page route
│   └── page.tsx                  # (will be updated to use new TabContainer)
│
├── components/
│   └── customer/                 # (new or existing customer components)
│       ├── CustomerTabContainer.tsx    # NEW: Main tabbed interface wrapper
│       ├── TabPanel.tsx               # NEW: Individual tab content renderer
│       └── TabHeader.tsx              # NEW: Tab navigation buttons
│
└── lib/
    └── customer-data.ts          # (existing, may add data-loading helpers)
```

**Structure Decision**: Single-project web app structure. Tabs are frontend-only presentation changes with no backend reorganization needed. New React components will be co-located with existing customer components for maintainability.

## Phase 0: Research

**Focus**: Clarify technical decisions and validate best practices for the React/Next.js environment

### Research Tasks

1. **Tab State Management Pattern** (Clarify strategy for managing active tab)
   - Question: Should active tab be managed via URL query params, React state (local component), or context provider?
   - Impact: Affects session-state reset behavior and browser back-button behavior

2. **Scroll Behavior & Content Overflow** (Clarify scrolling model)
   - Question: Should each tab have its own scrollable container, or should page scroll position reset per tab?
   - Impact: Affects UX consistency and performance

3. **Data Loading Strategy** (Clarify how tab content is populated)
   - Question: Should all tab content be loaded on page mount, or lazy-loaded when tab is clicked?
   - Impact: Affects initial page load time vs. tab switch latency

4. **Component Library & Styling** (Verify existing patterns in project)
   - Question: Are there existing tab/accordion components or styling patterns in the project to reuse?
   - Impact: Ensures consistency with existing UI

**Outcome**: `research.md` with decisions on each point, rationale, and recommended implementation pattern.

## Phase 1: Design & Contracts

**Prerequisites**: `research.md` complete

### 1. Data Model (`data-model.md`)

Define the shape of tab configuration and content structure:

**TabConfig**
- `id`: unique tab identifier (e.g., "program", "feedback", "history", "notes")
- `label`: display text (e.g., "Program", "Customer Feedback")
- `icon`: optional icon identifier
- `isEnabled`: boolean (true by default; false if no data available)
- `contentType`: category of data to render ("program" | "feedback" | "history" | "notes")

**TabPanelContent**
- `tabId`: which tab this content belongs to
- `data`: raw content (Program object | Feedback[] | History[] | Notes[])
- `isEmpty`: boolean (true if no data to display)
- `errorMessage`: optional error state message

**CustomerProfile** (existing, updated for tabs)
- `customerId`: unique identifier
- `name`: customer name
- `tabs`: TabConfig[] (ordered list of available tabs for this customer)
- `currentTabId`: string (session-scoped; reset on refresh)

### 2. Interface Contracts (`contracts/`)

**Tab Switching Contract** (`contracts/tab-interaction.md`)
```
INPUT: User clicks tab with id "feedback"
OUTPUT: 
  - Active tab indicator moves to "feedback" tab
  - Feedback content renders in panel
  - Program tab content unrenders
  - Total time to render: <200ms
  - URL/state does NOT change (session-only, per spec)
  - Scroll position within feedback panel: reset to top
```

**Empty State Contract** (`contracts/empty-state-rendering.md`)
```
INPUT: Tab is enabled but data is empty (e.g., no feedback recorded)
OUTPUT: Tab renders a friendly message ("No feedback recorded yet")
  - Message is prominent but not intrusive
  - Message matches UX tone of project
  - User can still click the tab; empty state is displayable
```

**Responsive Contract** (`contracts/responsive-tabs.md`)
```
Desktop (>600px):
  - Tabs arranged horizontally, buttons side-by-side
  - Tab labels fully visible
  
Mobile (320-600px):
  - Tabs may stack or use horizontal scroll if space constrained
  - Tab buttons remain tappable (min 44px height)
  - Interface remains single-column; no cramping
```

### 3. Quickstart Validation Guide (`quickstart.md`)

Runnable scenarios proving the feature works end-to-end:

**Scenario 1: Tab Switching**
- Prerequisites: Customer with program.md, feedback.md, history data
- Setup: Navigate to customer page
- Action: Click "Feedback" tab, then "History" tab, then "Program" tab
- Expected: Each click shows corresponding data instantly; active tab visually distinguished
- Success Criteria: All 3 tabs display unique content; no page reload occurs

**Scenario 2: Empty State Handling**
- Prerequisites: Customer with program data but no feedback entries
- Setup: Navigate to customer page, Feedback tab enabled
- Action: Click "Feedback" tab
- Expected: Friendly empty-state message appears; tab remains clickable
- Success Criteria: No errors; message is clear and on-brand

**Scenario 3: Mobile Responsiveness**
- Prerequisites: Customer page on mobile browser (simulated 375px viewport)
- Setup: Navigate to customer page on mobile
- Action: Tap tabs; scroll within tab content if content exceeds height
- Expected: Tab buttons remain tappable; content scrolls within panel; no horizontal scroll of page
- Success Criteria: Interface remains usable; no cramping or overflow

**Scenario 4: Session State Reset**
- Prerequisites: Customer page loaded with History tab active
- Setup: User refreshes page with History tab selected
- Action: Page reloads
- Expected: Default "Program" tab is selected (not History)
- Success Criteria: Refresh resets tab to default; confirms session-only state

## Next Steps

1. **Run Phase 0 research** to resolve data-loading and state-management questions
2. **Generate Phase 1 artifacts** (data model, contracts, quickstart)
3. **Proceed to `/speckit-tasks`** to break down implementation into actionable tasks
4. **Implementation** will follow task list with verification at each step (per constitution)

**Complexity Tracking**: No violations; single-project, frontend-only feature with no exceptional complexity.
