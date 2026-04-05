import { Router } from 'express';
import { prisma } from '../lib/prisma.js';
import { tutorReply } from '../lib/openaiClient.js';
import { requireUser } from '../middleware/auth.js';
import { getOrCreateTodayMission, TUTOR, updateMissionTask } from '../lib/missionService.js';

const ALLOWED_TUTOR_INTENTS = new Set(['explain_more', 'dont_know']);

export const tutorRouter = Router();
tutorRouter.use(requireUser);

tutorRouter.post('/messages', async (req, res) => {
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

    let photoAnalysis = null;
    const pa = req.body?.photoAnalysis;
    if (pa != null && typeof pa === 'object' && !Array.isArray(pa)) {
      photoAnalysis = pa;
    }

    let userIntent = null;
    if (typeof req.body?.userIntent === 'string' && ALLOWED_TUTOR_INTENTS.has(req.body.userIntent)) {
      userIntent = req.body.userIntent;
    }

    let learningContext = null;
    const lc = req.body?.learningContext;
    if (lc != null && typeof lc === 'object' && !Array.isArray(lc)) {
      learningContext = lc;
    }

    const text = await tutorReply(sanitized, {
      photoAnalysis,
      userIntent,
      learningContext,
    });

    try {
      const mission = await getOrCreateTodayMission(req.userId);
      const tutorTask = mission.tasks.find((t) => t.type === TUTOR);
      if (tutorTask) {
        let meta = {};
        try {
          meta = JSON.parse(tutorTask.meta || '{}');
        } catch {
          meta = {};
        }
        const prev = typeof meta.turns === 'number' ? meta.turns : 0;
        const newTurns = Math.max(prev, userTurns);
        await updateMissionTask(tutorTask.id, req.userId, {
          turns: newTurns,
          sessionId: meta.sessionId || tutorTask.id,
        });
      }

      await prisma.learningEvent.create({
        data: {
          userId: req.userId,
          type: 'tutor_turn',
          payload: JSON.stringify({ userTurns }),
        },
      });

      await prisma.analyticsEvent.create({
        data: {
          userId: req.userId,
          eventType: 'tutor_message',
          props: JSON.stringify({ userTurns }),
        },
      });
    } catch (persistErr) {
      console.error('tutor persist failed (reply still returned)', persistErr);
    }

    res.json({ reply: text, userTurns });
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: 'tutor_failed', message: String(e?.message || e) });
  }
});
