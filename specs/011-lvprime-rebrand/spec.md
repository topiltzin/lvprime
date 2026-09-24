# Feature Specification: LvPrime Rebrand

**Feature Branch**: `011-lvprime-rebrand`

**Created**: 2026-09-24

**Status**: Draft

**Input**: User description: "LvPrime rebrand: replace the "Lv Fitness" identity in the coach app with the LvPrime brand system designed in design/brand/ (brand-sheet.html, brand-sheet.png, mark.svg, mark-on-dark.svg, mark-mono.svg). Audience: personal training for people 40+; tone elegant and fitness oriented. Scope: rename to LvPrime everywhere user-visible (page title, header, login view, PDF exports); header lock-up with mark, two-tone wordmark and descriptor on Evergreen with a Brass rule; new palette (Evergreen, Evergreen deep, Brass, Ivory, Stone, Ink) with Signal green kept as the single status/action accent; add a serif display face for the wordmark and headings, self-hosted; favicon and app icon from the mark with a simplified small-size variant; optional login tagline. Out of scope: layout changes to tabs, data, or customer workflows. Success: consistent brand across header, login and PDFs; WCAG AA contrast; no status colour regressions."

**Design source of truth**: `design/brand/brand-sheet.png` (inspected render) and `design/brand/brand-sheet.html` (editable), plus `mark.svg`, `mark-on-dark.svg`, `mark-mono.svg`.

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Coach sees the LvPrime identity in the app shell (Priority: P1)

The coach opens the app and immediately sees the LvPrime brand: the mark, the two-tone "LvPrime" wordmark and the "Personal training · 40+" descriptor in the header, on the Evergreen brand colour with a thin Brass rule. The browser tab reads "LvPrime" and shows the LvPrime icon.

**Why this priority**: The header and tab are seen on every screen. Replacing the old "Lv Fitness" identity here delivers the rebrand on its own.

**Independent Test**: Load any view (overview, customer, feedback form). Confirm the header lock-up matches the brand sheet's "App header" panel, the tab title contains "LvPrime", the tab icon is the LvPrime mark, and no "Lv Fitness" text remains anywhere in the interface.

**Acceptance Scenarios**:

1. **Given** the coach is signed in, **When** any view loads, **Then** the header shows the mark, the wordmark "Lv" in ivory with "Prime" in italic brass, and the uppercase descriptor "PERSONAL TRAINING · 40+", matching the brand sheet.
2. **Given** any view, **When** the coach looks at the header, **Then** the "Coach workspace" label is still present on the right.
3. **Given** the app is open in a browser tab, **When** the coach looks at the tab, **Then** the title reads "LvPrime" (optionally followed by a page descriptor) and the icon is the LvPrime mark, legible at 16px.
4. **Given** the coach selects the header logo, **When** it is activated, **Then** it returns to the overview exactly as the current logo does.

---

### User Story 2 - Pages use the LvPrime palette and type without changing meaning (Priority: P1)

Across all views, the page background, surfaces, borders, text and headings use the LvPrime palette and type (serif display for headings, sans for body and UI). Status and action colours (completed, missed, progress, primary buttons) keep their existing meaning and green signal colour.

**Why this priority**: A new header on an old palette reads as unfinished. It must land together with User Story 1 while protecting the coach's ability to read status at a glance.

**Independent Test**: Compare each view before and after. Backgrounds, borders, text and headings follow the brand sheet; every status indicator, chart bar and primary action shows the same colour role as before.

**Acceptance Scenarios**:

1. **Given** any view in light mode, **When** it renders, **Then** the page background is Ivory, lines and dividers are Stone, body text is Ink, and page headings use the serif display face.
2. **Given** a customer with completed and missed sessions, **When** the trend chart and status badges render, **Then** completed stays Signal green and missed stays the existing danger red.
3. **Given** any interactive control (button, link, tab, toggle), **When** it renders, **Then** it never uses Brass as its colour.
4. **Given** the coach's system uses a dark colour scheme, **When** any view renders, **Then** brand, text and status colours adapt so all text stays legible and Brass details remain visible without glare.

---

### User Story 3 - Sign-in view carries the brand (Priority: P2)

Before signing in, the coach sees the LvPrime lock-up and, optionally, the tagline "Strength for the decades ahead."

**Why this priority**: The sign-in view is the first impression, but it is seen far less often than the main shell.

**Independent Test**: Sign out and load the sign-in view. Confirm the lock-up and tagline appear and the form works as before.

**Acceptance Scenarios**:

1. **Given** the coach is signed out, **When** the sign-in view loads, **Then** it shows the LvPrime mark and wordmark and the tagline "Strength for the decades ahead."
2. **Given** the sign-in view, **When** the coach submits valid or invalid credentials, **Then** behaviour and error messages are unchanged.

---

### User Story 4 - Exported PDFs are branded (Priority: P2)

When the coach exports a program or nutrition PDF for a customer, each document carries the LvPrime name and mark in a restrained header or footer, so the customer receives a recognisably branded deliverable.

**Why this priority**: PDFs are the customer-facing artefact. Today they carry no brand at all.

**Independent Test**: Export one program PDF and one nutrition PDF. Confirm the LvPrime name and mark appear on the first page (and a footer on every page) and the content is otherwise unchanged and fully readable.

**Acceptance Scenarios**:

1. **Given** a customer with a program, **When** the coach exports the program PDF, **Then** page one shows the LvPrime lock-up and every page shows an "LvPrime" footer.
2. **Given** a customer with a nutrition plan, **When** the coach exports the nutrition PDF, **Then** it carries the same brand treatment as the program PDF.
3. **Given** a long program that spans several pages, **When** it is exported, **Then** the brand header or footer never overlaps or truncates program content.

---

### Edge Cases

- The display font fails to load: headings and wordmark fall back to a system serif, and the layout does not shift or clip.
- Narrow screens (phone width): the lock-up shrinks or drops the descriptor so the header fits without horizontal scroll, and the "Coach workspace" label may hide; the mark and wordmark always remain.
- Tab icon at 16px: the simplified mark is used so the L and rising stroke still read as a shape, not a blur.
- Printing or exporting in greyscale: the mark stays recognisable via the mono variant or sufficient tonal contrast.
- Dark mode on the Evergreen header: the header remains distinct from the dark page background (for example via the Brass rule or a tonal step).
- Reduced motion preference: any hover or transition on the logo respects it, as today.

## Requirements *(mandatory)*

### Functional Requirements

**Name and identity**

- **FR-001**: The product name MUST be "LvPrime" (one word, capital L and P) in every user-visible place: browser tab title, header, sign-in view and PDF exports.
- **FR-002**: No user-visible text MUST read "Lv Fitness" or "Personalized Training" after this change.

**Header lock-up**

- **FR-003**: The header MUST show, left to right: the mark (dark-surface variant), the wordmark with "Lv" in ivory and "Prime" in italic brass, and beneath the wordmark the descriptor "PERSONAL TRAINING · 40+" in uppercase with wide letter spacing.
- **FR-004**: The header background MUST be Evergreen (#16352A) with a 2px Brass (#C9A46A) bottom rule, replacing the current near-black background and green rule.
- **FR-005**: The header MUST keep the "Coach workspace" label and the logo's existing link-to-overview behaviour.
- **FR-006**: On narrow screens the header MUST fit without horizontal scrolling; the descriptor and label MAY be hidden, the mark and wordmark MUST remain.

**Palette**

- **FR-007**: The interface MUST adopt these brand colour roles: Evergreen #16352A (brand surfaces), Evergreen deep #0E231C (mark tile, deep surfaces), Brass #C9A46A (brand detail on dark), Brass dark #9C7A43 (brand detail on light), Ivory #F5F1EA (page background), Stone #E6E0D5 (borders and lines), Ink #141412 (primary text).
- **FR-008**: Signal green (#1F7A4D, with its existing dark-mode counterpart) MUST remain the single accent for status, progress and primary actions, preserving the existing single-accent rule from spec 002 (FR-019).
- **FR-009**: Brass MUST be used only for brand details: the mark, the "Prime" part of the wordmark, and at most one decorative rule per view. It MUST NOT be used for buttons, links, tabs, status, charts or form states.
- **FR-010**: Danger and warning colours and their meanings MUST remain unchanged.
- **FR-011**: A dark-mode equivalent MUST be defined for every new colour role so that all text meets the contrast target in both schemes.

**Typography**

- **FR-012**: The wordmark and page headings (top-level and section headings) MUST use a refined serif display face; body text, labels, forms and data MUST keep the current sans-serif face.
- **FR-013**: The display face MUST be bundled with the app, consistent with the project's existing no-external-font-CDN policy.
- **FR-014**: Body text size MUST be no smaller than today's body size, and brand changes MUST NOT reduce the size of any existing text.

**Mark and icons**

- **FR-015**: The browser tab icon MUST use the LvPrime mark, with a simplified variant for 16px and 32px sizes that remains recognisable.
- **FR-016**: An app icon (for home-screen or bookmark use) MUST be provided from the mark at standard sizes.
- **FR-017**: The mark MUST have three variants available to the app: on light (Evergreen tile), on dark (Evergreen deep tile with Brass hairline) and mono (single colour, no tile).

**Sign-in and PDFs**

- **FR-018**: The sign-in view MUST show the LvPrime lock-up and the tagline "Strength for the decades ahead.", with sign-in behaviour unchanged.
- **FR-019**: Program and nutrition PDF exports MUST show the LvPrime lock-up on the first page and an "LvPrime" footer on every page, without overlapping or displacing content.

**Scope guard**

- **FR-020**: This change MUST NOT alter layout structure, tab behaviour, data, customer workflows or the content of customer files.

### Key Entities

- **Brand mark**: The LvPrime symbol (L and V sharing one baseline, with a brass stroke rising past the cap height). Variants: on light, on dark, mono, simplified small size.
- **Wordmark lock-up**: Mark + "Lv" + italic "Prime" + descriptor. Variants: full (with descriptor) and compact (mark and wordmark only).
- **Brand palette**: The named colour roles in FR-007 and FR-008, each with a light and dark value.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: Zero occurrences of "Lv Fitness" or "Personalized Training" remain in any user-visible screen or exported PDF.
- **SC-002**: 100% of text in the header, sign-in view and all main views meets WCAG AA contrast (4.5:1 for normal text, 3:1 for large text) in both light and dark schemes.
- **SC-003**: Every status indicator (completed, missed, warning, danger) and primary action shows the same colour role before and after the change, verified on the overview, customer and feedback views.
- **SC-004**: The header, sign-in lock-up and PDF header are judged by the coach to match the brand sheet (mark, wordmark colours, descriptor, Evergreen and Brass rule) on first review.
- **SC-005**: The tab icon is recognisable as the LvPrime mark at 16px when viewed side by side with other open tabs.
- **SC-006**: At 360px screen width, every view renders the header without horizontal scrolling or clipped text.
- **SC-007**: Initial page load shows no visible layout shift from the display font loading.

## Assumptions

- The brand sheet in `design/brand/` is the approved visual reference; hex values listed there are final for v1.
- The display face is Fraunces (as shown on the brand sheet), bundled with the app like the current Inter faces.
- The dark-mode header may reuse Evergreen, since it is already a dark surface; the dark page background may shift slightly warmer to sit with the palette.
- The old green-on-black header and green bottom rule are fully replaced; no toggle between old and new brand is needed.
- Brass on Ivory fails AA for small text, so small brand text on light backgrounds uses Brass dark (#9C7A43) and is used only at large sizes (wordmark "Prime").
- PDF exports may use a built-in serif if the display face cannot be embedded; the mark is embedded as an image.
- The tagline is fixed copy for v1 and not coach-editable.
- The project has no automated visual tests; verification is by rendering each view and PDF and inspecting them against the brand sheet (constitution Principle IV: exported deliverables must be verified to render before hand-off).
