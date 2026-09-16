# Implementation Plan: Server-Based Data Sync

**Branch**: `004-server-data-sync` | **Date**: 2026-09-16 | **Spec**: [spec.md](spec.md)

**Input**: Feature specification from `specs/004-server-data-sync/spec.md`

## Summary

Move Lili Trainer from a local-only dashboard to a server-based system where:
- **Coach workflows** remain local-first (create/edit programs via Claude Code)
- **Customer interactions** shift to server-based UI (submit feedback via web)
- **Data stays synchronized** bi-directionally with conflict resolution favoring coach changes

The technical approach extends the existing REST API with a sync layer that handles file-level sync, offline queueing, and conflict detection.

## Technical Context

**Language/Version**: Node.js 22.5.0+ (existing); JavaScript (ES modules)

**Primary Dependencies**: 
- Vite 8.3.0 (frontend build)
- Custom HTTP server (server/index.js)
- SQLite (app/data/index.sqlite for indexing)
- File system (fs) for markdown storage

**Storage**: 
- Primary: Local file system (`customers/[name]/{program.md, feedback.md, notes.md}`)
- Index: SQLite database for fast queries
- Server side: Need to add persistent sync state tracking

**Testing**: Node.js built-in test runner (`node --test`)

**Target Platform**: Linux/macOS server + web browser + Claude Code CLI

**Project Type**: Web service + CLI integration (hybrid local/server architecture)

**Performance Goals**: 
- Sync latency < 5 seconds (FR-001, SC-001)
- Feedback ingestion < 30 seconds (SC-002)
- Support 10+ concurrent customers (SC-006)

**Constraints**:
- 99.9% data consistency (no loss during sync) (SC-003)
- Offline-first: coach can work disconnected, queue changes, sync on reconnect (FR-006, SC-004)
- Format preservation: YYYY-MM-DD dates, markdown structure integrity (FR-008)

**Scale/Scope**: 
- Multi-customer system (10+ concurrent feedback submitters expected)
- File-level sync operations (program.md, feedback.md)
- Minimal schema changes (preserve 3-file structure)

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

### Lili Trainer Constitution (v1.0.0) - Principle Alignment

✓ **Principle I: Content & Program Quality**
- Spec requirement FR-008 mandates format consistency (YYYY-MM-DD dates, markdown structure)
- Implementation plan must preserve program.md format fidelity through sync operations
- Sync system is a transport layer; it must NOT corrupt or reformat customer data

✓ **Principle II: Verify-Before-Save Testing Standards (NON-NEGOTIABLE)**
- Spec defines acceptance scenarios for each user story (testable, end-to-end)
- Sync implementation must include conflict detection (FR-007) and resolution logging (FR-010)
- Pre-save checks: feedback validation (FR-002), format consistency (FR-008), no overwrites (FR-009)

✓ **Principle III: User Experience Consistency**
- Spec defines "100% clarity on which version I'm viewing" (SC-005)
- Sync must ensure customers see latest coach updates instantly, coaches see all feedback
- Conflict resolution is deterministic (coach-always-wins) so UX behavior is predictable

✓ **Principle IV: Performance & Responsiveness**
- Spec mandates latency < 5s for program delivery (SC-001) and < 30s for feedback (SC-002)
- Offline-first sync minimizes blocking; queueing keeps coach productive when disconnected
- Sync logging (FR-010) enables fast debugging of failures

**Status**: ✅ PASS - No principle violations. Sync layer is a transport enhancement that strengthens all four principles.

## Project Structure

### Documentation (this feature)

```text
specs/004-server-data-sync/
├── spec.md                  # Feature specification
├── plan.md                  # This file (implementation plan)
├── research.md              # Phase 0 research findings
├── data-model.md            # Phase 1: Data structures for sync
├── contracts/               # Phase 1: Sync API contracts
│   ├── sync-protocol.md     # Bi-directional sync contract
│   ├── conflict-resolution.md # Conflict resolution algorithm
│   └── offline-queue.md     # Offline queue structure
├── quickstart.md            # Phase 1: Validation guide
└── checklists/              # Quality gates
    └── requirements.md
```

### Source Code (repository root)

The existing app structure is preserved; sync adds new modules:

```text
app/
├── src/
│   ├── api-client.js        # (existing) UI → API calls
│   └── sync-client.js       # (NEW) Handles file sync, offline queue
├── server/
│   ├── index.js             # (existing) HTTP routes
│   ├── serve.js             # (existing) Standalone server
│   ├── db.js                # (existing) SQLite queries
│   ├── customers-repo.js    # (existing) File system operations
│   ├── sync-engine.js       # (NEW) Sync coordination, conflict detection
│   ├── sync-state.js        # (NEW) Persist sync metadata (in-progress, last-sync)
│   └── offline-queue.js     # (NEW) Server-side queue for offline coach edits
├── data/
│   └── index.sqlite         # (existing) Index DB
└── server/
    └── data/
        └── sync-state.db    # (NEW) Sync metadata store

customers/
└── [customer-name]/
    ├── program.md           # (existing) Coach edits locally
    ├── feedback.md          # (existing + modified) Feedback appended via API
    └── notes.md             # (existing) Coach edits locally

tests/
├── sync/                    # (NEW) Sync engine tests
│   ├── offline-queue.test.js
│   ├── conflict-detection.test.js
│   └── sync-flow.test.js
└── [existing tests]
```

**Structure Decision**: Single-service hybrid architecture (existing). Sync layer is added as middleware/service modules within the existing app, not as a separate microservice. This minimizes deployment complexity while supporting both local CLI and server UI workflows.

## Complexity Tracking

No Constitution violations; no simplification tradeoffs needed.

---

## Phase 0: Research (To Be Generated)

**Output location**: `research.md` (not yet generated)

**Research topics** (from spec technical unknowns):
1. File sync patterns for offline-first architectures (how to queue local edits safely)
2. Conflict resolution algorithms for concurrent file edits (last-write-wins vs custom strategies)
3. SQLite transaction patterns for tracking sync state without losing data
4. WebSocket or polling for real-time feedback delivery to coach
5. Verification strategy for sync integrity (checksums, version vectors, event logs)

---

## Phase 1: Design & Contracts (To Be Generated)

**Output location**: 
- `data-model.md` — Sync metadata entities and state machine
- `contracts/sync-protocol.md` — File sync API contract (client↔server)
- `contracts/conflict-resolution.md` — Conflict resolution algorithm
- `contracts/offline-queue.md` — Offline change queue structure
- `quickstart.md` — End-to-end validation scenarios

**Entities to model** (from spec Key Entities section):

1. **Program** (program.md)
   - Owned by coach, read by customer
   - Synced: local save → server → UI display
   - Conflict: coach-always-wins (coach version replaces concurrent UI changes)

2. **Feedback Entry** (appended to feedback.md)
   - Created by customer (UI), read by coach (local)
   - Synced: UI form → server → coach's feedback.md
   - Preserved even if conflict with program edit

3. **Sync State** (new, tracked in sync-state.db)
   - `last_sync_timestamp` per file per customer
   - `pending_changes` queue for offline edits
   - `conflict_log` for debugging concurrent edits
   - `version_vector` or `last_writer` for conflict detection

4. **Offline Queue** (new, persistent in server or client)
   - Coach's local edits when disconnected
   - Persisted locally (Claude Code file system or IndexedDB)
   - Flushed to server on reconnect
   - Conflict detection on flush

## Constitution Re-Check (Post-Design)

Will be re-run after Phase 1 design artifacts are generated to verify sync algorithm respects all four principles (especially Principle II: verify-before-save).

---

## Next Steps

Run `/speckit-tasks` to break Phase 1 design into implementation work items:
- Spike research.md (conflict patterns, offline queue design)
- Implement data-model.md (sync state schema)
- Implement sync API contracts (sync-protocol.md)
- Build offline queue (offline-queue.md)
- Create quickstart validation tests
- Implement sync engine and client integration
