import express from 'express';
import { db } from '../config/firebaseAdmin.js';
import { requireAuth } from '../middleware/auth.middleware.js';

const router = express.Router();

// ── In-memory cache (5 min TTL) to handle concurrent faculty loads without hammering Firestore ──
let _cache = null;
let _cacheExpiry = 0;
const CACHE_TTL_MS = 5 * 60 * 1000; // 5 minutes

router.get('/', requireAuth, async (req, res) => {
  try {
    // Serve from cache if still fresh
    if (_cache && Date.now() < _cacheExpiry) {
      res.set('X-Cache', 'HIT');
      return res.json({ data: _cache });
    }

    let snap = await db.collection('faculty').get();
    if (snap.empty) {
      snap = await db.collection('faculties').get();
    }
    const data = snap.docs.map((doc) => ({ id: doc.id, ...doc.data() }));

    // Update cache
    _cache = data;
    _cacheExpiry = Date.now() + CACHE_TTL_MS;
    res.set('X-Cache', 'MISS');
    return res.json({ data });
  } catch (error) {
    return res.status(500).json({ message: error.message || 'Failed to load faculty data' });
  }
});

export default router;
