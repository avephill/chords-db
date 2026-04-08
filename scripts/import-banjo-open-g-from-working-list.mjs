#!/usr/bin/env node
import fs from 'fs';
import path from 'path';

const ROOT = process.cwd();
const WORKING_LIST = path.join(
  ROOT,
  'src',
  'db',
  'banjo-open-g',
  'chords',
  'Banjo-chords-working.txt'
);
const CHORDS_ROOT = path.join(ROOT, 'src', 'db', 'banjo-open-g', 'chords');
const SUFFIXES_FILE = path.join(ROOT, 'src', 'db', 'banjo-open-g', 'suffixes.js');

function parseArgs(argv) {
  let concurrency = 10;
  for (let i = 0; i < argv.length; i += 1) {
    if (argv[i] === '--concurrency' && argv[i + 1]) {
      concurrency = Number.parseInt(argv[i + 1], 10) || concurrency;
      i += 1;
    }
  }
  return {
    includeAlias: argv.includes('--include-alias'),
    onlySkipped: argv.includes('--only-skipped'),
    concurrency,
  };
}

function parseLine(line) {
  const trimmed = line.trim();
  if (!trimmed) return null;

  const [head, ...rest] = trimmed.split('##');
  const comment = rest.length ? rest.join('##').trim() : '';
  const parts = head.trim().split(/\s+/);
  const chord = parts[0];
  const url = parts.find((p) => p.startsWith('http://') || p.startsWith('https://')) || '';
  return { chord, url, comment };
}

function parseChordToken(chord) {
  const m = /^([A-G](?:#|b)?)(.*)$/.exec(chord);
  if (!m) return null;
  const key = m[1];
  const remainder = m[2] || '';
  let suffix = 'major';
  if (remainder === 'm') suffix = 'minor';
  else if (remainder) suffix = remainder;
  return { key, suffix };
}

function suffixToStem(suffix) {
  if (suffix === 'major') return 'major';
  if (suffix === 'minor') return 'minor';
  if (suffix.startsWith('/')) return `_${suffix.slice(1)}`;
  return suffix.replace('/', '_');
}

function targetPathForChord(chord) {
  const parsed = parseChordToken(chord);
  if (!parsed) return null;
  return path.join(CHORDS_ROOT, parsed.key, `${suffixToStem(parsed.suffix)}.js`);
}

function stemToSuffix(stem) {
  if (stem === 'major') return 'major';
  if (stem === 'minor') return 'minor';
  if (stem.startsWith('_') && !stem.slice(1).includes('_')) return `/${stem.slice(1)}`;
  if (stem.includes('_')) {
    const idx = stem.indexOf('_');
    return `${stem.slice(0, idx)}/${stem.slice(idx + 1)}`;
  }
  return stem;
}

function fretsToDb(spaced) {
  const out = [];
  for (const tokenRaw of spaced.trim().split(/\s+/)) {
    const token = tokenRaw.toLowerCase();
    if (token === 'x') {
      out.push('x');
      continue;
    }
    const n = Number.parseInt(token, 10);
    if (Number.isNaN(n) || n < 0) return null;
    out.push(n.toString(16));
  }
  return out.join('');
}

function parseVoicings(markdown) {
  const cutMarkers = [
    /##\s+Horizontal Chord Charts/i,
    /##\s+.*Inversions on banjo/i,
    /##\s+.*chord charts for left handed banjo/i,
    /##\s+Chords related to/i,
  ];
  let cut = markdown.length;
  for (const marker of cutMarkers) {
    const m = marker.exec(markdown);
    if (m && m.index < cut) cut = m.index;
  }
  const scoped = markdown.slice(0, cut);

  const voicings = [];
  const seen = new Set();
  const rx = /chord on banjo frets:\s*([xX0-9 ]+)/gi;
  let match;
  while ((match = rx.exec(scoped)) !== null) {
    const db = fretsToDb(match[1]);
    if (!db || db.length !== 5 || seen.has(db)) continue;
    seen.add(db);
    voicings.push(db);
  }
  return voicings;
}

async function fetchMarkdown(url) {
  const u = new URL(url);
  const source = `http://${u.host}${u.pathname}${u.search}`;
  const proxy = `https://r.jina.ai/${source}`;
  for (let attempt = 1; attempt <= 6; attempt += 1) {
    try {
      const res = await fetch(proxy);
      if (res.ok) return res.text();
    } catch (_) {
      // retry
    }
    await new Promise((r) => setTimeout(r, 600 * attempt));
  }
  return '';
}

function buildChordModule(key, suffix, voicings) {
  const rows = voicings
    .map((f) => `    {\n      frets: '${f}',\n    }`)
    .join(',\n');
  return `export default {\n  key: '${key}',\n  suffix: '${suffix}',\n  positions: [\n${rows},\n  ],\n};\n`;
}

function toImportId(stem) {
  let id = stem.replace(/#/g, 'sharp').replace(/[^A-Za-z0-9_$]/g, '_');
  if (!/^[A-Za-z_$]/.test(id)) id = `_${id}`;
  return id;
}

function rebuildKeyIndex(keyDir) {
  const stems = fs
    .readdirSync(keyDir)
    .filter((f) => f.endsWith('.js') && f !== 'index.js')
    .map((f) => f.slice(0, -3))
    .sort((a, b) => a.localeCompare(b, 'en', { numeric: true }));

  const imports = stems.map((stem) => `import ${toImportId(stem)} from './${stem}';`).join('\n');
  const exports = stems.map((stem) => `  ${toImportId(stem)},`).join('\n');
  const out = `${imports}\n\nexport default [\n${exports}\n];\n`;
  fs.writeFileSync(path.join(keyDir, 'index.js'), out);
}

function rebuildSuffixesFile() {
  const suffixes = new Set();
  for (const dirent of fs.readdirSync(CHORDS_ROOT, { withFileTypes: true })) {
    if (!dirent.isDirectory()) continue;
    const keyDir = path.join(CHORDS_ROOT, dirent.name);
    for (const file of fs.readdirSync(keyDir)) {
      if (!file.endsWith('.js') || file === 'index.js') continue;
      suffixes.add(stemToSuffix(file.slice(0, -3)));
    }
  }

  const arr = Array.from(suffixes).sort((a, b) => a.localeCompare(b, 'en', { numeric: true }));
  const prioritized = ['major', 'minor'];
  const ordered = [...prioritized.filter((x) => arr.includes(x)), ...arr.filter((x) => !prioritized.includes(x))];
  const body = `export default [\n${ordered.map((s) => `  '${s}',`).join('\n')}\n];\n`;
  fs.writeFileSync(SUFFIXES_FILE, body);
}

async function runPool(items, concurrency, worker) {
  let i = 0;
  async function loop() {
    while (true) {
      const idx = i;
      i += 1;
      if (idx >= items.length) break;
      await worker(items[idx], idx);
    }
  }
  const runners = [];
  for (let n = 0; n < Math.max(1, concurrency); n += 1) runners.push(loop());
  await Promise.all(runners);
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  const lines = fs.readFileSync(WORKING_LIST, 'utf8').split(/\r?\n/);
  const rows = lines.map(parseLine).filter(Boolean);
  const filtered = rows.filter((r) => {
    if (!r.url) return false;
    const comment = (r.comment || '').toUpperCase();
    if (!comment.includes('WARNING:')) return true;
    if (comment.includes('NO CHORDS ASSOCIATED')) return false;
    if (args.includeAlias && comment.includes('ALIAS/DUPLICATE')) return true;
    return false;
  });
  const toImport = args.onlySkipped
    ? filtered.filter((r) => (r.comment || '').toUpperCase().includes('SKIPPED:'))
    : filtered;

  let created = 0;
  let updated = 0;
  let deleted = 0;
  let skipped = 0;

  await runPool(toImport, args.concurrency, async (row, idx) => {
    const parsed = parseChordToken(row.chord);
    if (!parsed) {
      skipped += 1;
      return;
    }

    const md = await fetchMarkdown(row.url);
    if (!md) {
      skipped += 1;
      return;
    }
    const voicings = parseVoicings(md);
    if (voicings.length === 0) {
      skipped += 1;
      return;
    }

    const stem = suffixToStem(parsed.suffix);
    const keyDir = path.join(CHORDS_ROOT, parsed.key);
    const outPath = path.join(keyDir, `${stem}.js`);
    if (voicings.length === 0) {
      if (fs.existsSync(outPath)) {
        fs.unlinkSync(outPath);
        deleted += 1;
      } else {
        skipped += 1;
      }
      return;
    }

    if (!fs.existsSync(keyDir)) fs.mkdirSync(keyDir, { recursive: true });
    const existed = fs.existsSync(outPath);
    fs.writeFileSync(outPath, buildChordModule(parsed.key, parsed.suffix, voicings));
    if (existed) updated += 1;
    else created += 1;

    if ((idx + 1) % 50 === 0) {
      console.log(`processed ${idx + 1}/${toImport.length}`);
    }
  });

  for (const dirent of fs.readdirSync(CHORDS_ROOT, { withFileTypes: true })) {
    if (!dirent.isDirectory()) continue;
    rebuildKeyIndex(path.join(CHORDS_ROOT, dirent.name));
  }
  rebuildSuffixesFile();

  console.log(
    `created=${created} updated=${updated} deleted=${deleted} skipped=${skipped} scanned=${toImport.length} includeAlias=${args.includeAlias} onlySkipped=${args.onlySkipped} concurrency=${args.concurrency}`
  );
}

main().catch((err) => {
  console.error(err?.message || err);
  process.exit(1);
});
