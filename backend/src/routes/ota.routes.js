import { Router } from 'express';
import fs from 'fs';
import path from 'path';

const router = Router();

router.get('/check', (req, res) => {
  try {
    const updatesPath = path.join(process.cwd(), 'updates', 'updates.json');
    if (!fs.existsSync(updatesPath)) {
      return res.status(404).json({ message: 'No updates found' });
    }

    const updatesData = JSON.parse(fs.readFileSync(updatesPath, 'utf8'));
    res.json(updatesData);
  } catch (error) {
    console.error('OTA Check error:', error);
    res.status(500).json({ message: 'Server error checking OTA updates' });
  }
});

export default router;
