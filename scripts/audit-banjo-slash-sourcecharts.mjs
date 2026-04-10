#!/usr/bin/env node
/**
 * List positions whose // sourceChart URL PNG stem does not match the chord (slash / m/ only).
 * Run after changing verify-scales-chords stem rules; does not modify files.
 *
 *   node scripts/audit-banjo-slash-sourcecharts.mjs
 */

import fs from 'fs';
import path from 'path';
import { banjoSlashChartUrlMatchesChord } from './verify-scales-chords-frets.mjs';

const ROOT = path.resolve('src/db/banjo-open-g/chords');

function walk(dir, out = []) {
  for (const name of fs.readdirSync(dir)) {
    const p = path.join(dir, name);
    const st = fs.statSync(p);
    if (st.isDirectory()) walk(p, out);
    else if (name.endsWith('.js') && name !== 'index.js') out.push(p);
  }
  return out;
}

function parseModule(p) {
  const text = fs.readFileSync(p, 'utf8');
  const keyM = /key:\s*'([^']+)'/.exec(text);
  const suffixM = /suffix:\s*'([^']+)'/.exec(text);
  if (!keyM || !suffixM) return null;
  const key = keyM[1];
  const suffix = suffixM[1];
  if (!suffix.startsWith('/') && !suffix.startsWith('m/')) return null;

  const issues = [];
  const posRe =
    /\{\s*([\s\S]*?)\s*\}(?=\s*,|\s*\])/g;
  const inner = /positions:\s*\[([\s\S]*)\]\s*,?\s*\}/.exec(text);
  if (!inner) return { key, suffix, issues: ['no positions array'] };
  let idx = 0;
  let m;
  const arr = inner[1];
  while ((m = posRe.exec(arr)) !== null) {
    idx += 1;
    const block = m[1];
    const sc = /\/\/\s*sourceChart:\s*(\S+)/.exec(block);
    const fr = /frets:\s*'([^']+)'/.exec(block);
    if (!sc || !fr) continue;
    const url = sc[1];
    if (!banjoSlashChartUrlMatchesChord(key, suffix, url)) {
      issues.push({ position: idx, frets: fr[1], url });
    }
  }
  return { key, suffix, issues };
}

const files = walk(ROOT);
let badFiles = 0;
const report = [];

for (const f of files.sort()) {
  const rel = path.relative(process.cwd(), f);
  const r = parseModule(f);
  if (!r || !r.issues || r.issues.length === 0) continue;
  if (typeof r.issues[0] === 'string') continue;
  badFiles += 1;
  report.push({ file: rel, key: r.key, suffix: r.suffix, issues: r.issues });
}

for (const row of report) {
  console.log(`\n${row.file}  (${row.key}${row.suffix})`);
  for (const i of row.issues) {
    console.log(`  - pos frets=${i.frets}`);
    console.log(`    ${i.url}`);
  }
}

console.log(`\nTotal files with mismatched slash sourceChart: ${badFiles}`);
