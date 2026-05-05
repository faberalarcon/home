import { scryptSync } from 'node:crypto';

function hashSitePassword(password) {
  return scryptSync(password, 'drink-hub-site-password', 32).toString('hex');
}

const mode = process.argv[2];
const value = process.argv[3];

if (!mode || !value) {
  console.error('Usage: node scripts/hash-secret.mjs site-password <value>');
  process.exit(1);
}

if (mode === 'site-password') {
  console.log(hashSitePassword(value));
} else if (mode === 'admin-pin' || mode === 'admin-password') {
  console.error(
    'Admin credentials are no longer env-hashable. Set ADMIN_PASSWORD (plaintext, ' +
    'read only at first boot) or let the server bootstrap a random temp password, ' +
    'then manage it from /admin/settings.'
  );
  process.exit(1);
} else {
  console.error('Unknown mode. Use "site-password".');
  process.exit(1);
}
