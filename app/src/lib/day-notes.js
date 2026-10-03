// The per-day notepad's starting text: one line per exercise for the customer to finish
// ("Goblet squat — 3x12: ") so they never have to remember what the day held.

/** The exercise list as editable lines, or '' for a day without structured exercises. */
export function notepadPrefill(day) {
  return (day.exercises || [])
    .map((e) => `${e.name}${e.setsReps ? ` — ${e.setsReps}` : ''}: `)
    .join('\n');
}

/** What the notepad opens with: the saved note when there is one, else the exercise list. */
export function notepadStartText(day, entry) {
  const saved = (entry?.notes || '').trim();
  return saved || notepadPrefill(day);
}
