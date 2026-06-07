import express from 'express';

const router = express.Router();

router.get('/', (_req, res) => {
  res.json({
    status: 'ok',
    service: 'mit-adt-student-hub-backend',
    time: new Date().toISOString(),
  });
});

export default router;
