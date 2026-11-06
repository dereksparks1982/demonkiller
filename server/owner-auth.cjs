'use strict';

// DK Server: single-owner, loopback-only session bootstrap. The player never
// receives the local administration token or a serialized save file.
const fs = require('node:fs/promises');
const path = require('node:path');
const crypto = require('node:crypto');
const { promisify } = require('node:util');
const scrypt = promisify(crypto.scrypt);
const EXPIRY_MS = 12 * 60 * 60 * 1000;
const COOKIE = 'dk_owner_session';
const ATTEMPT_WINDOW_MS = 60_000;
const MAX_BAD_ATTEMPTS = 5;

function validPassword(value) {
  return typeof value === 'string' && value.length >= 12 && value.length <= 128 && !/[\u0000-\u001f\u007f]/.test(value);
}

async function passwordDigest(password, salt) {
  const buffer = await scrypt(password, salt, 64, { N: 16384, r: 8, p: 1, maxmem: 32 * 1024 * 1024 });
  return Buffer.from(buffer).toString('hex');
}

async function createOwnerAuth(dataDir, atomicWrite, now = () => Date.now()) {
  const file = path.join(dataDir, 'owner-identity.json');
  let identity = null;
  try {
    const loaded = JSON.parse(await fs.readFile(file, 'utf8'));
    if (loaded?.version !== 1 || typeof loaded.salt !== 'string' || !/^[a-f0-9]{32}$/.test(loaded.salt) ||
      typeof loaded.hash !== 'string' || !/^[a-f0-9]{128}$/.test(loaded.hash))
      throw new Error('Unrecognized DK Server owner identity; refusing to overwrite');
    identity = loaded;
  } catch (error) { if (error.code !== 'ENOENT') throw error; }
  const sessions = new Map();
  let setupQueue = Promise.resolve();
  let failed = [];
  function authenticated(req) {
    const cookies = req.headers.cookie || '';
    const token = cookies.split(';').map(x => x.trim()).find(x => x.startsWith(COOKIE + '='))?.slice(COOKIE.length + 1);
    if (!token || !/^[a-f0-9]{64}$/.test(token)) return false;
    const key = crypto.createHash('sha256').update(token).digest('hex');
    const expiry = sessions.get(key);
    if (!expiry) return false;
    if (expiry <= now()) { sessions.delete(key); return false; }
    return true;
  }
  function setSession(res) {
    const token = crypto.randomBytes(32).toString('hex');
    sessions.set(crypto.createHash('sha256').update(token).digest('hex'), now() + EXPIRY_MS);
    res.setHeader('Set-Cookie', COOKIE + '=' + token + '; HttpOnly; SameSite=Strict; Path=/; Max-Age=' + (EXPIRY_MS / 1000));
  }
  function clearSession(req, res) {
    const cookies = req.headers.cookie || '';
    const token = cookies.split(';').map(x => x.trim()).find(x => x.startsWith(COOKIE + '='))?.slice(COOKIE.length + 1);
    if (token) sessions.delete(crypto.createHash('sha256').update(token).digest('hex'));
    res.setHeader('Set-Cookie', COOKIE + '=; HttpOnly; SameSite=Strict; Path=/; Max-Age=0');
  }
  function status(req) { return { setup_required: identity === null, authenticated: authenticated(req) }; }
  async function setup(password, res) {
    if (!validPassword(password)) return { code: 422, body: { error: 'Choose a password of 12 to 128 characters' } };
    const pending = setupQueue.then(async () => {
      if (identity) return { code: 409, body: { error: 'DK Server owner was already configured' } };
      const salt = crypto.randomBytes(16).toString('hex');
      const hash = await passwordDigest(password, salt);
      const candidate = { version: 1, salt, hash };
      // First owner wins. An already-initialized world cannot be claimed twice.
      await atomicWrite(file, JSON.stringify(candidate) + '\n', { create: true });
      const existing = JSON.parse(await fs.readFile(file, 'utf8'));
      if (existing.hash !== hash || existing.salt !== salt) {
        identity = existing;
        return { code: 409, body: { error: 'DK Server owner was already configured' } };
      }
      identity = candidate;
      setSession(res);
      return { code: 201, body: status({ headers: { cookie: res.getHeader('Set-Cookie').split(';')[0] } }) };
    });
    setupQueue = pending.catch(() => {});
    return pending;
  }
  async function login(password, res) {
    if (!identity) return { code: 409, body: { error: 'Set up DK Server first' } };
    failed = failed.filter(time => time > now() - ATTEMPT_WINDOW_MS);
    if (failed.length >= MAX_BAD_ATTEMPTS) return { code: 429, body: { error: 'Too many attempts. Wait a minute.' } };
    if (typeof password !== 'string' || password.length > 128) return { code: 401, body: { error: 'Invalid password' } };
    const hash = await passwordDigest(password, identity.salt);
    if (!crypto.timingSafeEqual(Buffer.from(hash, 'hex'), Buffer.from(identity.hash, 'hex'))) {
      failed.push(now());
      return { code: 401, body: { error: 'Invalid password' } };
    }
    failed = [];
    setSession(res);
    return { code: 200, body: { authenticated: true, setup_required: false } };
  }
  return { status, authenticated, setup, login, clearSession };
}

module.exports = { createOwnerAuth };
