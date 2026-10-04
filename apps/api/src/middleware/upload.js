import multer from 'multer';
import { DOCUMENT_MAX_MB, DOCUMENT_TYPES } from '@feather/shared';
import { badRequest } from '@/utils/http.js';

const ALLOWED = new Set(['image/jpeg', 'image/png', 'image/webp']);

/** One photo in memory (phones compress before upload, so 8 MB is plenty). */
export const photoUpload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 8 * 1024 * 1024, files: 1, fields: 40 },
  fileFilter: (_req, file, cb) =>
    ALLOWED.has(file.mimetype) ? cb(null, true) : cb(badRequest('Only JPG, PNG or WEBP photos are allowed.')),
}).single('photo');

/** One document (bill, RR / BL…) in memory: PDF or picture, up to 10 MB. */
export const documentUpload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: DOCUMENT_MAX_MB * 1024 * 1024, files: 1, fields: 10 },
  fileFilter: (_req, file, cb) =>
    DOCUMENT_TYPES.includes(file.mimetype) ? cb(null, true) : cb(badRequest('Only PDF, JPG, PNG or WEBP files are allowed.', { fields: { file: 'Not allowed' } })),
}).single('file');
