# Feature Specification: Nutrition Plan Tab in Customer UI

**Feature Branch**: `005-nutrition-plan-tab`

**Created**: 2026-09-16

**Status**: Draft

**Input**: User description: "create a new pestana for the customer tab, now is a new file on each customer called nutrition_plan.md and make it visible on the UI. and also keep the PDF export as the program."

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Coach Views Customer's Nutrition Plan (Priority: P1)

Fitness coach opens a customer profile and can see the nutrition plan information in a dedicated tab alongside program, feedback, and notes tabs.

**Why this priority**: Core feature - coaches need to access and review nutrition plans they created for customers. This is the primary value delivery.

**Independent Test**: Coach can navigate to any customer profile, click the Nutrition Plan tab, and see the content from nutrition_plan.md displayed in a readable format.

**Acceptance Scenarios**:

1. **Given** a coach is viewing a customer profile with an existing nutrition_plan.md, **When** the coach clicks the "Nutrition Plan" tab, **Then** the nutrition content displays in full
2. **Given** a customer has both program.md and nutrition_plan.md files, **When** the coach switches between Program and Nutrition Plan tabs, **Then** both tabs load correctly and independently
3. **Given** navigation tabs are displayed (Program, Feedback, Notes, Nutrition Plan), **When** a coach clicks any tab, **Then** the correct content loads without reloading the page

---

### User Story 2 - Nutrition Plan Tab Displays Formatted Content (Priority: P1)

The nutrition_plan.md file renders with proper formatting (headers, lists, tables, emphasis) so the information is scannable and easy to read on the UI.

**Why this priority**: Ensures the nutrition plan is actually useful to coaches and customers - poor formatting defeats the purpose of having the tab.

**Independent Test**: Nutrition plan with markdown formatting (headers, bullets, tables) renders correctly in the UI with visual hierarchy and readability.

**Acceptance Scenarios**:

1. **Given** a nutrition_plan.md with markdown formatting (## headers, - bullets, | tables), **When** displayed in the tab, **Then** all markdown is rendered correctly
2. **Given** a nutrition plan with multiple sections and emphasis (bold, italic), **When** viewed in the tab, **Then** visual hierarchy makes it scannable

---

### User Story 3 - PDF Export Remains Available for Program (Priority: P2)

The existing PDF export functionality for program.md continues to work as before - no regression in program export capability.

**Why this priority**: Protects existing functionality - coaches may rely on PDF exports of programs for sharing or archival.

**Independent Test**: Program tab still has a working PDF export button after nutrition tab is added. Exported PDF contains program content only.

**Acceptance Scenarios**:

1. **Given** a customer profile is open on the Program tab, **When** the export button is clicked, **Then** a PDF is generated and downloaded with program content
2. **Given** multiple tabs exist (Program, Nutrition Plan, Feedback, Notes), **When** program PDF is exported, **Then** only program content is in the PDF, not nutrition content

---

### User Story 4 - Nutrition Plan Tab Appears in Customer Profile (Priority: P2)

The Nutrition Plan tab is visible and accessible from the customer profile page navigation, positioned logically with other content tabs.

**Why this priority**: Usability - the tab must be discoverable by coaches who want to access nutrition information.

**Independent Test**: Every customer profile shows a Nutrition Plan tab in the main navigation tabs, regardless of whether nutrition_plan.md exists (and shows appropriate message if no plan exists).

**Acceptance Scenarios**:

1. **Given** a customer profile page loads, **When** the page displays, **Then** a "Nutrition Plan" tab is visible in the tab navigation
2. **Given** tabs are displayed (Program, Nutrition Plan, Feedback, Notes), **When** a coach views the customer profile, **Then** tab order is consistent and logical
3. **Given** a customer has no nutrition_plan.md file yet, **When** the Nutrition Plan tab is clicked, **Then** a helpful message displays (e.g., "No nutrition plan created yet")

---

### Edge Cases

- What happens when a customer has a nutrition_plan.md but it's empty or has only whitespace? → Display empty state message
- What happens if the markdown in nutrition_plan.md contains broken links or references? → Links display as-is; rendering fails gracefully
- What happens if a coach is viewing the nutrition plan and another coach updates the file? → Page shows cached version; refresh shows updated content
- What happens on mobile/narrow screens? → Nutrition plan content is responsive and readable

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: System MUST display a "Nutrition Plan" tab in the customer profile tab navigation alongside existing tabs (Program, Feedback, Notes)
- **FR-002**: System MUST render nutrition_plan.md content in the Nutrition Plan tab with markdown formatting applied (headers, lists, tables, emphasis)
- **FR-003**: System MUST read nutrition_plan.md file from the customer directory (/customers/[customer-name]/nutrition_plan.md)
- **FR-004**: System MUST display an appropriate message (e.g., "No nutrition plan available") if nutrition_plan.md does not exist for a customer
- **FR-005**: System MUST preserve existing PDF export functionality for program.md in the Program tab
- **FR-006**: System MUST allow coaches to view nutrition plan content without requiring admin privileges (same access level as program/feedback tabs)
- **FR-007**: Tab navigation MUST remain responsive and properly load content on tab click without full page reload
- **FR-008**: System MUST handle nutrition_plan.md files of any reasonable size (up to 100KB) without performance degradation

### Key Entities

- **NutritionPlan**: The nutrition_plan.md file content
  - Attributes: customer_id, file_path (/customers/[name]/nutrition_plan.md), last_modified, content (markdown)
  - Relationships: Belongs to one Customer, displayed on Customer profile page

- **CustomerProfile**: Existing entity extended with nutrition plan visibility
  - New attribute: nutrition_plan_tab_visible (boolean)
  - Existing tabs updated: Program, Feedback, Notes + new Nutrition Plan tab

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: Coaches can access nutrition plan content within 2 clicks from customer profile (Program tab click + Nutrition Plan tab click)
- **SC-002**: Nutrition plan markdown renders with 100% accuracy (all headers, lists, tables, emphasis display correctly)
- **SC-003**: PDF export for program.md continues to work with 0 regression - all existing PDFs remain identical in content and format
- **SC-004**: Nutrition Plan tab loads in under 500ms on broadband connection (same performance as existing tabs)
- **SC-005**: 100% of customer profiles display the Nutrition Plan tab (no missing tabs on any customer view)
- **SC-006**: Coaches report nutrition plan tab as discoverable and easy to access in feature review

## Assumptions

- **Assumption 1**: All customers have a customer directory (/customers/[customer-name]/) - same structure as existing program.md and feedback.md files
- **Assumption 2**: nutrition_plan.md files are created and managed separately (via nutrition specialist skill or manual creation) - this feature only displays them
- **Assumption 3**: Markdown rendering library already exists in the codebase or can be easily integrated (no new major dependency required)
- **Assumption 4**: Existing tab navigation architecture can accommodate a new tab without significant refactoring
- **Assumption 5**: PDF export is only needed for program.md; nutrition plan export can be addressed in future iteration if needed
- **Assumption 6**: Same file permissions apply to nutrition_plan.md as program.md (readable by coaches, not user-editable in UI)
- **Assumption 7**: Tab order is flexible and can be: Program, Nutrition Plan, Feedback, Notes (or any logical order agreed upon)
