# Topiltzin Flores - Coach Observations & Insights

## Initial Program Notes (2026-09-14)

### Program Design Rationale
- **6-day split chosen:** Upper/Lower (3x Upper, 3x Lower) for volume and recovery
- **Elbow accommodation:** Avoided isolation curls; emphasized machine work where possible
- **Muscle gain focus:** Heavy compounds (4-6 rep range) + moderate isolation (8-12 reps)
- **1-hour constraint:** Tight session structure with built-in rest periods

### Key Observation Areas
1. **Elbow pain management** — Will track if current exercises aggravate condition
2. **Recovery capacity** — 6 days/week is aggressive; monitor energy and soreness
3. **Form consistency** — First 2 weeks critical for establishing baseline technique
4. **Strength progression** — Track compound lift increases week-to-week

### Potential Adjustments (Trigger Points)
- If elbow pain > 5/10 during any upper body session → reduce volume, switch to machines
- If energy dropping significantly by Friday → consider 5-day split instead
- If hamstring tightness → add extra foam rolling post-session
- After 3 weeks → assess if progression pace is realistic

---

## Week 1 Observations
[To be updated as sessions complete]

---

## Week 2-3 Observations
[To be updated as sessions complete]

---

## Strength Progression Tracking

| Lift | Week 1 | Week 4 Target | Week 8 Target |
|------|--------|---------------|---------------|
| Bench Press | TBD | TBD +10 lbs | TBD +20 lbs |
| Squat | TBD | TBD +15 lbs | TBD +30 lbs |
| Deadlift | TBD | TBD +10 lbs | TBD +20 lbs |

---

## Personalization Notes
- Customer is ready for intermediate-level intensity
- Full gym access allows for flexible programming
- Elbow pain is the primary constraint — must respect this
- 6-day commitment suggests high motivation; validate this continues

---

## Recommendations for Future Updates
- After week 2: Check if elbow pain has improved, worsened, or stayed same
- After week 4: Assess readiness for increased intensity vs. volume
- After week 8: Plan next 4-week block based on progress and feedback

---

## Week 2 Program Redesign (2026-09-23)

### What changed and why
- **Frequency cut 6 → 5 days/week.** Requested directly; also addresses the "watch for form breakdown / 6-day sustainability" trigger point flagged in Week 1 planning — no negative feedback yet, but 5 days gives more buffer.
- **Goal reframed:** Muscle Gain via volume, now trained through a calisthenics + weights (dumbbells, kettlebells, bar) hybrid instead of pure machine/barbell work.
- **New skill objective added: Tuck Planche.** Dedicated skill blocks placed on Monday/Thursday (push days), first in the session while fresh — skill work needs low fatigue, unlike volume accessories.
- **Duration held at ≤60 min** including warm-up/cool-down, same constraint as Week 1 — skill work time was carved out of accessory volume, not added on top.

### Feedback review (per workflow — checked before redesigning)
- Only one real session logged so far (2026-09-15, legs/"Piernas"): energy good, fully completed, **no elbow pain**, overall impression positive. Monday's baseline chest/back entry is still pending.
- Too little data to say a specific exercise wasn't working — no negative signal, so the redesign is driven by the customer's explicit request, not a corrective response to feedback.
- **Watch point going forward:** straight-arm calisthenics (planche holds, dips, push-up variations) load the elbow differently than the machine-based Week 1 exercises did. Elbow has been pain-free so far, but this is a real risk with the new stimulus — flagged explicitly in program.md with a "keep elbows soft, never locked" cue on every relevant exercise, plus a fallback (drop to Frog Stand / swap dips for incline press) if discomfort shows up.

### Things to check after Week 2 sessions
- Elbow response specifically to dips, pseudo planche push-ups, and tuck planche holds (new stimulus vs. Week 1's machine work)
- Whether 5 days feels more sustainable than 6 (energy trend across the week)
- Tuck planche hold time progression Monday → Thursday (should trend up if skill work is landing)
- Whether 60 min is actually enough once skill work + wrist prep are included — first session will validate the timing

---

## Bug Fix: Duplicate "Week" Sections in program.md (2026-09-23)

### What was wrong
The dashboard's week tabs (Week 1-4 chips) are architecturally fixed to show **one single day-by-day schedule under all four tabs** — switching weeks only swaps a short progression-note text (`server/markdown-parser.js`'s `parseProgramDetail`, `src/components/week-subnav.js`, per `specs/003-program-weekly-tabs-pdf`). It has no concept of "Week 1 has different exercises than Week 2."

When program.md was restructured earlier today with a separate "## Week 1" (original Upper/Lower split) and "## Week 2" (new hybrid) section, each with its own Monday-Friday day headings, the parser — which scans the *entire file* for any heading starting with a day name — picked up **11 day blocks** (6 from Week 1 + 5 from Week 2) and rendered all 11 identically under every week tab (1 through 4). That's why Topiltzin's dashboard showed "Week 2" looking the same as the other week tabs: the schedule block is always identical across tabs by design, and now it was also bloated with duplicate days.

### Fix applied
- `program.md` now contains exactly **one** active weekly schedule (Monday-Friday, the new hybrid Calisthenics + Weights plan) — matches the data model the app actually supports (same pattern as `customers/jaqueline-orellano/program.md`).
- Progression section rewritten as `- **Week N:** text` bullets (N=1-4) under "Progresión Semanal (4 semanas)" — the exact format `parseWeeklyProgression()` requires. The original file used `### Week 1-2: Baseline` style range headings, which the parser silently never matched — the progression-note tab area for Topiltzin had likely always shown the fallback "No specific guidance for this week." even before today's change (unrelated pre-existing gap, fixed as part of this same edit).
- The original 6-day Upper/Lower split (2026-09-14 through 2026-09-22) is archived below as historical reference, not as live day-heading content.

### Update (2026-09-23)
Resolved by spec 010 (commit d571929): each week is now its own routine in the app. The hybrid plan above was stored as Week 1; Week 2 is drafted below.

---

## Week 2 Plan (2026-09-23)

### What changed and why
- **Planche volume cut from 5 exercises to 2** (Tuck Planche Hold Mon, Pseudo Planche Push-ups Thu) — requested by the customer. Frog Stand Hold and Advanced Tuck Planche Lean removed.
- **Twist: tempo + Pike Push-ups.** 3-sec lowering on pull-ups, goblet squats and wide push-ups adds time under tension without new equipment or longer sessions. Pike Push-ups fill the freed skill slot and keep building the overhead/shoulder strength planche depends on.
- **Everything else carried over from Week 1** (same 5-day split, same equipment, ≤60 min) so progress stays comparable week to week.

### Evidence behind it
- No sessions logged yet on the calisthenics plan. The only completed entry is **2026-09-15 (Piernas)**: completed, energy good, **elbow ok**, overall "todo bien" — from the old Upper/Lower plan.
- So Week 2 is driven by the customer's request, not by a problem in the feedback. Loads stay at Week 1 levels on tempo lifts until real Week 1 sessions are logged.

### Watch next
- Elbow response to Pike Push-ups (new overhead pressing angle) — first thing to check in feedback.
- Whether dropping planche volume slows Tuck Planche Hold progress; if hold time stalls in Week 3, restore one planche exercise.
- Session length with tempo sets — should still fit ≤60 min.

---

## Archived: Original Week 1 Plan (2026-09-14 to 2026-09-22, superseded 2026-09-23)

Upper/Lower split, 6 days/week, 60 min/session. Kept here for reference only — no longer the active program.md schedule.

### Warm-up (5 min - every session)
- 2 min light cardio (treadmill/bike)
- 3 min dynamic stretching (arm circles, leg swings, cat-cow)

### UPPER BODY DAYS (Monday, Wednesday, Friday)

**Monday - Chest & Back Focus**
1. Barbell Bench Press - 4 × 6-8 reps - Rest 2 min (full ROM, chest to bar, feet planted)
2. Bent-Over Barbell Rows - 4 × 6-8 reps - Rest 2 min (hinge at hips, squeeze shoulder blades, core tight)
3. Dumbbell Incline Press - 3 × 8-10 reps - Rest 90 sec (control descent, elbows at 45°)
4. Lat Pulldown (Machine) - 3 × 8-10 reps - Rest 90 sec (pull to chest, no swinging, full stretch)
5. Cable Chest Fly - 3 × 10-12 reps - Rest 60 sec (slight elbow bend, arc motion, squeeze center)

**Wednesday - Back & Shoulders**
1. Deadlifts (Conventional) - 4 × 5-6 reps - Rest 2 min (neutral spine, shoulders over bar, drive through heels)
2. Machine Shoulder Press - 4 × 8-10 reps - Rest 90 sec (controlled tempo, no arching, full range)
3. Face Pulls - 3 × 12-15 reps - Rest 60 sec (external rotation, rear delts, light/elbow-friendly)
4. Vertical Chest Machine - 3 × 8-10 reps - Rest 90 sec
5. Rear Delt Fly Machine - 3 × 10-12 reps - Rest 60 sec

**Friday - Upper Body Power**
1. Incline Barbell Press - 4 × 6-8 reps - Rest 2 min (30° angle, controlled descent, explosive press)
2. Weighted Pull-ups - 4 × 6-8 reps - Rest 2 min (full range, chest to bar, no momentum)
3. Dumbbell Rows - 3 × 8-10 reps/side - Rest 90 sec
4. Machine Lateral Raise - 3 × 10-12 reps - Rest 60 sec (elbows slightly bent, elbow-friendly)
5. Chest Dips (assisted if needed) - 3 × 8-10 reps - Rest 90 sec

### LOWER BODY DAYS (Tuesday, Thursday, Saturday)

**Tuesday - Legs Compound**
1. Barbell Back Squat - 4 × 6-8 reps - Rest 2 min (knees track over toes, ATG depth)
2. Romanian Deadlifts - 4 × 8-10 reps - Rest 90 sec
3. Leg Press - 3 × 8-10 reps - Rest 90 sec
4. Leg Curls (Machine) - 3 × 10-12 reps - Rest 60 sec
5. Calf Raises - 3 × 12-15 reps - Rest 60 sec

**Thursday - Leg Power**
1. Barbell Front Squat - 4 × 6-8 reps - Rest 2 min (upright torso, elbows high, deep squat)
2. Leg Curl (Lying) - 4 × 8-10 reps - Rest 90 sec
3. Walking Lunges (Dumbbells) - 3 × 10 reps/leg - Rest 90 sec
4. Leg Extension - 3 × 10-12 reps - Rest 60 sec
5. Seated Calf Raises - 3 × 15-20 reps - Rest 60 sec

**Saturday - Legs & Glutes**
1. Trap Bar Deadlifts - 4 × 5-6 reps - Rest 2 min
2. Belt Squat - 3 × 8-10 reps - Rest 90 sec
3. Bulgarian Split Squats - 3 × 8-10/leg - Rest 90 sec
4. Leg Press Calf Raises - 3 × 12-15 reps - Rest 60 sec
5. Abductor Machine - 3 × 12-15 reps - Rest 60 sec

### Original Progression Strategy
- Week 1-2: Baseline — form, controlled tempo, record weights
- Week 3-4: Volume increase — +1-2 reps or +5 lbs on compounds
- Week 5-6: Intensity focus — -1-2 reps, +5-10 lbs
- Week 7-8: Deload — -30% volume
