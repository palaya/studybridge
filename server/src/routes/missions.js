import { Router } from 'express';
import { prisma } from '../lib/prisma.js';
import {
  getOrCreateTodayMission,
  updateMissionTask,
  computeMissionCompletionRate,
  missionSuccess,
  allTasksCompleted,
} from '../lib/missionService.js';
import { requireUser } from '../middleware/auth.js';

export const missionsRouter = Router();
missionsRouter.use(requireUser);

missionsRouter.get('/today', async (req, res) => {
  try {
    const mission = await getOrCreateTodayMission(req.userId);
    const user = await prisma.user.findUniqueOrThrow({ where: { id: req.userId } });
    res.json(formatMissionResponse(mission, user));
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: 'mission_fetch_failed' });
  }
});

/**
 * @param {object} mission
 * @param {object} user
 */
/**
 * @param {string} type
 * @param {string} metaJson
 * @returns {object}
 */
function metaForClient(type, metaJson) {
  const m = safeJson(metaJson);
  if (type === 'vocab' && m.blankAnswer != null) {
    const rest = { ...m };
    delete rest.blankAnswer;
    return rest;
  }
  return m;
}

function formatMissionResponse(mission, user) {
  const tasks = mission.tasks.map((t) => ({
    id: t.id,
    type: t.type,
    completed: t.completed,
    meta: metaForClient(t.type, t.meta),
  }));
  const rate = computeMissionCompletionRate(mission.tasks);
  const success = missionSuccess(mission.tasks);
  const allDone = allTasksCompleted(mission.tasks);
  return {
    mission: {
      id: mission.id,
      date: mission.date,
      status: mission.status,
      completionRate: rate,
      checkInGranted: mission.checkInGranted,
      tasks,
    },
    user: {
      xp: user.xp,
      streak: user.streak,
      lastCheckInDate: user.lastCheckInDate,
    },
    rules: {
      missionComplete: success,
      allTasksCompleted: allDone,
      completionRateAtLeast80: rate >= 0.8,
    },
  };
}

function safeJson(s) {
  try {
    return JSON.parse(s || '{}');
  } catch {
    return {};
  }
}

missionsRouter.post('/tasks/:taskId/complete', async (req, res) => {
  try {
    const { taskId } = req.params;
    const body = req.body || {};
    const updated = await updateMissionTask(taskId, req.userId, {
      completeMath: Boolean(body.completeMath),
      learnWord: body.learnWord,
      turns: typeof body.turns === 'number' ? body.turns : undefined,
      sessionId: body.sessionId,
      viewPassage: Boolean(body.viewPassage),
    });
    const user = await prisma.user.findUniqueOrThrow({ where: { id: req.userId } });
    res.json(formatMissionResponse(updated, user));
  } catch (e) {
    if (e instanceof Error && e.message === 'Task not found') {
      res.status(404).json({ error: 'task_not_found' });
      return;
    }
    console.error(e);
    res.status(500).json({ error: 'task_update_failed' });
  }
});
