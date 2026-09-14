# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

**Lili Trainer** — A personalized fitness coaching system for building and managing customer workout programs. Each customer has an individual markdown file documenting their program, progress, and feedback.

## Purpose & Workflow

This is a fitness coach assistant that:
1. Manages customer fitness programs in individual MD files
2. Creates personalized workout routines based on goals, fitness level, and constraints
3. Tracks customer feedback and progress
4. Provides insights on how customers feel about their routines

**Core Workflow:**
- When receiving a customer request, always ask first: **Is this a new customer or updating an existing one?**
- For new customers: Create a new MD file in `customers/[customer-name]/`
- For existing customers: Update their existing MD file with new programs or progress notes
- After any program entry: Analyze and provide insights on the routine's effectiveness based on customer feedback

## Directory Structure

```
/home/topiltzin/lili/trainer/
├── CLAUDE.md                    (This file)
├── customers/                   (Customer program directory)
│   └── [customer-name]/
│       ├── program.md          (Main program file)
│       ├── feedback.md         (Progress & feedback log)
│       └── notes.md            (Coach observations & insights)
├── .agents/skills/fitness-coach/ (Fitness coach skill)
└── skills/                      (Skills symlinks)
```

## Customer Program Format

### program.md
Primary file containing the current workout routine. Use the fitness-coach skill output format:
- Workout goal, fitness level, duration
- Weekly breakdown with exercise lists
- Sets, reps, rest periods
- Form tips for each exercise
- Progression strategy for weeks 2, 4, etc.
- Warm-up and cool-down guidance

### feedback.md
Track session entries and customer feedback:
```markdown
## [Date] - [Exercise/Week]
- How customer felt: [Energy, pain, difficulty]
- Completed: [Yes/No]
- Notes: [Any modifications, improvements, struggles]
- Overall impression: [Easy/Moderate/Hard]
```

### notes.md
Your insights and recommendations:
```markdown
## Observations
- [Date]: Customer finding [exercise] challenging → suggest [alternative]
- [Date]: Good progress on [metric] → increase intensity by [amount]
- [Date]: Customer feedback indicates [pattern] → recommend [adjustment]
```

## Key Commands

**Creating a new customer program:**
1. Ask if new or existing customer
2. Create `customers/[customer-name]/` directory with three MD files
3. Use fitness-coach skill to generate initial program
4. Save to program.md

**Updating a customer:**
1. Read their existing program.md and feedback.md
2. Log new feedback entry in feedback.md
3. Analyze patterns in feedback.md
4. Update notes.md with insights
5. If adjustments needed, regenerate program.md sections

**Providing feedback insights:**
- After any feedback entry, scan the feedback.md for patterns
- Identify what's working: exercises completed consistently, positive energy
- Identify struggles: missed sessions, pain, fatigue, difficulty
- Recommend adjustments: alternative exercises, reduced volume, added mobility work
- Keep recommendations simple and actionable

## Fitness Coach Skill

Located at `.agents/skills/fitness-coach/SKILL.md`

Input parameters:
- Fitness goal (weight loss, muscle gain, endurance, mobility)
- Current fitness level (beginner, intermediate, advanced)
- Available equipment
- Time per session
- Days per week available
- Any injuries or limitations

The skill generates structured workout plans with exercises, form guidance, and progression strategies.

## Starting Simple

As instructed: keep the initial setup simple. Start with basic weekly schedules and gradually enhance:
- Begin with 3-4 exercises per session
- Add complexity (supersets, drop sets) only when customer requests or after 2-3 weeks of consistent feedback
- Increase exercise variety and volume only after customer demonstrates readiness

## Notes for Future Sessions

- Always confirm whether you're working with a new customer or updating existing
- Review feedback.md before suggesting changes—past patterns inform better recommendations
- Keep customer files organized by name in the customers/ directory
- Use consistent date formats (YYYY-MM-DD) for tracking
- When providing insights, be specific about what's working and what needs adjustment
