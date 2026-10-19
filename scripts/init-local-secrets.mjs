import { randomBytes } from 'node:crypto';
import { mkdirSync, openSync, writeFileSync, closeSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

export function ensureLocalCredentials(file) {
  mkdirSync(dirname(file), { recursive: true, mode: 0o700 });
  let descriptor;
  try {
    descriptor = openSync(file, 'wx', 0o600);
  } catch (error) {
    if (error.code === 'EEXIST') return false;
    throw error;
  }
  try {
    writeFileSync(descriptor, `local_${randomBytes(12).toString('hex')}: ${randomBytes(48).toString('base64url')}\n`);
  } finally {
    closeSync(descriptor);
  }
  return true;
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const file = fileURLToPath(new URL('../secrets/local-keys.yaml', import.meta.url));
  try {
    console.log(ensureLocalCredentials(file)
      ? 'Created protected local-only credentials. No values were displayed.'
      : 'Existing local credentials preserved. No values were read or displayed.');
  } catch {
    console.error('Could not initialize local credentials. Check filesystem access.');
    process.exitCode = 1;
  }
}
