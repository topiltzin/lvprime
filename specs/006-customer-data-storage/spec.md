# Feature Specification: Customer Data Storage Migration for Vercel Deployment

**Feature Branch**: `006-customer-data-storage`

**Created**: 2026-09-17

**Status**: Draft

**Input**: User description: "I will deploy the app on Vercel, so where the Customer data should rely, inside the app ? and if so move it there and modify the reference on the code."

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Migrate Existing Customer Data to Database (Priority: P1)

A coach has existing customer data currently stored in the filesystem (`/customers/[name]/` directories with `.md` files). When deploying to Vercel, this filesystem-based storage must be migrated to a persistent database so data survives deployments and is accessible across Vercel's distributed architecture.

**Why this priority**: This is the critical blocker for Vercel deployment—Vercel functions are stateless and don't persist filesystem changes across deployments. Without this, all customer data would be lost on each redeploy.

**Independent Test**: All existing customer files (program.md, feedback.md, notes.md, nutrition_plan.md) are successfully migrated from the filesystem to the database and can be retrieved by the application with identical content.

**Acceptance Scenarios**:

1. **Given** a coach has 10 existing customers with program.md, feedback.md, notes.md files, **When** the migration runs, **Then** all files are transferred to the database with no data loss
2. **Given** customer data exists in the filesystem, **When** the migration completes, **Then** the database contains all customer records with identical structure and content
3. **Given** a backup of old filesystem data, **When** migration fails, **Then** the original data can be recovered without loss

---

### User Story 2 - Read Customer Data from Database in App (Priority: P1)

The application currently reads customer data from filesystem files. After migration, the app must read all customer data (programs, feedback, notes, nutrition plans) from the database instead, with zero visible change to the coach's experience.

**Why this priority**: Core functionality—if the app can't read data from the database, the entire feature fails. This must work flawlessly for the app to function on Vercel.

**Independent Test**: Coach opens a customer profile and all data (program, feedback, notes, nutrition plan) loads correctly from the database without errors.

**Acceptance Scenarios**:

1. **Given** a customer exists in the database, **When** a coach opens the customer profile, **Then** all tabs (Program, Nutrition Plan, Feedback, Notes) display data from the database
2. **Given** multiple customers in the database, **When** a coach switches between customers, **Then** the correct customer data loads each time
3. **Given** a customer has no nutrition_plan data, **When** the coach views the Nutrition Plan tab, **Then** an appropriate "no data" message displays (not an error)

---

### User Story 3 - Write Customer Data Updates to Database (Priority: P1)

When a coach adds feedback, updates notes, or creates a new program, the app must persist these changes to the database instead of the filesystem, maintaining consistency with the new storage model.

**Why this priority**: Coaches need to save new feedback and program updates. Without database writes, coaches can read data but cannot log progress or make changes—breaking core workflow.

**Independent Test**: Coach adds a new feedback entry and closes/reopens the app; the feedback entry persists and is retrieved from the database.

**Acceptance Scenarios**:

1. **Given** a coach adds a feedback entry for a customer, **When** the entry is saved, **Then** it is stored in the database
2. **Given** a coach updates customer notes, **When** the save button is clicked, **Then** the updated notes are persisted to the database
3. **Given** multiple coaches (in future scenarios), **When** one coach updates a customer record, **Then** other coaches see the updated data on next page load

---

### User Story 4 - Ensure Vercel Compatibility & Persistence (Priority: P1)

After migration, customer data must persist across Vercel deployments, function invocations, and cold starts. The storage solution must be compatible with Vercel's execution model (serverless functions with no persistent filesystem).

**Why this priority**: If data doesn't persist after deployment, the feature is useless. This validates that the storage solution works correctly in Vercel's environment.

**Independent Test**: Deploy the app to Vercel, verify data loads correctly, redeploy the app, verify the same data still exists and loads correctly.

**Acceptance Scenarios**:

1. **Given** the app is deployed to Vercel with customer data in the database, **When** a redeploy occurs, **Then** all customer data is still accessible after deployment
2. **Given** a Vercel serverless function reads customer data, **When** a cold start occurs, **Then** data loads correctly without timeout
3. **Given** the app is running on Vercel, **When** a coach accesses any customer profile, **Then** no "data not found" errors occur due to storage unavailability

---

### Edge Cases

- What happens if the migration is interrupted partway through (e.g., network failure)? → Must support resumable migration or rollback to original state
- What happens if the database is temporarily unavailable when the app tries to read data? → App should display appropriate error message and retry gracefully
- What happens if a customer file exists in the filesystem but is corrupted or invalid? → Migration should skip or flag the corrupted entry
- How is user data recovered if the database backup needs to be restored? → Must maintain filesystem backup during transition period

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: System MUST read all customer data (program.md, feedback.md, notes.md, nutrition_plan.md) from a persistent database instead of the filesystem
- **FR-002**: System MUST write all customer updates (feedback entries, program changes, notes) to the database
- **FR-003**: System MUST migrate all existing customer data from the filesystem to a Supabase PostgreSQL database
- **FR-004**: System MUST support data retrieval on Vercel's serverless architecture without relying on persistent filesystem
- **FR-005**: System MUST maintain identical data structure and format after migration (no changes to how data is represented to the coach)
- **FR-006**: System MUST provide a rollback mechanism if migration fails during execution
- **FR-007**: Application code MUST abstract database access through a data access layer so file reads/writes are replaced with database calls

### Key Entities

- **Customer**: Represents a fitness coaching client
  - Attributes: customer_slug, name, created_date, last_updated
  - Related data: program, feedback, notes, nutrition_plan

- **Program**: Customer's current workout routine (formerly program.md)
  - Attributes: customer_id, content (markdown), last_updated
  - Relationships: Belongs to one Customer

- **Feedback**: Customer's progress log (formerly feedback.md)
  - Attributes: customer_id, entries (array of dated feedback), last_updated
  - Relationships: Belongs to one Customer

- **Notes**: Coach's observations and insights (formerly notes.md)
  - Attributes: customer_id, content (markdown), last_updated
  - Relationships: Belongs to one Customer

- **NutritionPlan**: Customer's nutrition guidance (formerly nutrition_plan.md)
  - Attributes: customer_id, content (markdown), last_updated
  - Relationships: Belongs to one Customer

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: 100% of existing customer data is successfully migrated to the database with zero data loss
- **SC-002**: App functionality is identical before and after migration—zero regression (all existing features work without modification to the coach's workflow)
- **SC-003**: Customer data loads in under 500ms on Vercel serverless functions (same performance as filesystem reads)
- **SC-004**: App successfully deploys to Vercel and runs without persistent filesystem dependency
- **SC-005**: Coaches can read and write customer data after migration with the same ease and speed as before
- **SC-006**: Data persists across Vercel redeployments—no data loss when app is redeployed

## Assumptions

- **Assumption 1**: Supabase PostgreSQL will be used as the persistent database for customer data storage, providing native Vercel integration and reliable persistence.
- **Assumption 2**: The current customer data structure (markdown files in customer directories) represents the complete set of data to be migrated.
- **Assumption 3**: No authentication layer changes are required—only storage layer changes from filesystem to database.
- **Assumption 4**: Existing filesystem data will be backed up before migration to allow rollback if needed.
- **Assumption 5**: The app's current data model (program, feedback, notes, nutrition_plan per customer) will remain unchanged—only storage location changes.
- **Assumption 6**: A migration script will be created to handle the one-time transfer of data from filesystem to database.
- **Assumption 7**: After successful migration, the filesystem customer data directory can be removed from production (after verification period).
