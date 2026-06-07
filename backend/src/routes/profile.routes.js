import express from 'express';
import { db } from '../config/firebaseAdmin.js';
import { requireAuth } from '../middleware/auth.middleware.js';

const router = express.Router();

router.get('/me', requireAuth, async (req, res) => {
  try {
    const snap = await db.collection('users').doc(req.user.uid).get();
    if (!snap.exists) return res.status(404).json({ message: 'Profile not found' });
    return res.json({ data: snap.data() });
  } catch (error) {
    return res.status(500).json({ message: error.message || 'Failed to load profile' });
  }
});

router.patch('/me', requireAuth, async (req, res) => {
  try {
    const allowedFields = ['displayName', 'department', 'course', 'year', 'enrollment', 'roll', 'theme', 'language'];
    const VALID_THEMES = ['light', 'dark'];
    const VALID_LANGUAGES = ['en', 'hi', 'mr'];
    const payload = {};
    for (const field of allowedFields) {
      if (Object.prototype.hasOwnProperty.call(req.body, field)) {
        payload[field] = req.body[field];
      }
    }

    // ─ Sanitize each field ─
    if (payload.displayName !== undefined)
      payload.displayName = String(payload.displayName).trim().slice(0, 80);
    if (payload.department !== undefined)
      payload.department  = String(payload.department).trim().slice(0, 80);
    if (payload.course !== undefined)
      payload.course      = String(payload.course).trim().slice(0, 80);
    if (payload.roll !== undefined)
      payload.roll        = String(payload.roll).trim().slice(0, 30);
    if (payload.enrollment !== undefined)
      payload.enrollment  = String(payload.enrollment).trim().slice(0, 20);
    if (payload.year !== undefined) {
      const yr = Number(payload.year);
      if (!Number.isInteger(yr) || yr < 1 || yr > 6)
        return res.status(400).json({ message: 'year must be an integer between 1 and 6.' });
      payload.year = yr;
    }
    if (payload.theme !== undefined && !VALID_THEMES.includes(payload.theme))
      return res.status(400).json({ message: `theme must be one of: ${VALID_THEMES.join(', ')}` });
    if (payload.language !== undefined && !VALID_LANGUAGES.includes(payload.language))
      return res.status(400).json({ message: `language must be one of: ${VALID_LANGUAGES.join(', ')}` });

    if (payload.enrollment) {
      const existing = await db.collection('users').where('enrollment', '==', payload.enrollment).limit(2).get();
      const duplicate = existing.docs.find(d => d.id !== req.user.uid);
      if (duplicate) {
        return res.status(400).json({ message: 'Enrollment number is already in use by another account.' });
      }
    }
    payload.updatedAt = new Date().toISOString();
    await db.collection('users').doc(req.user.uid).set(payload, { merge: true });
    const updated = await db.collection('users').doc(req.user.uid).get();
    return res.json({ data: updated.data() });
  } catch (error) {
    return res.status(500).json({ message: error.message || 'Failed to update profile' });
  }
});

export default router;
