/* eslint-disable no-console */

// Watch policy folders for new PDFs/TXTs.
// - Converts PDFs to TXT using `pdftotext`
// - Normalizes raw TXT files via normalize-policies.js
// Usage:
//   node scripts/watch-policies.js
//   POLICY_SOURCE_DIR=./data/policies node scripts/watch-policies.js

const fs = require('fs');
const path = require('path');
const { spawn } = require('child_process');

const POLICY_DIR =
  process.env.POLICY_SOURCE_DIR || path.join(process.cwd(), 'data', 'policies');
const DEBOUNCE_MS = parseInt(process.env.POLICY_WATCH_DEBOUNCE_MS || '800', 10);
const POLL_INTERVAL_MS = parseInt(process.env.POLICY_WATCH_POLL_MS || '30000', 10);

let queue = Promise.resolve();
const pending = new Map();

function isPdf(filePath) {
  return filePath.toLowerCase().endsWith('.pdf');
}

function isTxt(filePath) {
  return filePath.toLowerCase().endsWith('.txt');
}

function isNormalizedTxt(filePath) {
  return filePath.toLowerCase().endsWith('.normalized.txt');
}

function enqueue(task) {
  queue = queue.then(task).catch((err) => {
    console.error('Watcher task failed:', err);
  });
  return queue;
}

function runPdftotext(pdfPath, txtPath) {
  return new Promise((resolve) => {
    const proc = spawn('pdftotext', ['-layout', pdfPath, txtPath], {
      stdio: 'inherit',
    });

    proc.on('error', (err) => {
      console.error('pdftotext failed (is it installed on PATH?)', err.message);
      resolve(false);
    });

    proc.on('close', (code) => {
      if (code === 0) {
        resolve(true);
      } else {
        console.error(`pdftotext exited with code ${code} for ${pdfPath}`);
        resolve(false);
      }
    });
  });
}

function runNormalizeForDir(dirPath) {
  return new Promise((resolve) => {
    const env = { ...process.env, POLICY_SOURCE_DIR: dirPath };
    const proc = spawn('node', ['scripts/normalize-policies.js'], {
      stdio: 'inherit',
      env,
    });

    proc.on('error', (err) => {
      console.error('normalize-policies failed', err.message);
      resolve(false);
    });

    proc.on('close', (code) => {
      if (code === 0) {
        resolve(true);
      } else {
        console.error(`normalize-policies exited with code ${code} for ${dirPath}`);
        resolve(false);
      }
    });
  });
}

function schedule(filePath) {
  const full = path.resolve(filePath);
  if (pending.has(full)) {
    clearTimeout(pending.get(full));
  }
  pending.set(
    full,
    setTimeout(() => {
      pending.delete(full);
      handleFile(full);
    }, DEBOUNCE_MS)
  );
}

function handleFile(filePath) {
  if (!fs.existsSync(filePath)) return;

  if (isPdf(filePath)) {
    const txtPath = filePath.replace(/\.pdf$/i, '.txt');
    enqueue(async () => {
      if (fs.existsSync(txtPath)) {
        console.log(`TXT already exists for ${filePath}`);
      } else {
        console.log(`Converting PDF to TXT: ${filePath}`);
        const ok = await runPdftotext(filePath, txtPath);
        if (!ok) return;
      }
      schedule(txtPath);
    });
    return;
  }

  if (isTxt(filePath) && !isNormalizedTxt(filePath)) {
    const dirPath = path.dirname(filePath);
    enqueue(async () => {
      console.log(`Normalizing TXT files in ${dirPath}`);
      await runNormalizeForDir(dirPath);
    });
  }
}

function walk(dir) {
  const results = [];
  if (!fs.existsSync(dir)) return results;
  const entries = fs.readdirSync(dir, { withFileTypes: true });
  for (const entry of entries) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      results.push(...walk(full));
    } else if (entry.isFile()) {
      results.push(full);
    }
  }
  return results;
}

function initialScan() {
  const files = walk(POLICY_DIR);
  files.forEach((filePath) => {
    if (isPdf(filePath)) {
      const txtPath = filePath.replace(/\.pdf$/i, '.txt');
      if (!fs.existsSync(txtPath)) {
        schedule(filePath);
      }
    } else if (isTxt(filePath) && !isNormalizedTxt(filePath)) {
      const normalized = filePath.replace(/\.txt$/i, '.normalized.txt');
      if (!fs.existsSync(normalized)) {
        schedule(filePath);
      }
    }
  });
}

function startWatch() {
  console.log(`Watching policies in: ${POLICY_DIR}`);

  try {
    fs.watch(POLICY_DIR, { recursive: true }, (eventType, filename) => {
      if (!filename) return;
      const full = path.join(POLICY_DIR, filename);
      if (!isPdf(full) && !isTxt(full)) return;
      schedule(full);
    });
  } catch (err) {
    console.warn('Recursive watch not available; falling back to polling.');
    setInterval(initialScan, POLL_INTERVAL_MS);
  }
}

initialScan();
startWatch();

