# Data Model: Customer Tabbed Page Interface

**Created**: 2026-09-15  
**Version**: 1.0

---

## Overview

The tabbed interface reorganizes existing customer data (from `program.md`, `feedback.md`, `notes.md`) into tab panels without modifying the underlying file formats. This document defines the shape of data flowing through the tab system.

---

## Core Entities

### TabConfig

Metadata for a single tab button and its associated panel.

```typescript
interface TabConfig {
  id: string;                    // Unique identifier: "program" | "feedback" | "history" | "notes"
  label: string;                 // Display text: "Program", "Customer Feedback", "Workout History", "Coach Notes"
  icon?: string;                 // Optional icon identifier (e.g., "dumbbell", "chart", "list")
  isEnabled: boolean;            // Whether tab is shown to user (false if no data available)
  contentType: "program" | "feedback" | "history" | "notes";  // Determines how data is rendered
  order: number;                 // Display order (0=leftmost, 1, 2, 3...)
}
```

**Validation Rules**:
- `id` must be one of the four predefined types (no arbitrary IDs)
- `label` must not be empty
- `order` must be 0-3 (exactly 4 tabs maximum)
- If no data exists for a tab category, `isEnabled` must be `false`

---

### TabPanelContent

The data and metadata for a single tab's displayed content.

```typescript
interface TabPanelContent {
  tabId: string;                 // References TabConfig.id
  data: ProgramData | FeedbackData[] | HistoryData[] | NotesData;
  isEmpty: boolean;              // True if data is null/undefined or empty collection
  errorMessage?: string;         // If data failed to load, explains why
}
```

**Validation Rules**:
- `tabId` must match an enabled TabConfig
- If `isEmpty === true`, `data` should be null or empty collection
- `errorMessage` is optional; present only on error state

---

### ProgramData

Represents current workout program (from `program.md`).

```typescript
interface ProgramData {
  customerId: string;
  goal: string;                  // e.g., "Weight loss", "Muscle gain"
  fitnessLevel: string;           // e.g., "Beginner", "Intermediate", "Advanced"
  weekNumber: number;            // Current week
  exercises: Exercise[];         // Weekly exercise list
  warmup?: string;               // Warm-up guidance
  cooldown?: string;             // Cool-down guidance
  progression?: string;          // Strategy for weeks 2, 4, etc.
}

interface Exercise {
  name: string;
  sets: number;
  reps: string;                  // e.g., "8-10", "12"
  restSeconds: number;
  formTips?: string[];
}
```

**Validation Rules**:
- All fields required except `formTips`, `warmup`, `cooldown`, `progression`
- `exercises` must not be empty
- `sets` must be >= 1
- `restSeconds` must be >= 0

---

### FeedbackData

Individual customer feedback entry (from `feedback.md`).

```typescript
interface FeedbackData {
  date: string;                  // Format: YYYY-MM-DD
  exercise: string;              // Exercise or week reference
  howCustomerFelt: string;       // Energy/pain/difficulty level
  completed: boolean;            // Did customer complete the session?
  notes: string;                 // Additional observations
  overallImpression: "Easy" | "Moderate" | "Hard";
}
```

**Validation Rules**:
- `date` must be valid YYYY-MM-DD format
- `completed` must be boolean
- `overallImpression` must be one of three values
- All fields are required (no optional fields for feedback entries)

---

### HistoryData

Aggregated workout history summary (derived from `feedback.md`).

```typescript
interface HistoryData {
  weekNumber: number;
  sessionsCompleted: number;
  sessionsProgrammed: number;
  completionRate: number;        // 0-1 (0% to 100%)
  avgDifficulty: string;         // "Easy" | "Moderate" | "Hard" | "Mixed"
  highlights?: string[];         // Notable improvements or struggles
}
```

**Validation Rules**:
- `completionRate` must be 0-1
- `sessionsCompleted` must be <= `sessionsProgrammed`
- `avgDifficulty` should be derived from feedback entries (or "Mixed" if varied)

---

### NotesData

Coach observations and recommendations (from `notes.md`).

```typescript
interface NotesData {
  observations: CoachObservation[];
  recommendations: CoachRecommendation[];
}

interface CoachObservation {
  date: string;                  // YYYY-MM-DD format
  exercise?: string;             // If about specific exercise
  observation: string;           // What coach noticed
}

interface CoachRecommendation {
  date: string;                  // YYYY-MM-DD format
  recommendation: string;        // Specific, actionable suggestion
  rationale?: string;            // Why this recommendation (cites specific feedback dates)
}
```

**Validation Rules**:
- All dates must be YYYY-MM-DD format
- `observation` and `recommendation` must not be empty
- Per constitution: recommendations MUST cite justifying feedback dates in rationale

---

### CustomerTabState

Component-level state for active tab and session management.

```typescript
interface CustomerTabState {
  customerId: string;
  activeTabId: string;           // Currently selected tab
  tabs: TabConfig[];             // Ordered list of available tabs
  panelData: Record<string, TabPanelContent>;  // Pre-loaded data for all tabs
  isLoading: boolean;            // Data fetch in progress
  loadError?: string;            // Load failure message
}
```

**Validation Rules**:
- `activeTabId` must match one of the IDs in `tabs` array
- Exactly 4 tabs in `tabs` array (Program, Feedback, History, Notes)
- Only enabled tabs can be set as `activeTabId`
- `panelData` must have entries for all tabs in `tabs`

---

## Data Flow

```
1. Customer page component loads
   ↓
2. Fetch & parse customer data:
   - Read program.md → ProgramData
   - Read feedback.md → FeedbackData[] → calculate HistoryData
   - Read notes.md → NotesData
   ↓
3. Build TabConfig array (determine isEnabled based on data availability)
   ↓
4. Create CustomerTabState object
   ↓
5. Pass state to CustomerTabContainer
   ↓
6. Render TabHeader (buttons) + TabPanel (content)
   ↓
7. User clicks tab → setState(activeTabId) → re-render with new panel
```

---

## Empty State Handling

When a tab has no data:

- `isEnabled = false` → tab button is hidden (not disabled)
- Optionally: `isEnabled = true` + `isEmpty = true` → tab is clickable but shows message "No feedback recorded yet"

**Decision**: For MVP, use `isEnabled = false` (hide empty tabs). Can enhance to `isEnabled = true` + empty message in v1.1 if coaches want to see "no data" state.

---

## State Lifecycle

```
Initial Mount:
  activeTabId = "program" (default)
  
User Clicks Tab:
  setState(activeTabId = "feedback")
  → Component re-renders
  → TabPanel receives new tabId prop
  → Content switches instantly
  
User Refreshes Page:
  Component unmounts → remounts
  → activeTabId resets to "program" (per session-only requirement)
  
User Navigates Away:
  Component unmounts
  → All state discarded (per session-only requirement)
```

---

## Notes

- All data is pre-loaded on customer page mount (eager loading per research.md decision)
- Markdown files (`program.md`, `feedback.md`, `notes.md`) are unchanged; this model reads from them, doesn't modify
- Constitution Principle I compliance: File formats remain identical; UI is reorganization only
- No persistence or backend storage changes required
