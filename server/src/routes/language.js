import { Router } from 'express';
import { prisma } from '../lib/prisma.js';
import {
  simplifySentence,
  readingChatReply,
  readingApplicationFeedback,
} from '../lib/openaiClient.js';
import { requireUser } from '../middleware/auth.js';
import { getOrCreateTodayMission, VOCAB, updateMissionTask } from '../lib/missionService.js';

export const languageRouter = Router();
languageRouter.use(requireUser);

languageRouter.post('/simplify', async (req, res) => {
  try {
    const sentence = req.body?.sentence;
    if (!sentence || typeof sentence !== 'string' || sentence.trim().length === 0) {
      res.status(400).json({ error: 'sentence_required' });
      return;
    }
    if (sentence.length > 2000) {
      res.status(400).json({ error: 'sentence_too_long' });
      return;
    }

    const result = await simplifySentence(sentence.trim());

    await prisma.learningEvent.create({
      data: {
        userId: req.userId,
        type: 'sentence_simplify',
        payload: JSON.stringify({ inputLength: sentence.length }),
      },
    });

    res.json({ result });
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: 'simplify_failed' });
  }
});

languageRouter.post('/vocab/learn', async (req, res) => {
  try {
    const word = req.body?.word;
    if (!word || typeof word !== 'string') {
      res.status(400).json({ error: 'word_required' });
      return;
    }

    const mission = await getOrCreateTodayMission(req.userId);
    const vocabTask = mission.tasks.find((t) => t.type === VOCAB);
    if (!vocabTask) {
      res.status(404).json({ error: 'vocab_task_not_found' });
      return;
    }

    const updated = await updateMissionTask(vocabTask.id, req.userId, { learnWord: word });

    await prisma.learningEvent.create({
      data: {
        userId: req.userId,
        type: 'word_learned',
        payload: JSON.stringify({ word }),
      },
    });

    res.json({ mission: updated });
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: 'vocab_learn_failed' });
  }
});

languageRouter.post('/reading-chat', async (req, res) => {
  try {
    const messages = req.body?.messages;
    if (!Array.isArray(messages) || messages.length === 0) {
      res.status(400).json({ error: 'messages_required' });
      return;
    }

    const sanitized = messages
      .filter((m) => m && (m.role === 'user' || m.role === 'assistant'))
      .map((m) => ({
        role: m.role,
        content: String(m.content || '').slice(0, 8000),
      }));

    const userTurns = sanitized.filter((m) => m.role === 'user').length;
    if (userTurns === 0) {
      res.status(400).json({ error: 'user_message_required' });
      return;
    }

    const mission = await getOrCreateTodayMission(req.userId);
    const vocabTask = mission.tasks.find((t) => t.type === VOCAB);
    if (!vocabTask) {
      res.status(404).json({ error: 'vocab_task_not_found' });
      return;
    }

    let meta = {};
    try {
      meta = JSON.parse(vocabTask.meta || '{}');
    } catch {
      meta = {};
    }
    if (!meta.passageEn) {
      res.status(400).json({ error: 'reading_passage_not_ready' });
      return;
    }

    const wordHints = (meta.words || [])
      .map((w) => `${w.word}: ${w.simpleEnglish || ''} (${w.zh || ''})`)
      .join('; ');

    const userIntent =
      req.body?.userIntent === 'explain_more' || req.body?.userIntent === 'dont_know'
        ? req.body.userIntent
        : null;

    const reply = await readingChatReply(sanitized, {
      passageContext: {
        passageEn: meta.passageEn,
        passageZh: meta.passageZh || '',
        wordHints,
      },
      userIntent,
    });

    try {
      await updateMissionTask(vocabTask.id, req.userId, {
        readingChatUserTurns: userTurns,
      });
      await prisma.learningEvent.create({
        data: {
          userId: req.userId,
          type: 'reading_chat',
          payload: JSON.stringify({ userTurns }),
        },
      });
    } catch (persistErr) {
      console.error('reading chat persist failed (reply still returned)', persistErr);
    }

    res.json({ reply, userTurns });
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: 'reading_chat_failed', message: String(e?.message || e) });
  }
});

languageRouter.post('/reading-application', async (req, res) => {
  try {
    const mode = req.body?.mode;
    const userAnswer = req.body?.userAnswer;
    if (mode !== 'blank' && mode !== 'sentence') {
      res.status(400).json({ error: 'invalid_mode' });
      return;
    }
    if (userAnswer == null || typeof userAnswer !== 'string' || !userAnswer.trim()) {
      res.status(400).json({ error: 'answer_required' });
      return;
    }

    const mission = await getOrCreateTodayMission(req.userId);
    const vocabTask = mission.tasks.find((t) => t.type === VOCAB);
    if (!vocabTask) {
      res.status(404).json({ error: 'vocab_task_not_found' });
      return;
    }

    let meta = {};
    try {
      meta = JSON.parse(vocabTask.meta || '{}');
    } catch {
      meta = {};
    }
    if (!meta.passageEn) {
      res.status(400).json({ error: 'reading_passage_not_ready' });
      return;
    }

    const snippet = String(meta.passageEn).slice(0, 1200);
    let result;
    if (mode === 'blank') {
      result = await readingApplicationFeedback({
        mode: 'blank',
        passageSnippet: snippet,
        expectedAnswer: meta.blankAnswer,
        userAnswer: userAnswer.trim(),
      });
    } else {
      result = await readingApplicationFeedback({
        mode: 'sentence',
        passageSnippet: snippet,
        targetWord: meta.sentenceWord,
        userAnswer: userAnswer.trim(),
      });
    }

    if (result.accepted) {
      try {
        await updateMissionTask(vocabTask.id, req.userId, { applicationComplete: true });
      } catch (persistErr) {
        console.error('reading application persist failed', persistErr);
      }
    }

    res.json(result);
  } catch (e) {
    console.error(e);
    res.status(500).json({
      error: 'reading_application_failed',
      message: String(e?.message || e),
    });
  }
});
