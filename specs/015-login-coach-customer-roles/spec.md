# Feature Specification: Login with Coach and Customer Profiles

**Feature Branch**: `015-login-coach-customer-roles`

**Created**: 2026-10-03

**Status**: Draft

**Input**: User description: "Let's create the Login page. The coach creates the customer account with a default password and the customer must reset it the first time they sign in. The coach creates the routine for that customer. There are 2 profiles: customer and coach. The coach sees all customers; a customer sees only their own process. For the customer, the Notas and Seguimiento tabs must be disabled."

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Sign in and land in the right place (Priority: P1)

Anyone opening the app is asked to sign in first. A coach lands on the list of all customers. A customer lands directly on their own page. Nobody can see any customer data without signing in.

**Why this priority**: Everything else depends on knowing who is using the app. Without sign-in, customer data is open to anyone with the link.

**Independent Test**: Open the app signed out and confirm only the login page shows; sign in as a coach and see all customers; sign in as a customer and see only their own page.

**Acceptance Scenarios**:

1. **Given** a signed-out visitor, **When** they open any page of the app, **Then** they see the login page and no customer data.
2. **Given** a coach with valid credentials, **When** they sign in, **Then** they see the list of all customers.
3. **Given** a customer with valid credentials who has already set their own password, **When** they sign in, **Then** they land on their own customer page.
4. **Given** wrong credentials, **When** a user tries to sign in, **Then** they see a clear error that does not reveal whether the email or the password was wrong, and stay on the login page.
5. **Given** a signed-in user, **When** they choose to sign out, **Then** they return to the login page and cannot go back to see data.

---

### User Story 2 - Coach creates a customer account with a default password (Priority: P1)

When the coach adds a new customer, the coach also sets up their sign-in: an email (or username) and a default password they pass on to the customer. The coach then builds the customer's routine as they do today.

**Why this priority**: Customers cannot sign in until the coach creates their account, so this is the only way customers enter the system.

**Independent Test**: As a coach, create a customer with a default password, then sign in as that customer using it.

**Acceptance Scenarios**:

1. **Given** a signed-in coach, **When** they create a new customer and provide a sign-in identifier and default password, **Then** the customer account exists and is linked to that customer's program.
2. **Given** a signed-in coach, **When** they create a customer using an identifier that already belongs to another account, **Then** they are told it is taken and nothing is created.
3. **Given** an existing customer who has no sign-in yet, **When** the coach opens that customer, **Then** the coach can create sign-in access for them.
4. **Given** a customer who forgot their password, **When** the coach resets it to a new default password, **Then** the customer must set their own password at next sign-in.

---

### User Story 3 - Customer must replace the default password on first sign-in (Priority: P1)

The first time a customer signs in with the default password, they are required to choose their own password before reaching anything else.

**Why this priority**: The coach knows the default password, so it must not remain in use.

**Independent Test**: Sign in as a newly created customer; confirm you are forced to set a new password and only then reach your page.

**Acceptance Scenarios**:

1. **Given** a customer signing in for the first time, **When** the credentials are correct, **Then** they are taken to a "set your new password" step and cannot reach any other page until it is done.
2. **Given** the set-password step, **When** the customer enters a new password that meets the rules and confirms it, **Then** it is saved, the default password stops working, and they continue to their page.
3. **Given** the set-password step, **When** the new password is the same as the default, too weak, or the confirmation does not match, **Then** they see what is wrong and remain on the step.
4. **Given** a customer who left before finishing the step, **When** they sign in again, **Then** they are asked to set the password again.

---

### User Story 4 - Customer sees only their own process, with Notas and Seguimiento disabled (Priority: P2)

A signed-in customer can view only their own page: their program (and other tabs such as nutrition and progress that are meant for them). The Notas and Seguimiento tabs are visible but disabled and cannot be opened. A customer cannot reach any other customer, or the customer list.

**Why this priority**: Protects privacy between customers and keeps the coach's private notes and tracking away from customers.

**Independent Test**: Sign in as a customer; confirm Notas and Seguimiento appear disabled, other customers cannot be opened by changing the address, and the coach's notes are never exposed.

**Acceptance Scenarios**:

1. **Given** a signed-in customer on their page, **When** they look at the tabs, **Then** Notas and Seguimiento are shown as disabled and do nothing when selected.
2. **Given** a signed-in customer, **When** they try to open another customer's page or the customer list by address, **Then** access is denied and they are returned to their own page.
3. **Given** a signed-in customer, **When** the app loads their data, **Then** the coach's notes and tracking content are not delivered to them at all, not just hidden.
4. **Given** a signed-in coach, **When** they open any customer, **Then** all tabs, including Notas and Seguimiento, work as they do today.

---

### Edge Cases

- A customer's session stays open after the coach resets their password: the next sign-in requires the new default password and then a new personal password.
- A customer account is archived by the coach: the customer can no longer sign in and sees a clear message to contact their coach.
- Repeated failed sign-in attempts: further attempts are temporarily slowed or blocked to prevent guessing.
- A session expires while the user is working: they are sent to the login page and unsaved work is not silently lost without warning.
- Existing customers created before this feature have no sign-in; they remain visible to the coach and can be given access later.
- Customer opens a link to a page they are not allowed to see: shown their own page, not an error that reveals other customers exist.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: System MUST require sign-in before showing any customer data or customer-specific page.
- **FR-002**: System MUST support exactly two profiles: coach and customer.
- **FR-003**: Coach MUST be able to create a customer account by providing a sign-in identifier and a default password.
- **FR-004**: System MUST link each customer account to exactly one customer record and its program.
- **FR-005**: System MUST force a customer signing in with a default password to set a new personal password before accessing anything else.
- **FR-006**: System MUST reject a new password that equals the default password, does not meet minimum strength rules, or does not match its confirmation.
- **FR-007**: Coach MUST be able to reset a customer's password to a new default password, which again forces a personal password on next sign-in.
- **FR-008**: Coach MUST be able to see and open all customers and manage their programs, as today.
- **FR-009**: A customer MUST be able to see only their own customer page and data, and MUST be denied access to other customers and the customer list, including by direct address.
- **FR-010**: For customers, the Notas and Seguimiento tabs MUST be shown disabled and MUST NOT be openable.
- **FR-011**: System MUST NOT deliver Notas or Seguimiento content to customer sessions.
- **FR-012**: Only the coach MAY create or edit a customer's routine; customers MUST NOT be able to modify their program.
- **FR-013**: System MUST store passwords so they cannot be read back by anyone, including the coach.
- **FR-014**: Users MUST be able to sign out, ending their access.
- **FR-015**: Failed sign-in messages MUST NOT reveal whether the identifier or the password was wrong, and repeated failures MUST be rate limited.
- **FR-016**: System MUST keep users signed in across page reloads for a reasonable period and require sign-in again after it expires.
- **FR-017**: System MUST prevent two accounts from sharing the same sign-in identifier.
- **FR-018**: All login and password screens MUST be in Spanish, consistent with the rest of the app, and follow the existing visual style.
- **FR-019**: Archiving a customer MUST prevent that customer from signing in.

### Key Entities

- **Coach account**: A user with full access to all customers; has a sign-in identifier and password.
- **Customer account**: A user linked to one customer record; has a sign-in identifier, a password, and a flag indicating whether the personal password still needs to be set.
- **Customer record**: Existing customer with program, nutrition, progress, feedback, and notes; now optionally linked to a customer account.
- **Session**: A signed-in period identifying the user and their profile, with an expiry.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: 100% of attempts to view any customer data while signed out are blocked.
- **SC-002**: A coach can create a customer account with a default password in under 1 minute.
- **SC-003**: A new customer can go from first sign-in to seeing their program in under 2 minutes, including setting a personal password.
- **SC-004**: In testing, 0 customer sessions can read another customer's data or the coach's notes and tracking content, including by direct address.
- **SC-005**: 100% of customers still on a default password are prevented from reaching any page other than the set-password step.
- **SC-006**: 95% of coaches and customers complete sign-in on the first attempt when using correct credentials.

## Assumptions

- There is a single coach (Lili) for now; creating additional coach accounts is out of scope and the coach account is set up outside the app.
- Sign-in uses an email as the identifier with a password; social sign-in and self-registration are out of scope.
- The coach chooses the default password and shares it with the customer outside the app (e.g., messaging); automated email delivery is out of scope.
- Self-service "forgot password" by email is out of scope; the coach resets passwords instead.
- Customers may see the Program, Plan de nutrición and Progreso tabs, and may continue to use their own session logging if it exists today; only Notas and Seguimiento are disabled. Whether customers can register sessions ("Registrar sesión") is kept as it is today unless the coach decides otherwise.
- Minimum password length is 8 characters, with at least one letter and one number.
- Sessions last about 30 days unless the user signs out.
- Existing customers keep working for the coach; their sign-in access is created on demand.
- Builds on existing customer data storage and server (specs 004 and 006).
