# Feature Specification: Exercise Library Migration & Video Linking

**Feature Branch**: `[007-exercise-library-migration]`

**Created**: 2026-09-21

**Status**: Draft

**Input**: User description: "we have the exercise.md and now on the exersize for each cusotmer, add the video link to the name of the exersice for each of the workout. Add the exercise.md as a new Table, so we remove it locally."

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Exercise names link straight to a demo video (Priority: P1)

As the coach, when I open a customer's workout program, every exercise name I recognize from the exercise library appears as a clickable link that opens a video demonstrating proper form, so I no longer have to leave the program or search for the exercise separately.

**Why this priority**: This is the core value of the feature — it's the visible, day-to-day payoff for both the coach and (wherever programs are shared) the customer. Without this, the migration underneath has no user-facing benefit.

**Independent Test**: Open any existing customer's workout program that contains an exercise also present in the exercise library, and confirm the exercise's name is a working link to its video — independent of whether the library-table migration story has shipped yet (it can be validated against a seeded library).

**Acceptance Scenarios**:

1. **Given** a customer program contains "Push-up" as a workout exercise and the exercise library has a video link for "Push-up", **When** the program is viewed, **Then** "Push-up" is displayed as a link to that video.
2. **Given** a customer program contains an exercise name that has no matching entry in the exercise library, **When** the program is viewed, **Then** the exercise name is displayed as plain text (unlinked) and the rest of the program renders normally.
3. **Given** the exercise library is updated with a new or corrected video link for an exercise, **When** any customer program referencing that exercise is next viewed, **Then** it reflects the updated link without the program itself being manually edited.

---

### User Story 2 - Exercise reference data lives in one central place (Priority: P2)

As the coach, the exercise name/video reference data that used to live in a local `exercise.md` file is instead stored as structured records alongside the other customer/program data, so it's the single source of truth every customer program draws from.

**Why this priority**: This is the enabling data change behind Story 1 — video links can't be attached to workouts reliably until the reference data is centralized and queryable rather than being a flat file a human has to read.

**Independent Test**: Query the exercise reference records directly (independent of any specific customer program) and confirm every exercise from the original `exercise.md` is present with its name and video link intact.

**Acceptance Scenarios**:

1. **Given** the migration has run, **When** the exercise reference records are listed, **Then** every exercise previously in `exercise.md` appears exactly once, with its name and video link preserved.
2. **Given** the coach adds a brand-new exercise to the reference records, **When** a customer program is later created or updated referencing that exercise by name, **Then** the new exercise becomes linkable the same way as the originally-migrated ones.

---

### User Story 3 - The local exercise file is retired (Priority: P3)

As the coach, once the exercise reference data is safely in the new central store, the local `exercise.md` file is removed from the project so there's no stale duplicate copy that could drift out of sync.

**Why this priority**: Cleanup step — valuable for avoiding confusion and drift, but only safe to do once Stories 1 and 2 are confirmed working, so it's lowest priority.

**Independent Test**: After migration is verified (Story 2's acceptance scenarios pass), confirm `exercise.md` no longer exists in the project working directory.

**Acceptance Scenarios**:

1. **Given** every exercise from `exercise.md` has been verified present in the new reference records, **When** cleanup runs, **Then** `exercise.md` is deleted from the project.
2. **Given** `exercise.md` has been deleted, **When** a customer program is viewed or a new one is generated, **Then** exercise video linking still works correctly using only the central reference records (no dependency on the removed file).

---

### Edge Cases

- What happens when an exercise name in a customer's program is spelled or formatted slightly differently than its entry in the reference records (e.g., "Push Up" vs "Push-up")? → Treated as no match (Story 1, Scenario 2): displayed unlinked rather than guessing.
- What happens if two different exercises in the reference records end up with the same name? → Not a supported state; exercise names must be unique in the reference records.
- What happens if a reference record's video link is missing or blank for an otherwise-valid exercise? → That exercise is treated as unlinked, same as a no-match case, until a link is supplied.
- What happens to a customer program that mentions an exercise not yet in the reference records at migration time, but the exercise is added later? → It becomes linked automatically the next time the program is viewed (per Story 1, Scenario 3's live-lookup behavior), no manual program edit needed.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: System MUST maintain a central exercise reference record set containing, at minimum, each exercise's name and its demonstration video link.
- **FR-002**: System MUST migrate every exercise entry currently in `exercise.md` into this central reference record set, preserving each exercise's name and video link, before the file is removed.
- **FR-003**: System MUST be able to look up a video link for a given exercise name from the central reference records.
- **FR-004**: When displaying or generating a customer's workout program, the system MUST render each exercise name as a link to its video wherever the exercise name matches an entry in the central reference records.
- **FR-005**: When an exercise name in a customer's workout program has no matching entry (or the matching entry has no video link), the system MUST display that exercise name as plain, unlinked text without failing or omitting the rest of the program.
- **FR-006**: This linking behavior MUST apply both to programs generated going forward and to customers' existing workout programs already on file.
- **FR-007**: System MUST match exercise names case-insensitively but otherwise exactly (no partial or fuzzy matching) against the central reference records.
- **FR-008**: Exercise names in the central reference records MUST be unique.
- **FR-009**: Once migration is verified complete (all exercises from `exercise.md` confirmed present in the central reference records with name and video link intact), the system MUST no longer depend on `exercise.md`, and the file MUST be deleted from the project.
- **FR-010**: The coach MUST be able to add a new exercise (name + video link) to the central reference records after migration, and MUST be able to update an existing exercise's video link, with changes reflected in every customer program that references that exercise.

### Key Entities

- **Exercise**: A reference entry in the central exercise library — its name (unique, used for matching), category (e.g., strength/cardio/flexibility, inherited from the current `exercise.md` grouping), and a link to a video demonstrating proper form. This is the migrated replacement for the rows currently in `exercise.md`.
- **Program** *(existing entity)*: A customer's workout routine content. Unchanged in what it stores, but its exercise names are now resolved against the Exercise entity whenever the program is displayed or generated, to determine which names render as video links.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: 100% of the exercises listed in the original `exercise.md` are present in the central exercise reference records after migration, with no name or video link lost.
- **SC-002**: Across all existing customer workout programs, every workout line whose exercise name matches an entry in the central reference records displays that name as a working video link, verified with zero manual per-program edits required.
- **SC-003**: A coach can go from viewing a workout exercise to watching its form-demonstration video in one click, without searching outside the program.
- **SC-004**: No local exercise reference file exists in the project once migration is verified complete.
- **SC-005**: Updating one exercise's video link in the central reference records is reflected the next time each customer program referencing that exercise is viewed — with zero of that customer's program files needing individual edits.

## Assumptions

- The "new Table" the user asked for follows the same storage approach already established for other customer/program data (see the existing `customers`, `programs`, `feedbacks`, and `notes` reference records) rather than introducing a different storage mechanism — this spec describes the data and behavior, leaving the concrete storage technology to the planning phase.
- Exercise-name matching is case-insensitive exact-match; near-miss spelling/formatting variants (e.g., "Push Up" vs "Push-up") are out of scope for this feature and are treated as unlinked rather than resolved automatically.
- Linking applies retroactively to every existing customer's workout program, not just newly generated ones — this is what "for each customer" in the request means.
- The video-link source data itself (which real video URL belongs to which exercise) is the set already compiled in `exercise.md`; this feature does not re-source or re-verify those links.
- "Add the video link to the name of the exercise" means the exercise's name itself becomes the clickable link (matching the format already used while `exercise.md` existed), not a separate link appended after the name.
- Removing `exercise.md` "locally" means deleting it from the project working directory/repository once the migration is confirmed complete, not merely hiding or archiving it.
