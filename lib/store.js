// Tiny JSON-file data store with atomic writes and a per-file write queue.
// Good for a single hospital site; swap for SQLite/Postgres if traffic grows.
const fs = require('fs');
const path = require('path');

const DATA_DIR = process.env.DATA_DIR || path.join(__dirname, '..', 'data');
fs.mkdirSync(DATA_DIR, { recursive: true });
fs.mkdirSync(path.join(DATA_DIR, 'history'), { recursive: true });

const cache = new Map();
const queues = new Map();

function file(name) { return path.join(DATA_DIR, `${name}.json`); }

function read(name, fallback) {
  if (cache.has(name)) return cache.get(name);
  let value = fallback;
  try { value = JSON.parse(fs.readFileSync(file(name), 'utf8')); } catch (_) { /* first run */ }
  cache.set(name, value);
  return value;
}

function write(name, value) {
  cache.set(name, value);
  const prev = queues.get(name) || Promise.resolve();
  const next = prev.then(() => new Promise((resolve, reject) => {
    const tmp = `${file(name)}.${process.pid}.tmp`;
    fs.writeFile(tmp, JSON.stringify(value, null, 1), (err) => {
      if (err) return reject(err);
      fs.rename(tmp, file(name), (err2) => (err2 ? reject(err2) : resolve()));
    });
  })).catch((e) => console.error('[store] write failed', name, e));
  queues.set(name, next);
  return next;
}

// Keep the last N versions of content so mistakes can be undone.
function snapshot(name, value, keep = 30) {
  const dir = path.join(DATA_DIR, 'history');
  const stamp = new Date().toISOString().replace(/[:.]/g, '-');
  fs.writeFileSync(path.join(dir, `${name}-${stamp}.json`), JSON.stringify(value));
  const files = fs.readdirSync(dir).filter((f) => f.startsWith(`${name}-`)).sort();
  while (files.length > keep) fs.unlinkSync(path.join(dir, files.shift()));
}

function listHistory(name) {
  const dir = path.join(DATA_DIR, 'history');
  return fs.readdirSync(dir).filter((f) => f.startsWith(`${name}-`)).sort().reverse();
}

function readHistory(fileName) {
  if (!/^[\w.-]+\.json$/.test(fileName)) throw new Error('bad name');
  return JSON.parse(fs.readFileSync(path.join(DATA_DIR, 'history', fileName), 'utf8'));
}

module.exports = { read, write, snapshot, listHistory, readHistory, DATA_DIR };
