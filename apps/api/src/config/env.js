const list = (v) => (v ? v.split(',').map((s) => s.trim()).filter(Boolean) : []);

const isProd = process.env.NODE_ENV === 'production';

export const env = Object.freeze({
  isProd,
  port: Number(process.env.PORT || 4000),
  mongoUri: process.env.MONGODB_URI || 'mongodb://127.0.0.1:27017/feather',
  jwtSecret: process.env.JWT_SECRET || '',
  jwtExpiresIn: process.env.JWT_EXPIRES_IN || '7d',
  ownerName: process.env.OWNER_NAME || 'Owner',
  ownerEmail: process.env.OWNER_EMAIL || '',
  corsOrigins: list(process.env.CORS_ORIGINS),
  smtp: {
    host: process.env.SMTP_HOST || '',
    port: Number(process.env.SMTP_PORT || 587),
    secure: process.env.SMTP_SECURE === 'true',
    user: process.env.SMTP_USER || '',
    pass: process.env.SMTP_PASS || '',
    from: process.env.MAIL_FROM || 'Feather <no-reply@localhost>',
  },
  storage: {
    driver: process.env.STORAGE_DRIVER || 'r2',
    r2AccountId: process.env.R2_ACCOUNT_ID || '',
    r2AccessKeyId: process.env.R2_ACCESS_KEY_ID || '',
    r2SecretAccessKey: process.env.R2_SECRET_ACCESS_KEY || '',
    r2Bucket: process.env.R2_BUCKET || '',
    fileUrlSecret: process.env.FILE_URL_SECRET || process.env.JWT_SECRET || '',
  },
});

export function assertEnv() {
  const missing = [];
  if (!env.jwtSecret || env.jwtSecret === 'change-me') missing.push('JWT_SECRET');
  if (env.storage.driver === 'r2') {
    for (const [k, v] of Object.entries({
      R2_ACCOUNT_ID: env.storage.r2AccountId,
      R2_ACCESS_KEY_ID: env.storage.r2AccessKeyId,
      R2_SECRET_ACCESS_KEY: env.storage.r2SecretAccessKey,
      R2_BUCKET: env.storage.r2Bucket,
    })) if (!v) missing.push(k);
  }
  if (isProd && env.storage.driver === 'local') missing.push('STORAGE_DRIVER=r2 (local storage is for development only)');
  if (isProd && !env.smtp.host) missing.push('SMTP_HOST');
  if (missing.length) {
    throw new Error(`Missing or unsafe configuration: ${missing.join(', ')}. See apps/api/.env.example`);
  }
}
