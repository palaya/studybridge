import { Router } from 'express';
import multer from 'multer';
import { prisma } from '../lib/prisma.js';
import { analyzePhoto } from '../lib/openaiClient.js';
import { requireUser } from '../middleware/auth.js';
import { getOrCreateTodayMission, MATH, updateMissionTask } from '../lib/missionService.js';

export const learnRouter = Router();
learnRouter.use(requireUser);

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 8 * 1024 * 1024 },
});

learnRouter.post('/photo', upload.single('image'), async (req, res) => {
  try {
    if (!req.file?.buffer) {
      res.status(400).json({ error: 'image_required' });
      return;
    }
    const mime = req.file.mimetype || 'image/jpeg';
    const subjectHint = typeof req.body?.subject === 'string' ? req.body.subject : '';

    const result = await analyzePhoto(req.file.buffer, mime, subjectHint);

    await prisma.learningEvent.create({
      data: {
        userId: req.userId,
        type: 'problem_photo',
        payload: JSON.stringify({ subjectHint, hasKeywords: (result.keywords || []).length }),
      },
    });

    const mission = await getOrCreateTodayMission(req.userId);
    const mathTask = mission.tasks.find((t) => t.type === MATH);
    if (mathTask) {
      await updateMissionTask(mathTask.id, req.userId, { completeMath: true });
    }

    res.json({ result });
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: 'photo_analyze_failed', message: String(e?.message || e) });
  }
});
