import jwt from 'jsonwebtoken';
import { v4 as uuidv4 } from 'uuid';
import env from '../config/env.js';
import { db } from '../config/firebaseAdmin.js';

const REFRESH_COLLECTION = 'sessions';

export function signAccessToken(payload) {
  return jwt.sign(payload, env.jwtAccessSecret, { expiresIn: env.accessTokenTtl });
}

export function verifyAccessToken(token) {
  return jwt.verify(token, env.jwtAccessSecret);
}

export async function createRefreshSession({ uid, email, provider }) {
  const sessionId = uuidv4();
  const refreshToken = jwt.sign({ uid, sid: sessionId }, env.jwtRefreshSecret, {
    expiresIn: env.refreshTokenTtl,
  });

  await db.collection(REFRESH_COLLECTION).doc(sessionId).set({
    uid,
    email,
    provider,
    isRevoked: false,
    createdAt: new Date().toISOString(),
  });

  return { sessionId, refreshToken };
}

export async function rotateRefreshToken(token) {
  const decoded = jwt.verify(token, env.jwtRefreshSecret);
  const sessionRef = db.collection(REFRESH_COLLECTION).doc(decoded.sid);
  const sessionDoc = await sessionRef.get();

  if (!sessionDoc.exists || sessionDoc.data().isRevoked) {
    throw new Error('Invalid refresh session');
  }

  await sessionRef.update({ isRevoked: true, revokedAt: new Date().toISOString() });

  const { uid } = decoded;
  const email = sessionDoc.data().email || '';
  return createRefreshSession({ uid, email, provider: sessionDoc.data().provider || 'email' });
}

export async function revokeRefreshSession(token) {
  try {
    const decoded = jwt.verify(token, env.jwtRefreshSecret);
    await db.collection(REFRESH_COLLECTION).doc(decoded.sid).update({
      isRevoked: true,
      revokedAt: new Date().toISOString(),
    });
  } catch (_) {
    // no-op
  }
}
