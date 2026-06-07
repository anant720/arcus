import express from 'express';
import { db } from '../config/firebaseAdmin.js';
import { requireAuth } from '../middleware/auth.middleware.js';

const router = express.Router();

router.get('/', requireAuth, async (req, res) => {
  try {
    const snap = await db.collection('tasks').doc(req.user.uid).collection('items').get();
    const data = snap.docs.map((doc) => ({ id: doc.id, ...doc.data() }));
    return res.json({ data });
  } catch (error) {
    return res.status(500).json({ message: error.message || 'Failed to load tasks' });
  }
});

router.post('/', requireAuth, async (req, res) => {
  try {
    const { title, subject = '', priority = 'medium', dueDate = null, notes = '' } = req.body;
    if (!title || !String(title).trim()) return res.status(400).json({ message: 'title is required' });

    // ─ Input validation ─
    const VALID_PRIORITIES = ['low', 'medium', 'high'];
    const safeTitle   = String(title).trim().slice(0, 120);
    const safeSubject = String(subject).trim().slice(0, 80);
    const safeNotes   = String(notes).trim().slice(0, 1000);
    const safePriority = VALID_PRIORITIES.includes(priority) ? priority : 'medium';
    const safeDueDate  = dueDate ? new Date(dueDate) : null;
    if (safeDueDate && isNaN(safeDueDate.getTime())) {
      return res.status(400).json({ message: 'Invalid dueDate format.' });
    }

    const created = await db.collection('tasks').doc(req.user.uid).collection('items').add({
      title: safeTitle,
      subject: safeSubject,
      priority: safePriority,
      dueDate: safeDueDate,
      notes: safeNotes,
      isCompleted: false,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    });
    const snap = await created.get();
    return res.status(201).json({ data: { id: snap.id, ...snap.data() } });
  } catch (error) {
    return res.status(500).json({ message: error.message || 'Failed to create task' });
  }
});

router.patch('/:taskId', requireAuth, async (req, res) => {
  try {
    // ─ SECURITY: Whitelist allowed fields — prevent mass assignment ─
    const ALLOWED = ['title', 'subject', 'priority', 'dueDate', 'notes', 'isCompleted'];
    const VALID_PRIORITIES = ['low', 'medium', 'high'];
    const payload = {};
    for (const field of ALLOWED) {
      if (Object.prototype.hasOwnProperty.call(req.body, field)) {
        payload[field] = req.body[field];
      }
    }
    if (!Object.keys(payload).length) {
      return res.status(400).json({ message: 'No valid fields to update.' });
    }
    // Sanitize each field
    if (payload.title)    payload.title    = String(payload.title).trim().slice(0, 120);
    if (payload.subject)  payload.subject  = String(payload.subject).trim().slice(0, 80);
    if (payload.notes)    payload.notes    = String(payload.notes).trim().slice(0, 1000);
    if (payload.priority && !VALID_PRIORITIES.includes(payload.priority)) {
      return res.status(400).json({ message: `priority must be one of: ${VALID_PRIORITIES.join(', ')}` });
    }
    if (payload.dueDate) {
      const d = new Date(payload.dueDate);
      if (isNaN(d.getTime())) return res.status(400).json({ message: 'Invalid dueDate format.' });
      payload.dueDate = d;
    }
    if (typeof payload.isCompleted !== 'undefined') {
      payload.isCompleted = Boolean(payload.isCompleted);
    }
    payload.updatedAt = new Date().toISOString();

    const ref = db.collection('tasks').doc(req.user.uid).collection('items').doc(req.params.taskId);
    // Verify task exists and belongs to this user before updating
    const existing = await ref.get();
    if (!existing.exists) {
      return res.status(404).json({ message: 'Task not found.' });
    }
    await ref.set(payload, { merge: true });
    const snap = await ref.get();
    return res.json({ data: { id: snap.id, ...snap.data() } });
  } catch (error) {
    return res.status(500).json({ message: error.message || 'Failed to update task' });
  }
});

router.delete('/:taskId', requireAuth, async (req, res) => {
  try {
    await db.collection('tasks').doc(req.user.uid).collection('items').doc(req.params.taskId).delete();
    return res.json({ message: 'Task deleted' });
  } catch (error) {
    return res.status(500).json({ message: error.message || 'Failed to delete task' });
  }
});

export default router;
