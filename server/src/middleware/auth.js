import { verifyRequestUser } from '../lib/auth.js';

/**
 * @param {import('express').Request} req
 * @param {import('express').Response} res
 * @param {import('express').NextFunction} next
 */
export function requireUser(req, res, next) {
  const auth = verifyRequestUser(req.headers.authorization);
  if (!auth) {
    res.status(401).json({ error: 'Unauthorized' });
    return;
  }
  req.userId = auth.userId;
  next();
}
