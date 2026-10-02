# Feature Specification: Gemini Chatbot Option

**Feature Branch**: `014-gemini-chatbot-option`

**Created**: 2026-10-02

**Status**: Draft

**Input**: User description: "implement previous requirement for Gemini Chatbot option." (Keep the current chatbot endpoint and behavior; add a deployment setting that selects which chatbot service answers the coach, with Google's Gemini as a second option.)

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Switch the coach assistant to Gemini (Priority: P1)

The site owner sets one deployment setting to choose Gemini as the service behind the coach assistant, supplies the Gemini access key, and restarts. Coaches keep using the same chat panel and receive short Spanish coaching answers produced by Gemini, with earlier-conversation memory still working.

**Why this priority**: This is the new capability; without it the feature delivers nothing.

**Independent Test**: Select Gemini, provide a key, ask a question in the chat panel, and confirm a coaching answer appears; then end the conversation and confirm memory notes are still saved.

**Acceptance Scenarios**:

1. **Given** Gemini is selected and a valid key is set, **When** a coach asks a question, **Then** they receive a concise Spanish coaching answer in the same chat panel.
2. **Given** Gemini is selected and the coach has earlier messages in the conversation, **When** they ask a follow-up, **Then** the answer takes the prior turns and saved memory notes into account.
3. **Given** Gemini is selected, **When** a conversation ends and its notes are updated, **Then** the notes are produced by Gemini and saved as before.

---

### User Story 2 - Existing chatbot keeps working unchanged (Priority: P1)

A deployment that does not set the new selection keeps using the current chatbot service exactly as today, with no new settings required.

**Why this priority**: Protects the live deployment from regression.

**Independent Test**: With the selection unset (and, separately, set to the current option), run the existing chat flow and confirm identical behavior and that all existing checks pass.

**Acceptance Scenarios**:

1. **Given** no selection is set, **When** a coach asks a question, **Then** the current chatbot service is used.
2. **Given** the current option is explicitly selected, **When** a coach asks a question, **Then** behavior is identical to the unset case.

---

### User Story 3 - Clear failure when misconfigured (Priority: P2)

If the selected option is unknown or lacks its required settings (e.g. Gemini selected without a key), the coach sees the same "assistant unavailable/not configured" message used today rather than a crash or a silent fallback to another service.

**Why this priority**: Prevents confusing behavior and accidental use of an unintended service.

**Independent Test**: Select Gemini with no key, and separately select an unknown value; confirm the not-configured response in both cases.

**Acceptance Scenarios**:

1. **Given** Gemini is selected with no key, **When** a coach asks a question, **Then** the not-configured response is returned.
2. **Given** an unrecognized selection value, **When** a coach asks a question, **Then** the not-configured response is returned.
3. **Given** the selected service is unreachable or returns no answer, **When** a coach asks a question, **Then** the existing unavailable/timeout messages are shown.

### Edge Cases

- The selection value has different capitalization or surrounding spaces: it is still recognized.
- The Gemini reply contains internal reasoning content alongside the answer: only the answer text reaches the coach.
- The Gemini reply has no answer text: treated as unavailable, not shown as an empty message.
- Keys, service addresses and question/answer text are never exposed to the browser or logged.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: The system MUST let the deployment choose the chatbot service through a single setting, with the current service as the default when unset.
- **FR-002**: The system MUST offer Gemini as a selectable option alongside the current service.
- **FR-003**: Selecting Gemini MUST require an access key; the model name and service address MUST be optionally overridable with sensible defaults.
- **FR-004**: Both options MUST apply the same coaching instruction, answer-length guidance, conversation history and memory notes.
- **FR-005**: Conversation memory summarization MUST use the selected service.
- **FR-006**: The current service's configuration and behavior MUST remain unchanged.
- **FR-007**: A missing key, missing address or unrecognized selection MUST yield the existing not-configured response, with no fallback to the other service.
- **FR-008**: Only the answer text from the selected service MUST be returned to the coach; internal reasoning content MUST be discarded.
- **FR-009**: Keys and service addresses MUST NOT reach the browser, and question/answer text MUST NOT be logged.
- **FR-010**: The example configuration file MUST document the new setting and the Gemini-specific settings.

### Key Entities

- **Chatbot service selection**: The deployment-level choice of which service answers (current service or Gemini), plus that service's settings (address/key/model).

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: Switching a deployment to Gemini takes only changing settings and restarting; no code change.
- **SC-002**: 100% of existing chat checks pass with the selection unset.
- **SC-003**: With Gemini selected, a coach receives an answer to a typical question in under 30 seconds in normal conditions.
- **SC-004**: Every misconfiguration case (no key, unknown value) produces the not-configured message, never an error screen or an answer from the other service.

## Assumptions

- Chat panel, sign-in gate, per-user memory and Spanish UI are unchanged; this feature only changes which service answers.
- Gemini requests are sent as a single combined prompt (coaching instruction, memory notes, history, question); no separate answer-length cap is sent because the model's reasoning shares any such cap.
- The Gemini key setting is named `GEMINI_API_KEY`; the selection setting is `CHATBOT_PROVIDER` (`lightning` default, `gemini`).
- Gemini service revision is fixed to the one given in the request (2026-05-20); default model `gemini-3.8-flash`.
- Switching services mid-deployment does not migrate existing saved memory notes; they remain valid text for either service.
- Streaming responses and per-user service choice are out of scope.
