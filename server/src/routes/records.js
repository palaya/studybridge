import { Router } from 'express';
import { prisma } from '../lib/prisma.js';
import { requireUser } from '../middleware/auth.js';

export const recordsRouter = Router();
recordsRouter.use(requireUser);

recordsRouter.get('/summary', async (req, res) => {
  try {
    const userId = req.userId;

    const [user, problemCount, wordCount, sessionCount, recentCheckIns] =
      await Promise.all([
        prisma.user.findUniqueOrThrow({ where: { id: userId } }),
        prisma.learningEvent.count({
          where: { userId, type: 'problem_photo' },
        }),
        prisma.learningEvent.count({
          where: { userId, type: 'word_learned' },
        }),
        prisma.learningEvent.count({
          where: { userId, type: 'tutor_turn' },
        }),
        prisma.checkIn.findMany({
          where: { userId },
          orderBy: { date: 'desc' },
          take: 30,
          select: { date: true, xpAwarded: true },
        }),
      ]);

    res.json({
      user: {
        xp: user.xp,
        streak: user.streak,
        lastCheckInDate: user.lastCheckInDate,
      },
      stats: {
        problems: problemCount,
        words: wordCount,
        tutorSessions: sessionCount,
      },
      recentCheckIns,
    });
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: 'summary_fetch_failed' });
  }
});
