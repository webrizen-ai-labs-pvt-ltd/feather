import multer from 'multer';
import { badRequest } from '@/utils/http.js';

const ALLOWED = new Set(['image/jpeg', 'image/png', 'image/webp']);

/** One photo in memory (phones compress before upload, so 8 MB is plenty). */
export const photoUpload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 8 * 1024 * 1024, files: 1, fields: 40 },
  fileFilter: (_req, file, cb) =>
    ALLOWED.has(file.mimetype) ? cb(null, true) : cb(badRequest('Only JPG, PNG or WEBP photos are allowed.')),
}).single('photo');
