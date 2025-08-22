// scripts/loadEnv.cjs
// CommonJS loader for environment variables - runs before ESM/tsx
const fs = require('fs');
const path = require('path');
const dotenv = require('dotenv');

const root = process.cwd(); // expect to run from frontend/
const candidates = [
  path.join(root, '.env.snapshot'), // optional override for cron
  path.join(root, '.env.local'),
  path.join(root, '.env'),
];

let loaded = null;
for (const p of candidates) {
  if (fs.existsSync(p)) {
    dotenv.config({ path: p });
    loaded = p;
    break;
  }
}

const required = ['SUPABASE_URL', 'SUPABASE_SERVICE_ROLE_KEY'];
const missing = required.filter(k => !process.env[k] || String(process.env[k]).trim() === '');
if (missing.length) {
  const msg = [
    'Missing required environment variables:',
    missing.join(', '),
    '',
    `cwd=${root}`,
    `tried=${candidates.join(' | ')}`,
    `loaded=${loaded || 'none'}`
  ].join(' ');
  throw new Error(msg);
}

// Masked log for debugging (uncomment if needed)
// console.log('[env] loaded', path.basename(loaded), 'URL:', !!process.env.SUPABASE_URL, 'ROLE:', !!process.env.SUPABASE_SERVICE_ROLE_KEY);
