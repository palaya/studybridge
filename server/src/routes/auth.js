import { Router } from 'express';
import { v4 as uuidv4 } from 'uuid';
import { prisma } from '../lib/prisma.js';
import { signToken } from '../lib/auth.js';

export const authRouter = Router();

authRouter.post('/register-anonymous', async (req, res) => {
  try {
    const timezone =
      typeof req.body?.timezone === 'string' ? req.body.timezone : 'America/Los_Angeles';
    const deviceId = typeof req.body?.deviceId === 'string' ? req.body.deviceId : uuidv4();

    let user = await prisma.user.findUnique({ where: { deviceId } });
    if (!user) {
      user = await prisma.user.create({
        data: { deviceId, timezone },
      });
    } else if (user.timezone !== timezone) {
      user = await prisma.user.update({
        where: { id: user.id },
        data: { timezone },
      });
    }

    const token = signToken({ sub: user.id });
    res.json({ token, user: { id: user.id, timezone: user.timezone, xp: user.xp, streak: user.streak } });
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: 'register_failed' });
  }
});

authRouter.post('/login', async (req, res) => {
  try {
    const deviceId = req.body?.deviceId;
    if (!deviceId || typeof deviceId !== 'string') {
      res.status(400).json({ error: 'deviceId_required' });
      return;
    }
    const user = await prisma.user.findUnique({ where: { deviceId } });
    if (!user) {
      res.status(404).json({ error: 'not_found' });
      return;
    }
    const token = signToken({ sub: user.id });
    res.json({ token, user: { id: user.id, timezone: user.timezone, xp: user.xp, streak: user.streak } });
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: 'login_failed' });
  }
});
