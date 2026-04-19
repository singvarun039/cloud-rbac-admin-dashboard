import { Router } from 'express';
import { ok } from '../utils/apiResponse';

const router = Router();

router.get('/health', (req, res) => {
  return ok(res, req, {
    service: 'backend',
    ts: new Date().toISOString(),
  });
});

export default router;
