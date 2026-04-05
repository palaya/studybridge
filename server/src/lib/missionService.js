import { prisma } from './prisma.js';
import { localDateString, daysBetween } from './dateUtils.js';

const MATH = 'math';
const VOCAB = 'vocab';
const TUTOR = 'tutor';

/** @type {object[]} */
const READING_PASSAGES = [
  {
    passageEn: `All living things need energy to grow. Plants get energy from sunlight. Their leaves catch the light and turn it into food. Plants also need water from the soil. Roots drink the water and send it up the stem. Clean air helps plants too. When we care for a small plant, we give it sun, water, and time. Then we can watch it grow taller each week.`,
    passageZh:
      '所有生物都需要能量才能生长。植物从阳光中获得能量。叶子吸收光并把它变成食物。植物还需要土壤里的水。根吸收水分并送到茎里。清新的空气对植物也有帮助。我们照顾小植物时，给它阳光、水和时间，就能每周看到它长高。',
    words: [
      { word: 'sunlight', simpleEnglish: 'light from the sun', zh: '阳光' },
      { word: 'roots', simpleEnglish: 'the parts under the ground that take in water', zh: '根' },
      { word: 'stem', simpleEnglish: 'the main stick-like part of a plant', zh: '茎' },
      { word: 'soil', simpleEnglish: 'the earth where plants grow', zh: '土壤' },
      { word: 'energy', simpleEnglish: 'the power to do things or grow', zh: '能量' },
      { word: 'leaves', simpleEnglish: 'the flat green parts of a plant', zh: '叶子' },
    ],
    blankText: 'Plants get energy from _____. Their leaves use it to make food.',
    blankAnswer: 'sunlight',
    sentenceWord: 'water',
  },
  {
    passageEn: `School mornings can feel busy. Many students eat breakfast at home or at school. A calm breakfast helps your brain wake up. In class, we listen, ask questions, and share ideas. Friends sit together at lunch and talk about their day. Teachers want everyone to feel safe and ready to learn. Small habits, like packing your bag the night before, make the morning easier.`,
    passageZh:
      '上学的早晨常常很忙碌。许多学生在家或在学校吃早餐。平静的早餐帮助大脑清醒。课堂上我们倾听、提问、分享想法。午餐时朋友坐在一起聊这一天。老师希望每个人都感到安全并准备好学习。像前一晚整理书包这样的小习惯能让早晨更轻松。',
    words: [
      { word: 'breakfast', simpleEnglish: 'the first meal of the day', zh: '早餐' },
      { word: 'listen', simpleEnglish: 'pay attention with your ears', zh: '倾听' },
      { word: 'habits', simpleEnglish: 'things you do often without thinking', zh: '习惯' },
      { word: 'ready', simpleEnglish: 'prepared to start', zh: '准备好' },
      { word: 'calm', simpleEnglish: 'quiet and peaceful', zh: '平静的' },
      { word: 'share', simpleEnglish: 'give part of something to others', zh: '分享' },
    ],
    blankText: 'Many students eat _____ at home or at school before class.',
    blankAnswer: 'breakfast',
    sentenceWord: 'listen',
  },
  {
    passageEn: `Weather changes from day to day. Some days are warm and sunny. You might see clouds when rain is near. Wind moves the leaves on trees. In winter, some places get snow. We wear coats when it is cold. Weather reports on the news help families plan trips. Watching the sky can teach you simple clues about what comes next.`,
    passageZh:
      '天气每天都在变化。有些日子温暖晴朗。快要下雨时你可能会看到云。风吹动树上的叶子。冬天有些地方会下雪。天冷时我们穿外套。新闻里的天气预报帮助家庭安排出行。观察天空能教你一些接下来会发生什么的简单线索。',
    words: [
      { word: 'clouds', simpleEnglish: 'white or gray things floating in the sky', zh: '云' },
      { word: 'wind', simpleEnglish: 'moving air that you can feel', zh: '风' },
      { word: 'snow', simpleEnglish: 'soft white ice that falls from the sky', zh: '雪' },
      { word: 'weather', simpleEnglish: 'how hot, cold, wet, or dry it is outside', zh: '天气' },
      { word: 'coats', simpleEnglish: 'warm clothes you wear over other clothes', zh: '外套' },
      { word: 'clues', simpleEnglish: 'hints that help you figure something out', zh: '线索' },
    ],
    blankText: 'When rain is near, you might see _____ in the sky.',
    blankAnswer: 'clouds',
    sentenceWord: 'weather',
  },
];

const DEFAULT_WORD_BANK = [
  { word: 'hypotenuse', zh: '直角三角形的最长边（斜边）' },
  { word: 'numerator', zh: '分数的分子' },
  { word: 'denominator', zh: '分数的分母' },
  { word: 'photosynthesis', zh: '光合作用' },
  { word: 'molecule', zh: '分子' },
  { word: 'density', zh: '密度' },
  { word: 'variable', zh: '变量' },
  { word: 'equation', zh: '方程' },
  { word: 'hypothesis', zh: '假设' },
  { word: 'evidence', zh: '证据' },
];

/**
 * @param {string} date
 * @returns {(typeof READING_PASSAGES)[0]}
 */
export function pickReadingPackage(date) {
  const seed = date.split('-').reduce((a, n) => a + parseInt(n, 10), 0);
  return READING_PASSAGES[seed % READING_PASSAGES.length];
}

/**
 * @param {Record<string, unknown>} meta
 * @returns {boolean}
 */
function readingVocabComplete(meta) {
  if (!meta.passageEn) {
    return false;
  }
  const turns = Number(meta.readingChatUserTurns) || 0;
  const learned = Array.isArray(meta.learnedWordIds) ? meta.learnedWordIds.length : 0;
  return !!(
    meta.passageViewed &&
    turns >= 2 &&
    learned >= 6 &&
    meta.applicationComplete
  );
}

/**
 * @param {object} pkg
 * @returns {string}
 */
function vocabMetaFromReadingPackage(pkg) {
  return JSON.stringify({
    passageEn: pkg.passageEn,
    passageZh: pkg.passageZh,
    words: pkg.words,
    blankText: pkg.blankText,
    blankAnswer: pkg.blankAnswer,
    sentenceWord: pkg.sentenceWord,
    learnedWordIds: [],
    passageViewed: false,
    readingChatUserTurns: 0,
    applicationComplete: false,
  });
}

/**
 * @param {string} json
 * @returns {Record<string, unknown>}
 */
function parseMeta(json) {
  try {
    return JSON.parse(json || '{}');
  } catch {
    return {};
  }
}

/**
 * @param {import('@prisma/client').MissionTask} t
 * @returns {number} 0..1
 */
function taskProgress(t) {
  const meta = parseMeta(t.meta);
  if (t.type === MATH) {
    return t.completed ? 1 : 0;
  }
  if (t.type === VOCAB) {
    if (meta.passageEn) {
      if (t.completed) {
        return 1;
      }
      const viewed = meta.passageViewed ? 1 : 0;
      const turns = Math.min(1, (Number(meta.readingChatUserTurns) || 0) / 2);
      const words = Math.min(1, (Array.isArray(meta.learnedWordIds) ? meta.learnedWordIds.length : 0) / 6);
      const app = meta.applicationComplete ? 1 : 0;
      return (viewed + turns + words + app) / 4;
    }
    const words = /** @type {{ word: string; zh: string }[]} */ (meta.words || []);
    const learned = /** @type {string[]} */ (meta.learnedWordIds || []);
    if (words.length === 0) {
      return t.completed ? 1 : 0;
    }
    const need = Math.ceil(words.length * 0.8);
    const ratio = Math.min(1, learned.length / need);
    return t.completed ? 1 : ratio;
  }
  if (t.type === TUTOR) {
    const turns = typeof meta.turns === 'number' ? meta.turns : 0;
    return t.completed ? 1 : Math.min(1, turns / 3);
  }
  return t.completed ? 1 : 0;
}

/**
 * @param {import('@prisma/client').MissionTask[]} tasks
 * @returns {number}
 */
export function computeMissionCompletionRate(tasks) {
  if (tasks.length === 0) {
    return 0;
  }
  const sum = tasks.reduce((acc, t) => acc + taskProgress(t), 0);
  return sum / tasks.length;
}

/**
 * @param {import('@prisma/client').MissionTask[]} tasks
 * @returns {boolean}
 */
export function allTasksCompleted(tasks) {
  return tasks.length > 0 && tasks.every((t) => t.completed);
}

/**
 * @param {import('@prisma/client').MissionTask[]} tasks
 * @returns {boolean}
 */
export function missionSuccess(tasks) {
  return allTasksCompleted(tasks) || computeMissionCompletionRate(tasks) >= 0.8;
}

/**
 * @param {string} userId
 * @returns {Promise<import('@prisma/client').User>}
 */
async function getUser(userId) {
  const user = await prisma.user.findUnique({ where: { id: userId } });
  if (!user) {
    throw new Error('User not found');
  }
  return user;
}

/**
 * @param {import('@prisma/client').DailyMission & { tasks: import('@prisma/client').MissionTask[] }} mission
 * @param {string} date
 * @returns {Promise<import('@prisma/client').DailyMission & { tasks: import('@prisma/client').MissionTask[] }>}
 */
async function ensureVocabReadingPackage(mission, date) {
  const vocab = mission.tasks.find((t) => t.type === VOCAB);
  if (!vocab) {
    return mission;
  }
  const meta = parseMeta(vocab.meta);
  if (meta.passageEn && Array.isArray(meta.words) && meta.words.length >= 6) {
    return mission;
  }
  const pkg = pickReadingPackage(date);
  await prisma.missionTask.update({
    where: { id: vocab.id },
    data: {
      meta: vocabMetaFromReadingPackage(pkg),
      completed: false,
    },
  });
  return prisma.dailyMission.findUniqueOrThrow({
    where: { id: mission.id },
    include: { tasks: true },
  });
}

/**
 * @param {string} userId
 * @returns {Promise<object>}
 */
export async function getOrCreateTodayMission(userId) {
  const user = await getUser(userId);
  const date = localDateString(user.timezone);

  let mission = await prisma.dailyMission.findUnique({
    where: { userId_date: { userId, date } },
    include: { tasks: true },
  });

  if (!mission) {
    const pkg = pickReadingPackage(date);
    mission = await prisma.dailyMission.create({
      data: {
        userId,
        date,
        tasks: {
          create: [
            { type: MATH, meta: JSON.stringify({}) },
            {
              type: VOCAB,
              meta: vocabMetaFromReadingPackage(pkg),
            },
            { type: TUTOR, meta: JSON.stringify({ turns: 0, sessionId: null }) },
          ],
        },
      },
      include: { tasks: true },
    });
  } else {
    mission = await ensureVocabReadingPackage(mission, date);
  }

  const rate = computeMissionCompletionRate(mission.tasks);
  await prisma.dailyMission.update({
    where: { id: mission.id },
    data: { completionRate: rate },
  });

  return prisma.dailyMission.findUniqueOrThrow({
    where: { id: mission.id },
    include: { tasks: true },
  });
}

/**
 * @param {string} userId
 * @param {string} missionId
 * @returns {Promise<void>}
 */
export async function maybeFinalizeMission(userId, missionId) {
  const mission = await prisma.dailyMission.findFirst({
    where: { id: missionId, userId },
    include: { tasks: true },
  });
  if (!mission) {
    return;
  }

  const rate = computeMissionCompletionRate(mission.tasks);
  const success = missionSuccess(mission.tasks);

  await prisma.dailyMission.update({
    where: { id: mission.id },
    data: {
      completionRate: rate,
      status: success ? 'completed' : 'in_progress',
    },
  });

  if (!success || mission.checkInGranted) {
    return;
  }

  const user = await getUser(userId);
  const today = localDateString(user.timezone);

  await prisma.$transaction(async (tx) => {
    const existing = await tx.checkIn.findUnique({
      where: { userId_date: { userId, date: today } },
    });
    if (existing) {
      await tx.dailyMission.update({
        where: { id: mission.id },
        data: { checkInGranted: true },
      });
      return;
    }

    const xpAward = 50;
    let newStreak = 1;
    if (user.lastCheckInDate) {
      const diff = daysBetween(user.lastCheckInDate, today);
      if (diff === 1) {
        newStreak = user.streak + 1;
      } else if (diff === 0) {
        newStreak = user.streak;
      } else {
        newStreak = 1;
      }
    }

    await tx.checkIn.create({
      data: {
        userId,
        date: today,
        missionId: mission.id,
        xpAwarded: xpAward,
      },
    });

    await tx.user.update({
      where: { id: userId },
      data: {
        xp: user.xp + xpAward,
        streak: newStreak,
        lastCheckInDate: today,
      },
    });

    await tx.dailyMission.update({
      where: { id: mission.id },
      data: { checkInGranted: true },
    });

    await tx.learningEvent.create({
      data: {
        userId,
        type: 'check_in',
        payload: JSON.stringify({ missionId: mission.id, xp: xpAward, streak: newStreak }),
      },
    });
  });
}

/**
 * @param {string} taskId
 * @param {string} userId
 * @param {Record<string, unknown>} [patch]
 * @returns {Promise<object>}
 */
export async function updateMissionTask(taskId, userId, patch = {}) {
  const task = await prisma.missionTask.findFirst({
    where: { id: taskId },
    include: { mission: true },
  });
  if (!task || task.mission.userId !== userId) {
    throw new Error('Task not found');
  }

  const meta = parseMeta(task.meta);
  let completed = task.completed;

  if (task.type === MATH && patch.completeMath) {
    completed = true;
  }
  if (task.type === VOCAB && patch.learnWord) {
    const w = String(patch.learnWord);
    const words = /** @type {{ word: string }[]} */ (meta.words || []);
    const ids = new Set(/** @type {string[]} */ (meta.learnedWordIds || []));
    if (words.some((x) => x.word === w)) {
      ids.add(w);
    }
    meta.learnedWordIds = [...ids];
    if (meta.passageEn) {
      completed = readingVocabComplete(meta);
    } else {
      const need = Math.max(1, Math.ceil(words.length * 0.8));
      if (meta.learnedWordIds.length >= need) {
        completed = true;
      }
    }
  }
  if (task.type === VOCAB && patch.viewPassage) {
    meta.passageViewed = true;
    if (meta.passageEn) {
      completed = readingVocabComplete(meta);
    }
  }
  if (task.type === VOCAB && typeof patch.readingChatUserTurns === 'number') {
    const prev = Number(meta.readingChatUserTurns) || 0;
    meta.readingChatUserTurns = Math.max(prev, patch.readingChatUserTurns);
    if (meta.passageEn) {
      completed = readingVocabComplete(meta);
    }
  }
  if (task.type === VOCAB && patch.applicationComplete) {
    meta.applicationComplete = true;
    if (meta.passageEn) {
      completed = readingVocabComplete(meta);
    }
  }
  if (task.type === TUTOR && typeof patch.turns === 'number') {
    meta.turns = patch.turns;
    if (patch.sessionId) {
      meta.sessionId = patch.sessionId;
    }
    if (meta.turns >= 3) {
      completed = true;
    }
  }

  await prisma.missionTask.update({
    where: { id: taskId },
    data: {
      meta: JSON.stringify(meta),
      completed,
    },
  });

  await maybeFinalizeMission(userId, task.missionId);

  return getOrCreateTodayMission(userId);
}

export { MATH, VOCAB, TUTOR, DEFAULT_WORD_BANK };
