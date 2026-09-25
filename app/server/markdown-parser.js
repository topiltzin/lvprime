// Parses program.md / feedback.md content into structured data, and formats new
// feedback entries so they match a given customer file's own existing template
// (constitution Principle I: never corrupt/diverge from existing content).
//
// feedback.md files in this repo are NOT one fixed shape across customers — each
// customer's file embeds its own worked example ("Formato de Entrada" / "Session
// Format") with its own field set (see customers/jaqueline-orellano/feedback.md vs.
// customers/topiltzin-flores/feedback.md). So instead of assuming one fixed field
// list, the template is *extracted from the file itself* and reused both to parse
// entries and to format new ones.

const DATE_LIKE = /^(\d{4}-\d{2}-\d{2}|\d{1,2}\s+de\s+[A-Za-zÀ-ÿ]+(?:,?\s*\d{4})?|\[[^\]]*fecha[^\]]*\]|\[[^\]]*date[^\]]*\])/i;
const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;
const HEADING_LINE = /^(#{2,4})\s+(.*)$/;
const FIELD_LINE = /^-\s*([^:]+):\s*(.*)$/;

const FALLBACK_TEMPLATE = {
  headingLevel: 2,
  fields: ['How customer felt', 'Completed', 'Notes', 'Overall impression'],
};

const SYNONYMS = {
  felt: /energ[íi]a|energy|how.*felt|c[oó]mo se sinti[oó]/i,
  completed: /^complet/i,
  difficulty: /dificultad|difficulty|overall impression|impresi[oó]n general/i,
  notes: /nota|observ|note/i,
};

const PLACEHOLDER = /^\[.*\]$/;
// Written by "Mark done" quick-complete (specs/012) for every field the coach didn't
// fill in; treated as absent so it never counts as real felt/difficulty data.
const NOT_REPORTED = /^(not reported|no reportado)$/i;

function isPlaceholder(value) {
  if (value == null) return true;
  const v = value.trim();
  if (v === '') return true;
  if (PLACEHOLDER.test(v)) return true;
  if (/^pending$/i.test(v)) return true;
  if (NOT_REPORTED.test(v)) return true;
  return false;
}

function normalizeLabelKey(label) {
  return label.trim().toLowerCase();
}

function classifyLabel(label) {
  for (const [key, re] of Object.entries(SYNONYMS)) {
    if (re.test(label)) return key;
  }
  return null;
}

/**
 * Extract the per-file entry template from the fenced example block near a
 * "Formato de Entrada" / "Entry Format" / "Session Format" heading. Falls back to
 * FALLBACK_TEMPLATE (the generic shape from CLAUDE.md) if no such block is found.
 */
export function extractFeedbackTemplate(feedbackMdText) {
  const lines = feedbackMdText.split(/\r?\n/);
  const formatHeadingIdx = lines.findIndex((l) =>
    /^#{1,4}\s*(Formato de Entrada|Entry Format|Session Format)/i.test(l)
  );
  if (formatHeadingIdx === -1) {
    return { ...FALLBACK_TEMPLATE, fields: [...FALLBACK_TEMPLATE.fields] };
  }

  let i = formatHeadingIdx + 1;
  while (i < lines.length && !lines[i].trim().startsWith('```')) i++;
  if (i >= lines.length) return { ...FALLBACK_TEMPLATE, fields: [...FALLBACK_TEMPLATE.fields] };
  i++; // skip opening fence

  const blockLines = [];
  while (i < lines.length && !lines[i].trim().startsWith('```')) {
    blockLines.push(lines[i]);
    i++;
  }

  const headingMatch = blockLines[0] && blockLines[0].match(HEADING_LINE);
  const headingLevel = headingMatch ? headingMatch[1].length : FALLBACK_TEMPLATE.headingLevel;

  const fields = [];
  for (const line of blockLines.slice(1)) {
    const m = line.match(FIELD_LINE);
    if (m) fields.push(m[1].trim());
  }

  if (fields.length === 0) {
    return { ...FALLBACK_TEMPLATE, fields: [...FALLBACK_TEMPLATE.fields] };
  }

  // The documented example's heading level can differ from what's actually used
  // by real entries (e.g. entries nested under "## Week N" grouping headings use
  // "###", one level deeper than the "## [Date]..." example). Prefer the level
  // actually in use so new entries match real practice, not just the example.
  const realEntries = parseFeedbackEntries(feedbackMdText);
  const actualHeadingLevel = realEntries.length
    ? realEntries[realEntries.length - 1].heading_level
    : headingLevel;

  return { headingLevel: actualHeadingLevel, fields };
}

/**
 * Extract the customer's current program goal only (used for the fast overview
 * summary — full program parsing lives in parseProgramDetail, added for US2).
 */
export function parseProgramGoal(programMdText) {
  const match = programMdText.match(/\*\*(Objetivo|Goal)\S*:?\*\*\s*(.+)/i);
  if (!match) return null;
  return match[2].trim().replace(/\s{2,}$/, '') || null;
}

const DAY_NAME = /^(Monday|Tuesday|Wednesday|Thursday|Friday|Saturday|Sunday|Lunes|Martes|Mi[ée]rcoles|Jueves|Viernes|S[áa]bado|Domingo)/i;

// Structured exercise-row extraction (User Story 2 / contracts/exercise-row-parsing.md).
// Matches the numbered-list shape both existing customer files already use, regardless of
// authored language: "N. **Name** (optional parenthetical) - <sets x reps> - <Descanso|Rest> <duration>",
// optionally followed by a "- Forma:"/"- Form tip:" bullet on the next line. Lines that don't
// match this shape are simply skipped — the day's existing `html` still carries them (research.md §1).
const EXERCISE_LINE = /^\d+\.\s*\*\*(.+?)\*\*\s*(.*)$/;
const LEADING_PARENTHETICAL = /^\([^)]*\)\s*/;
const LEADING_DASH = /^-\s*/;
const SEGMENT_SPLIT = /\s+-\s+/;
const REST_LABEL = /^(?:Descanso|Rest)\.?\s*:?\s*/i;
const FORM_TIP_LINE = /^\s*-\s*(?:Forma|Form tip|Form)\s*:\s*(.+)$/i;

/**
 * Extract structured exercise rows from one training day's Markdown body lines.
 * @param {Map<string, string>} [videoLinkMap] lowercased/trimmed exercise name -> video URL
 *   (specs/007-exercise-library-migration/contracts/exercise-video-linking.md). Matching is
 *   case-insensitive but otherwise exact; a miss (or no map at all) yields videoUrl: null,
 *   never a thrown error.
 * @returns {Array<{name: string, setsReps: string, rest: string|null, formTip: string|null, videoUrl: string|null}>}
 */
function extractExercises(bodyLines, videoLinkMap) {
  const exercises = [];
  for (let i = 0; i < bodyLines.length; i++) {
    const match = bodyLines[i].match(EXERCISE_LINE);
    if (!match) continue;

    const name = match[1].trim();
    let remainder = match[2].trim().replace(LEADING_PARENTHETICAL, '').replace(LEADING_DASH, '');
    const segments = remainder.split(SEGMENT_SPLIT).map((s) => s.trim()).filter(Boolean);
    if (segments.length < 2) continue;

    const restSegment = segments[segments.length - 1];
    const restLabelMatch = restSegment.match(REST_LABEL);
    if (!restLabelMatch) continue;

    const setsReps = segments.slice(0, -1).join(' - ');
    const rest = restSegment.slice(restLabelMatch[0].length).trim() || null;

    let formTip = null;
    const nextLine = bodyLines[i + 1];
    if (nextLine) {
      const tipMatch = nextLine.match(FORM_TIP_LINE);
      if (tipMatch) formTip = tipMatch[1].trim();
    }

    const videoUrl = videoLinkMap?.get(name.toLowerCase()) ?? null;

    exercises.push({ name, setsReps, rest, formTip, videoUrl });
  }
  return exercises;
}

/**
 * Full program detail for one week's routine: level, durations, one block per
 * day-of-week heading (any heading level whose text starts with a day name, in
 * English or Spanish — covers both existing customer templates), and any
 * "Progresión"/"Progression" section(s).
 * @param {Map<string, string>} [videoLinkMap] see extractExercises() — optional;
 *   omitting it (or passing an empty map) makes every exercise's videoUrl null.
 */
export function parseProgramDetail(programMdText, renderMarkdown, videoLinkMap) {
  const fitnessLevel = matchLabelLine(programMdText, /Nivel|Level/i);
  const sessionDuration = matchLabelLine(programMdText, /Duraci[oó]n|Duration/i);
  const planDuration = matchLabelLine(programMdText, /Duraci[oó]n del Plan/i);

  const lines = programMdText.split(/\r?\n/);
  const weeklySchedule = [];
  for (let i = 0; i < lines.length; i++) {
    const headingMatch = lines[i].match(HEADING_LINE);
    if (!headingMatch) continue;
    const headingText = headingMatch[2].trim();
    if (!DAY_NAME.test(headingText)) continue;

    const dayMatch = headingText.match(DAY_NAME);
    let dayEnd = dayMatch[0].length;
    const joinMatch = headingText.slice(dayEnd).match(/^\s*(y|and|\/)\s*(Monday|Tuesday|Wednesday|Thursday|Friday|Saturday|Sunday|Lunes|Martes|Mi[ée]rcoles|Jueves|Viernes|S[áa]bado|Domingo)/i);
    if (joinMatch) dayEnd += joinMatch[0].length;
    const day = headingText.slice(0, dayEnd).trim();
    const focus = headingText.slice(dayEnd).replace(/^\s*[-–]\s*/, '').trim();

    const level = headingMatch[1].length;
    let j = i + 1;
    const bodyLines = [];
    while (j < lines.length) {
      const nextHeading = lines[j].match(HEADING_LINE);
      if (nextHeading && nextHeading[1].length <= level) break;
      bodyLines.push(lines[j]);
      j++;
    }
    weeklySchedule.push({
      day,
      focus,
      html: renderMarkdown(bodyLines.join('\n').trim()),
      exercises: extractExercises(bodyLines, videoLinkMap),
    });
    i = j - 1;
  }

  const progressionMatch = programMdText.match(
    /(^|\n)(#{2,3}\s*(Progresi[oó]n|Progression)[\s\S]*?)(?=\n#{1,2}\s*(?!.*Progresi[oó]n)(?!.*Progression)|$)/i
  );
  const progressionHtml = progressionMatch ? renderMarkdown(progressionMatch[2].trim()) : null;

  return { fitnessLevel, sessionDuration, planDuration, weeklySchedule, progressionHtml };
}

function matchLabelLine(text, labelRe) {
  const re = new RegExp(`\\*\\*(?:${labelRe.source}):\\*\\*\\s*(.+)`, 'i');
  const match = text.match(re);
  if (!match) return null;
  return match[1].trim().replace(/\s{2,}$/, '') || null;
}

/**
 * Parse every logged session entry out of a feedback.md file. Entries are
 * recognized as a level 2-4 heading whose text starts with something date-like;
 * everything else (grouping headings like "## Week 1", the embedded format
 * example, summary sections) is skipped. An entry that doesn't fully match the
 * expected field set is still returned (raw_matched: false), never dropped.
 */
export function parseFeedbackEntries(feedbackMdText) {
  const lines = feedbackMdText.split(/\r?\n/);
  const entries = [];
  let sortOrder = 0;

  // Fenced code blocks (used to embed a worked "Formato de Entrada"/"Session
  // Format" example near the top of each file) are documentation, not real
  // logged entries, and must not be scanned as such.
  const inFence = new Array(lines.length).fill(false);
  let fenced = false;
  for (let k = 0; k < lines.length; k++) {
    if (lines[k].trim().startsWith('```')) {
      fenced = !fenced;
      inFence[k] = true; // the fence delimiter line itself is not scannable content
      continue;
    }
    inFence[k] = fenced;
  }

  for (let i = 0; i < lines.length; i++) {
    if (inFence[i]) continue;
    const headingMatch = lines[i].match(HEADING_LINE);
    if (!headingMatch) continue;
    const headingText = headingMatch[2].trim();
    if (!DATE_LIKE.test(headingText)) continue;

    const headingLevel = headingMatch[1].length;
    const dateMatch = headingText.match(DATE_LIKE);
    const rawDate = dateMatch[0].trim();
    const rest = headingText.slice(dateMatch[0].length).replace(/^\s*-\s*/, '').trim();

    const fieldsRaw = [];
    let j = i + 1;
    while (j < lines.length) {
      const line = lines[j];
      if (HEADING_LINE.test(line) || line.trim() === '---') break;
      const fieldMatch = line.match(FIELD_LINE);
      if (fieldMatch) {
        fieldsRaw.push({ label: fieldMatch[1].trim(), value: fieldMatch[2].trim() });
      }
      j++;
    }

    const fieldsByKey = {};
    for (const { label, value } of fieldsRaw) {
      const canonical = classifyLabel(label);
      if (canonical && fieldsByKey[canonical] === undefined) {
        fieldsByKey[canonical] = isPlaceholder(value) ? null : value;
      }
    }

    const entryDate = ISO_DATE.test(rawDate) ? rawDate : rawDate;
    const hasAnyRealValue = Object.values(fieldsByKey).some((v) => v != null);
    const rawMatched = fieldsRaw.length > 0 && hasAnyRealValue;

    entries.push({
      entry_date: entryDate,
      entry_date_iso: ISO_DATE.test(rawDate) ? rawDate : null,
      label: rest || null,
      felt: fieldsByKey.felt ?? null,
      completed: parseCompleted(fieldsByKey.completed),
      difficulty: fieldsByKey.difficulty ?? null,
      notes: fieldsByKey.notes ?? null,
      raw_matched: rawMatched,
      fields_raw: fieldsRaw,
      heading_level: headingLevel,
      sort_order: sortOrder++,
    });

    i = j - 1;
  }

  return entries;
}

function parseCompleted(value) {
  if (value == null) return null;
  if (/^(s[ií]|yes|true)/i.test(value)) return true;
  if (/^(no|false)/i.test(value)) return false;
  return null;
}

/**
 * Format a single new entry as Markdown text matching a template extracted by
 * extractFeedbackTemplate(). `fieldValues` maps each template field label
 * (verbatim, as it appears in that file) to the value to write for it.
 */
export function formatFeedbackEntry(template, { date, label, fieldValues }) {
  const heading = `${'#'.repeat(template.headingLevel)} ${date}${label ? ` - ${label}` : ''}`;
  const fieldLines = template.fields.map((f) => `- ${f}: ${fieldValues[f] ?? ''}`);
  return [heading, ...fieldLines].join('\n');
}

// ---- "Mark done" quick-complete + Log Session upsert (specs/012-program-day-mark-done) ----

function isSpanishLabel(label) {
  return /[áéíóúñ]/i.test(label) || /completad|energ[íi]a|nota|dificultad/i.test(label);
}

/** True when the customer's own feedback template is written in Spanish. */
export function isSpanishTemplate(template) {
  return template.fields.some(isSpanishLabel);
}

/** The "not reported" sentinel in the template's language (parsed back as absent). */
export function notReportedValue(template) {
  return isSpanishTemplate(template) ? 'No reportado' : 'Not reported';
}

/** A completed-field value validateFeedbackSubmission and parseCompleted accept as yes. */
export function completedYesValue(template) {
  return isSpanishTemplate(template) ? 'Sí' : 'Yes';
}

function normalizeEntryLabel(label) {
  return (label || '').trim().toLowerCase();
}

/**
 * Line range { start, end } (end exclusive) of the last entry in `content` with this
 * ISO date and label (trimmed, case-insensitive; an empty label only matches an
 * unlabelled entry), using the same heading/fence rules as parseFeedbackEntries().
 * Returns null when there is no such entry.
 */
export function findFeedbackEntryBlock(content, { date, label }) {
  const lines = content.split('\n');
  const wanted = normalizeEntryLabel(label);
  let fenced = false;
  let found = null;

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i].replace(/\r$/, '');
    if (line.trim().startsWith('```')) {
      fenced = !fenced;
      continue;
    }
    if (fenced) continue;
    const headingMatch = line.match(HEADING_LINE);
    if (!headingMatch) continue;
    const headingText = headingMatch[2].trim();
    const dateMatch = headingText.match(DATE_LIKE);
    if (!dateMatch || dateMatch[0].trim() !== date) continue;
    const rest = headingText.slice(dateMatch[0].length).replace(/^\s*-\s*/, '').trim();
    if (normalizeEntryLabel(rest) !== wanted) continue;

    let end = i + 1;
    while (end < lines.length) {
      const next = lines[end].replace(/\r$/, '');
      if (HEADING_LINE.test(next) || next.trim() === '---' || next.trim().startsWith('```')) break;
      end++;
    }
    found = { start: i, end };
  }
  return found;
}

function appendEntryText(content, entryText, header) {
  if (content.trim() === '') return `${header ? `${header}\n\n` : ''}${entryText}\n`;
  const separator = content.endsWith('\n\n') ? '' : content.endsWith('\n') ? '\n' : '\n\n';
  return `${content}${separator}${entryText}\n`;
}

/** Swaps lines [start, end) for newLines, keeping the block's trailing blank lines. */
function replaceBlock(lines, { start, end }, newLines) {
  let trailing = 0;
  while (end - trailing - 1 > start && lines[end - trailing - 1].trim() === '') trailing++;
  return [...lines.slice(0, start), ...newLines, ...lines.slice(end - trailing)].join('\n');
}

/**
 * Log Session write (FR-009): replaces the last entry with the same date + label, or
 * appends a new one. `header` is written first when content is empty.
 * Returns { content, replaced }.
 */
export function upsertFeedbackEntryText(content, template, { date, label, fieldValues }, header = null) {
  const entryText = formatFeedbackEntry(template, { date, label, fieldValues });
  const block = findFeedbackEntryBlock(content, { date, label });
  if (!block) return { content: appendEntryText(content, entryText, header), replaced: false };
  return { content: replaceBlock(content.split('\n'), block, entryText.split('\n')), replaced: true };
}

/**
 * Quick-complete on an existing entry: sets only its completed-like field to yes and
 * keeps every other line. Returns { content, changed }, or null when no entry matches.
 */
export function setEntryCompleted(content, template, { date, label }) {
  const block = findFeedbackEntryBlock(content, { date, label });
  if (!block) return null;

  const lines = content.split('\n');
  const yes = completedYesValue(template);
  let changed = false;
  let sawCompleted = false;
  for (let i = block.start + 1; i < block.end; i++) {
    const fieldMatch = lines[i].replace(/\r$/, '').match(FIELD_LINE);
    if (!fieldMatch || !/^complet/i.test(fieldMatch[1].trim())) continue;
    sawCompleted = true;
    if (parseCompleted(fieldMatch[2].trim()) !== true) {
      lines[i] = `- ${fieldMatch[1].trim()}: ${yes}`;
      changed = true;
    }
    break;
  }
  if (!sawCompleted) {
    // An entry written without a completed line: add one right after the heading.
    const completedLabel = template.fields.find((f) => /^complet/i.test(f.trim())) || 'Completed';
    lines.splice(block.start + 1, 0, `- ${completedLabel}: ${yes}`);
    changed = true;
  }
  return { content: lines.join('\n'), changed };
}
