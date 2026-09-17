# Phase 1: Quickstart Validation Guide

**Purpose**: Runnable validation scenarios to prove the feature works end-to-end

**Date**: 2026-09-17

---

## Prerequisites

1. **Supabase Account**: Create free account at supabase.com
2. **Supabase Project**: Create a new PostgreSQL project (or use existing)
3. **Environment Setup**:
   ```bash
   # Copy .env.example to .env.local
   cp app/.env.example app/.env.local
   
   # Add Supabase credentials
   SUPABASE_URL=https://[PROJECT-ID].supabase.co
   SUPABASE_SERVICE_ROLE_KEY=eyJx...
   ```
4. **Node Dependencies**:
   ```bash
   cd app
   npm install @supabase/supabase-js
   npm install
   ```
5. **Test Data**: Existing `customers/` directory with at least one customer (e.g., jaqueline-orellano)

---

## Scenario 1: Database Schema Setup

**Goal**: Verify PostgreSQL tables exist and are accessible from Node.js

**Setup**:
1. Go to Supabase dashboard → SQL Editor
2. Run all CREATE TABLE statements from `contracts/database-schema.md`
3. Verify tables appear in "Tables" section

**Validation**:
```bash
# Run in Node.js REPL or test script:
node -e "
const { createClient } = require('@supabase/supabase-js');
const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

(async () => {
  const { data, error } = await supabase.from('customers').select('*');
  console.log('✓ Connection successful, tables exist');
})();
"
```

**Expected Result**: No errors; output shows empty customers table

---

## Scenario 2: Data Migration Script

**Goal**: Migrate all existing customer data from filesystem to Supabase

**Setup**:
1. Verify `app/server/migrations/migrate-data.js` exists (created during implementation phase)
2. Ensure Supabase project is empty (no existing customer data in tables)

**Run Migration**:
```bash
# From app/ directory
node server/migrations/migrate-data.js

# Expected output:
# Migrating customers from /customers/ directory...
# ✓ Migrated customer: jaqueline-orellano
# ✓ Created program record
# ✓ Created feedback record
# ✓ Created notes record
# ✓ Created nutrition_plan record
# Migration complete: 1 customer, 4 records
```

**Verify in Supabase**:
1. Go to Supabase dashboard → SQL Editor
2. Run:
   ```sql
   SELECT COUNT(*) FROM customers;
   SELECT COUNT(*) FROM programs;
   SELECT COUNT(*) FROM feedbacks;
   SELECT COUNT(*) FROM notes;
   SELECT COUNT(*) FROM nutrition_plans;
   ```
3. Verify counts match number of customers and data files

**Expected Result**: 
- `customers` table has 1 row (jaqueline-orellano)
- Each data table has 1 row linked to that customer
- No errors during migration

---

## Scenario 3: Read Customer Data from Database in App

**Goal**: Verify app can load customer data from Supabase and display in UI

**Setup**:
1. Migration complete (Scenario 2)
2. App has new data access layer (`app/src/lib/customer-data.js`)
3. Dev server running: `npm run dev`

**Test in Browser**:
1. Navigate to http://localhost:5173
2. Click on a customer (e.g., jaqueline-orellano)
3. Verify all tabs load:
   - **Program Tab**: Displays workout program content from database
   - **Nutrition Plan Tab**: Displays nutrition plan content from database
   - **Feedback Tab**: Displays feedback entries from database
   - **Notes Tab**: Displays coaching notes from database

**Console Check** (browser DevTools → Console):
- No "undefined" or "TypeError" messages
- Network requests to database are successful
- Data loads in <500ms (check Network tab timing)

**Expected Result**: All customer data displays correctly; identical to filesystem version before migration

---

## Scenario 4: Add New Feedback Entry via Database

**Goal**: Verify app can write feedback entries to Supabase

**Setup**:
1. Scenarios 1-3 complete
2. App running with database layer

**Test**:
1. Open customer profile (jaqueline-orellano)
2. Click **Feedback** tab
3. Add new feedback entry:
   - Date: 2026-09-17
   - Week: Week 2
   - How customer felt: Strong energy
   - Completed: Yes
   - Notes: All exercises completed as prescribed
   - Overall impression: Moderate
4. Click "Save Feedback"

**Verify in Supabase**:
1. Go to Supabase dashboard → SQL Editor
2. Run:
   ```sql
   SELECT entries FROM feedbacks 
   WHERE customer_id = (SELECT id FROM customers WHERE slug = 'jaqueline-orellano');
   ```
3. Verify output includes new entry with date 2026-09-17

**Expected Result**: 
- Feedback entry saved to database
- New entry appears in Feedback tab
- No duplicate entries on refresh

---

## Scenario 5: Persistence Across Redeployment

**Goal**: Verify data survives app redeployment (simulating Vercel deployment)

**Setup**:
1. Customer data in Supabase (Scenario 3)
2. App running with database layer

**Test**:
1. Verify customer data loads: customer profile → all tabs show content
2. Stop dev server: `Ctrl+C`
3. Wait 5 seconds
4. Restart dev server: `npm run dev`
5. Open browser to http://localhost:5173
6. Reload same customer profile

**Expected Result**: 
- All data loads correctly after restart
- No data loss
- Same feedback entries, program, notes, nutrition plan visible

---

## Scenario 6: Database Responsiveness on Large Data

**Goal**: Verify <500ms load time even with large customer data (100KB+)

**Setup**:
1. Scenarios 1-5 complete
2. Create test customer with large program file (>100KB markdown)

**Test**:
1. Open customer profile with large data
2. Monitor Network tab (browser DevTools)
3. Measure total load time for all 4 data queries
4. Verify each query responds in <50ms

**Expected Result**: 
- Total load time <500ms
- No timeouts or 503 errors
- Tables render correctly even with large content

---

## Scenario 7: Error Handling — Database Unavailable

**Goal**: Verify app handles database connection failures gracefully

**Setup**:
1. App running with database layer
2. Network access (to simulate disconnection, could disconnect locally or use DevTools throttling)

**Test**:
1. Open customer profile (should load normally)
2. Disable internet or throttle network to "Offline" in DevTools
3. Try to load different customer profile

**Expected Result**: 
- Error message displays: "Unable to load customer data. Please try again."
- No white screen or console errors
- User can retry after connection restored

---

## Scenario 8: Data Integrity After Migration

**Goal**: Verify all data correctly migrated with no loss or corruption

**Setup**:
1. Migration complete (Scenario 2)
2. Database populated with customer data

**Validation Checklist**:

| Check | Method | Expected |
|-------|--------|----------|
| All customers migrated | Compare filesystem `ls customers/` count with DB `SELECT COUNT(*)` | Match |
| Program content identical | Compare `customers/[name]/program.md` with DB `program.content` | Exact match |
| Feedback entries complete | Count entries in DB vs filesystem | All entries present |
| Notes content preserved | Compare filesystem vs DB content | Exact match (markdown format) |
| Nutrition plan preserved | Compare filesystem vs DB content | Exact match (markdown format) |
| Dates in YYYY-MM-DD format | Check DB `feedback.entries[].date` values | All match format |
| No duplicate records | Check for duplicate customer_ids in data tables | Zero duplicates |
| Timestamps present | Verify `created_at`, `updated_at` set | All rows have timestamps |

**Run Validation Script** (pseudo-code):
```javascript
// tests/integration/migration-validation.js
test('migration preserves all data', async () => {
  // Read filesystem
  const fsProgram = readFileSync('customers/jaqueline-orellano/program.md')
  
  // Read from DB
  const dbProgram = await getCustomerProgram('jaqueline-orellano')
  
  // Compare
  expect(dbProgram.content).toBe(fsProgram)
})
```

**Expected Result**: ✅ All checks pass; zero data loss

---

## Rollback Procedure (If Needed)

If migration fails or data corruption detected:

1. **Stop Production Traffic**: Don't deploy to Vercel yet
2. **Restore from Backup**: Supabase automatic backups or manual backup from Scenario 2
3. **Clear Corrupted Tables**: 
   ```sql
   TRUNCATE customers, programs, feedbacks, notes, nutrition_plans CASCADE;
   ```
4. **Re-run Migration**: 
   ```bash
   node server/migrations/migrate-data.js
   ```
5. **Re-validate**: Run through Scenarios 1-8 again

**Filesystem Data**: Kept as backup for 30 days; do NOT delete until migration fully validated

---

## Go-Live Checklist

Before deploying to Vercel:

- [ ] Scenario 1: Database schema setup ✅
- [ ] Scenario 2: Data migration successful ✅
- [ ] Scenario 3: App reads from database ✅
- [ ] Scenario 4: Feedback writes work ✅
- [ ] Scenario 5: Data persists after restart ✅
- [ ] Scenario 6: Performance <500ms ✅
- [ ] Scenario 7: Error handling works ✅
- [ ] Scenario 8: Data integrity verified ✅
- [ ] Filesystem backup created ✅
- [ ] Supabase backups enabled ✅
- [ ] Environment variables set in Vercel ✅

Once all items checked, proceed to `/speckit-tasks` for detailed implementation tasks.

---

## Support & Debugging

**Common Issues**:

| Issue | Cause | Solution |
|-------|-------|----------|
| "SUPABASE_URL not set" | Environment variable missing | Add to .env.local and restart |
| "Connection refused" | Supabase project offline | Check Supabase dashboard status |
| "Customer not found" error | Slug mismatch (spaces vs hyphens) | Use lowercase hyphens for customer names |
| Data loads but displays blank | Markdown parsing issue | Verify `marked` library handles content |
| Performance slow (>500ms) | Network latency | Check Supabase region; use nearest to Vercel region |

**Useful SQL Queries** (Supabase SQL Editor):
```sql
-- Check all customers
SELECT id, slug, name, created_at FROM customers;

-- Check programs for specific customer
SELECT content FROM programs 
WHERE customer_id = (SELECT id FROM customers WHERE slug = 'jaqueline-orellano');

-- Check feedback entries
SELECT entries FROM feedbacks 
WHERE customer_id = (SELECT id FROM customers WHERE slug = 'jaqueline-orellano');

-- Count total records per table
SELECT 
  (SELECT COUNT(*) FROM customers) as customer_count,
  (SELECT COUNT(*) FROM programs) as program_count,
  (SELECT COUNT(*) FROM feedbacks) as feedback_count;
```

---

## Next Steps

After all scenarios pass:

1. Run `/speckit-tasks` to generate detailed implementation tasks
2. Follow implementation phase to add database layer to app
3. Deploy to Vercel with database connection
4. Monitor production data access patterns
