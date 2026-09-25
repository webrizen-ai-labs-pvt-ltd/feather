import { Router } from 'express';
import { verifyLocalLink } from '@/services/storage.js';
import { HttpError } from '@/utils/http.js';

/** Serves development photos from local disk via signed, expiring links. */
const router = Router();

router.get('/local/*key', (req, res) => {
  const key = [].concat(req.params.key).join('/');
  const file = verifyLocalLink(key, req.query.exp, req.query.sig);
  if (!file) throw new HttpError(403, 'Photo link has expired. Refresh the page.');
  res.set('Cache-Control', 'private, max-age=3600');
  res.sendFile(file);
});

export default router;
