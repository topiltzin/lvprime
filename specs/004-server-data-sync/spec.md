# Feature Specification: Server-Based Data Sync

**Feature Branch**: `004-server-data-sync`

**Created**: 2026-09-16

**Status**: Draft

**Input**: User description: "check the app, I need for the next iteration the app will be on a server not locally, then how to keep the Data on sync? I need the routine create it locally with the claude code, but the feedback could be inserted on the UI and data shoudl be on sync."

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Coach Creates Program Locally via Claude Code (Priority: P1)

A fitness coach uses Claude Code locally to create a new customer workout program. The program is authored as a structured markdown file (program.md) following Lili Trainer standards. Once saved locally, the program must be immediately available to the customer on the server-based UI, without manual upload or sync intervention.

**Why this priority**: This is the core workflow for program creation. If coaches cannot reliably get programs to the server, the entire system fails. This is the foundation for all subsequent features.

**Independent Test**: Coach creates a program.md file locally via Claude Code → program appears in customer dashboard on the web UI within seconds → customer can view and act on the program.

**Acceptance Scenarios**:

1. **Given** a coach has created a new `program.md` locally, **When** the file is saved, **Then** the program data is synced to the server automatically.
2. **Given** a program exists on the server, **When** a customer loads the web dashboard, **Then** the latest program is displayed without requiring manual refresh.
3. **Given** a coach modifies an existing program locally, **When** the changes are saved, **Then** the server reflects the updates and customers see the new version.

---

### User Story 2 - Customer Provides Feedback via Web UI (Priority: P1)

A customer accesses the web UI and provides workout feedback for a session (e.g., how they felt, whether they completed it, notes). This feedback is stored on the server and immediately available for the coach to review locally via Claude Code.

**Why this priority**: Feedback collection is equally critical as program delivery. Without reliable feedback flow from UI to coach, the coaching relationship breaks down and the system cannot adapt to customer needs.

**Independent Test**: Customer enters feedback in web UI → feedback is stored on server → coach can read all feedback via Claude Code in next interaction → coach can analyze patterns and adjust program.

**Acceptance Scenarios**:

1. **Given** a customer submits feedback via the web UI, **When** the form is submitted, **Then** the feedback entry is persisted on the server.
2. **Given** feedback has been entered on the web UI, **When** the coach queries feedback locally, **Then** the latest feedback entries are visible in feedback.md.
3. **Given** multiple feedback entries exist, **When** the coach reviews feedback.md, **Then** all entries are in chronological order with consistent formatting.

---

### User Story 3 - Bi-Directional Sync Maintains Consistency (Priority: P2)

The coach makes changes locally (program updates, notes) and the customer provides feedback via UI (feedback entries). Both streams of changes must converge on the server such that:
- Coach sees all customer feedback when working locally
- Customer sees all coach updates when viewing the UI
- Changes from either side do not overwrite or conflict with changes from the other

**Why this priority**: This ensures the system remains reliable as both coach and customer interact. Without conflict-free sync, data can be lost or inconsistent, breaking trust in the coaching relationship.

**Independent Test**: Coach edits program.md locally while customer simultaneously enters feedback via UI → both changes persist without loss or contradiction → coach and customer each see the other's updates in their respective interfaces.

**Acceptance Scenarios**:

1. **Given** a coach has changed the program locally and a customer has added feedback via UI simultaneously, **When** both save, **Then** neither change is lost and both are visible in their respective views.
2. **Given** conflicting edits occur (e.g., coach modifies the program while customer submits feedback simultaneously), **When** conflict is detected, **Then** the coach's changes take precedence and the customer's concurrent UI submission is not processed (but can be retried after seeing the updated program).
3. **Given** the coach works offline, **When** changes are made locally, **Then** they are queued and synced to the server once connectivity is restored.

---

### Edge Cases

- What happens when a coach creates a program locally while the network is down and then reconnects?
- How does the system handle if feedback is submitted via UI while the coach is simultaneously deleting that feedback entry via Claude Code?
- What if a customer's feedback includes data that contradicts the current program structure (e.g., feedback for an exercise no longer in the program)?
- What happens if the coach's local Claude Code environment goes out of sync with the server state for an extended period?

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: System MUST support creating and editing program.md files locally via Claude Code and automatically sync them to the server.
- **FR-002**: System MUST allow customers to submit feedback entries via a web UI form and persist them on the server.
- **FR-003**: System MUST display the latest program.md content in the customer web UI dashboard without requiring manual refresh.
- **FR-004**: System MUST display all feedback entries in the coach's local feedback.md file, with entries listed in chronological order.
- **FR-005**: System MUST handle simultaneous edits from the coach (local) and customer (UI) without data loss.
- **FR-006**: System MUST support offline-first behavior: coach can work locally without server connectivity and changes are synced when reconnected.
- **FR-007**: System MUST implement a conflict resolution strategy for concurrent edits where coach changes take precedence over simultaneous UI-based changes. When a conflict is detected, the coach's version is synced to the server and the UI shows the coach's latest version.
- **FR-008**: System MUST maintain data format consistency: all dates use YYYY-MM-DD format, all files follow Lili Trainer markdown structure, and no data is corrupted during sync.
- **FR-009**: System MUST provide customers read-only access to program.md and allow them to add feedback entries only (preventing accidental program overwrites).
- **FR-010**: System MUST log all sync events (success, failure, conflict, offline queue) for debugging and audit purposes.

### Key Entities *(include if feature involves data)*

- **Program**: Structured markdown document (program.md) containing weekly workout routines, exercises, sets, reps, form tips, and progression strategy. Owned by coach, read by customer, synced bidirectionally.
- **Feedback Entry**: Timestamped record (date, how customer felt, completed status, notes, overall impression) submitted via web UI. Created by customer, read by coach.
- **Sync State**: Metadata tracking whether a file is in sync with the server, timestamp of last sync, and any pending changes in the offline queue.
- **Customer**: An individual receiving coaching, with files stored under `customers/[customer-name]/`.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: Coach can create a program locally and customer sees it on the web UI within 5 seconds of save (sync latency < 5s under normal network conditions).
- **SC-002**: Customer can submit feedback via the web UI and it appears in coach's local feedback.md within 30 seconds.
- **SC-003**: System maintains 99.9% data consistency: no feedback entries or program updates are lost during sync, even with simultaneous edits.
- **SC-004**: Coach can work offline and successfully sync 100% of locally created or modified files once reconnected, without manual intervention.
- **SC-005**: Customers and coaches report no confusion about which version of a program they are viewing (100% clarity on "am I looking at the latest?").
- **SC-006**: System handles 10+ concurrent customers providing feedback simultaneously without service degradation or sync delays.
- **SC-007**: All sync conflicts are resolved within 2 minutes (automatically or via manual review) and both parties are notified of the resolution.

## Assumptions

- **Network**: Customers and coaches have reliable internet connectivity during normal use. Coach's Claude Code environment can reliably connect to the server when actively working.
- **Scope**: Mobile-native sync (app) is out of scope for v1; web UI is the primary customer interface. Desktop/CLI coach experience remains primary.
- **Data Structure**: The existing three-file structure (program.md, feedback.md, notes.md) is preserved; sync operates at the file level, not individual fields.
- **Conflict Resolution Strategy**: Coach changes always take precedence over simultaneous UI-based changes. This ensures program integrity (coach's expertise is authoritative) while accepting that UI feedback submissions may not be processed if a simultaneous coach edit occurs. Feedback entries are still preserved if submitted moments before/after (not simultaneous with) a coach edit.
- **Authentication & Authorization**: Existing authentication system is reused; coaches see only their own customers' data, customers see only their own feedback and program.
- **Backward Compatibility**: The system must support coaches who continue to work entirely locally (opt-out of sync) during a transition period.
- **Data Retention**: Feedback and program versions are retained indefinitely unless explicitly archived (no automatic deletion).
- **Timezone Handling**: All timestamps are stored in UTC; UI displays customer's local timezone; coach sees UTC in local files.
