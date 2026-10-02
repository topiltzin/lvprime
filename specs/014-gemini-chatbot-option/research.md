# Research: Gemini Chatbot Option

## Decision 1: Selection mechanism
- **Decision**: `CHATBOT_PROVIDER` env var, values `lightning` (default) and `gemini`, trimmed and case-insensitive; unknown value → `chatbot_not_configured`.
- **Rationale**: Matches the request for an environment variable; default keeps existing deployments unchanged; no silent fallback (FR-007).
- **Alternatives**: Infer from which keys are set (ambiguous, can pick the wrong service); per-user choice (out of scope).

## Decision 2: Gemini request shape
- **Decision**: POST `{ model, input }` with `x-goog-api-key` and `Api-Revision: 2026-05-20`; `input` is one string combining system prompt, memory notes, history and question.
- **Rationale**: Exactly the shape in the user's working curl example; no schema guesses.
- **Alternatives**: Structured turns / system instruction fields (unverified for this revision; revisit if the docs confirm them).

## Decision 3: Answer extraction
- **Decision**: Concatenate `text` parts of `steps[]` entries with `type: "model_output"`; ignore `thought` steps; empty → `chatbot_unavailable`.
- **Rationale**: Matches the sample response, which includes a large signed `thought` step.

## Decision 4: Token cap
- **Decision**: Send no max-output setting for Gemini.
- **Rationale**: Sample shows 373 thought tokens vs 14 output; a cap of 200 could yield empty answers. The prompt already requests brevity.

## Decision 5: Key name
- **Decision**: `GEMINI_API_KEY` (user's shell variable was `GEMINI_API`).
- **Rationale**: Conventional name; trivial to rename if preferred.

No NEEDS CLARIFICATION items remained.
