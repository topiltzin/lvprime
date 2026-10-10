# Feature Specification: In-Page Exercise Video Player

**Feature Branch**: `017-in-page-video-player` (no git branch created; work on `main` unless the user chooses otherwise)

**Created**: 2026-10-10

**Status**: Draft

**Input**: User description: "as a new change the youtube video should be open on the same webpage on a popup or something similar, rather to go to youtube /ui-ux-pro-max verify the best profesionl way to do it."

## UX Approach (design research summary)

The UI/UX guidance consulted recommends, for a short demo video launched from a list item: a **modal dialog over a dimmed backdrop** (not a new tab, not an inline expansion that shifts the list), **click-to-play only** (no autoplay on page load), a **visible, labelled close control**, **keyboard support** (focus moved into the dialog, trapped while open, Esc closes, focus returns to the trigger), a **visible focus ring** on every control, **reserved space / fixed aspect ratio** so nothing jumps while loading, a **loading indicator**, and **reduced-motion** respect. On phones the dialog should use nearly the full width so the video is as large as possible. These choices are encoded as requirements below.

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Watch an exercise demo without leaving the app (Priority: P1)

A customer viewing a day of their program taps an exercise name that has a demo video. Instead of being sent to YouTube (leaving the app, losing their place), the video opens in a popup over the current page. They watch it, close the popup, and are exactly where they were.

**Why this priority**: This is the entire request. Today the link leaves the app, and on phones it often opens the YouTube app, making it hard to come back to the workout.

**Independent Test**: Open a program day, tap an exercise with a video; the popup appears with the video ready to play; close it; the program day is unchanged (same scroll position, same expanded/checked state).

**Acceptance Scenarios**:

1. **Given** a program day with an exercise that has a demo video, **When** the customer taps the exercise name, **Then** a popup opens over the page showing that exercise's video, with the exercise name as its title, and no new tab/window or external app is opened.
2. **Given** the popup is open, **When** the customer taps the close button, taps the dimmed area outside the video, or presses Esc, **Then** the popup closes, video playback stops, and the page behind is unchanged.
3. **Given** the popup was opened, **When** it closes, **Then** keyboard focus returns to the exercise name that opened it and the page scroll position is the same as before.
4. **Given** the popup is open, **When** the customer scrolls or swipes on the dimmed area, **Then** the page behind does not scroll.
5. **Given** an exercise without a video, **When** the customer views it, **Then** nothing changes from today (no link, no popup).

---

### User Story 2 - Comfortable on phones and for keyboard / assistive-technology users (Priority: P2)

Customers mostly use the app on phones, and some use keyboards or screen readers. The popup must be large and easy to dismiss on a small screen and fully operable without a pointer.

**Why this priority**: A popup that is cramped, hard to close, or traps keyboard users would be worse than the current link.

**Independent Test**: On a ~375px-wide viewport, open a video: it fills nearly the full width with a close control at least 44×44px. With keyboard only: open via Enter/Space, Tab cycles only within the popup, Esc closes, focus returns to the trigger.

**Acceptance Scenarios**:

1. **Given** a phone-width screen, **When** the popup opens, **Then** the video uses nearly the full screen width at its natural widescreen proportion, with no horizontal scrolling.
2. **Given** the popup is open, **When** the customer presses Tab/Shift+Tab, **Then** focus stays inside the popup and every control shows a visible focus indicator.
3. **Given** a screen reader is in use, **When** the popup opens, **Then** it is announced as a dialog titled with the exercise name, and content behind it is not reachable.
4. **Given** the customer prefers reduced motion, **When** the popup opens or closes, **Then** no sliding/zooming animation is used (at most a simple fade or none).
5. **Given** the app is shown in English or Spanish, **When** the popup is shown, **Then** all of its labels (close button, loading, error) appear in the selected language.

---

### User Story 3 - Graceful loading and failure (Priority: P3)

While the video loads, the customer sees a clear loading state in a space the same size as the video. If the video cannot be shown inline (offline, blocked, removed by its owner, or not embeddable), they get a clear message and a way to open it on YouTube instead.

**Why this priority**: Prevents a blank or broken popup and keeps today's capability (watching on YouTube) as a fallback.

**Independent Test**: Throttle the network and open a video: a loading indicator fills the video area without layout jump. Simulate offline/blocked embed: a message and an "Open on YouTube" link appear.

**Acceptance Scenarios**:

1. **Given** a slow connection, **When** the popup opens, **Then** a loading indicator occupies the reserved video area and the popup does not resize when the video appears.
2. **Given** the video cannot be played inline, **When** the failure is detected or the video does not become ready within a reasonable time, **Then** the popup shows a plain-language message and an "Open on YouTube" link that opens in a new tab.
3. **Given** the popup has been opened and closed, **When** the page is later reloaded, **Then** no video is auto-played and no video content is loaded until the customer taps an exercise.

---

### Edge Cases

- A stored video address is not a recognisable YouTube link (e.g. a short link, a link with a start time, or an unsupported site): short links and start times are honoured; anything unrecognisable falls back to opening the original link in a new tab, as today.
- The customer taps a second exercise's video while one popup is open: not possible (the popup is modal); only one video popup can exist at a time.
- The customer uses the browser Back button / phone back gesture while the popup is open: the popup closes and the customer stays on the same program day (they are not taken to the previous page).
- The device is rotated while the popup is open: the video resizes to fit and stays centred.
- The customer opens a video, then switches tabs/apps: playback behaviour follows the browser default; closing the popup always stops playback.
- Customer's browser or network blocks the video provider: covered by the failure state (User Story 3).
- Privacy: customers are not tracked by the video provider until they choose to play (no video content is loaded on page view).

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: Tapping/clicking (or pressing Enter/Space on) an exercise name that has a demo video MUST open that video in a popup on the current page instead of navigating away or opening a new tab.
- **FR-002**: The popup MUST be a modal layer: dimmed backdrop, page behind not scrollable or interactive, and a single video visible at a time.
- **FR-003**: The popup MUST show the exercise name as its title and a clearly labelled close button with a minimum 44×44px touch target.
- **FR-004**: The popup MUST close via the close button, a tap on the backdrop, the Esc key, and the browser/phone Back action; closing MUST stop playback.
- **FR-005**: On close, keyboard focus MUST return to the element that opened the popup and the page scroll position MUST be unchanged.
- **FR-006**: While open, keyboard focus MUST be contained within the popup, and every interactive control MUST show a visible focus indicator.
- **FR-007**: The popup MUST be exposed to assistive technology as a dialog with an accessible name (the exercise title).
- **FR-008**: The video MUST NOT autoplay on page load; no video content is requested until the customer opens the popup. Playback starts when the popup opens from the customer's tap (customer-initiated).
- **FR-009**: The video area MUST keep a fixed widescreen proportion and reserve its space while loading so the popup never changes size when the video appears.
- **FR-010**: The popup MUST show a loading indicator until the video is ready.
- **FR-011**: If the video cannot be played inline, the popup MUST show a clear message and an "Open on YouTube" link that opens the original video in a new tab.
- **FR-012**: If a stored video address cannot be understood as a playable video, the system MUST fall back to the existing behaviour (open the original link in a new tab) rather than show a broken popup.
- **FR-013**: On phone-width screens the popup MUST use nearly the full viewport width without horizontal scrolling; on larger screens it MUST be a centred panel of comfortable maximum width.
- **FR-014**: Open/close transitions MUST be short (under 300ms), and MUST be reduced to a simple fade or none when the customer prefers reduced motion.
- **FR-015**: All popup text (close label, loading, error message, fallback link) MUST be available in both supported languages (English, Spanish) and follow the selected language.
- **FR-016**: The popup MUST follow the app's existing visual style, including its light/dark appearance.
- **FR-017**: Exercises without a video MUST behave exactly as today.
- **FR-018**: The popup MUST work for every place an exercise name with a video link is shown today (e.g. the program day view), for both customers and coaches.

### Key Entities

- **Exercise demo video**: the existing per-exercise video link (already stored with each exercise); no new data is stored. The popup derives what to show from this existing link.
- **Video popup (transient)**: a temporary view state holding which exercise's video is open, which element opened it, and its loading/failed status. Not persisted.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: 100% of exercise-video taps open the video on the same page, with zero new tabs/windows and zero external-app launches in the normal case.
- **SC-002**: A customer can open a video, watch it, close it, and be back at the same spot in their program in under 3 interactions (tap exercise, play/watch, close).
- **SC-003**: The popup appears with its loading state within 300ms of the tap on a typical phone connection, and the video area never shifts size after appearing (no visible layout jump).
- **SC-004**: On a 375px-wide screen the video is at least 90% of the screen width, and the close control is reachable with one thumb tap.
- **SC-005**: The full open → close flow is completable using only a keyboard, and a screen reader announces the popup with the exercise name; no keyboard trap exists after closing.
- **SC-006**: When a video cannot be shown inline, 100% of cases present a message and a working "Open on YouTube" fallback (no blank popup).
- **SC-007**: Program pages load no video-provider content until a video is requested (page-load weight and third-party requests unchanged from today).

## Assumptions

- Demo videos are YouTube links already stored per exercise (feature 007); no data migration or editing UI changes are in scope.
- Only YouTube videos are embedded inline; other hosts use the new-tab fallback.
- The popup is a plain modal dialog; picture-in-picture, playlists, next/previous exercise navigation, and in-app video hosting are out of scope.
- Customers are online when watching; offline playback is out of scope.
- The existing exercise-name tap target and its play icon are kept; only the destination changes.
- Using the video provider's privacy-enhanced embedding mode is an acceptable default so third-party tracking is minimised until play.
- The existing English/Spanish string system and visual theme are reused.
