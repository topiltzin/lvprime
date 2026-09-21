# Phase 1: Data Model — Publish-Time Exercise Coverage Check

**Date**: 2026-09-21
**Status**: Complete

## Overview

No schema change, no new persisted entity. This feature is entirely about *when* and *where*
specs/008's existing `Exercise`/`Program` read path gets invoked and surfaced — the two shapes
below are in-process data shapes (function input/output), not database structures.

---

## Shape: Coverage Report *(new — extracted from check-exercise-coverage.js's `main()`)*

**Purpose**: The structured result `checkCoverage()` returns, consumed by both
`check-exercise-coverage.js`'s own CLI output and `publish.js`'s new `reportProgramCoverage()`.

```js
{
  customerCount: number,        // distinct customers scanned
  distinctUsedCount: number,    // distinct exercise names referenced across all programs
  libraryCount: number,         // rows currently in the exercises table
  missing: Array<{ name: string, slugs: string[] }>,  // specs/008's diffMissingExercises() output
}
```

No validation rules — this is a read-only computed report, not a persisted or user-supplied shape.

---

## Shape: Coverage Report Text *(new — `formatCoverageReport()`)*

**Purpose**: The exact printable text specs/008's `check-exercise-coverage.js` already produces
today, now a pure function of a Coverage Report so `publish.js` prints identical text.

**Input**: one Coverage Report (above).

**Output**: a string — either the "No coverage gaps..." line, or the "Scanned N customer(s)..."
header followed by one `"name" — used by: slug1, slug2` line per missing entry, exactly matching
today's `check-exercise-coverage.js` console output byte-for-byte (this is the whole point of
extracting it — see research.md §2).

---

## No changes to existing entities

- **Exercise** *(specs/007)*: unchanged.
- **Program** *(existing)*: unchanged — still read-only input to the coverage check, same as
  specs/008.
- **Customer** *(specs/006)*: unchanged — `publish.js` already creates one via `upsertCustomer` when
  needed; this feature adds no new field or behavior to that step.
