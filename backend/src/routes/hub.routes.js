import express from 'express';
import { db } from '../config/firebaseAdmin.js';
import { requireAuth } from '../middleware/auth.middleware.js';

const router = express.Router();

router.get('/announcements', requireAuth, async (_req, res) => {
  try {
    const snap = await db.collection('announcements').where('isActive', '==', true).get();
    const data = snap.docs.map((doc) => ({ id: doc.id, ...doc.data() }));
    return res.json({ data });
  } catch (error) {
    return res.status(500).json({ message: error.message || 'Failed to load announcements' });
  }
});

router.get('/events', requireAuth, async (_req, res) => {
  try {
    const snap = await db.collection('events').where('isActive', '==', true).get();
    const data = snap.docs.map((doc) => ({ id: doc.id, ...doc.data() }));
    return res.json({ data });
  } catch (error) {
    return res.status(500).json({ message: error.message || 'Failed to load events' });
  }
});

export default router;
