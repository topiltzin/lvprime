# Phase 0 Research: Fitness Plan Dashboard

All Technical Context fields were resolved directly from the user's planning instructions
and the existing repository content (customer files, `CLAUDE.md`, constitution) — no
`[NEEDS CLARIFICATION]` markers remain. This file records the decisions made and why,
including the two points the user explicitly left to the planner's judgment: SQLite binding
choice, and where SQLite sits relative to the Markdown files as sources of truth.

## 1. Frontend tooling: Vite + vanilla JS/HTML/CSS

- **Decision**: Use Vite purely as a dev server and bundler. No frontend framework (no
  React/Vue/Svelte). Views are plain JS modules that build/update DOM nodes directly;
  navigation between the three views (overview, customer detail, feedback form) is a small
  hand-written hash-based router in `src/main.js`.
- **Rationale**: Directly requested ("Vite with minimal number of libraries... vanilla HTML,
  CSS, and JavaScript as much as possible"). The app has exactly three views and modest
  interactivity (list, detail, form) — well within what vanilla DOM code handles cleanly
  without a framework's state-management machinery.
- **Alternatives considered**: A framework (React/Preact) was rejected as unnecessary
  overhead for three views and directly against the stated instruction. Server-rendered HTML
  with no bundler at all was rejected because Vite was explicitly requested and still adds
  real value (dev server with hot reload, ES module bundling for the browser).

## 2. Local SQLite binding: `better-sqlite3`

- **Decision**: Use `better-sqlite3` for all SQLite access from the Node backend.
- **Rationale**: It is synchronous (simpler code than callback/promise-based drivers for a
  single-user local tool with no concurrency to manage), has a single native dependency with
  no further transitive bloat, and is one of the most widely used, stable SQLite bindings
  for Node — appropriate for "minimal number of libraries."
- **Alternatives considered**: Node's built-in `node:sqlite` module was considered first
  (zero dependencies) but is still experimental in the Node 20 LTS line this plan targets,
  which is a worse fit for a tool meant to keep running reliably session after session.
  `sql.js` (WASM SQLite) was rejected — it's aimed at browser/in-memory use and would need
  extra glue to persist to disk. An ORM (Prisma/Drizzle) was rejected as unnecessary weight
  for a handful of small, hand-written queries.

**Implementation note (added during `/speckit-implement`)**: `better-sqlite3` failed to
build on the Node version actually installed in this environment (Node 26.8.1) — its native
addon uses a V8 `PropertyCallbackInfo::This()` method that newer V8 removed, so
`node-gyp`/`make` failed. Node's built-in `node:sqlite` (`DatabaseSync`) was verified
working on this Node version with no experimental-flag warning, offers the same synchronous
`prepare()/run()/get()/all()` shape (including named `@param` binding), and — being
built-in — drops a dependency rather than adding one. `server/db.js` was implemented against
`node:sqlite` instead; the only code-shape difference is that transactions use manual
`BEGIN`/`COMMIT`/`ROLLBACK` via `db.exec()` since `node:sqlite` has no `.transaction()`
helper. This is a strict improvement on the "minimal number of libraries" goal and removes
the native-compilation fragility risk entirely — no downside was found. `app/package.json`'s
`engines.node` was set to `>=22.5.0` accordingly.

## 3. Markdown rendering for display: `marked`

- **Decision**: Use `marked` to render the free-form portions of `program.md` and
  `notes.md` (headings, tables, bold text, nested lists) to HTML for display. The
  structured, bespoke portions — `feedback.md` entries — are **not** rendered through a
  generic Markdown parser; they're parsed with a small dedicated parser (see §4) because
  their fields need to be individually addressable (for the trend view and for validation),
  not just turned into HTML.
- **Rationale**: `program.md` files (see `customers/jaqueline-orellano/program.md`) use
  real Markdown tables, nested bullet structure, and bold/heading formatting throughout.
  Hand-rolling a Markdown-to-HTML renderer to cover tables correctly is a meaningful amount
  of code to write and maintain versus pulling in one small, dependency-free, widely-used
  library.
- **Alternatives considered**: Writing a minimal custom renderer was considered to keep
  dependency count at the absolute floor, but rejected — it would need to cover tables,
  nested lists, and inline formatting to render the existing files correctly, which is
  disproportionate effort next to one well-tested library. Rendering Markdown as
  preformatted text (no HTML conversion) was rejected — it fails spec FR-003's "readable,
  organized layout" bar for tables and structure.

## 4. Feedback entry parsing/writing: dedicated parser, no Markdown library

- **Decision**: Write a small, purpose-built parser/formatter (`server/markdown-parser.js`,
  `server/feedback-writer.js`) for the specific `feedback.md` entry shape used across
  customer files:
  ```text
  ## [Date] - [Day/Session label]
  - Completed: [Yes/No]
  - Energy/felt: ...
  - Notes: ...
  - Overall impression: ...
  ```
  (Field labels vary slightly by customer file — see `data-model.md` for the exact field
  set the parser recognizes.) Parsing is done with line-based pattern matching, not a
  general Markdown AST library.
- **Rationale**: The format is a small, fixed template already defined in `CLAUDE.md`, not
  arbitrary Markdown — a general parser is the wrong tool and would still require
  post-processing to extract the fields. A dedicated parser is simpler, has zero new
  dependencies, and can be made precisely round-trip-safe (parse → format produces
  byte-identical output for unmodified entries), which matters for Principle I (never
  corrupt existing content).
- **Alternatives considered**: Using `marked`'s AST for this too was rejected — extracting
  labeled fields from its generic list/heading nodes would be more code than the direct
  line-based approach, for a document shape that Markdown-generality doesn't actually help
  with.

## 5. Data ownership: Markdown files are canonical; SQLite is a derived, rebuildable index

- **Decision**: `program.md` and `notes.md` are read-only to the app and are the sole source
  of truth for their content (never written by the app — spec FR-009). `feedback.md` is the
  source of truth for feedback history; the app's only write path for feedback is appending
  a new, validated entry to that file (spec FR-008). SQLite (`app/data/index.sqlite`) stores
  a **derived index** built by parsing those files: one row per customer, one row per
  feedback entry (for trend queries), and one row per non-standard attachment's metadata
  (path/size/mtime — never file contents). The index is refreshed lazily using file
  modification times: before serving a customer's data, the backend compares each relevant
  file's mtime against the last-indexed mtime stored in SQLite and re-parses/upserts if the
  file changed. The whole database can be deleted at any time and rebuilt by rescanning
  `customers/`.
- **Rationale**: This directly satisfies the user's instruction to track customer/session
  metadata in SQLite "rather than rely only on the md files," while still satisfying spec
  FR-009 and constitution Principle I (app must not become a second authority for
  program/notes content) and FR-012 (must reflect current file contents without a manual
  sync step — the mtime check gives this for free, including changes made outside the app,
  e.g. by the coach through the existing Claude/`CLAUDE.md` workflow). It also gives the
  overview screen (FR-001/002) and trend view (FR-006) fast, indexed queries instead of
  re-parsing every customer's files on every navigation.
- **Alternatives considered**: Making SQLite the primary store (write feedback there, export
  to `feedback.md` as a secondary artifact) was rejected — it would make the app, not the
  Markdown file, the real source of truth, directly conflicting with spec FR-008/FR-009 and
  constitution Principle I, and would risk the file and DB drifting apart. Parsing all files
  fresh on every request with no persistent index was rejected as not meeting the user's
  explicit SQLite instruction, even though raw performance would be adequate at current
  scale (see Technical Context "Scale/Scope").

## 6. Local API architecture: Vite middleware, no separate framework

- **Decision**: The Node API (`server/index.js`) is a small set of route handlers using only
  Node's built-in `http`/`node:url` modules — no Express/Fastify/Koa. In development, it's
  mounted into the Vite dev server via a Vite plugin's `configureServer` hook (one process,
  one port). For everyday use, `vite build` produces static assets and a small `npm start`
  script runs the same route handlers as a plain Node HTTP server serving both the built
  assets and `/api/*`.
- **Rationale**: The API surface is small (list customers, get one customer's data, submit
  feedback — see `contracts/api.md`); a routing framework adds a dependency for
  negligible benefit at this scope, matching "minimal number of libraries."
- **Alternatives considered**: Express was considered (very common, well understood) but
  rejected as an avoidable dependency for ~3 routes. Two separate always-running processes
  (Vite dev server + a separate backend server on another port, connected via CORS) was
  rejected as more moving parts than the single-process middleware approach for no benefit
  in a local single-user tool.

## 7. Testing: Node's built-in test runner

- **Decision**: `node:test` + `node:assert` for both unit and integration tests. No Jest/
  Vitest/Mocha.
- **Rationale**: Zero additional dependency, sufficient for this project's test needs
  (parser round-trips, DB query correctness, HTTP route behavior), consistent with the
  minimal-libraries directive.
- **Alternatives considered**: Vitest (pairs naturally with Vite) was considered but
  rejected — it would be the app's 4th dependency for a capability Node already provides
  natively at the targeted Node 20 LTS version.

## 8. Feedback trend visualization: hand-drawn SVG, no charting library

- **Decision**: Render trend views (completion rate, energy/difficulty over time — spec
  FR-006) as small, hand-written inline SVG generated by `src/components/trend-chart.js` —
  simple bar/line shapes computed from the indexed feedback data, no charting library.
- **Rationale**: The required charts are simple (a handful of data points per customer,
  bar/line style) — well within what a small amount of direct SVG-generation code can do,
  keeping the dependency count at the three already justified above.
- **Alternatives considered**: A charting library (Chart.js, uPlot, etc.) was rejected as
  disproportionate for a few simple trend lines and against the minimal-libraries
  instruction; nothing about the chart requirements needs a general-purpose charting engine.

## 9. Date/format normalization

- **Decision**: The app always writes new feedback entries with `YYYY-MM-DD` dates
  (constitution Principle III), regardless of how older entries in a file are formatted.
  When parsing existing entries for display, the parser accepts the entry as-is (including
  free-form or missing dates) and displays what it can, per spec's edge case for
  partially-matching entries — it does not attempt to rewrite or "fix" historical content it
  didn't write.
- **Rationale**: Existing files (e.g. `jaqueline-orellano/program.md`) currently use
  free-form Spanish dates ("14 de Septiembre, 2026"), not yet `YYYY-MM-DD`. Constitution
  Principle I forbids the app from modifying `program.md`, so those cannot be normalized by
  the app at all; for `feedback.md`, silently rewriting a coach's or customer's historical
  entries the app didn't create would violate Principle I's "never corrupt existing content"
  intent even though it's technically writable. New data the app itself creates is held to
  the `YYYY-MM-DD` standard from day one.
- **Alternatives considered**: Rejecting/blocking display of any entry with a non-ISO date
  was rejected — it would violate spec's edge case requirement that malformed/partial
  entries still display.
