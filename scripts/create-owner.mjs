#!/usr/bin/env node
// Creates (or resets) an owner login. There is no public sign-up; this is how the first
// owner gets in. After that, owners invite everyone else from the admin's Team screen.
//
//   npm run create-owner -- --email owner@example.com --name "Jane Doe" [--remote]
//
// The password is asked for interactively and never written to disk or shell history.

import { execFileSync } from 'node:child_process';
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { hashPassword, validateNewPassword } from '../apps/admin/functions/lib/auth.js';

const args = process.argv.slice(2);
const arg = (name) => {
  const i = args.indexOf(`--${name}`);
  return i >= 0 ? args[i + 1] : undefined;
};
const email = (arg('email') || '').trim().toLowerCase();
const name = arg('name') || '';
const remote = args.includes('--remote');

if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
  console.error('Usage: npm run create-owner -- --email you@example.com --name "Your Name" [--remote]');
  process.exit(1);
}

// Reads a line without echoing it. Uses raw mode so it works the same in Windows
// PowerShell/cmd, macOS and Linux terminals.
function askPassword(prompt) {
  if (process.env.OWNER_PASSWORD) return Promise.resolve(process.env.OWNER_PASSWORD); // scripted local setup only
  return new Promise((resolve, reject) => {
    const stdin = process.stdin;
    process.stdout.write(`${prompt}(typing is hidden) `);
    if (!stdin.isTTY) {
      // Piped input: read the first line.
      let buf = '';
      stdin.setEncoding('utf8');
      stdin.on('data', (d) => (buf += d));
      stdin.on('end', () => resolve(buf.split(/\r?\n/)[0]));
      return;
    }
    let value = '';
    stdin.setRawMode(true);
    stdin.setEncoding('utf8');
    stdin.resume();
    const done = (err) => {
      stdin.setRawMode(false);
      stdin.pause();
      stdin.removeListener('data', onData);
      process.stdout.write('\n');
      err ? reject(err) : resolve(value);
    };
    const onData = (chunk) => {
      for (const ch of chunk) {
        if (ch === '\r' || ch === '\n') return done();
        if (ch === '\u0003') return done(new Error('Cancelled.')); // Ctrl+C
        if (ch === '\u0008' || ch === '\u007f') value = value.slice(0, -1); // Backspace
        else if (ch >= ' ') value += ch;
      }
    };
    stdin.on('data', onData);
  });
}

const password = await askPassword('Password (min 10 characters): ');
const problem = validateNewPassword(password);
if (problem) {
  console.error(problem);
  process.exit(1);
}

const hash = await hashPassword(password);
const q = (s) => `'${String(s).replace(/'/g, "''")}'`;
const sql = `INSERT INTO users (email, name, role, password_hash) VALUES (${q(email)}, ${q(name)}, 'owner', ${q(hash)})
ON CONFLICT(email) DO UPDATE SET role = 'owner', name = excluded.name, password_hash = excluded.password_hash, updated_at = datetime('now');`;

const adminDir = fileURLToPath(new URL('../apps/admin/', import.meta.url));
const flags = remote ? ['--remote'] : ['--local', '--persist-to', '../../.wrangler/state'];
// SQL goes through a temp file (not the command line) so Windows shells can't mangle the hash.
const dir = mkdtempSync(join(tmpdir(), '5r-owner-'));
const sqlFile = join(dir, 'owner.sql');
writeFileSync(sqlFile, sql);
try {
  execFileSync('npx', ['wrangler', 'd1', 'execute', '5rsuites', ...flags, `--file=${sqlFile}`], {
    cwd: adminDir,
    stdio: 'inherit',
    shell: process.platform === 'win32', // npx is npx.cmd on Windows
  });
} finally {
  rmSync(dir, { recursive: true, force: true });
}
console.log(`\nOwner ${email} is ready (${remote ? 'production' : 'local'} database).`);
