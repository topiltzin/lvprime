<!--
Sync Impact Report
Version change: (none, unratified template) → 1.0.0
Modified principles: n/a (initial ratification)
Added sections:
  - Core Principles: I. Content & Program Quality, II. Verify-Before-Save Testing Standards
    (NON-NEGOTIABLE), III. User Experience Consistency, IV. Performance & Responsiveness
  - Customer Data Standards
  - Development Workflow & Quality Gates
  - Governance
Removed sections: none (unfilled placeholder template had no ratified content)
Templates requiring updates:
  - No dependent Spec Kit templates/commands were modified by this command (out of scope
    per the constitution command's Scope Guard).
Follow-up TODOs: none — all placeholders resolved from CLAUDE.md and user-supplied scope.
-->

# Lili Trainer Constitution

## Core Principles

### I. Content & Program Quality
Every customer artifact this project produces — `program.md`, `feedback.md`, `notes.md`,
and any exported deliverable (PDF/HTML) — MUST conform exactly to the file formats defined
in `CLAUDE.md`. A generated workout program MUST NOT be saved unless it includes: the goal,
fitness level, and duration; a weekly exercise breakdown with sets, reps, and rest periods;
form tips per exercise; a progression strategy; and warm-up/cool-down guidance. Skill
definitions (e.g. `.agents/skills/fitness-coach/SKILL.md`) MUST stay internally consistent
with the file formats they produce — if one changes, the other MUST be updated in the same
change.
**Rationale**: This project's "code" is structured Markdown and skill instructions, not
compiled software. Quality here means format fidelity and completeness, since an
incomplete program is unusable by the customer and a malformed file breaks every
downstream read (feedback logging, insight generation, PDF export).

### II. Verify-Before-Save Testing Standards (NON-NEGOTIABLE)
There is no automated test suite for this project; verification MUST instead happen as a
mandatory pre-save check on every write. Before writing or updating `program.md`, the new
plan MUST be checked against the customer's stated goal, fitness level, equipment, and any
injuries/limitations recorded in `feedback.md`/`notes.md`. Before appending to `feedback.md`,
the entry MUST include all required fields (date, how customer felt, completed, notes,
overall impression). Before writing to `notes.md`, each insight or recommendation MUST cite
the specific dated feedback entries that justify it — unsupported claims MUST NOT be
written.
**Rationale**: Without CI or unit tests, the only quality gate is disciplined verification
at write time. Skipping this check is how a program drifts from a customer's real
constraints or an insight becomes coaching folklore instead of evidence-based guidance.

### III. User Experience Consistency
All customer-facing output MUST be consistent in structure, tone, and terminology across
customers and across sessions — a program from week 1 and a program from week 10 must read
as the same coaching voice. Dates MUST always use `YYYY-MM-DD` format. Every new-customer
interaction MUST begin by asking whether this is a new or existing customer before any file
is created or modified, exactly as specified in `CLAUDE.md`. Section headings and structure
within `program.md`, `feedback.md`, and `notes.md` MUST match the templates in `CLAUDE.md`
verbatim so customers and the coach can navigate any customer's files identically.
**Rationale**: Customers experience this system as a coaching relationship, not software.
Inconsistent formatting or an unpredictable workflow undermines trust in the coaching
itself, not just the tooling.

### IV. Performance & Responsiveness
Session turnaround MUST stay fast: logging feedback and producing the resulting insight
SHOULD complete within a single interaction, without redundant re-reads of files already
loaded in the current session. Customer files MUST stay lean — `feedback.md` and `notes.md`
entries SHOULD be summarized or archived once they grow large enough to slow down review,
rather than left to grow unbounded. Any exported deliverable (PDF/HTML program) MUST be
generated and verified to render without errors before being handed to the customer.
**Rationale**: A coach who takes too long to respond, or whose files become too large to
scan quickly, degrades the coaching experience and slows down every future update to that
customer.

## Customer Data Standards

Customer records live under `customers/[customer-name]/` with exactly the three files
defined in `CLAUDE.md` (`program.md`, `feedback.md`, `notes.md`); no customer data MAY be
stored outside this structure. Directory and file names MUST use consistent, lowercase,
hyphenated customer naming. Customer files MUST contain only fitness-program-relevant
information (goals, constraints, feedback, coaching notes) — no unrelated personal data
MAY be recorded. All timestamps MUST use `YYYY-MM-DD`.

## Development Workflow & Quality Gates

Every customer interaction MUST follow the workflow defined in `CLAUDE.md`: (1) confirm new
vs. existing customer; (2) for existing customers, read the current `program.md` and
`feedback.md` before making any change; (3) log new feedback entries first, then analyze
patterns across `feedback.md` before updating `notes.md`; (4) only regenerate or adjust
`program.md` sections after insights have been recorded in `notes.md`. Insights MUST be
specific and actionable (name the exercise or metric and the concrete adjustment), never
generic advice. Any deviation from this sequence (e.g., editing `program.md` before
reviewing feedback) MUST be treated as a violation of Principle II.

## Governance

This constitution supersedes all other project practices, including conflicting guidance
elsewhere, for the four Core Principles above; `CLAUDE.md` remains the operational
reference for day-to-day workflow detail and MUST be read as subordinate to and consistent
with this document. Amendments are made by editing this file directly, MUST include an
updated Sync Impact Report, and MUST follow semantic versioning: MAJOR for backward
incompatible principle removals or redefinitions, MINOR for new principles or materially
expanded guidance, PATCH for wording/clarification fixes. Every customer file change made
under this project SHOULD be checked against Principles I–IV before being finalized;
repeated or systemic violations MUST trigger a review of this constitution rather than
silent workarounds.

**Version**: 1.0.0 | **Ratified**: 2026-09-14 | **Last Amended**: 2026-09-14
