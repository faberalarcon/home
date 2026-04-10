import { createHash, scryptSync } from 'node:crypto';

function hashPin(pin) {
  return createHash('sha256').update(`drink-hub-pin:${pin}`).digest('hex');
}

function hashSitePassword(password) {
  return scryptSync(password, 'drink-hub-site-password', 32).toString('hex');
}

const mode = process.argv[2];
const value = process.argv[3];

if (!mode || !value) {
  console.error('Usage: node scripts/hash-secret.mjs <site-password|admin-pin> <value>');
  process.exit(1);
}

if (mode === 'site-password') {
  console.log(hashSitePassword(value));
} else if (mode === 'admin-pin') {
  console.log(hashPin(value));
} else {
  console.error('Unknown mode. Use "site-password" or "admin-pin".');
  process.exit(1);
}
