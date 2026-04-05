/**
 * Tutor learning context: structured topic + sub-topic (optional, skippable).
 * Persisted locally for continuity (spec §10).
 */

export const TUTOR_CONTEXT_STORAGE_KEY = 'sb_tutor_learning_context';

export const SUBJECT_OPTIONS = [
  { id: 'math', label: 'Math' },
  { id: 'science', label: 'Science' },
  { id: 'reading', label: 'Reading' },
];

/** @type {Record<string, { id: string; label: string }[]>} */
export const SUB_TOPICS_BY_SUBJECT = {
  math: [
    { id: 'fractions', label: 'Fractions' },
    { id: 'decimals', label: 'Decimals' },
    { id: 'word_problems', label: 'Word problems' },
    { id: 'geometry', label: 'Geometry' },
    { id: 'equations', label: 'Equations' },
  ],
  science: [
    { id: 'plants', label: 'Plants' },
    { id: 'energy', label: 'Energy' },
    { id: 'matter', label: 'Matter' },
    { id: 'weather', label: 'Weather' },
  ],
  reading: [
    { id: 'main_idea', label: 'Main idea' },
    { id: 'vocabulary', label: 'Vocabulary' },
    { id: 'inference', label: 'Inference' },
    { id: 'summarizing', label: 'Summarizing' },
  ],
};

/**
 * @returns {{ skipped: boolean; subject: string | null; subTopic: string | null }}
 */
export function loadTutorContext() {
  try {
    const raw = localStorage.getItem(TUTOR_CONTEXT_STORAGE_KEY);
    if (!raw) {
      return { skipped: false, subject: null, subTopic: null };
    }
    const o = JSON.parse(raw);
    return {
      skipped: Boolean(o.skipped),
      subject: typeof o.subject === 'string' ? o.subject : null,
      subTopic: typeof o.subTopic === 'string' ? o.subTopic : null,
    };
  } catch {
    return { skipped: false, subject: null, subTopic: null };
  }
}

/**
 * @param {{ skipped?: boolean; subject: string | null; subTopic: string | null }} ctx
 */
export function saveTutorContext(ctx) {
  try {
    localStorage.setItem(
      TUTOR_CONTEXT_STORAGE_KEY,
      JSON.stringify({
        skipped: Boolean(ctx.skipped),
        subject: ctx.subject,
        subTopic: ctx.subTopic,
        updatedAt: Date.now(),
      }),
    );
  } catch {
    /* ignore quota */
  }
}

/**
 * @param {{ subject: string | null; subTopic: string | null; skipped: boolean }} ctx
 */
export function getContextualWelcome(ctx) {
  if (ctx.skipped || !ctx.subject) {
    return {
      title: 'Hi!',
      lines: [
        'Use the camera or upload a photo, or type a question.',
        'I’ll guide you step by step — I won’t give the final answer right away.',
      ],
      actions: ['Take a photo of a problem', 'Type what you are stuck on', 'Tap a topic above to personalize'],
    };
  }
  const subj = SUBJECT_OPTIONS.find((s) => s.id === ctx.subject);
  const subList = SUB_TOPICS_BY_SUBJECT[ctx.subject] || [];
  const sub = subList.find((x) => x.id === ctx.subTopic);
  const focus = sub ? `${subj?.label || ctx.subject} · ${sub.label}` : subj?.label || ctx.subject;
  return {
    title: `Let’s work on ${focus}`,
    lines: [
      'I’ll use this topic in my questions.',
      'Pick one of the steps below — no long typing needed.',
    ],
    actions: [
      'Take or upload a photo of a problem',
      'Type a short question',
      'Tap “Start with an example” (or wait a few seconds)',
    ],
  };
}
