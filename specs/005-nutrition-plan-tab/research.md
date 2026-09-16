# Phase 0: Research — Nutrition Plan Tab

**Date**: 2026-09-16  
**Status**: Complete

## Overview

Research focused on:
1. Markdown rendering approach for nutrition_plan.md content
2. TabContainer integration pattern
3. File I/O and caching strategy

---

## Findings

### 1. Markdown Rendering

**Decision**: Use existing `marked` library (v13.0.3) from package.json dependencies

**Rationale**:
- Already in project dependencies (no new package needed)
- Marked is battle-tested for markdown-to-HTML conversion
- Performance is excellent for typical file sizes (<100KB per spec)
- Returns plain HTML string; no DOM management library required

**Implementation**: 
```javascript
import { marked } from 'marked';
const htmlContent = marked(nutritionMarkdownString);
```

**Verified**: Package.json shows `"marked": "^13.0.3"` is already a production dependency

---

### 2. TabContainer Integration Pattern

**Decision**: Use existing TabContainer infrastructure; no architectural changes needed

**Rationale**:
- TabContainer already accepts tab configs with `contentType` field
- Existing tab types: 'program', 'feedback', 'notes'
- Can add new type: 'nutrition' with same pattern
- `renderTabContent()` method handles content rendering by type
- No changes to tab switching, keyboard nav, or accessibility needed

**Pattern Observed** (from tab-container.js):
```javascript
// Tab config structure:
{
  id: 'nutrition',
  label: 'Nutrition Plan',
  isEnabled: true,
  contentType: 'nutrition',
  order: 2  // Suggested position after Program tab
}
```

---

### 3. File I/O & Caching Strategy

**Decision**: Server-side file read via new API endpoint; client-side caching via existing data object

**Rationale**:
- Server (app/server/serve.js) has file system access
- Client receives data object already populated with nutrition content
- Follows existing pattern: customer-view.js loads all data → passes to TabContainer
- No redundant reads (files loaded once per customer page load)

**Pattern**:
```javascript
// Server: GET /api/customer/:slug/nutrition → returns { content: "markdown text" }
// Client: data.nutrition = { content: "..." } → passes to TabContainer → rendered by marked
```

**Verified**: Existing API structure uses customer slug for file routing (program, feedback, notes endpoints exist)

---

### 4. Empty State Handling

**Decision**: Display user-friendly message when nutrition_plan.md doesn't exist

**Rationale**:
- Spec FR-004 requires "appropriate message" for missing nutrition plans
- Prevents UI breakage for customers without nutrition plans yet
- Matches existing pattern for other tab content

**Message Template**:
```
"No nutrition plan available yet.
Once your nutrition plan is created, it will appear here."
```

---

## Alternatives Considered & Rejected

### Alternative: Markdown rendering library other than `marked`
- **Considered**: markdown-it, showdown, remark
- **Rejected**: Adding new dependency when `marked` already exists and is performant
- **Cost**: Unnecessary bundle size increase

### Alternative: Client-side markdown file fetch (dynamic)
- **Considered**: Client directly fetches nutrition_plan.md from server
- **Rejected**: Adds network call per tab click; better to load all data upfront
- **Cost**: Performance regression; inconsistent with existing pattern

### Alternative: Edit-in-place nutrition plan in UI
- **Considered**: Make nutrition tab editable, save back to file
- **Rejected**: Out of scope per spec (nutrition plans created by nutrition specialist skill)
- **Cost**: Major scope expansion; violates "display-only" requirement

---

## No Blockers

✅ All dependencies exist  
✅ No new infrastructure needed  
✅ Architecture accommodates feature naturally  
✅ File handling pattern established  
✅ Performance targets achievable with existing tools  

---

## Next: Phase 1 Design

Proceed to data-model.md, contracts/, and quickstart.md with confidence that:
- Markdown rendering approach is confirmed
- Integration points are clear
- No research blockers remain
