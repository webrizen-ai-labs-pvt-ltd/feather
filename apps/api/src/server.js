import { createApp } from '@/app.js';
import { connectDb } from '@/config/db.js';
import { assertEnv, env } from '@/config/env.js';
import { startJobs } from '@/services/jobs.js';

assertEnv();
await connectDb();

const app = createApp();
app.listen(env.port, () => {
  console.log(`[api] listening on http://localhost:${env.port}`);
  if (!env.smtp.host) console.log('[api] SMTP not set — emails and login codes are printed here.');
  if (env.storage.driver === 'local') console.log('[api] Photos are stored on local disk (development).');
});

startJobs();
