import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import { authRouter } from './routes/auth.js';
import { missionsRouter } from './routes/missions.js';
import { learnRouter } from './routes/learn.js';
import { tutorRouter } from './routes/tutor.js';
import { languageRouter } from './routes/language.js';
import { recordsRouter } from './routes/records.js';
import { analyticsRouter } from './routes/analytics.js';

const app = express();
const PORT = parseInt(process.env.PORT || '4000', 10);

const allowedOrigins = (process.env.CORS_ORIGIN || 'http://localhost:3000')
  .split(',')
  .map(o => o.trim());
app.use(cors({
  origin(origin, cb) {
    if (!origin || allowedOrigins.includes(origin)) return cb(null, true);
    cb(null, false);
  },
}));
app.use(express.json());

app.get('/api/health', (_req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

app.use('/api/auth', authRouter);
app.use('/api/missions', missionsRouter);
app.use('/api/learn', learnRouter);
app.use('/api/tutor', tutorRouter);
app.use('/api/language', languageRouter);
app.use('/api/records', recordsRouter);
app.use('/api/analytics', analyticsRouter);

app.use((_req, res) => {
  res.status(404).json({ error: 'not_found' });
});

app.use((err, _req, res, _next) => {
  console.error('Unhandled error:', err);
  res.status(500).json({ error: 'internal_error' });
});

app.listen(PORT, () => {
  console.log(`StudyBridge server running on http://localhost:${PORT}`);
});
