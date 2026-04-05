import jwt from 'jsonwebtoken';

const JWT_SECRET = process.env.JWT_SECRET || 'dev-secret-change-me';

/**
 * @param {{ sub: string }} payload
 * @returns {string}
 */
export function signToken(payload) {
  return jwt.sign(payload, JWT_SECRET, { expiresIn: '365d' });
}

/**
 * @param {string | undefined} header
 * @returns {{ userId: string } | null}
 */
export function verifyRequestUser(header) {
  if (!header || !header.startsWith('Bearer ')) {
    return null;
  }
  const token = header.slice(7);
  try {
    const decoded = jwt.verify(token, JWT_SECRET);
    if (typeof decoded === 'object' && decoded && 'sub' in decoded) {
      return { userId: /** @type {string} */ (decoded.sub) };
    }
  } catch {
    return null;
  }
  return null;
}
