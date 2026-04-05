import OpenAI from 'openai';

/**
 * @returns {OpenAI | null}
 */
// Parameters that Gemini's OpenAI-compatible endpoint does not recognise.
// The OpenAI SDK (v4.x+) injects some of these by default (e.g. `store`),
// causing Gemini to return 400 "Unknown field" errors.
const UNSUPPORTED_PARAMS = new Set([
  'store',
  'user',
  'frequency_penalty',
  'presence_penalty',
  'logprobs',
  'top_logprobs',
  'logit_bias',
  'seed',
  'service_tier',
  'parallel_tool_calls',
]);

/**
 * Wraps the global fetch to strip parameters Gemini does not understand.
 */
function geminiSafeFetch(url, init) {
  if (init?.body && typeof init.body === 'string') {
    try {
      const json = JSON.parse(init.body);
      let changed = false;
      for (const key of UNSUPPORTED_PARAMS) {
        if (key in json) {
          delete json[key];
          changed = true;
        }
      }
      if (changed) {
        init = { ...init, body: JSON.stringify(json) };
      }
    } catch { /* not JSON, pass through */ }
  }
  return fetch(url, init);
}

export function getOpenAI() {
  const key = process.env.GEMINI_API_KEY?.trim();
  if (!key) {
    return null;
  }
  return new OpenAI({
    apiKey: key,
    baseURL: 'https://generativelanguage.googleapis.com/v1beta/openai/',
    fetch: geminiSafeFetch,
  });
}

/**
 * @param {{ content?: string | Array<{ type?: string; text?: string }>; refusal?: string } | undefined} message
 * @returns {string}
 */
function assistantMessageText(message) {
  const c = message?.content;
  if (typeof c === 'string') {
    return c.trim();
  }
  if (Array.isArray(c)) {
    return c
      .filter((p) => p && p.type === 'text')
      .map((p) => (p.type === 'text' ? p.text : ''))
      .join('')
      .trim();
  }
  return '';
}

const PHOTO_SCHEMA = {
  name: 'photo_learning_result',
  schema: {
    type: 'object',
    additionalProperties: false,
    required: [
      'originalQuestion',
      'simplifiedEnglish',
      'chineseExplanation',
      'steps',
      'keywords',
    ],
    properties: {
      originalQuestion: { type: 'string' },
      simplifiedEnglish: { type: 'string' },
      chineseExplanation: { type: 'string' },
      steps: {
        type: 'array',
        items: { type: 'string' },
      },
      keywords: {
        type: 'array',
        items: {
          type: 'object',
          additionalProperties: false,
          required: ['term', 'simpleEnglish', 'chineseHint'],
          properties: {
            term: { type: 'string' },
            simpleEnglish: { type: 'string' },
            chineseHint: { type: 'string' },
          },
        },
      },
    },
  },
};

const TUTOR_SYSTEM = `
You are StudyBridge AI, a patient and skilled tutor for an ESL middle school student (around grade 7 in the US, learning English for about 2 years).

Your goal:
Help the student understand and solve problems step by step, while building thinking skills and confidence.

---

1. Language rules (VERY IMPORTANT)

- Use simple English (grade 4–6 level)
- Use short, clear sentences
- Avoid complex grammar

IMPORTANT:
The content can be grade 7 level, but your language must stay simple.

---

2. Teaching style (Socratic method with structure)

Do NOT jump to the answer.

Always follow this structure:

Step 1: Understand the problem
- Ask what the question is asking
- Identify key words

Step 2: Plan
- Ask what the first step could be

Step 3: Solve step-by-step
- Guide one step at a time

Step 4: Reflect
- Ask why the answer makes sense

---

3. First response rule (CRITICAL)

When a new problem is given:

- Do NOT explain immediately
- Start with a simple question

Examples:
- "What do you think this question is asking?"
- "What information do we have?"

---

4. If the student is stuck

If the student says "I don't know" or gives no answer:

- Be encouraging:
  "That's okay 😊 Let's try together."

- Make the question easier
- Give a small hint (NOT the full solution)

---

5. If the student clicks "Explain more"

Change behavior:

- Give a clearer explanation of the current step
- Break it into smaller steps
- Still avoid jumping to the final answer

---

6. Difficulty control

- Start very easy
- Increase difficulty slowly
- If the student struggles → go simpler
- If the student answers well → move forward

---

7. Image / homework context

When a problem comes from a photo:

- Treat it as real homework
- Focus only on that problem
- Guide, do NOT solve it directly

---

8. Chinese usage

- You may use a little Chinese ONLY to explain a difficult word or concept
- Keep most explanation in English

---

9. Tone

- Friendly
- Encouraging
- Patient
- Never judgmental
`;

const LC_SUBTOPIC_BY_SUBJECT = {
  math: new Set(['fractions', 'decimals', 'word_problems', 'geometry', 'equations']),
  science: new Set(['plants', 'energy', 'matter', 'weather']),
  reading: new Set(['main_idea', 'vocabulary', 'inference', 'summarizing']),
};

const LC_SUBJECT_LABEL = { math: 'Math', science: 'Science', reading: 'Reading' };

const LC_SUBTOPIC_LABEL = {
  fractions: 'Fractions',
  decimals: 'Decimals',
  word_problems: 'Word problems',
  geometry: 'Geometry',
  equations: 'Equations',
  plants: 'Plants',
  energy: 'Energy',
  matter: 'Matter',
  weather: 'Weather',
  main_idea: 'Main idea',
  vocabulary: 'Vocabulary',
  inference: 'Inference',
  summarizing: 'Summarizing',
};

/**
 * @param {unknown} raw
 * @returns {{ subject: string; subTopic: string | null } | null}
 */
export function sanitizeLearningContext(raw) {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) {
    return null;
  }
  const subj = raw.subject;
  const subject =
    subj === 'math' || subj === 'science' || subj === 'reading' ? subj : null;
  if (!subject) {
    return null;
  }
  const allowed = LC_SUBTOPIC_BY_SUBJECT[subject];
  const st = typeof raw.subTopic === 'string' ? raw.subTopic : '';
  const subTopic = allowed.has(st) ? st : null;
  return { subject, subTopic };
}

const MAX_PA_TEXT = 4000;
const MAX_PA_STEPS = 20;
const MAX_PA_STEP_LEN = 500;
const MAX_KEYWORDS = 30;

/**
 * @param {unknown} raw
 * @returns {object | null}
 */
export function sanitizePhotoAnalysisForTutor(raw) {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) {
    return null;
  }
  const clip = (s, n) => String(s ?? '').slice(0, n);
  const steps = Array.isArray(raw.steps)
    ? raw.steps.slice(0, MAX_PA_STEPS).map((s) => clip(s, MAX_PA_STEP_LEN))
    : [];
  const keywords = Array.isArray(raw.keywords)
    ? raw.keywords.slice(0, MAX_KEYWORDS).map((k) => {
        if (!k || typeof k !== 'object') {
          return { term: '', simpleEnglish: '', chineseHint: '' };
        }
        return {
          term: clip(k.term, 120),
          simpleEnglish: clip(k.simpleEnglish, 200),
          chineseHint: clip(k.chineseHint, 200),
        };
      })
    : [];
  return {
    originalQuestion: clip(raw.originalQuestion, MAX_PA_TEXT),
    simplifiedEnglish: clip(raw.simplifiedEnglish, MAX_PA_TEXT),
    chineseExplanation: clip(raw.chineseExplanation, MAX_PA_TEXT),
    steps,
    keywords,
  };
}

/**
 * @param {object | null} photoAnalysis
 * @param {string | null} userIntent
 * @param {{ subject: string; subTopic: string | null } | null} learningContext
 * @returns {string}
 */
function buildTutorSystemContent(photoAnalysis, userIntent, learningContext) {
  let system = TUTOR_SYSTEM;
  if (learningContext) {
    const area = LC_SUBJECT_LABEL[learningContext.subject] || learningContext.subject;
    const focus = learningContext.subTopic
      ? LC_SUBTOPIC_LABEL[learningContext.subTopic] || learningContext.subTopic
      : null;
    system += `

--- Student learning focus (self-selected, optional) ---
Subject area: ${area}.
${focus ? `Current focus: ${focus}.` : 'No sub-topic was chosen; keep hints within this subject area in general.'}
Always tie your opening hints and questions to this focus when the student has not sent a photo. Offer 2–3 very simple next actions they could try (e.g. one tiny practice question, one vocabulary check, or “take a photo of a problem”). Use plain language. Do not require long typing from the student.`;
  }
  if (photoAnalysis) {
    const kwText =
      photoAnalysis.keywords
        .filter((k) => k.term)
        .map((k) => `${k.term}: ${k.simpleEnglish}${k.chineseHint ? ` (${k.chineseHint})` : ''}`)
        .join('; ') || '—';
    const stepsText = photoAnalysis.steps.length ? photoAnalysis.steps.join(' | ') : '—';
    system += `

--- Problem context (from student's homework photo) ---
Original question (extracted): ${photoAnalysis.originalQuestion}
Simplified English: ${photoAnalysis.simplifiedEnglish}
Chinese note (for your reference only): ${photoAnalysis.chineseExplanation || '—'}
Keywords: ${kwText}

INTERNAL reference steps (do NOT output these as a numbered solution or read them verbatim to the student. Use them only to plan hints and Socratic questions): ${stepsText}

If the student just uploaded this photo or you have not yet opened with a warm, understanding-focused question: briefly acknowledge (you may use a friendly emoji), then ask what they think the question is asking. Never start by giving the full worked answer or listing all solution steps.`;
  }
  if (userIntent === 'explain_more') {
    system += `

The student asked for more explanation.

Now:
- Explain the CURRENT step clearly
- Break it into smaller parts
- Use an example if helpful
- Do NOT jump to the final answer`;
  }
  if (userIntent === 'dont_know') {
    system += `

The student said "I don't know".

Now:
- Encourage them warmly
- Make the problem easier
- Give a small hint
- Ask a simpler question they can answer`;
  }
  return system;
}

/**
 * @param {object | null} photoAnalysis
 * @param {string | null} userIntent
 * @param {{ subject: string; subTopic: string | null } | null} learningContext
 * @returns {string}
 */
function demoTutorReply(photoAnalysis, userIntent, learningContext) {
  if (userIntent === 'dont_know') {
    return "That's okay! Let's try it together 😊 What is the very first word or number you notice in the problem?";
  }
  if (userIntent === 'explain_more') {
    return "Let's go one step slower (demo mode). Look at the question: what is it asking you to find or do?";
  }
  if (photoAnalysis) {
    return "Let's look at this together 😊 What do you think this question is asking you to do? (Demo mode: set GEMINI_API_KEY for full AI help.)";
  }
  if (learningContext) {
    const area = LC_SUBJECT_LABEL[learningContext.subject] || learningContext.subject;
    const focus = learningContext.subTopic
      ? LC_SUBTOPIC_LABEL[learningContext.subTopic] || learningContext.subTopic
      : null;
    const bit = focus ? `${area} — ${focus}` : area;
    return `Let's start with ${bit} (demo mode). Quick question: what is one thing you already know about this topic? (Add GEMINI_API_KEY for full AI.)`;
  }
  return 'Hi! Tell me what problem you are working on. What do you think the first step could be? (Demo mode: add GEMINI_API_KEY.)';
}

const SIMPLIFY_SYSTEM = `You help ESL students understand complex English sentences.
Respond with JSON only: { "simpleSentences": string[], "structureNote": string, "chineseSummary": string }
Use short, simple sentences suitable for grade 4–6. structureNote should briefly explain grammar in simple English.`;

/**
 * @param {Buffer} imageBuffer
 * @param {string} mimeType
 * @param {string} [subjectHint]
 * @returns {Promise<object>}
 */
export async function analyzePhoto(imageBuffer, mimeType, subjectHint = '') {
  const client = getOpenAI();
  if (!client) {
    return mockPhotoResult(subjectHint);
  }
  const b64 = imageBuffer.toString('base64');
  const dataUrl = `data:${mimeType};base64,${b64}`;

  const userContent = [
    {
      type: 'text',
      text: `Analyze this student homework or textbook problem photo. Subject hint: ${subjectHint || 'unknown'}.
Extract or reconstruct the question in English, then teach with guided steps.
Output must follow the JSON schema: original question, simplified English version, optional Chinese explanation for parents/students, step-by-step solution in simple English, and key vocabulary with simple English and Chinese hints.`,
    },
    {
      type: 'image_url',
      image_url: { url: dataUrl },
    },
  ];

  const res = await client.chat.completions.create({
    model: process.env.GEMINI_MODEL || 'gemini-2.0-flash',
    messages: [
      {
        role: 'system',
        content:
          'You are an ESL-friendly math/science tutor. Always respond with valid JSON matching the provided schema. Use grade 4–6 English for explanations.',
      },
      { role: 'user', content: userContent },
    ],
    response_format: {
      type: 'json_schema',
      json_schema: {
        name: PHOTO_SCHEMA.name,
        schema: PHOTO_SCHEMA.schema,
        strict: undefined,
      },
    },
    max_completion_tokens: 2000,
  });

  const text = res.choices[0]?.message?.content;
  if (!text) {
    throw new Error('Empty model response');
  }
  return JSON.parse(text);
}

/**
 * @param {string} hint
 */
function mockPhotoResult(hint) {
  return {
    originalQuestion: 'Sample problem (set GEMINI_API_KEY for real analysis)',
    simplifiedEnglish: 'What is 2 + 3?',
    chineseExplanation: '这是演示数据。配置 GEMINI_API_KEY 后可分析真实题目照片。',
    steps: [
      'Start with the first number: 2.',
      'Add the second number: 3.',
      '2 + 3 = 5.',
    ],
    keywords: [
      {
        term: 'add',
        simpleEnglish: 'put numbers together',
        chineseHint: '相加',
      },
    ],
  };
}

/**
 * @param {{ role: string; content: string }[]} messages
 * @param {{ photoAnalysis?: object | null; userIntent?: string | null; learningContext?: object | null }} [options]
 * @returns {Promise<string>}
 */
export async function tutorReply(messages, options = {}) {
  const photoAnalysis =
    options.photoAnalysis != null
      ? sanitizePhotoAnalysisForTutor(options.photoAnalysis)
      : null;
  const userIntent =
    options.userIntent === 'explain_more' || options.userIntent === 'dont_know'
      ? options.userIntent
      : null;
  const learningContext = sanitizeLearningContext(options.learningContext);
  const systemContent = buildTutorSystemContent(
    photoAnalysis,
    userIntent,
    learningContext,
  );

  const client = getOpenAI();
  if (!client) {
    return demoTutorReply(photoAnalysis, userIntent, learningContext);
  }
  const model = process.env.GEMINI_MODEL || 'gemini-2.0-flash';
  let res;
  try {
    res = await client.chat.completions.create({
      model,
      messages: [{ role: 'system', content: systemContent }, ...messages],
      max_completion_tokens: 1024,
    });
  } catch (err) {
    const msg =
      err?.message ||
      (typeof err?.error?.message === 'string' ? err.error.message : String(err));
    throw new Error(msg || 'Gemini request failed');
  }
  const choice = res.choices?.[0];
  const msg = choice?.message;
  const text = assistantMessageText(msg);
  if (text) {
    return text;
  }
  if (msg?.refusal) {
    return String(msg.refusal);
  }
  if (choice?.finish_reason === 'content_filter') {
    throw new Error('Response was filtered. Please try a different message.');
  }
  throw new Error(
    `Empty tutor response (model=${model}, finish_reason=${choice?.finish_reason ?? 'none'})`,
  );
}

/**
 * @param {string} sentence
 * @returns {Promise<{ simpleSentences: string[]; structureNote: string; chineseSummary: string }>}
 */
export async function simplifySentence(sentence) {
  const client = getOpenAI();
  if (!client) {
    return {
      simpleSentences: [sentence],
      structureNote: 'Demo mode: set GEMINI_API_KEY for AI simplification.',
      chineseSummary: '演示模式',
    };
  }
  const res = await client.chat.completions.create({
    model: process.env.GEMINI_MODEL || 'gemini-2.0-flash',
    messages: [
      { role: 'system', content: SIMPLIFY_SYSTEM },
      { role: 'user', content: sentence },
    ],
    response_format: { type: 'json_object' },
    max_completion_tokens: 800,
  });
  const text = res.choices[0]?.message?.content;
  if (!text) {
    throw new Error('Empty simplify response');
  }
  return JSON.parse(text);
}

const READING_CHAT_BASE = `
You are a friendly and patient reading tutor for an ESL middle school student (Grade 7, learning English for about 2 years).

The passage is short and written at grade 3–5 level.

Your goal:
Help the student understand the passage step by step, not test them.

---

Teaching Style:

1. Start EASY
- Begin with a very simple question.
- Focus on ONE sentence or ONE idea first.
- Do NOT start with "main idea".

Good examples:
- "What is this sentence talking about?"
- "What does 'sunlight' mean here?"

---

2. Guide step by step
- Ask ONE question at a time
- Wait for the student's answer
- Use follow-up questions to guide thinking

---

3. If the student struggles

If the student says "I don't know" or gives no answer:

- Encourage them:
  "That's okay 😊 Let's do it together."

- Break the question into something easier
- Give a small hint instead of the full answer

---

4. Language rules

- Use very simple English (grade 4–6)
- Use short sentences
- Avoid complex grammar

- You MAY use a little Chinese ONLY to explain ONE difficult word if needed

Example:
"photosynthesis means using sunlight to make food（光合作用）"

---

5. Stay focused

- Only talk about the passage
- Do not introduce unrelated topics

---

6. Teaching progression

Follow this order naturally:

1) Word meaning (if needed)
2) Sentence understanding
3) Small detail questions
4) Then simple main idea

---

7. Do NOT:

- Do NOT give full answers immediately
- Do NOT ask many questions at once
- Do NOT make it feel like a test

---

Tone:

- Friendly
- Encouraging
- Calm
- Like a helpful teacher, not an examiner
`;

/**
 * @param {{ passageEn: string; passageZh?: string; wordHints: string }} ctx
 * @param {string | null} userIntent
 * @returns {string}
 */
function buildReadingChatSystem(ctx, userIntent) {
  let s = `${READING_CHAT_BASE}

Today's passage (English):
${ctx.passageEn}
${ctx.passageZh ? `\nChinese reference (for you only):\n${ctx.passageZh}\n` : ''}
Words to connect to (definitions for your planning): ${ctx.wordHints}`;
  if (userIntent === 'explain_more') {
    s += `\nThe student asked for more help. Offer a clearer hint or break the question into a tinier step, but still avoid giving a complete model answer in one reply.`;
  }
  if (userIntent === 'dont_know') {
    s += `\nThe student indicated they don't know. Start with warmth, then simplify the question or offer a very small hint.`;
  }
  return s;
}

/**
 * @param {{ role: string; content: string }[]} messages
 * @param {{ passageContext: { passageEn: string; passageZh?: string; wordHints: string }; userIntent?: string | null }} options
 * @returns {Promise<string>}
 */
export async function readingChatReply(messages, options) {
  const ctx = options.passageContext || { passageEn: '', wordHints: '' };
  const userIntent =
    options.userIntent === 'explain_more' || options.userIntent === 'dont_know'
      ? options.userIntent
      : null;
  const systemContent = buildReadingChatSystem(
    {
      passageEn: ctx.passageEn || '',
      passageZh: ctx.passageZh || '',
      wordHints: ctx.wordHints || '',
    },
    userIntent,
  );

  const client = getOpenAI();
  if (!client) {
    if (userIntent === 'dont_know') {
      return "That's okay 😊 Let's try an easier question: pick one word you remember from the passage.";
    }
    if (userIntent === 'explain_more') {
      return 'Here is another way to think about it: what is the first thing the passage talks about? (Demo mode)';
    }
    return 'What is this passage mostly about—in a few simple words? (Demo mode: set GEMINI_API_KEY.)';
  }
  const model = process.env.GEMINI_MODEL || 'gemini-2.0-flash';
  let res;
  try {
    res = await client.chat.completions.create({
      model,
      messages: [{ role: 'system', content: systemContent }, ...messages],
      max_completion_tokens: 700,
    });
  } catch (err) {
    console.error('readingChatReply error details:', JSON.stringify(err?.error || err?.message || err, null, 2));
    const msg =
      err?.message ||
      (typeof err?.error?.message === 'string' ? err.error.message : String(err));
    throw new Error(msg || 'Gemini request failed');
  }
  const choice = res.choices?.[0];
  const msg = choice?.message;
  const text = assistantMessageText(msg);
  if (text) {
    return text;
  }
  if (msg?.refusal) {
    return String(msg.refusal);
  }
  throw new Error('Empty reading chat response');
}

const APP_FEEDBACK_SCHEMA = {
  name: 'reading_application_feedback',
  schema: {
    type: 'object',
    additionalProperties: false,
    required: ['accepted', 'feedback'],
    properties: {
      accepted: { type: 'boolean' },
      feedback: { type: 'string' },
    },
  },
};

/**
 * @param {{ mode: 'blank' | 'sentence'; passageSnippet: string; expectedAnswer?: string; targetWord?: string; userAnswer: string }} payload
 * @returns {Promise<{ accepted: boolean; feedback: string }>}
 */
export async function readingApplicationFeedback(payload) {
  const ans = String(payload.userAnswer || '').trim();
  if (!ans) {
    return { accepted: false, feedback: 'Please write something first.' };
  }

  const client = getOpenAI();
  if (!client) {
    if (payload.mode === 'blank' && payload.expectedAnswer) {
      const ok =
        ans.toLowerCase().replace(/\s+/g, ' ') ===
        String(payload.expectedAnswer).toLowerCase().trim();
      return {
        accepted: ok,
        feedback: ok
          ? 'Nice! That fits the passage. (Demo mode)'
          : 'Not quite—try the word from the lesson about light and plants. (Demo mode)',
      };
    }
    if (payload.mode === 'sentence' && payload.targetWord) {
      const w = payload.targetWord.toLowerCase();
      const ok = ans.toLowerCase().split(/\s+/).some((x) => x.replace(/[^a-z']/gi, '') === w);
      return {
        accepted: ok,
        feedback: ok
          ? 'Good job using the word in a sentence! (Demo mode)'
          : `Try again using the word "${payload.targetWord}" in a full sentence. (Demo mode)`,
      };
    }
    return { accepted: false, feedback: 'Demo mode: could not check this exercise.' };
  }

  const model = process.env.GEMINI_MODEL || 'gemini-2.0-flash';
  const userPrompt =
    payload.mode === 'blank'
      ? `Passage context: ${payload.passageSnippet}\nCorrect blank answer (for grading): ${payload.expectedAnswer}\nStudent wrote: ${ans}\nIs the student's answer acceptable (synonyms, minor spelling OK)? Respond with JSON only.`
      : `Passage context: ${payload.passageSnippet}\nStudent must use this word correctly: ${payload.targetWord}\nStudent sentence: ${ans}\nJudge if the word is used in a reasonable English sentence. Respond with JSON only.`;

  const res = await client.chat.completions.create({
    model,
    messages: [
      {
        role: 'system',
        content:
          'You grade short ESL exercises. Be fair: accept close synonyms for blanks and small grammar slips if meaning is clear. JSON only matching schema.',
      },
      { role: 'user', content: userPrompt },
    ],
    response_format: {
      type: 'json_schema',
      json_schema: {
        name: APP_FEEDBACK_SCHEMA.name,
        schema: APP_FEEDBACK_SCHEMA.schema,
        strict: undefined,
      },
    },
    max_completion_tokens: 400,
  });
  const text = res.choices[0]?.message?.content;
  if (!text) {
    throw new Error('Empty application feedback');
  }
  return JSON.parse(text);
}
