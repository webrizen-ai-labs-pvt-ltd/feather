import multer from 'multer';
import { env } from '@/config/env.js';

export function notFoundHandler(req, res) {
  res.status(404).json({ error: { message: `No route for ${req.method} ${req.path}` } });
}

// eslint-disable-next-line no-unused-vars
export function errorHandler(err, req, res, _next) {
  if (err instanceof multer.MulterError) {
    const message = err.code === 'LIMIT_FILE_SIZE' ? 'Photo is too large. Max 8 MB.' : 'Could not read the upload.';
    return res.status(400).json({ error: { message, code: 'UPLOAD' } });
  }
  if (err?.code === 11000) {
    const field = Object.keys(err.keyPattern ?? {})[0] ?? 'value';
    return res.status(409).json({ error: { message: `This ${field} already exists.`, code: 'DUPLICATE', fields: { [field]: 'Already exists' } } });
  }
  if (err?.name === 'CastError') {
    return res.status(400).json({ error: { message: 'Invalid id.', code: 'BAD_ID' } });
  }
  if (err instanceof RangeError) {
    return res.status(400).json({ error: { message: err.message, code: 'VALIDATION' } });
  }
  const status = err.status ?? 500;
  if (status >= 500) console.error(`[error] ${req.method} ${req.originalUrl}`, err);
  res.status(status).json({
    error: {
      message: status >= 500 && env.isProd ? 'Something went wrong. Please try again.' : err.message,
      code: err.code,
      fields: err.fields,
      data: err.data,
    },
  });
}
