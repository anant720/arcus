import { verifyAccessToken } from '../services/session.service.js';

export function requireAuth(req, res, next) {
  const header = req.headers.authorization || '';
  const token = header.startsWith('Bearer ') ? header.slice(7) : null;

  if (!token) {
    return res.status(401).json({ message: 'Unauthorized: missing access token' });
  }

  try {
    const payload = verifyAccessToken(token);
    req.user = { uid: payload.uid, email: payload.email, role: payload.role || 'student' };
    return next();
  } catch (error) {
    return res.status(401).json({ message: 'Unauthorized: invalid access token' });
  }
}
