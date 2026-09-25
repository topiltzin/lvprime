# Feature Specification: Fitness Coach Chatbot

**Feature Branch**: `013-fitness-coach-chatbot`

**Created**: 2026-09-25

**Status**: Draft

**Input**: User description: "I want to add a Chatbot on the web. The Chatbot is deployed on an API (example: POST `https://8000-01m3cags23heagcw7bk8nz057w.cloudspaces.litng.ai/chat` with `{ "message": "Beginner diet tips?", "max_tokens": 200 }`, 120 s timeout, reply read from `response`, non-200 treated as an error). Add to the message a sentence like 'you are a fitness coach ready to help', and make each answer short."

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Ask the coach assistant a quick question (Priority: P1)

A signed-in coach is working in the app and wants a quick answer to a general fitness or nutrition question ("Beginner diet tips?", "Good warm-up before squats?"). They open the chat panel, type the question and send it. After a short wait they get a brief answer in a fitness-coach voice, shown under their question.

**Why this priority**: This is the whole feature. Without asking and getting an answer, nothing else in the chatbot has value.

**Independent Test**: Sign in, open the chat panel from any screen, send "Beginner diet tips?", and confirm a short, fitness-focused answer appears under the question.

**Acceptance Scenarios**:

1. **Given** a signed-in coach on any screen, **When** they click the chat launcher, **Then** a chat panel opens with an empty message box and a short greeting (e.g. "Hi! I'm your fitness coach assistant. Ask me anything about training or nutrition.").
2. **Given** the chat panel is open, **When** the coach types a question and presses Send (or Enter), **Then** the question appears in the conversation right away, the input clears, and a "Thinking..." indicator is shown.
3. **Given** a question was sent, **When** the assistant service replies successfully, **Then** the indicator is replaced by the answer, shown as an assistant message under the question.
4. **Given** any question, **When** the assistant replies, **Then** the answer is written as a fitness coach and is short (a few sentences or a short list, not a long article).
5. **Given** the coach's question text, **When** it is sent to the assistant service, **Then** the text sent is the coach's question with the fixed coaching instruction added ("You are a fitness coach ready to help. Keep your answer short."), and the coach never sees that instruction in the conversation.

---

### User Story 2 - Clear feedback when the assistant is slow or unavailable (Priority: P2)

The assistant runs on an external service that can be slow, asleep or down. The coach needs to know what is happening and be able to try again without retyping.

**Why this priority**: The external service can take up to two minutes or fail. Without clear waiting and error states the panel looks broken, and coaches lose their question.

**Independent Test**: With the assistant service unreachable (or returning an error), send a question and confirm a friendly error with a Retry action appears and the question stays in the conversation.

**Acceptance Scenarios**:

1. **Given** a question is waiting for an answer, **When** the coach looks at the panel, **Then** the waiting indicator is visible and the Send button is disabled so the same question can't be sent twice.
2. **Given** the assistant service returns an error or can't be reached, **When** the request ends, **Then** the conversation shows "The coach assistant is unavailable right now. Try again." with a Retry action under the coach's question.
3. **Given** no answer arrives within 120 seconds, **When** the time limit passes, **Then** the request stops and the same error-with-Retry message is shown.
4. **Given** an error message is shown, **When** the coach clicks Retry, **Then** the same question is sent again without retyping and the waiting indicator returns.
5. **Given** the service replies successfully but with an empty answer, **When** the reply arrives, **Then** it is treated as an error (Story 2, scenario 2), not shown as a blank message.

---

### User Story 3 - Keep the conversation while working (Priority: P3)

The coach asks several questions in a row and moves between screens (overview, a client's tabs) while the panel is open or closed. The questions and answers from this visit stay visible until the coach clears them or leaves the app.

**Why this priority**: It makes the chatbot comfortable for more than one question, but a one-question chat still delivers value without it.

**Independent Test**: Ask two questions, close the panel, switch to another client, reopen the panel, and confirm both questions and answers are still there; then click "Clear chat" and confirm the conversation is empty.

**Acceptance Scenarios**:

1. **Given** a conversation with several messages, **When** the coach closes and reopens the panel or moves to another screen, **Then** all messages are still shown in order.
2. **Given** a conversation with messages, **When** the coach clicks "Clear chat", **Then** all messages are removed and the greeting is shown again.
3. **Given** a long conversation, **When** a new answer arrives, **Then** the panel scrolls to show the newest message.

---

### Edge Cases

- **Empty or whitespace-only message**: Send is disabled; nothing is sent.
- **Very long question**: input is limited to 1,000 characters, with a visible counter near the limit.
- **Question sent while another is still waiting**: not possible, because Send is disabled until the current request ends.
- **Off-topic questions** (e.g. unrelated to fitness): the question is still sent; the coaching instruction steers the answer, and the app does not filter topics itself.
- **Answer with line breaks or list formatting**: line breaks and simple lists are shown readably; the answer is displayed as plain text, never run as page content.
- **Coach's sign-in expires while chatting**: the request fails like any other app request and the coach is taken to the sign-in page, as happens elsewhere in the app.
- **Panel on a phone-width screen**: the panel takes the full width and does not cause horizontal scrolling.
- **Coach closes the panel while waiting**: the request keeps going; the answer is in the conversation when the panel is reopened.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: The app MUST show a chat launcher on every screen available to a signed-in coach, and MUST NOT show it on the sign-in page.
- **FR-002**: The launcher MUST open and close a chat panel without leaving or reloading the current screen.
- **FR-003**: Coaches MUST be able to type a question (1–1,000 characters, not only whitespace) and send it with a Send button or the Enter key.
- **FR-004**: For every question, the system MUST send the assistant service a message made of a fixed coaching instruction plus the coach's question. The instruction MUST tell the assistant it is a fitness coach ready to help and that answers must be short (e.g. "You are a fitness coach ready to help. Keep your answer short (2–4 sentences). Question: <coach's question>").
- **FR-005**: The system MUST cap each answer's length with a response-length limit sent with every request (default equal to the example's 200-token budget), so answers stay short even if the instruction is ignored.
- **FR-006**: The coaching instruction MUST NOT appear in the conversation shown to the coach; only the coach's own words and the assistant's answers are shown.
- **FR-007**: The system MUST show a waiting indicator while an answer is pending and MUST prevent sending another question until the current one ends.
- **FR-008**: The system MUST stop waiting after 120 seconds and treat that as a failure.
- **FR-009**: On any failure (unreachable service, error status, timeout, empty answer), the system MUST show a friendly error message with a Retry action under the question, and Retry MUST resend the same question.
- **FR-010**: Assistant answers MUST be shown as plain text, keeping line breaks, and MUST never be interpreted as page markup or scripts.
- **FR-011**: The conversation MUST persist while the coach moves between screens and opens/closes the panel during the same visit, and MUST be clearable with a "Clear chat" action.
- **FR-012**: Only signed-in coaches MUST be able to use the chatbot; questions MUST reach the assistant service only through the app's own signed-in access, so people without a coach sign-in can't use the app to reach it.
- **FR-013**: The assistant service address MUST be configurable per environment (local vs. deployed) without changing the app's code, since the provided address is a placeholder ("Replace with your Lightning AI URL").
- **FR-014**: The chatbot MUST NOT send customer data (names, programs, feedback, notes) to the assistant service; only the text the coach types plus the coaching instruction is sent.
- **FR-015**: The chat panel MUST follow the app's existing visual style (colors, type, light/dark handling) and work at phone width without horizontal scrolling.

### Key Entities

- **Chat message**: One item in the conversation. Attributes: who sent it (coach or assistant), text, time sent, status (sent, waiting, answered, failed). Lives only for the current visit; not stored with customer data.
- **Conversation**: The ordered list of chat messages for the coach's current visit. Cleared by "Clear chat" or by leaving the app.
- **Coaching instruction**: The fixed text added to every question that sets the fitness-coach role and the short-answer rule. Configured once, the same for every question.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: A coach can open the chat, ask a question and see an answer in 3 interactions or fewer (open, type, send).
- **SC-002**: At least 90% of answers are 4 sentences / 80 words or fewer when checked against a sample of 20 typical fitness and nutrition questions.
- **SC-003**: At least 90% of answers on that same sample are written from a fitness-coach point of view (on-topic training, nutrition or recovery advice).
- **SC-004**: When the assistant service is healthy, 95% of answers appear within 30 seconds of sending.
- **SC-005**: In 100% of failure cases (service down, error, timeout, empty reply), the coach sees an error with Retry within 121 seconds, and no failed question is lost from the conversation.
- **SC-006**: 0 requests reach the assistant service from someone who is not signed in as a coach.

## Assumptions

- **Audience**: The app is coach-only today, so the chatbot is for signed-in coaches. A customer-facing chatbot is out of scope.
- **Placement**: A floating launcher available on all signed-in screens, rather than a new tab inside a client page, because the questions are general and not tied to one client.
- **Single-turn answers**: The assistant service takes one message per request and returns one answer. Earlier questions in the conversation are not sent as context; each question is answered on its own. Multi-turn memory is out of scope for this version.
- **No customer context**: The assistant gives general coaching answers. Using a client's program or feedback to personalize answers is out of scope (and FR-014 forbids sending it).
- **Conversation is not saved**: Chats are kept only for the current visit, not written to the database or to customer files, so the constitution's customer-data rules (three files per customer, fitness-only data) are unaffected.
- **Wording of the instruction**: The exact instruction text can be tuned during planning; it must keep both parts the user asked for (fitness-coach role, short answers).
- **Language**: The instruction is in English; the assistant is expected to reply in the language of the question, and this is not enforced by the app.
- **Dependency**: Requires the external assistant service to be running and reachable. Its availability, cost and model quality are outside this app's control; the app only has to handle failures well (Story 2).
