# Phase 1: Data Model — Nutrition Plan Tab

**Date**: 2026-09-16  
**Status**: Complete

## Overview

This section defines the data structures and entities involved in the Nutrition Plan Tab feature.

---

## Entity: NutritionPlan

**Purpose**: Represents the nutritional guidance for a specific customer

**Source**: File-based (`customers/[customer-name]/nutrition_plan.md`)

**Structure**:

| Field | Type | Required | Notes |
|-------|------|----------|-------|
| `customer_slug` | string | Yes | Customer identifier, matches directory name (e.g., "jaqueline-orellano") |
| `content` | string (markdown) | Yes | Raw markdown content from nutrition_plan.md file |
| `last_modified` | date (ISO-8601) | No | File modification time; used for cache invalidation (future) |
| `file_path` | string | Yes | Absolute path: `/customers/[customer-slug]/nutrition_plan.md` |

**Validation Rules**:

- `content` MUST be valid UTF-8 markdown text
- `content` may be empty string (no plan created yet) → empty state message shown
- `content` MUST NOT exceed 100KB (per spec FR-008)
- `customer_slug` MUST match regex: `^[a-z0-9]([a-z0-9-]*[a-z0-9])?$` (lowercase, hyphens)

**State**:

- **Created**: nutrition_plan.md exists and contains markdown
- **Not Yet Created**: nutrition_plan.md does not exist → empty state UI shown
- **Invalid**: File exists but is not readable → error message shown

**Relationships**:

- Belongs to one **Customer** (via customer_slug)
- Displayed on **CustomerProfile** page in **NutritionTab** component

---

## Entity: TabConfig (Extended)

**Purpose**: Configuration for individual tabs in the tab navigation

**New Tab Instance for Nutrition**:

| Field | Value | Type |
|-------|-------|------|
| `id` | 'nutrition' | string |
| `label` | 'Nutrition Plan' | string |
| `icon` | '🥗' (optional) | string |
| `isEnabled` | true if nutrition_plan.md exists, false otherwise | boolean |
| `contentType` | 'nutrition' | string |
| `order` | 2 (after Program, before Feedback) | number |

**Integration**: Passed to TabContainer constructor alongside existing tabs (program, feedback, notes)

**Example**:

```javascript
const tabs = [
  { id: 'program', label: 'Program', isEnabled: true, contentType: 'program', order: 1 },
  { id: 'nutrition', label: 'Nutrition Plan', isEnabled: true, contentType: 'nutrition', order: 2 },  // NEW
  { id: 'feedback', label: 'Feedback', isEnabled: true, contentType: 'feedback', order: 3 },
  { id: 'notes', label: 'Notes', isEnabled: true, contentType: 'notes', order: 4 }
];
```

---

## Entity: TabData (Extended)

**Purpose**: Complete data object passed to TabContainer with all tab content

**New Property for Nutrition**:

```javascript
const data = {
  program: { /* existing program data */ },
  feedback: { /* existing feedback data */ },
  notes: { /* existing notes data */ },
  nutrition: {  // NEW
    content: "## Nutrition Goals\n\n- Increase protein intake...",
    isEmpty: false,
    error: null
  }
};
```

**Properties**:

| Field | Type | When Set | Notes |
|-------|------|----------|-------|
| `content` | string | Always | Markdown text from nutrition_plan.md, or empty string if file doesn't exist |
| `isEmpty` | boolean | Always | true if nutrition_plan.md doesn't exist or is empty |
| `error` | string \| null | If error occurs | Error message if file read failed |

---

## Key Relationships

```
Customer
  ├── program.md ─→ Program Tab ─→ TabContent (rendered as daily breakdown + PDF export)
  ├── feedback.md ─→ Feedback Tab ─→ TabContent (rendered as entry list + form)
  ├── notes.md ─→ Notes Tab ─→ TabContent (rendered as insight list)
  └── nutrition_plan.md ─→ Nutrition Tab ─→ TabContent (rendered as marked HTML)  [NEW]
```

---

## Validation & Error Handling

### File Read Errors

**Scenario**: nutrition_plan.md file is missing

**Handling**:
```javascript
if (!nutritionContent) {
  data.nutrition = {
    content: "",
    isEmpty: true,
    error: null
  };
  // UI shows: "No nutrition plan available yet."
}
```

**Scenario**: File read fails (permission, disk error, etc.)

**Handling**:
```javascript
data.nutrition = {
  content: "",
  isEmpty: false,
  error: "Unable to load nutrition plan. Please try again."
};
// UI shows error message
```

### Content Validation

**Scenario**: nutrition_plan.md is empty or whitespace-only

**Handling**: Treat as isEmpty = true; show empty state message

**Scenario**: nutrition_plan.md contains broken markdown syntax

**Handling**: `marked` library renders it as-is (graceful degradation). No validation of markdown structure required.

**Scenario**: nutrition_plan.md exceeds 100KB

**Handling**: Server-side check before returning to client. Return error if exceeded (per spec FR-008).

---

## Future Extensibility

This data model supports future enhancements:

- **Nutrition Metadata**: Add `createdDate`, `authorName`, `version` fields for tracking
- **Export**: Add `pdf_export()` method if nutrition PDF export is requested (currently not in scope)
- **Multiple Plans**: Store version history if plan revisions are tracked
- **Nutrition Analytics**: Add fields for tracking customer adherence metrics

---

## Summary

- **1 New Entity Type**: NutritionPlan (file-based, read-only)
- **1 Extended Entity**: TabConfig (adds 'nutrition' tab type)
- **1 Extended Data Structure**: TabData (adds nutrition property)
- **No Database Changes**: File-based storage, no migration needed
- **No Breaking Changes**: Existing entities remain unchanged
