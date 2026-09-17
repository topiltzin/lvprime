# Contract: Data Access Layer API

**Purpose**: Define the interface between application code and database layer; all database operations must go through this API

**Version**: 1.0  
**Date**: 2026-09-17  
**Location**: `app/src/lib/customer-data.js`

---

## Overview

The Data Access Layer (DAL) abstracts all Supabase database operations. Application components and views import from this module and call well-defined functions to read/write customer data. This separation ensures:
- Testability (can mock DAL for unit tests)
- Maintainability (database details isolated)
- Flexibility (can swap database provider without changing app code)

---

## Module: `customer-data.js`

### Core Functions

#### `async getCustomer(slug)`

**Purpose**: Retrieve a single customer by slug

**Parameters**:
- `slug` (string): Customer identifier (e.g., "jaqueline-orellano")

**Returns**:
```javascript
{
  id: UUID,
  slug: string,
  name: string,
  created_at: ISO8601 timestamp,
  updated_at: ISO8601 timestamp
}
```

**Throws**: `CustomerNotFoundError` if slug not found

**Usage**:
```javascript
const customer = await getCustomer('jaqueline-orellano')
// Returns: { id: '...', slug: 'jaqueline-orellano', name: 'Jaqueline Orellano', ... }
```

**Performance**: <50ms (indexed query)

---

#### `async getCustomerProgram(slug)`

**Purpose**: Retrieve a customer's workout program

**Parameters**:
- `slug` (string): Customer identifier

**Returns**:
```javascript
{
  id: UUID,
  customer_id: UUID,
  content: string (markdown),
  updated_at: ISO8601 timestamp
}
```

**Returns**: `null` if no program exists for customer

**Throws**: `CustomerNotFoundError` if customer slug invalid

**Usage**:
```javascript
const program = await getCustomerProgram('jaqueline-orellano')
if (program) {
  // Display program.content in Program tab
} else {
  // Show "no program yet" message
}
```

**Performance**: <50ms

---

#### `async getCustomerFeedback(slug)`

**Purpose**: Retrieve a customer's feedback log

**Parameters**:
- `slug` (string): Customer identifier

**Returns**:
```javascript
{
  id: UUID,
  customer_id: UUID,
  entries: [
    {
      date: "YYYY-MM-DD",
      week: string,
      how_customer_felt: string,
      completed: boolean,
      notes: string,
      overall_impression: "Easy" | "Moderate" | "Hard"
    },
    ...
  ],
  updated_at: ISO8601 timestamp
}
```

**Returns**: `{ entries: [] }` if no feedback exists yet

**Throws**: `CustomerNotFoundError` if customer slug invalid

**Usage**:
```javascript
const feedback = await getCustomerFeedback('jaqueline-orellano')
feedback.entries.forEach(entry => {
  // Render feedback entry in Feedback tab
})
```

**Performance**: <50ms

---

#### `async getCustomerNotes(slug)`

**Purpose**: Retrieve a customer's coaching notes

**Parameters**:
- `slug` (string): Customer identifier

**Returns**:
```javascript
{
  id: UUID,
  customer_id: UUID,
  content: string (markdown),
  updated_at: ISO8601 timestamp
}
```

**Returns**: `null` if no notes exist

**Throws**: `CustomerNotFoundError` if customer slug invalid

**Usage**:
```javascript
const notes = await getCustomerNotes('jaqueline-orellano')
if (notes) {
  // Display notes.content in Notes tab
}
```

**Performance**: <50ms

---

#### `async getCustomerNutritionPlan(slug)`

**Purpose**: Retrieve a customer's nutrition plan

**Parameters**:
- `slug` (string): Customer identifier

**Returns**:
```javascript
{
  id: UUID,
  customer_id: UUID,
  content: string (markdown),
  updated_at: ISO8601 timestamp
}
```

**Returns**: `null` if no nutrition plan exists

**Throws**: `CustomerNotFoundError` if customer slug invalid

**Usage**:
```javascript
const nutrition = await getCustomerNutritionPlan('jaqueline-orellano')
if (nutrition) {
  // Display nutrition.content in Nutrition Plan tab
}
```

**Performance**: <50ms

---

#### `async addFeedbackEntry(slug, entry)`

**Purpose**: Add a new feedback entry to a customer's log

**Parameters**:
- `slug` (string): Customer identifier
- `entry` (object):
  ```javascript
  {
    date: "YYYY-MM-DD",  // Required
    week: string,         // Required (e.g., "Week 1")
    how_customer_felt: string, // Required
    completed: boolean,   // Required
    notes: string,        // Required
    overall_impression: "Easy" | "Moderate" | "Hard"  // Required
  }
  ```

**Returns**:
```javascript
{
  id: UUID,
  customer_id: UUID,
  entries: [...], // Full feedback array including new entry
  updated_at: ISO8601 timestamp
}
```

**Throws**: 
- `CustomerNotFoundError` if slug invalid
- `ValidationError` if entry missing required fields

**Usage**:
```javascript
const updatedFeedback = await addFeedbackEntry('jaqueline-orellano', {
  date: '2026-09-17',
  week: 'Week 2',
  how_customer_felt: 'Strong energy',
  completed: true,
  notes: 'All exercises completed',
  overall_impression: 'Moderate'
})
// Entry appended to existing feedback log
```

**Performance**: <100ms

---

> **Note on program/notes writes**: `updateCustomerNotes`/`updateCustomerProgram` below do an unconditional overwrite with no version check — use them only for non-sync write paths (e.g., the migration script in Phase 3, or a future admin edit tool). The actual coach sync upload endpoint (`POST /api/sync/upload`) MUST use `syncCoachWrite` (see "Sync & Offline Queue Functions" below) instead, since program/notes are version-tracked and conflict-checked per specs/004-server-data-sync.

#### `async updateCustomerNotes(slug, content)`

**Purpose**: Update (replace) a customer's coaching notes

**Parameters**:
- `slug` (string): Customer identifier
- `content` (string): Full markdown content for notes

**Returns**:
```javascript
{
  id: UUID,
  customer_id: UUID,
  content: string,
  updated_at: ISO8601 timestamp
}
```

**Throws**:
- `CustomerNotFoundError` if slug invalid
- `ValidationError` if content is empty or >500KB

**Usage**:
```javascript
const updated = await updateCustomerNotes('jaqueline-orellano', 
  '## Observations\n\n- 2026-09-17: Good progress on bench press'
)
```

**Performance**: <100ms

---

#### `async updateCustomerProgram(slug, content)`

**Purpose**: Update (replace) a customer's program

**Parameters**:
- `slug` (string): Customer identifier
- `content` (string): Full markdown content for program

**Returns**:
```javascript
{
  id: UUID,
  customer_id: UUID,
  content: string,
  updated_at: ISO8601 timestamp
}
```

**Throws**:
- `CustomerNotFoundError` if slug invalid
- `ValidationError` if content is empty or >500KB

**Usage**:
```javascript
const updated = await updateCustomerProgram('jaqueline-orellano', 
  '# 12-Week Muscle Gain Program\n\n...'
)
```

**Performance**: <100ms

---

#### `async updateCustomerNutritionPlan(slug, content)`

**Purpose**: Update (replace) a customer's nutrition plan

**Parameters**:
- `slug` (string): Customer identifier
- `content` (string): Full markdown content for nutrition plan

**Returns**:
```javascript
{
  id: UUID,
  customer_id: UUID,
  content: string,
  updated_at: ISO8601 timestamp
}
```

**Throws**:
- `CustomerNotFoundError` if slug invalid
- `ValidationError` if content is empty or >500KB

**Usage**:
```javascript
const updated = await updateCustomerNutritionPlan('jaqueline-orellano', 
  '# Nutrition Plan\n\n...'
)
```

**Performance**: <100ms

---

### Error Handling

**Custom Error Classes**:

```javascript
class CustomerNotFoundError extends Error {
  constructor(slug) {
    super(`Customer not found: ${slug}`)
    this.code = 'CUSTOMER_NOT_FOUND'
  }
}

class ValidationError extends Error {
  constructor(field, message) {
    super(`Validation error on ${field}: ${message}`)
    this.code = 'VALIDATION_ERROR'
    this.field = field
  }
}

class DatabaseError extends Error {
  constructor(message) {
    super(`Database error: ${message}`)
    this.code = 'DATABASE_ERROR'
  }
}
```

**Usage in Components**:
```javascript
try {
  const customer = await getCustomer(slug)
} catch (err) {
  if (err.code === 'CUSTOMER_NOT_FOUND') {
    showToast('Customer not found', 'error')
  } else if (err.code === 'DATABASE_ERROR') {
    showToast('Unable to load customer data. Please try again.', 'error')
  }
}
```

---

## Module: `database.js`

**Purpose**: Low-level database initialization and utility functions

**Exports**:
- `supabaseClient`: Initialized Supabase client instance
- `isConnected()`: Boolean check if database is accessible
- `getConnectionStatus()`: Detailed status info

**Usage** (internal only—app code should use `customer-data.js`):
```javascript
// Internal use in customer-data.js
const { data, error } = await supabaseClient
  .from('customers')
  .select('*')
  .eq('slug', slug)
  .single()
```

---

## Module: `database-client.js`

**Purpose**: Supabase client initialization with environment configuration

**Exports**:
```javascript
export const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
)
```

**Environment Requirements**:
- `SUPABASE_URL`: Supabase project URL
- `SUPABASE_SERVICE_ROLE_KEY`: Secret API key (backend only)

---

## Sync & Offline Queue Functions (replaces sync-engine.js / sync-state.js / offline-queue.js)

These functions absorb the "Coach Local Sync" feature (specs/004-server-data-sync), moving its JSON-file-backed, in-memory state (`server/sync-state.js`, which does not survive Vercel cold starts) onto the `programs`/`notes` `version`/`content_hash`/`sync_status` columns plus the new `sync_events` and `offline_queue_entries` tables.

#### `async syncCoachWrite(slug, fileType, { currentVersion, content, contentHash })`

**Purpose**: Coach uploads a new program/notes version; implements the same "coach-always-wins" conflict resolution as `sync-engine.js`'s `resolveCoachSync`

**Parameters**:
- `slug` (string): Customer identifier
- `fileType` ('program' | 'notes')
- `currentVersion` (number): Version the coach's client last saw
- `content` (string): New file content
- `contentHash` (string): SHA256 hex of `content`, verified server-side (per `hash-utils.js` `verifyContentHash`)

**Behavior** (mirrors `sync-engine.js` + `server/index.js` `handleSyncUpload`):
1. Verify `contentHash` matches `computeContentHash(content)`; throw `ValidationError` if mismatched
2. Read the current row's `version` (0 if row doesn't exist yet)
3. Detect conflict: `conflicted = currentVersion !== serverVersion` (per `detectVersionMismatch`)
4. Write `content`, set `version = serverVersion + 1`, `content_hash`, `last_writer = 'coach'`, `sync_status = 'synced'`
5. Insert a `sync_events` row (`event_type: 'sync_success'`, plus `sync_events` row with `event_type: 'sync_conflict'` if `conflicted`)

**Returns**:
```javascript
{
  status: 'synced',
  newVersion: number,
  conflicted: boolean,
  serverVersion: number, // version before this write
}
```

**Performance**: <150ms (read + write + audit log insert)

---

#### `async getSyncState(slug, fileType)`

**Purpose**: Retrieve current sync status for a program/notes file (replaces `sync-state.js` `getSyncState`)

**Returns**:
```javascript
{
  version: number,
  syncStatus: 'synced' | 'pending' | 'conflicted',
  lastWriter: 'coach' | 'customer' | null,
  contentHash: string | null,
  updatedAt: ISO8601 timestamp
}
```

**Returns**: `null` if no row exists yet (matches current `getSyncState` behavior)

---

#### `async queueOfflineChange(slug, fileType, entry)`

**Purpose**: Persist a coach change made while offline (replaces `offline-queue.js` `queueChange`)

**Parameters**:
- `entry`: `{ sequence, timestamp, action, content_hash, content_size_bytes, description }` — same shape and validation rules as `offline-queue.js`: `fileType` must be `'program'` or `'notes'`; `sequence` must start at 1 and increment without gaps per (slug, fileType); `content_hash` must match `^[a-f0-9]{64}$`; `content_size_bytes` must be `> 0`; `timestamp` must be valid ISO8601

**Throws**: `ValidationError` on any violated constraint (same messages as `offline-queue.js`)

**Behavior**: Inserts a row into `offline_queue_entries`; sets the corresponding `programs`/`notes` row's `sync_status = 'pending'`

---

#### `async getOfflineQueue(slug, fileType)`

**Purpose**: Retrieve queued offline entries in sequence order (replaces `offline-queue.js` `getQueue`)

**Returns**: Array of queue entries ordered by `sequence ASC`, or `[]` if none

---

#### `async clearOfflineQueue(slug, fileType)`

**Purpose**: Delete all queued entries after a successful flush (replaces `offline-queue.js` `clearQueue`)

**Behavior**: `DELETE FROM offline_queue_entries WHERE customer_id = ... AND file_type = ...`

---

#### `async recordSyncEvent(slug, fileType, eventType, metadata)`

**Purpose**: Append an audit-log row (replaces `sync-state.js` `recordSyncEvent`)

**Parameters**: `eventType` one of `'sync_start' | 'sync_success' | 'sync_conflict' | 'sync_error'`; `metadata` may include `source`, `versionFrom`, `versionTo`, `conflictDescription`, `errorMessage`, `contentHash`

**Behavior**: Insert-only row into `sync_events`; never throws on missing optional fields (all nullable)

---

#### `async getRecentSyncEvents(slug, limit = 10)`

**Purpose**: Retrieve recent sync audit events (replaces `sync-state.js` `getRecentSyncEvents`)

**Returns**: Array of `sync_events` rows ordered by `created_at DESC`, limited to `limit`

---

## Testing Strategy

**Unit Tests** (mock DAL):
```javascript
// tests/unit/customer-view.test.js
jest.mock('@/lib/customer-data', () => ({
  getCustomer: jest.fn().mockResolvedValue({
    id: '123', slug: 'test-customer', name: 'Test'
  })
}))

test('loads customer data on mount', async () => {
  // Test component behavior with mocked DAL
})
```

**Integration Tests** (real Supabase test project):
```javascript
// tests/integration/customer-data.test.js
test('getCustomer retrieves customer from database', async () => {
  const customer = await getCustomer('test-customer')
  expect(customer.slug).toBe('test-customer')
})
```

---

## Performance Expectations

All DAL functions are designed for Vercel serverless latency (<200ms total for loading customer profile):

| Operation | Query Time | Network Latency | Total |
|-----------|------------|-----------------|-------|
| getCustomer | <10ms | <30ms | <50ms |
| getCustomerProgram | <10ms | <30ms | <50ms |
| getCustomerFeedback | <10ms | <30ms | <50ms |
| getCustomerNotes | <10ms | <30ms | <50ms |
| getCustomerNutritionPlan | <10ms | <30ms | <50ms |
| **Load all 5 in parallel** | <50ms | <50ms | <100ms |

**Actual load time depends on Supabase region and network conditions; assumes <100ms from Vercel to Supabase.**

---

## Future Extensibility

- Add `getCustomerHistory(slug)` for version tracking
- Add `searchCustomers(query)` for customer search
- Add `listAllCustomers()` for admin dashboard
- Add batch operations for bulk updates
