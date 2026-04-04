/**
 * Merge ICDb composite sprite fingerings into banjo chord *.js where frets already exist.
 *
 * Usage (repo root):
 *   node scripts/merge-banjo-composite-fingers.mjs
 *   node scripts/merge-banjo-composite-fingers.mjs --fix-drift
 *
 * --fix-drift: when raw composite disagrees with existing fingers for the same fret string,
 *   overwrite fingers from composite (use after reviewing composite-finger-merge-review.txt).
 *
 * Notes from repo scan (2026):
 * - banjo-open-c / banjo-standard-c-drop-c chord files are generated from composite HTML;
 *   every position already has fingers. Uses: verify drift vs raw.
 * - banjo-open-g / banjo-d-f#-tuning: chord frets come from StaticCharts alts; composite grids in
 *   the same downloads encode different fret strings (offset / alternate voicings). Expect **zero**
 *   automatic fret matches until generators add composite voicings or you map them manually.
 *
 * Writes: scripts/composite-finger-merge-review.txt (gitignored; see README ICDb section).
 */
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { parseCompositeTableInnerHtml } from './parse-icdb-composite-table.mjs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '..');
const RAW_ROOT = path.join(ROOT, 'scripts', 'icdb-data');

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

function normalizeIcdbChordName(s) {
  if (!s) return s;
  return s
    .replace(/♭/g, 'b')
    .replace(/♯/g, '#')
    .replace(/°/g, 'dim')
    .trim();
}

function altToFrets(alt) {
  if (!alt || /not found/i.test(alt)) return null;
  const parts = alt.split(',').map((p) => p.trim());
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

function remainderToSuffix(r) {
  if (r === '') return 'major';
  for (const [k, v] of REMAINDER_TO_SUFFIX) {
    if (r === k) return v;
  }
  return null;
}

/** Keys config: folder name, exported key, ICDb html root */
const KEY_CONFIGS = [
  { dir: 'Ab', key: 'Ab', htmlRoot: 'Ab' },
  { dir: 'A', key: 'A', htmlRoot: 'A' },
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

const INSTRUMENTS = [
  { folder: 'banjo-open-c', chordsRoot: 'src/db/banjo-open-c/chords' },
  {
    folder: 'banjo-standard-c-drop-c',
    chordsRoot: 'src/db/banjo-standard-c-drop-c/chords',
  },
  { folder: 'banjo-open-g', chordsRoot: 'src/db/banjo-open-g/chords' },
  { folder: 'banjo-d-f#-tuning', chordsRoot: 'src/db/banjo-d-f#-tuning/chords' },
];

const args = process.argv.slice(2);
const fixDrift = args.includes('--fix-drift');

const reviewLines = [];

function logReview(kind, instr, keyDir, suffix, detail) {
  reviewLines.push(
    [kind, instr, keyDir, suffix, detail].join('\t')
  );
}

function extractBlocks(html) {
  const rx = /<!-- The fingering for tc\.\d+:\s*([^>]+?)\s*-->/g;
  const blocks = [];
  let m;
  while ((m = rx.exec(html)) !== null) {
    const fullName = normalizeIcdbChordName(m[1].trim());
    const start = m.index;
    const next = html.indexOf('<!-- The fingering for tc.', start + 10);
    const block =
      next < 0 ? html.slice(start) : html.slice(start, next);
    blocks.push({ fullName, block });
  }
  return blocks;
}

function parseBlockRow(block, htmlRoot) {
  const fullName = block.fullName;
  if (/fingering not found/i.test(fullName)) return null;
  if (!fullName.startsWith(htmlRoot)) return null;
  const remainder = fullName.slice(htmlRoot.length);
  const suffix = remainderToSuffix(remainder);
  if (!suffix) return null;

  const inner = block.block;
  const staticM = /StaticCharts\\[^"]+\.png[^>]*alt="([^"]*)"/i.exec(inner);
  const staticFrets = staticM ? altToFrets(staticM[1]) : null;

  const tblM = /<table class="SingleFingering_v2[^"]*"[^>]*>(.*?)<\/table>\s*<\/div>/is.exec(
    inner
  );
  let composite = null;
  if (tblM) {
    composite = parseCompositeTableInnerHtml(tblM[1]);
  }

  if (staticFrets && composite) {
    if (staticFrets !== composite.frets) {
      return {
        fullName,
        suffix,
        staticFrets,
        composite,
        conflict: 'static_composite_fret_mismatch',
      };
    }
    return { fullName, suffix, frets: staticFrets, fingers: composite.fingers };
  }
  if (composite) {
    return {
      fullName,
      suffix,
      frets: composite.frets,
      fingers: composite.fingers,
    };
  }
  if (staticM) {
    return { fullName, suffix, frets: staticFrets, fingers: null };
  }
  return null;
}

/** Differ only at index 0 and/or 4; each differing position uses only x or 0 */
function isBorderlineX0Only(a, b) {
  if (a === b) return false;
  const diffIdx = [];
  for (let i = 0; i < 5; i++) if (a[i] !== b[i]) diffIdx.push(i);
  if (!diffIdx.length) return false;
  if (!diffIdx.every((i) => i === 0 || i === 4)) return false;
  const ok = (c) => c === 'x' || c === '0';
  return diffIdx.every((i) => ok(a[i]) && ok(b[i]));
}

/** Diff only at ends (indices 0,4); may involve digits — needs human */
function isBorderlineEndOnly(a, b) {
  if (a === b) return false;
  const diffIdx = [];
  for (let i = 0; i < 5; i++) if (a[i] !== b[i]) diffIdx.push(i);
  return diffIdx.length > 0 && diffIdx.every((i) => i === 0 || i === 4);
}

function collectCompositeFingerings(instrFolder, chordsRel, opts = { log: true }) {
  /** @type {Map<string, Map<string, Array<{frets: string, fingers: string}>>>} */
  const byKeySuffix = new Map();

  for (const kc of KEY_CONFIGS) {
    const keyDir = path.join(ROOT, chordsRel, kc.dir);
    const rawKeyDir = path.join(RAW_ROOT, instrFolder, kc.dir);
    const sourceDir = fs.existsSync(rawKeyDir) ? rawKeyDir : keyDir;
    if (!fs.existsSync(sourceDir)) continue;
    for (let v = 1; v <= 4; v++) {
      const fp = path.join(sourceDir, `_raw_v${v}.html`);
      if (!fs.existsSync(fp)) continue;
      const html = fs.readFileSync(fp, 'utf8');
      for (const blk of extractBlocks(html)) {
        const row = parseBlockRow(blk, kc.htmlRoot);
        if (!row || !row.frets || row.conflict) {
          if (
            opts.log &&
            row &&
            row.conflict === 'static_composite_fret_mismatch'
          ) {
            logReview(
              'static_ne_composite_frets',
              instrFolder,
              kc.dir,
              row.suffix,
              `static=${row.staticFrets} composite=${row.composite.frets} ${row.composite.fingers}`
            );
          }
          continue;
        }
        if (!row.fingers) continue;

        const key = kc.key;
        if (!byKeySuffix.has(key)) byKeySuffix.set(key, new Map());
        const sm = byKeySuffix.get(key);
        if (!sm.has(row.suffix)) sm.set(row.suffix, []);
        const list = sm.get(row.suffix);
        const dup = list.some(
          (x) => x.frets === row.frets && x.fingers === row.fingers
        );
        if (!dup) list.push({ frets: row.frets, fingers: row.fingers });
      }
    }
  }
  return byKeySuffix;
}

function parseChordJs(text) {
  const keyM = /key:\s*'([^']+)'/.exec(text);
  const sufM = /suffix:\s*'([^']+)'/.exec(text);
  const positions = [];
  const re =
    /\{\s*frets:\s*'([^']+)'(?:\s*,\s*fingers:\s*'([^']*)')?\s*,?\s*\}/g;
  let m;
  while ((m = re.exec(text)) !== null) {
    positions.push({
      frets: m[1],
      fingers: m[2] !== undefined ? m[2] : null,
    });
  }
  return {
    key: keyM && keyM[1],
    suffix: sufM && sufM[1],
    positions,
  };
}

function formatPositionsJs(positions) {
  const lines = positions.map((p) => {
    if (p.fingers != null && p.fingers !== '')
      return `    {\n      frets: '${p.frets}',\n      fingers: '${p.fingers}',\n    }`;
    return `    {\n      frets: '${p.frets}',\n    }`;
  });
  return `[\n${lines.join(',\n')},\n  ]`;
}

function mergeInstrument(instr) {
  const { folder, chordsRoot } = instr;
  const data = collectCompositeFingerings(folder, chordsRoot, { log: true });
  let filesTouched = 0;

  for (const kc of KEY_CONFIGS) {
    const keyDir = path.join(ROOT, chordsRoot, kc.dir);
    if (!fs.existsSync(keyDir)) continue;

    const jsFiles = fs
      .readdirSync(keyDir)
      .filter((f) => f.endsWith('.js') && f !== 'index.js');

    for (const jf of jsFiles) {
      const stem = jf.replace(/\.js$/, '');
      let suffix = stem;
      if (stem === '5') suffix = '5';
      const parsed = parseChordJs(
        fs.readFileSync(path.join(keyDir, jf), 'utf8')
      );
      if (!parsed.suffix) continue;

      const compositeList = data.get(kc.key)?.get(parsed.suffix) ?? [];
      if (!compositeList.length) continue;

      let changed = false;
      for (const pos of parsed.positions) {
        const exact = compositeList.find((c) => c.frets === pos.frets);
        if (exact) {
          if (pos.fingers == null || pos.fingers === '') {
            pos.fingers = exact.fingers;
            changed = true;
          } else if (pos.fingers !== exact.fingers) {
            if (fixDrift) {
              pos.fingers = exact.fingers;
              changed = true;
            } else {
              logReview(
                'finger_drift',
                folder,
                kc.dir,
                parsed.suffix,
                `frets=${pos.frets} fileFingers=${pos.fingers} rawCompositeFingers=${exact.fingers}`
              );
            }
          }
          continue;
        }

        for (const c of compositeList) {
          if (isBorderlineX0Only(pos.frets, c.frets)) {
            logReview(
              'borderline_x0_ends',
              folder,
              kc.dir,
              parsed.suffix,
              `fileFrets=${pos.frets} compositeFrets=${c.frets} compositeFingers=${c.fingers}`
            );
            break;
          }
          if (isBorderlineEndOnly(pos.frets, c.frets)) {
            logReview(
              'borderline_end_digits',
              folder,
              kc.dir,
              parsed.suffix,
              `fileFrets=${pos.frets} compositeFrets=${c.frets} compositeFingers=${c.fingers}`
            );
            break;
          }
        }
      }

      if (changed) {
        const fp = path.join(keyDir, jf);
        const raw = fs.readFileSync(fp, 'utf8');
        const newBody = raw.replace(
          /positions:\s*\[[\s\S]*?\]/m,
          `positions: ${formatPositionsJs(parsed.positions)}`
        );
        fs.writeFileSync(fp, newBody, 'utf8');
        filesTouched += 1;
      }
    }
  }
  return filesTouched;
}

function countExactCompositeFileMatches(folder, chordsRel) {
  const data = collectCompositeFingerings(folder, chordsRel, { log: false });
  let hits = 0;
  let comp = 0;
  for (const [, suffMap] of data) {
    for (const [, list] of suffMap) comp += list.length;
  }
  for (const kc of KEY_CONFIGS) {
    const keyDir = path.join(ROOT, chordsRel, kc.dir);
    if (!fs.existsSync(keyDir)) continue;
    const jsFiles = fs
      .readdirSync(keyDir)
      .filter((f) => f.endsWith('.js') && f !== 'index.js');
    for (const jf of jsFiles) {
      const t = fs.readFileSync(path.join(keyDir, jf), 'utf8');
      const parsed = parseChordJs(t);
      if (!parsed.suffix) continue;
      const list = data.get(kc.key)?.get(parsed.suffix) ?? [];
      for (const pos of parsed.positions) {
        if (list.some((c) => c.frets === pos.frets)) hits++;
      }
    }
  }
  return { comp, hits };
}

const summaryLines = [
  '# composite-finger merge / drift check',
  `# fixDrift=${fixDrift}`,
];
for (const instr of INSTRUMENTS) {
  const { comp, hits } = countExactCompositeFileMatches(
    instr.folder,
    instr.chordsRoot
  );
  summaryLines.push(`# ${instr.folder}: composite rows=${comp} exactFretMatchesInFiles=${hits}`);
}
summaryLines.push('# --- detail rows follow (tab-separated) ---');

let total = 0;
for (const instr of INSTRUMENTS) {
  const n = mergeInstrument(instr);
  console.log(instr.folder, 'files updated:', n);
  total += n;
}

const reviewPath = path.join(__dirname, 'composite-finger-merge-review.txt');
const header =
  summaryLines.join('\n') +
  '\n' +
  ['kind', 'instrument', 'keyDir', 'suffix', 'detail'].join('\t') +
  '\n' +
  reviewLines.join('\n');
fs.writeFileSync(reviewPath, header + '\n', 'utf8');

console.log('Total files updated:', total);
console.log('Review:', reviewPath);
