# Feature Specification: Welcome Motivation Popup

**Feature Branch**: `018-welcome-motivation-popup`

**Created**: 2026-10-10

**Status**: Draft

**Input**: User description: "New change the message will change, now message will be a like welcoming on encourage message once the client is login. like motivational from Coach to Customer, but not vice versa and would be nice to show at start of the week with a specific setting which day sent it to customer as a popup. UI/UX Pro Max: make the popup cool and if possible with an effect once it appears and disappears like a firework or something."

## Summary of the change

The current two-way coach–client conversation (feature 016) becomes a **one-way motivational welcome message**: the coach writes an encouraging message for a customer, and the customer sees it as a celebratory popup when they sign in. Customers can no longer reply. The coach chooses, per customer, **which weekday** the message is delivered, so the customer is greeted at the start of their training week.

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Customer is welcomed with a motivational popup on sign-in (Priority: P1)

When a customer signs in and there is an unseen motivational message from the coach for them, a popup appears over the app showing the message, with a celebratory entrance effect (firework-style burst). The customer closes it with a clear control; the popup leaves with a matching exit effect and the customer lands on their normal page.

**Why this priority**: This is the core of the request: the customer feeling welcomed and encouraged at sign-in.

**Independent Test**: As a coach, write a message for a customer; sign in as that customer and confirm the popup shows the message with the effect, and that closing it reveals the usual page.

**Acceptance Scenarios**:

1. **Given** a customer with an undelivered message whose delivery day has arrived, **When** they sign in, **Then** the popup appears with the coach's message, the coach's name/label as sender, and a celebratory entrance effect.
2. **Given** the popup is open, **When** the customer taps the close/continue control, presses Escape, or taps outside it, **Then** it closes with an exit effect and the message is marked as seen.
3. **Given** a message already seen, **When** the customer signs in again the same week, **Then** the popup does not reappear.
4. **Given** a customer with no pending message, **When** they sign in, **Then** no popup appears and sign-in is not slowed or interrupted.
5. **Given** a customer whose device is set to reduce motion, **When** the popup appears or closes, **Then** the effects are replaced by a simple fade with no particles or movement.

---

### User Story 2 - Coach writes a motivational message and picks the delivery day (Priority: P2)

From a customer's page, the coach writes the encouragement message and chooses the weekday on which it is delivered (e.g. Monday, the start of the week). The coach can see what is scheduled, edit it, and see whether the customer has seen it.

**Why this priority**: Without coach authoring and the day setting, there is nothing to show; but the popup experience (P1) is the headline.

**Independent Test**: As a coach, set a message with delivery day Monday for a customer, confirm it is shown as scheduled, then edit it and confirm the change is what the customer sees.

**Acceptance Scenarios**:

1. **Given** a signed-in coach on a customer's page, **When** they write a message and pick a delivery day and save, **Then** the message is stored for that customer and shown as "scheduled for [day]".
2. **Given** a scheduled message, **When** the coach edits the text or day, **Then** the customer sees the updated version the next time it is delivered.
3. **Given** an empty or whitespace-only message, **When** the coach saves, **Then** nothing is saved and they are told a message is required.
4. **Given** a message the customer has seen, **When** the coach views the customer, **Then** it shows as seen with the date.
5. **Given** the coach wants to preview, **When** they use preview, **Then** they see the popup exactly as the customer would, without marking anything as seen.

---

### User Story 3 - Weekly start-of-week delivery (Priority: P3)

Each week, on the delivery day the coach chose, the message becomes due. The next time the customer signs in on or after that day in the week (and has not already seen it that week), the popup is shown once. The coach can keep the same message each week or replace it with a fresh one.

**Why this priority**: It sets the rhythm and keeps the popup meaningful rather than repetitive, but a single delivery already works without it.

**Independent Test**: Set the delivery day to today, sign in as the customer and see the popup; sign in again and confirm it does not repeat; advance to the next week's delivery day and confirm it is due again.

**Acceptance Scenarios**:

1. **Given** the delivery day is Monday and the customer first signs in on Wednesday, **When** they sign in, **Then** they still receive that week's message once (not missed because they skipped Monday).
2. **Given** the customer already saw this week's message, **When** the next week's delivery day arrives, **Then** the message is due again on their next sign-in.
3. **Given** the coach has not set a day, **When** a message is saved, **Then** it defaults to Monday.
4. **Given** the coach marks a message as one-time, **When** it has been seen once, **Then** it is not delivered again in later weeks.

---

### Edge Cases

- Customer has existing two-way conversation history from feature 016: history is kept readable by the coach for reference but customers can no longer reply; the old conversation view and unread badges for customers are retired.
- A customer signs in on several devices the same day: the popup is shown once; after seeing it on one device it does not appear on the others.
- Customer closes the browser while the popup is open: it counts as not seen and appears at next sign-in.
- Very long message: accepted up to a stated limit; the popup scrolls inside itself so the close control is always reachable.
- Popup open while the customer navigates by back button: it closes cleanly without breaking navigation.
- Coach signs in: never sees a customer popup; coach only sees the preview on demand.
- Signed-out visitors or other customers never see a message that is not theirs.
- Slow device or very small phone (360 px): the effect degrades gracefully and never blocks reading or closing the popup.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: The system MUST deliver motivational messages in one direction only, from the coach to a customer; customers MUST NOT be able to reply or send messages.
- **FR-002**: The coach MUST be able to write, edit and remove a motivational message for each customer from that customer's page.
- **FR-003**: The coach MUST be able to choose, per customer, the weekday on which the message is delivered, defaulting to Monday.
- **FR-004**: When a customer signs in and a message is due and unseen for the current week, the system MUST show it once as a popup before the customer's normal page.
- **FR-005**: A message is "due" from its delivery day through the end of that week; a customer signing in later in the week than the delivery day MUST still receive it once.
- **FR-006**: The system MUST record when a customer has seen a message and MUST NOT show it again in the same week, on any device.
- **FR-007**: The coach MUST be able to see, per customer, whether the current message is scheduled or seen and when.
- **FR-008**: The coach MUST be able to preview the popup as the customer would see it, without affecting seen status.
- **FR-009**: The system MUST reject empty/whitespace-only messages and messages over a stated maximum length, with a clear message to the coach.
- **FR-010**: The coach MUST be able to choose whether a message repeats every week or is shown only once.
- **FR-011**: A customer MUST only ever see their own message; signed-out visitors see none.
- **FR-012**: The popup MUST be available in every language the app supports (Spanish and English); its fixed labels follow the user's language, and the message text is shown exactly as the coach wrote it.
- **FR-013**: The previous customer reply capability, customer-side conversation view and customer unread badges MUST be removed; existing conversation history MUST NOT be lost for the coach.

### UI/UX Requirements

To be validated with the UI/UX Pro Max review against the existing app design.

- **FR-014**: The popup MUST feel celebratory and on-brand: a clear welcome heading, the coach's message in large readable type, the sender identified as the coach, and a single prominent close/continue action.
- **FR-015**: On appearing, the popup MUST play a firework-style celebratory effect (e.g. a burst of colorful particles) and on closing MUST play a matching, shorter exit effect. Both effects MUST complete within about 1.5 seconds and MUST NOT delay the customer from reading or dismissing the popup.
- **FR-016**: When the customer's device requests reduced motion, the system MUST replace all particle and movement effects with a simple fade.
- **FR-017**: The popup MUST be accessible: it captures focus while open and returns it on close, can be dismissed with the keyboard (Escape), has a text label announced by assistive technology, and text contrast meets WCAG AA (4.5:1) regardless of the effect behind it.
- **FR-018**: The popup MUST work from a 360 px-wide phone to desktop with no horizontal scrolling, with a close control of at least 44×44 px reachable at all times.
- **FR-019**: The popup MUST use the app's existing colors, typography and light/dark appearance, and effects MUST NOT cause sustained flashing (no more than three flashes per second).
- **FR-020**: The coach's authoring area MUST follow the existing customer-page tab/card pattern, with a visible label for the message field, a character counter near the limit, and a day picker that is usable by touch and keyboard.

### Key Entities

- **Motivational Message**: One per customer. Holds the text, delivery weekday, repeat setting (weekly or once), and last-edited date.
- **Delivery Record**: The customer's seen history for that message: which week it was shown and when it was dismissed.
- **Delivery Day Setting**: The weekday chosen by the coach for a customer; determines when the week's message becomes due.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: A coach can write a message, choose the day and save it in under 1 minute from opening the customer's page.
- **SC-002**: 100% of customers with a due unseen message see the popup on their next sign-in, and 0% see it more than once per week.
- **SC-003**: The popup is readable and dismissible within 1 second of appearing, even while the effect is still playing.
- **SC-004**: With reduced-motion enabled, 100% of popup appearances and exits use no particle or movement effects.
- **SC-005**: 100% of attempts by a customer or signed-out visitor to see another customer's message are blocked.
- **SC-006**: At least 90% of customers surveyed describe the welcome as "motivating" or "pleasant" after four weeks.
- **SC-007**: Sign-in for customers without a pending message takes no longer than it does today.

## Assumptions

- This builds on sign-in with coach and customer profiles (feature 015) and replaces the two-way messaging introduced by feature 016; the AI assistant chat (features 013/014) is unchanged.
- "Start of the week" defaults to Monday; the coach may pick any weekday per customer. The week runs Monday to Sunday.
- There is a single coach; the sender is shown as the coach's name or "Your coach".
- One current message per customer in v1 (no queue or history of past messages shown to the customer).
- Maximum message length is about 300 characters, keeping the popup short and motivating.
- Delivery happens at sign-in only; no push notifications, email or SMS.
- "Week" and "today" use the customer's local time zone.
- Existing 016 conversation history is retained for the coach as read-only and is not migrated into new messages.
- The firework-style effect is decorative; the app's performance and accessibility take priority over effect richness on low-power devices.
