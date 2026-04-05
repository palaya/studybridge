import { Router } from 'express';
import { prisma } from '../lib/prisma.js';
import { verifyRequestUser } from '../lib/auth.js';

export const analyticsRouter = Router();

analyticsRouter.post('/event', async (req, res) => {
  try {
    const auth = verifyRequestUser(req.headers.authorization);
    const userId = auth?.userId || null;

    const { eventType, props } = req.body || {};
    if (!eventType || typeof eventType !== 'string') {
      res.status(400).json({ error: 'eventType_required' });
      return;
    }

    await prisma.analyticsEvent.create({
      data: {
        userId,
        eventType: eventType.slice(0, 100),
        props: JSON.stringify(props || {}),
      },
    });

    res.json({ ok: true });
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: 'analytics_failed' });
  }
});
