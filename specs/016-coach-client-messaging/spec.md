# Feature Specification: Coach–Client Messaging

**Feature Branch**: `016-coach-client-messaging`

**Created**: 2026-10-06

**Status**: Draft

**Input**: User description: "I want to add the possibility that the coach could send messages to the client. What could be the best way? Only messages, or specific messages between client and coach? The UI/UX Pro Max review should validate that the change aligns with the existing design."

## Recommendation (answer to the open question)

Use **one private conversation per customer between the coach and that customer**, rather than a one-way "broadcast only" message feed. The coach starts and drives it (P1), and the customer can reply (P2). This is better than coach-only messages because a customer who reads "swap squats this week" or "how did the knee feel?" has no way to answer in a one-way feed, so the coach would still need WhatsApp or similar for the response. It stays simple: no group chats, no customer-to-customer contact, no attachments in the first version.

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Coach sends a message to a customer (Priority: P1)

From a customer's page, the coach writes a short message (for example a reminder, encouragement, or a change to the week) and sends it. The message is saved in that customer's conversation and the customer sees it the next time they open the app.

**Why this priority**: This is the core of the request. Even with no replies, the coach can already reach customers inside the app.

**Independent Test**: As a coach, open a customer, send a message, then sign in as that customer and confirm the message is visible.

**Acceptance Scenarios**:

1. **Given** a signed-in coach viewing a customer, **When** they write a message and send it, **Then** it appears in that customer's conversation with date and time and the coach as sender.
2. **Given** a message the coach sent, **When** the customer signs in, **Then** they see the message and a clear indicator that there is something new before opening it.
3. **Given** an empty or whitespace-only message, **When** the coach tries to send, **Then** nothing is sent and they are told a message is required.
4. **Given** a customer A and a customer B, **When** the coach sends a message to A, **Then** B never sees it.

---

### User Story 2 - Customer reads and replies to the coach (Priority: P2)

The customer opens the conversation, reads the coach's messages, and can write a reply. The coach sees the reply in the same conversation and knows it is new.

**Why this priority**: Two-way exchange makes messages actionable (questions, check-ins), but the coach-to-customer direction already delivers value on its own.

**Independent Test**: As a customer, open the conversation with an unread coach message, reply, then sign in as the coach and confirm the reply appears in order.

**Acceptance Scenarios**:

1. **Given** a customer with a conversation, **When** they write and send a reply, **Then** it appears in the same conversation, attributed to them, in chronological order.
2. **Given** a customer reply the coach has not seen, **When** the coach opens the customers list, **Then** that customer is marked as having unread messages.
3. **Given** a customer, **When** they view conversations, **Then** they only ever see their own conversation with the coach.

---

### User Story 3 - See what is new and what has been read (Priority: P3)

Both sides can tell at a glance which messages are unread. Opening the conversation marks incoming messages as read. The coach can see which customers have unread replies and whether a customer has read the latest message.

**Why this priority**: Helps the coach know a message landed, but messaging works without it.

**Independent Test**: Send a message as coach, confirm it shows as "unread" for the customer; open as customer, confirm it flips to "read" on the coach's side.

**Acceptance Scenarios**:

1. **Given** unread incoming messages, **When** the recipient opens the conversation, **Then** those messages are marked read and the unread indicator clears.
2. **Given** the coach's sent message, **When** the customer has not opened it, **Then** the coach sees it as "not read yet"; after they open it, it shows as read.

---

### Edge Cases

- A customer has no messages yet: the conversation shows a friendly empty state; the coach can still start it, and the customer can see the empty conversation but is not prompted to reply first (coach starts, per Assumptions).
- Very long message: the system accepts messages up to a reasonable length and tells the sender clearly when the limit is exceeded, without losing what they typed.
- Sending while offline or when saving fails: the sender sees an error and their text is kept so they can retry; a message is never shown as sent if it was not saved.
- Coach deletes a customer: the conversation is removed with the customer's data.
- A customer's access is removed or their password reset: past messages remain intact.
- Same message sent twice by double-tap: only one message is created.
- A signed-out visitor or another customer tries to open a conversation directly by link: they see nothing and are sent to sign-in or their own page.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: The system MUST keep exactly one private conversation per customer, shared only between the coach and that customer.
- **FR-002**: The coach MUST be able to send a text message to any customer from that customer's page.
- **FR-003**: A customer MUST be able to read the full history of their conversation, oldest to newest, with sender, date and time per message.
- **FR-004**: A customer MUST be able to reply within their conversation, and only after the coach has sent at least one message.
- **FR-005**: The system MUST NOT allow a customer to see, send to, or learn about any other customer's conversation.
- **FR-006**: The system MUST reject empty/whitespace-only messages and messages over a stated maximum length, with a clear message to the sender.
- **FR-007**: The system MUST show an unread indicator to each recipient, and clear it once they open the conversation.
- **FR-008**: The coach MUST be able to see, in the customers list, which customers have unread replies.
- **FR-009**: The coach MUST be able to see whether the customer has read the coach's latest message.
- **FR-010**: Messages MUST persist across sessions and devices and MUST NOT be lost if the sender closes the app right after sending.
- **FR-011**: The system MUST require sign-in to view or send any message; an unauthenticated visitor sees no message content.
- **FR-012**: All labels and states of the messaging area MUST be available in every language the app already supports (Spanish and English) and follow the user's chosen language. Message text itself is shown exactly as written.
- **FR-013**: The coach MUST be able to delete one of their own messages; the customer's replies are not deletable by the coach in this version.
- **FR-014**: Messages are plain text only; links are shown as text. Attachments, images, voice notes, group chats and customer-to-customer messaging are out of scope.

### UI/UX Alignment Requirements

Validated against the existing app design with the UI/UX Pro Max review (see `checklists/ux-alignment.md`).

- **FR-015**: Messaging MUST appear as its own clearly named area on the customer page, in the same tab pattern already used for Program, Nutrition and Progress. For customers it MUST remain available alongside the tabs they already see (the Notas and Seguimiento restriction is unchanged).
- **FR-016**: Messaging MUST be visually and verbally distinct from the existing AI "Coach assistant" chat (the floating button). Labels MUST make clear one is the real coach and the other is the assistant, and the two entry points MUST NOT overlap or compete for the same screen position.
- **FR-017**: The unread indicator MUST NOT rely on color alone (use a count or label too), MUST stay on one line when the count is large (e.g. "9+"), and MUST be announced to assistive technology as a meaningful phrase (e.g. "3 unread messages"), not a bare number.
- **FR-018**: The message composer MUST have a visible label (not placeholder-only), a send control of at least 44×44 px, and MUST keep the typed text visible when the on-screen keyboard opens on a phone. A visible character counter MUST appear as the limit approaches.
- **FR-019**: The conversation MUST use the app's existing visual style (colors, type, spacing, rounded cards, light and dark appearance if present) and distinguish coach and customer messages by alignment AND label, not color alone, with text contrast meeting WCAG AA (4.5:1).
- **FR-020**: The conversation MUST work from a 360 px-wide phone up to desktop with no horizontal scrolling, open scrolled to the newest message, and let a user reach every control by keyboard with a visible focus indicator.
- **FR-021**: Sending, failure and empty states MUST give immediate feedback (a sending state, an inline retry on failure, a friendly empty state), and any motion MUST respect the user's reduced-motion setting.

### Key Entities

- **Conversation**: The private thread between the coach and one customer. One per customer. Tracks when it was last active.
- **Message**: One entry in a conversation: sender role (coach or customer), text, sent date/time, and read/unread state for the recipient.
- **Unread Indicator**: A derived per-person count/flag of incoming messages not yet opened, shown to the customer on their page and to the coach in the customers list.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: A coach can send a message to a customer in under 30 seconds from opening the customer's page.
- **SC-002**: A newly sent message is visible to the customer within 5 seconds of their opening or refreshing the app.
- **SC-003**: 100% of attempts by a customer, or a signed-out visitor, to see another customer's messages are blocked.
- **SC-004**: 90% of customers who receive a message can find and open it on their first try without help.
- **SC-005**: Zero messages are lost or duplicated across 100 consecutive send attempts, including attempts with poor connectivity.
- **SC-006**: The coach can identify which customers have unread replies in under 5 seconds from the customers list.

## Assumptions

- This builds on the existing sign-in with coach and customer profiles (feature 015); there is a single coach, and each customer has their own account.
- The coach starts every conversation. A customer cannot message first, which keeps unsolicited contact to a minimum and matches "coach sends messages to the client."
- No push notifications, email or SMS in v1: customers see new messages when they open the app. Notifications can be a follow-up feature.
- Maximum message length is about 1,000 characters (a typical short coaching note).
- Message history is kept as long as the customer exists; no automatic expiry in v1.
- This is separate from the existing AI fitness-coach chatbot (features 013/014); those remain unchanged and are not part of the human conversation.
- Customers' Notas and Seguimiento tabs remain restricted per feature 015; the conversation is a new, customer-visible area.
- The app is bilingual (Spanish/English) and already has a floating AI assistant chat and a tabbed customer page; messaging reuses the tab pattern and does not add a second floating button.
