/**
 * Parse ICDb _raw_v1..v4.html for banjo open-G and write chord *.js + index + readable txt.
 * Same behaviour as generate-banjo-open-g-from-icdb.ps1 (StaticCharts alts); use whichever runtime you prefer.
 * Run: node scripts/generate-banjo-open-g-from-icdb.mjs
 */
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const CHORDS_ROOT = path.join(__dirname, '..', 'src', 'db', 'banjo-open-g', 'chords');

const REMAINDER_TO_SUFFIX = [
  ['m(add9)', 'madd9'],
  ['m(maj7)', 'mmaj7'],
  ['maj7(-sharp5)', 'maj7#5'],
  ['maj7(#5)', 'maj7#5'],
  ['maj7(b5)', 'maj7b5'],
  ['7(add-sharp9)', '7#9'],
  ['7(add-flat9)', '7b9'],
  ['7(addb9)', '7b9'],
  ['7(b5)', '7b5'],
  ['7sus4', '7sus4'],
  ['m7b5', 'm7b5'],
  ['m11', 'm11'],
  ['m9', 'm9'],
  ['m7', 'm7'],
  ['m6', 'm6'],
  ['maj13', 'maj13'],
  ['maj9', 'maj9'],
  ['maj7', 'maj7'],
  ['dim7', 'dim7'],
  ['sus4', 'sus4'],
  ['sus2', 'sus2'],
  ['(add9)', 'add9'],
  ['aug7', 'aug7'],
  ['dim', 'dim'],
  ['aug', 'aug'],
  ['9(b5)', '9b5'],
  ['11', '11'],
  ['13', '13'],
  ['9', '9'],
  ['6', '6'],
  ['5', '5'],
  ['7', '7'],
  ['m', 'minor'],
];

const SUFFIX_ORDER = [
  'major',
  'minor',
  'dim',
  'dim7',
  'sus2',
  'sus4',
  'aug',
  '5',
  '6',
  'm6',
  '7',
  '7b5',
  'aug7',
  '7#9',
  '7sus4',
  '9',
  '9b5',
  '7b9',
  '11',
  '13',
  'maj7',
  'maj7b5',
  'maj7#5',
  'maj9',
  'maj13',
  'm7',
  'm7b5',
  'm9',
  'm11',
  'mmaj7',
  'add9',
  'madd9',
];

/** suffix -> { importId, fileStem } fileStem without .js */
const SUFFIX_FILE = {
  major: { importId: 'major', fileStem: 'major' },
  minor: { importId: 'minor', fileStem: 'minor' },
  dim: { importId: 'dim', fileStem: 'dim' },
  dim7: { importId: 'dim7', fileStem: 'dim7' },
  sus2: { importId: 'sus2', fileStem: 'sus2' },
  sus4: { importId: 'sus4', fileStem: 'sus4' },
  aug: { importId: 'aug', fileStem: 'aug' },
  5: { importId: '_5', fileStem: '5' },
  6: { importId: '_6', fileStem: '6' },
  m6: { importId: 'm6', fileStem: 'm6' },
  7: { importId: '_7', fileStem: '7' },
  '7b5': { importId: '_7b5', fileStem: '7b5' },
  aug7: { importId: 'aug7', fileStem: 'aug7' },
  '7#9': { importId: '_7sharp9', fileStem: '7#9' },
  '7sus4': { importId: 'c7sus4', fileStem: '7sus4' },
  9: { importId: '_9', fileStem: '9' },
  '9b5': { importId: '_9b5', fileStem: '9b5' },
  '7b9': { importId: '_7b9', fileStem: '7b9' },
  11: { importId: '_11', fileStem: '11' },
  13: { importId: '_13', fileStem: '13' },
  maj7: { importId: 'maj7', fileStem: 'maj7' },
  maj7b5: { importId: 'maj7b5', fileStem: 'maj7b5' },
  'maj7#5': { importId: 'maj7sharp5', fileStem: 'maj7#5' },
  maj9: { importId: 'maj9', fileStem: 'maj9' },
  maj13: { importId: 'maj13', fileStem: 'maj13' },
  m7: { importId: 'm7', fileStem: 'm7' },
  m7b5: { importId: 'm7b5', fileStem: 'm7b5' },
  m9: { importId: 'm9', fileStem: 'm9' },
  m11: { importId: 'm11', fileStem: 'm11' },
  mmaj7: { importId: 'mmaj7', fileStem: 'mmaj7' },
  add9: { importId: 'add9', fileStem: 'add9' },
  madd9: { importId: 'madd9', fileStem: 'madd9' },
};

const KEYS = [
  { dir: 'Ab', key: 'Ab', htmlRoot: 'Ab' },
  { dir: 'B', key: 'B', htmlRoot: 'B' },
  { dir: 'Bb', key: 'Bb', htmlRoot: 'Bb' },
  { dir: 'C', key: 'C', htmlRoot: 'C' },
  { dir: 'C#', key: 'C#', htmlRoot: 'Db' },
  { dir: 'D', key: 'D', htmlRoot: 'D' },
  { dir: 'E', key: 'E', htmlRoot: 'E' },
  { dir: 'F', key: 'F', htmlRoot: 'F' },
  { dir: 'Eb', key: 'Eb', htmlRoot: 'Eb' },
  { dir: 'F#', key: 'F#', htmlRoot: 'Gb' },
  { dir: 'G', key: 'G', htmlRoot: 'G' },
];

function altToFrets(alt) {
  if (!alt || /not found/i.test(alt)) return null;
  const parts = alt.split(',').map((s) => s.trim());
  if (parts.length !== 5) return null;
  let out = '';
  for (const p of parts) {
    if (p === 'x' || p === 'X') {
      out += 'x';
      continue;
    }
    const n = parseInt(p, 10);
    if (Number.isNaN(n) || n < 0 || n > 15) return null;
    out += n.toString(16);
  }
  return out;
}

function remainderToSuffix(remainder) {
  if (remainder === '') return 'major';
  for (const [rem, sfx] of REMAINDER_TO_SUFFIX) {
    if (remainder === rem) return sfx;
  }
  return null;
}

function parseHtmlFile(html, htmlRoot) {
  const re = /<!-- The fingering for tc\.\d+:\s*([^>]+?)\s*-->/g;
  const results = [];
  let m;
  while ((m = re.exec(html)) !== null) {
    const fullName = m[1].trim();
    const start = m.index;
    const next = html.indexOf('<!-- The fingering for tc.', start + 10);
    const block = next === -1 ? html.slice(start) : html.slice(start, next);
    const imgMatch = block.match(/StaticCharts\\[^"]+\.png[^>]*alt="([^"]*)"/i);
    if (!imgMatch) continue;
    const frets = altToFrets(imgMatch[1]);
    if (!frets) continue;
    if (!fullName.startsWith(htmlRoot)) continue;
    const remainder = fullName.slice(htmlRoot.length);
    const suffix = remainderToSuffix(remainder);
    if (!suffix) {
      console.warn('Unknown type', fullName, JSON.stringify(remainder));
      continue;
    }
    results.push({ fullName, suffix, frets });
  }
  return results;
}

function fretsToParen(fretsStr) {
  const parts = fretsStr.split('').map((ch) =>
    ch === 'x' ? 'x' : String(parseInt(ch, 16))
  );
  return `(${parts.join(',')})`;
}

function displayChordName(key, htmlRoot, fullName) {
  if (key === htmlRoot) return fullName;
  return fullName.replace(new RegExp(`^${htmlRoot}`), key);
}

function formatPositionsJs(fretsList) {
  const lines = [...fretsList].map(
    (f) => `    {\n      frets: '${f}',\n    }`
  );
  return `[\n${lines.join(',\n')},\n  ]`;
}

function processKey({ dir, key, htmlRoot }) {
  const dirPath = path.join(CHORDS_ROOT, dir);
  let all = [];
  for (let v = 1; v <= 4; v++) {
    const fp = path.join(dirPath, `_raw_v${v}.html`);
    if (!fs.existsSync(fp)) {
      console.warn('Missing', fp);
      continue;
    }
    const html = fs.readFileSync(fp, 'utf8');
    all = all.concat(parseHtmlFile(html, htmlRoot));
  }

  const bySuffix = new Map();
  for (const { suffix, frets } of all) {
    if (!bySuffix.has(suffix)) bySuffix.set(suffix, new Set());
    bySuffix.get(suffix).add(frets);
  }

  const present = new Set(bySuffix.keys());

  for (const sfx of SUFFIX_ORDER) {
    if (!bySuffix.has(sfx)) continue;
    const { fileStem } = SUFFIX_FILE[sfx];
    const fileName = `${fileStem}.js`;
    const fretsList = bySuffix.get(sfx);
    const body = `export default {
  key: '${key}',
  suffix: '${sfx}',
  positions: ${formatPositionsJs(fretsList)},
};
`;
    fs.writeFileSync(path.join(dirPath, fileName), body, 'utf8');
  }

  const importLines = [];
  const exportNames = [];
  for (const sfx of SUFFIX_ORDER) {
    if (!present.has(sfx)) continue;
    const { importId, fileStem } = SUFFIX_FILE[sfx];
    importLines.push(`import ${importId} from './${fileStem}';`);
    exportNames.push(importId);
  }
  fs.writeFileSync(
    path.join(dirPath, 'index.js'),
    `${importLines.join('\n')}\n\nexport default [\n  ${exportNames.join(',\n  ')},\n];\n`,
    'utf8'
  );

  const readableMap = new Map();
  for (const row of all) {
    const label = displayChordName(key, htmlRoot, row.fullName);
    const paren = fretsToParen(row.frets);
    if (!readableMap.has(label)) readableMap.set(label, new Set());
    readableMap.get(label).add(paren);
  }
  const readableLines = [...readableMap.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([label, set]) => `${label} ${[...set].join(', ')}`);
  const txtName =
    dir === 'Ab'
      ? 'Abchords-readable-openGBanjo.txt'
      : `${dir}chords-readable-openGBanjo.txt`;
  fs.writeFileSync(
    path.join(dirPath, txtName),
    readableLines.join('\n') + '\n',
    'utf8'
  );

  console.log(dir, 'suffixes', present.size, 'parsed', all.length);
}

for (const k of KEYS) {
  processKey(k);
}
console.log('done');
