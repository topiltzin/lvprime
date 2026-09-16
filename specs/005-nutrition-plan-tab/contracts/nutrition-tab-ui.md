# Contract: Nutrition Tab UI Component Interface

**Purpose**: Defines the UI component interface and rendering contract for the Nutrition Plan tab

**Version**: 1.0  
**Status**: Design Phase

---

## TabContainer Integration

### Input Contract

The Nutrition Plan tab is rendered by TabContainer when the following conditions are met:

**Tab Configuration**:
```javascript
{
  id: 'nutrition',
  label: 'Nutrition Plan',
  isEnabled: true,  // Only enabled if nutrition_plan.md exists
  contentType: 'nutrition',
  order: 2  // Position in tab order (after Program)
}
```

**Tab Data**:
```javascript
{
  nutrition: {
    content: "## Nutrition Plan\n\n...",  // Markdown string
    isEmpty: false,                        // true if no plan exists
    error: null                            // null if no error, string if error occurred
  }
}
```

---

## Output Contract: Rendered HTML

### Structure

When rendered, the Nutrition Plan tab produces the following DOM structure:

```html
<div class="tab-panel" id="tab-panel-nutrition" role="tabpanel">
  <div class="tab-content tab-content-nutrition">
    <!-- CASE 1: Content exists -->
    <div class="nutrition-content">
      <div class="nutrition-rendered-html">
        <!-- Markdown rendered as HTML by marked() library -->
        <h2>Nutrition Plan</h2>
        <p>...</p>
        <!-- All markdown structures: headings, lists, tables, emphasis, links -->
      </div>
    </div>

    <!-- CASE 2: No nutrition plan yet -->
    <div class="nutrition-empty-state">
      <p>No nutrition plan available yet. Once your nutrition plan is created, it will appear here.</p>
    </div>

    <!-- CASE 3: Error loading nutrition plan -->
    <div class="nutrition-error-state">
      <p class="error-message">Unable to load nutrition plan. Please try again.</p>
    </div>
  </div>
</div>
```

---

## Rendering Rules

### Rule 1: Markdown to HTML Conversion

**Trigger**: `data.nutrition.content` is non-empty and `isEmpty` is false

**Behavior**:
- Use `marked(data.nutrition.content)` to convert markdown to HTML
- Insert rendered HTML into `.nutrition-rendered-html` container
- Rendering MUST handle all markdown elements:
  - Headings (h1-h6)
  - Paragraphs
  - Lists (ordered and unordered)
  - Tables (with headers and rows)
  - Code blocks and inline code
  - Emphasis (bold, italic, strikethrough)
  - Links and images
  - Blockquotes

**Performance Requirement**: <200ms for typical nutrition plan (up to 100KB)

**Example Input Markdown**:
```markdown
# Plan Nutricional: Jaqueline Orellano

## Distribución Proteína Diaria

| Comida | Proteína |
|--------|----------|
| Desayuno | 25-30g |
| Almuerzo | 28-30g |

- Proteína sólida (pollo, pescado)
- Carbohidratos complejos (arroz, papa)
```

**Expected Output**: All markdown structures render with correct HTML semantic tags and styling

---

### Rule 2: Empty State

**Trigger**: `isEmpty` is true OR `content` is empty string

**Behavior**:
- Hide content container
- Show empty state message
- Message text: "No nutrition plan available yet. Once your nutrition plan is created, it will appear here."
- Use neutral, informative tone

---

### Rule 3: Error State

**Trigger**: `data.nutrition.error` is not null

**Behavior**:
- Hide content container
- Show error message container
- Display the error message from `data.nutrition.error`
- Example error: "Unable to load nutrition plan. Please try again."

---

## Styling Requirements

### CSS Classes

| Class | Purpose | Notes |
|-------|---------|-------|
| `.tab-content-nutrition` | Main container | Inherits from existing tab styling |
| `.nutrition-content` | Content wrapper | Applied when content exists |
| `.nutrition-rendered-html` | HTML output container | Contains marked() output |
| `.nutrition-empty-state` | Empty state container | Displayed when no plan exists |
| `.nutrition-error-state` | Error state container | Displayed on load error |
| `.error-message` | Error text styling | Red/warning color treatment |

### Visual Consistency

- Use same font, spacing, and color scheme as Program tab
- Markdown heading sizes should match existing typography scale
- Tables should match existing table styling (if used in program.md)
- Lists should have consistent bullet/number styling
- Code blocks should use monospace font and distinct background

### Responsive Design

- Content should be readable on all viewport widths (mobile, tablet, desktop)
- Markdown tables should wrap or scroll on narrow screens if needed
- No horizontal scrolling for typical content widths

---

## Accessibility Requirements

### ARIA Labels

```html
<div class="tab-panel" 
     id="tab-panel-nutrition" 
     role="tabpanel"
     aria-labelledby="tab-button-nutrition">
```

### Keyboard Navigation

- Tab order: Follows existing TabContainer keyboard navigation (Arrow keys between tabs)
- Focusable elements within nutrition content: Links should be keyboard accessible
- Tab panel should be hidden (`display: none` or `hidden` attribute) when not active

### Semantic HTML

- Use `<h1>`, `<h2>`, etc. for headings (marked provides these)
- Use `<ul>` or `<ol>` for lists (marked provides these)
- Use `<table>` with `<thead>`, `<tbody>` for tables (marked provides these)
- Use `<strong>`, `<em>` for emphasis (marked provides these)

---

## Loading Behavior

### Lazy Rendering

- Nutrition tab content is NOT rendered until tab is clicked (lazy rendering)
- This reduces initial page load time
- Content is rendered on-demand when user clicks the Nutrition Plan tab

### No Duplicate Renders

- Content is rendered once per tab click
- If user switches away and back to tab, content is preserved (not re-rendered)
- If user navigates to different customer, TabContainer is destroyed and recreated fresh

---

## Edge Cases

### Edge Case 1: Very Long Nutrition Plan

**Condition**: nutrition_plan.md is 100KB (max size)

**Expected Behavior**:
- Content renders completely
- Page scroll is available
- Performance target: <500ms load (per spec SC-004)

---

### Edge Case 2: Markdown with Broken Syntax

**Condition**: nutrition_plan.md contains invalid markdown

**Expected Behavior**:
- marked() renders it anyway (graceful degradation)
- Malformed syntax is displayed as-is or best-effort rendered
- No crash or error state triggered

**Example**: `### heading without preceding content` → renders as heading

---

### Edge Case 3: Markdown with HTML Tags

**Condition**: nutrition_plan.md contains `<div>` or other HTML

**Expected Behavior**:
- marked() by default escapes HTML for security
- HTML tags are displayed as text, not rendered as DOM elements
- This is intentional (prevents XSS)

---

### Edge Case 4: Unicode Characters

**Condition**: nutrition_plan.md contains non-ASCII characters (Spanish accents, emojis, etc.)

**Expected Behavior**:
- UTF-8 encoding preserved throughout (file read, JSON transport, HTML rendering)
- Characters display correctly: "español", "🥗", "café"
- No character corruption or mojibake

---

## Testing Strategy

### Unit Test: Markdown Rendering

```
GIVEN: marked library and sample markdown
WHEN: render nutrition tab content
THEN: output matches expected HTML structure
```

### Integration Test: Tab Display

```
GIVEN: Customer with nutrition_plan.md
WHEN: Nutrition Plan tab is clicked
THEN: Content loads and displays within 500ms
```

### Edge Case Test: Empty State

```
GIVEN: Customer without nutrition_plan.md
WHEN: Tab is clicked
THEN: Empty state message displays
```

### Accessibility Test: Keyboard Navigation

```
GIVEN: Nutrition tab is active
WHEN: Tab and Shift+Tab keys pressed
THEN: Focus moves through tab buttons correctly
```

---

## Contract Version History

- **1.0** (2026-09-16): Initial UI component contract, markdown rendering, empty/error states
