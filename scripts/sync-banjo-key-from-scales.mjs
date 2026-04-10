#!/usr/bin/env node
/**
 * Sync banjo-open-g/chords/<Key>/*.js from Scales-Chords (Jina markdown), matching verify-scales-chords-frets.mjs.
 *
 * - Files listed in Banjo-chords-working.txt for that key: REPLACE positions with page voicings (+ sourcePage / sourceChart).
 * - Other files: MERGE — keep existing positions; append page voicings whose fret strings are not already present.
 * - Skips 7#9.js (manual fingerings).
 *
 * Usage:
 *   node scripts/sync-banjo-key-from-scales.mjs --key Ab
 *   node scripts/sync-banjo-key-from-scales.mjs --key B --dry-run
 */

import fs from 'fs';
import path from 'path';
import { pathToFileURL } from 'url';
import {
  buildBanjoPageUrlBackslash,
  extractBanjoCharts,
  extractSharpBassChartFretsFromUrls,
  extractSharpBassChartMap,
  fetchMarkdown,
  isSlashSharpChordSuffix,
} from './verify-scales-chords-frets.mjs';

/** Banjo-chords-working.txt first column → filename under chords/<Key>/. */
export const WORKING_MAPS = {
  A: {
    label: 'lines 1–39',
    names: {
      'A/Ab': '_Ab.js',
      'A/B': '_B.js',
      'A/Bb': '_Bb.js',
      'A/C': '_C.js',
      'A/C#': '_C#.js',
      'A/D': '_D.js',
      'A/E': '_E.js',
      'A/Eb': '_Eb.js',
      'A/F': '_F.js',
      'A/F#': '_F#.js',
      'A/G': '_G.js',
      'A/G#': '_G#.js',
      A69: '69.js',
      'A9#11': '9#11.js',
      Aadd11: 'add11.js',
      Aalt: 'alt.js',
      Aaug9: 'aug9.js',
      'Am/Ab': 'm_Ab.js',
      'Am/B': 'm_B.js',
      'Am/Bb': 'm_Bb.js',
      'Am/C': 'm_C.js',
      'Am/C#': 'm_C#.js',
      'Am/D': 'm_D.js',
      'Am/E': 'm_E.js',
      'Am/Eb': 'm_Eb.js',
      'Am/F': 'm_F.js',
      'Am/F#': 'm_F#.js',
      'Am/G': 'm_G.js',
      'Am/G#': 'm_G#.js',
      Am69: 'm69.js',
      'Am9/C': 'm9_C.js',
      'Am9/G': 'm9_G.js',
      Amaj11: 'maj11.js',
      Amaj7sus2: 'maj7sus2.js',
      Ammaj11: 'mmaj11.js',
      Ammaj7b5: 'mmaj7b5.js',
      Ammaj9: 'mmaj9.js',
      Asus: 'sus.js',
      Asus2sus4: 'sus2sus4.js',
    },
  },
  Ab: {
    label: 'lines 40–75 (Abadd11 omitted — no chord file per working note)',
    names: {
      'Ab/A': '_A.js',
      'Ab/B': '_B.js',
      'Ab/Bb': '_Bb.js',
      'Ab/C': '_C.js',
      'Ab/C#': '_C#.js',
      'Ab/D': '_D.js',
      'Ab/E': '_E.js',
      'Ab/Eb': '_Eb.js',
      'Ab/F': '_F.js',
      'Ab/F#': '_F#.js',
      'Ab/G': '_G.js',
      Ab69: '69.js',
      'Ab9#11': '9#11.js',
      Abalt: 'alt.js',
      Abaug9: 'aug9.js',
      'Abm/A': 'm_A.js',
      'Abm/B': 'm_B.js',
      'Abm/Bb': 'm_Bb.js',
      'Abm/C': 'm_C.js',
      'Abm/C#': 'm_C#.js',
      'Abm/D': 'm_D.js',
      'Abm/E': 'm_E.js',
      'Abm/Eb': 'm_Eb.js',
      'Abm/F': 'm_F.js',
      'Abm/F#': 'm_F#.js',
      'Abm/G': 'm_G.js',
      Abm69: 'm69.js',
      'Abm9/B': 'm9_B.js',
      'Abm9/F#': 'm9_F#.js',
      Abmaj11: 'maj11.js',
      Abmaj7sus2: 'maj7sus2.js',
      Abmmaj11: 'mmaj11.js',
      Abmmaj7b5: 'mmaj7b5.js',
      Abmmaj9: 'mmaj9.js',
      Absus: 'sus.js',
    },
  },
  B: {
    label: 'lines 76–112',
    names: {
      'B/A': '_A.js',
      'B/Ab': '_Ab.js',
      'B/Bb': '_Bb.js',
      'B/C': '_C.js',
      'B/C#': '_C#.js',
      'B/D': '_D.js',
      'B/E': '_E.js',
      'B/Eb': '_Eb.js',
      'B/F': '_F.js',
      'B/F#': '_F#.js',
      'B/G': '_G.js',
      B69: '69.js',
      'B9#11': '9#11.js',
      Badd11: 'add11.js',
      Balt: 'alt.js',
      Baug9: 'aug9.js',
      'Bm/A': 'm_A.js',
      'Bm/Ab': 'm_Ab.js',
      'Bm/Bb': 'm_Bb.js',
      'Bm/C': 'm_C.js',
      'Bm/C#': 'm_C#.js',
      'Bm/D': 'm_D.js',
      'Bm/E': 'm_E.js',
      'Bm/Eb': 'm_Eb.js',
      'Bm/F': 'm_F.js',
      'Bm/F#': 'm_F#.js',
      'Bm/G': 'm_G.js',
      Bm69: 'm69.js',
      'Bm9/A': 'm9_A.js',
      'Bm9/D': 'm9_D.js',
      Bmaj11: 'maj11.js',
      Bmaj7sus2: 'maj7sus2.js',
      Bmmaj11: 'mmaj11.js',
      Bmmaj7b5: 'mmaj7b5.js',
      Bmmaj9: 'mmaj9.js',
      Bsus: 'sus.js',
      Bsus2sus4: 'sus2sus4.js',
    },
  },
  Bb: {
    label: 'lines 113–149',
    names: {
      'Bb/A': '_A.js',
      'Bb/Ab': '_Ab.js',
      'Bb/B': '_B.js',
      'Bb/C': '_C.js',
      'Bb/C#': '_C#.js',
      'Bb/D': '_D.js',
      'Bb/E': '_E.js',
      'Bb/Eb': '_Eb.js',
      'Bb/F': '_F.js',
      'Bb/F#': '_F#.js',
      'Bb/G': '_G.js',
      Bb69: '69.js',
      'Bb9#11': '9#11.js',
      Bbadd11: 'add11.js',
      Bbalt: 'alt.js',
      Bbaug9: 'aug9.js',
      'Bbm/A': 'm_A.js',
      'Bbm/Ab': 'm_Ab.js',
      'Bbm/B': 'm_B.js',
      'Bbm/C': 'm_C.js',
      'Bbm/C#': 'm_C#.js',
      'Bbm/D': 'm_D.js',
      'Bbm/E': 'm_E.js',
      'Bbm/Eb': 'm_Eb.js',
      'Bbm/F': 'm_F.js',
      'Bbm/F#': 'm_F#.js',
      'Bbm/G': 'm_G.js',
      Bbm69: 'm69.js',
      'Bbm9/Ab': 'm9_Ab.js',
      'Bbm9/C#': 'm9_C#.js',
      Bbmaj11: 'maj11.js',
      Bbmaj7sus2: 'maj7sus2.js',
      Bbmmaj11: 'mmaj11.js',
      Bbmmaj7b5: 'mmaj7b5.js',
      Bbmmaj9: 'mmaj9.js',
      Bbsus: 'sus.js',
      Bbsus2sus4: 'sus2sus4.js',
    },
  },
  'C#': {
    label: 'lines 150–186',
    names: {
      'C#/A': '_A.js',
      'C#/Ab': '_Ab.js',
      'C#/B': '_B.js',
      'C#/Bb': '_Bb.js',
      'C#/C': '_C.js',
      'C#/D': '_D.js',
      'C#/E': '_E.js',
      'C#/Eb': '_Eb.js',
      'C#/F': '_F.js',
      'C#/F#': '_F#.js',
      'C#/G': '_G.js',
      'C#69': '69.js',
      'C#9#11': '9#11.js',
      'C#add11': 'add11.js',
      'C#alt': 'alt.js',
      'C#aug9': 'aug9.js',
      'C#m/A': 'm_A.js',
      'C#m/Ab': 'm_Ab.js',
      'C#m/B': 'm_B.js',
      'C#m/Bb': 'm_Bb.js',
      'C#m/C': 'm_C.js',
      'C#m/D': 'm_D.js',
      'C#m/E': 'm_E.js',
      'C#m/Eb': 'm_Eb.js',
      'C#m/F': 'm_F.js',
      'C#m/F#': 'm_F#.js',
      'C#m/G': 'm_G.js',
      'C#m69': 'm69.js',
      'C#m9/B': 'm9_B.js',
      'C#m9/E': 'm9_E.js',
      'C#maj11': 'maj11.js',
      'C#maj7sus2': 'maj7sus2.js',
      'C#mmaj11': 'mmaj11.js',
      'C#mmaj7b5': 'mmaj7b5.js',
      'C#mmaj9': 'mmaj9.js',
      'C#sus': 'sus.js',
      'C#sus2sus4': 'sus2sus4.js',
    },
  },
  C: {
    label: 'lines 187–225',
    names: {
      'C/A': '_A.js',
      'C/Ab': '_Ab.js',
      'C/B': '_B.js',
      'C/Bb': '_Bb.js',
      'C/C#': '_C#.js',
      'C/D': '_D.js',
      'C/E': '_E.js',
      'C/Eb': '_Eb.js',
      'C/F': '_F.js',
      'C/F#': '_F#.js',
      'C/G': '_G.js',
      C69: '69.js',
      'C7/G': '7_G.js',
      'C9#11': '9#11.js',
      Cadd11: 'add11.js',
      Calt: 'alt.js',
      Caug9: 'aug9.js',
      'Cm/A': 'm_A.js',
      'Cm/Ab': 'm_Ab.js',
      'Cm/B': 'm_B.js',
      'Cm/Bb': 'm_Bb.js',
      'Cm/C#': 'm_C#.js',
      'Cm/D': 'm_D.js',
      'Cm/E': 'm_E.js',
      'Cm/Eb': 'm_Eb.js',
      'Cm/F': 'm_F.js',
      'Cm/F#': 'm_F#.js',
      'Cm/G': 'm_G.js',
      Cm69: 'm69.js',
      'Cm9/Bb': 'm9_Bb.js',
      'Cm9/Eb': 'm9_Eb.js',
      Cmaj11: 'maj11.js',
      Cmaj7sus2: 'maj7sus2.js',
      'Cmaj9/B': 'maj9_B.js',
      Cmmaj11: 'mmaj11.js',
      Cmmaj7b5: 'mmaj7b5.js',
      Cmmaj9: 'mmaj9.js',
      Csus: 'sus.js',
      Csus2sus4: 'sus2sus4.js',
    },
  },
  D: {
    label: 'lines 226–261',
    names: {
      'D/A': '_A.js',
      'D/Ab': '_Ab.js',
      'D/B': '_B.js',
      'D/Bb': '_Bb.js',
      'D/C': '_C.js',
      'D/C#': '_C#.js',
      'D/E': '_E.js',
      'D/Eb': '_Eb.js',
      'D/F': '_F.js',
      'D/G': '_G.js',
      D69: '69.js',
      'D9#11': '9#11.js',
      Dadd11: 'add11.js',
      Dalt: 'alt.js',
      Daug9: 'aug9.js',
      'Dm/A': 'm_A.js',
      'Dm/Ab': 'm_Ab.js',
      'Dm/B': 'm_B.js',
      'Dm/Bb': 'm_Bb.js',
      'Dm/C': 'm_C.js',
      'Dm/C#': 'm_C#.js',
      'Dm/E': 'm_E.js',
      'Dm/Eb': 'm_Eb.js',
      'Dm/F': 'm_F.js',
      'Dm/F#': 'm_F#.js',
      'Dm/G': 'm_G.js',
      Dm69: 'm69.js',
      'Dm9/C': 'm9_C.js',
      'Dm9/F': 'm9_F.js',
      Dmaj11: 'maj11.js',
      Dmaj7sus2: 'maj7sus2.js',
      Dmmaj11: 'mmaj11.js',
      Dmmaj7b5: 'mmaj7b5.js',
      Dmmaj9: 'mmaj9.js',
      Dsus: 'sus.js',
      Dsus2sus4: 'sus2sus4.js',
    },
  },
};

const SKIP_FILES = new Set(['index.js', '7#9.js']);

const BETWEEN_MS = 1400;
const RETRY_429_MAX = 8;
const RETRY_429_BASE_MS = 3500;

function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

async function fetchMarkdownThrottled(pageUrl) {
  await sleep(BETWEEN_MS);
  let lastErr;
  for (let attempt = 0; attempt < RETRY_429_MAX; attempt += 1) {
    try {
      return await fetchMarkdown(pageUrl);
    } catch (e) {
      lastErr = e;
      const msg = e && e.message ? e.message : String(e);
      if (msg.includes('429') && attempt < RETRY_429_MAX - 1) {
        await sleep(RETRY_429_BASE_MS * (attempt + 1));
        continue;
      }
      throw e;
    }
  }
  throw lastErr;
}

function parseArgs(argv) {
  let dryRun = false;
  let keyFolder = null;
  let keyList = null;
  for (let i = 0; i < argv.length; i += 1) {
    if (argv[i] === '--dry-run') dryRun = true;
    if (argv[i] === '--key' && argv[i + 1]) {
      keyFolder = argv[i + 1];
      i += 1;
    } else if (argv[i] === '--keys' && argv[i + 1]) {
      keyList = argv[i + 1]
        .split(',')
        .map((s) => s.trim())
        .filter(Boolean);
      i += 1;
    }
  }
  return { dryRun, keyFolder, keyList };
}

function parseKeySuffix(text) {
  const keyM = /key:\s*'([^']+)'/.exec(text);
  const suffixM = /suffix:\s*'([^']+)'/.exec(text);
  if (!keyM || !suffixM) throw new Error('could not parse key/suffix');
  return { key: keyM[1], suffix: suffixM[1] };
}

function parsePositionsFromModule(text) {
  const m = /positions:\s*\[([\s\S]*)\]\s*,?\s*\}/.exec(text);
  if (!m) return [];
  const arrContent = m[1];
  const blocks = [];
  let i = 0;
  while (i < arrContent.length) {
    while (i < arrContent.length && /\s/.test(arrContent[i])) i += 1;
    if (i >= arrContent.length || arrContent[i] !== '{') break;
    let depth = 0;
    const start = i;
    for (; i < arrContent.length; i += 1) {
      const c = arrContent[i];
      if (c === '{') depth += 1;
      else if (c === '}') {
        depth -= 1;
        if (depth === 0) {
          i += 1;
          break;
        }
      }
    }
    blocks.push(arrContent.slice(start, i));
  }
  return blocks.map((block) => {
    const o = {};
    const sc = /\/\/\s*sourceChart:\s*(\S+)/.exec(block);
    if (sc) o.sourceChart = sc[1];
    const fr = /frets:\s*'([^']+)'/.exec(block);
    if (fr) o.frets = fr[1];
    const fing = /fingers:\s*'([^']+)'/.exec(block);
    if (fing) o.fingers = fing[1];
    const bar = /barres:\s*(\d+)/.exec(block);
    if (bar) o.barres = Number(bar[1], 10);
    return o;
  });
}

function extractPreambleNonSourcePage(text) {
  const lines = text.split('\n');
  const out = [];
  let seenExport = false;
  for (const line of lines) {
    if (/^\s*export\s+default/.test(line)) {
      seenExport = true;
      break;
    }
    if (/^\s*\/\/\s*sourcePage:/.test(line)) continue;
    out.push(line);
  }
  if (!seenExport) return '';
  const s = out.join('\n').trimEnd();
  return s ? `${s}\n\n` : '';
}

function buildPagePositions(markdown, key, suffix, instrument) {
  const ctx = { key, suffix };
  const chartMap = extractBanjoCharts(markdown, instrument, ctx);
  const sharpMap = extractSharpBassChartMap(markdown, key, suffix);
  const sharpList = extractSharpBassChartFretsFromUrls(markdown);
  const uniqueSharp = [...new Set(sharpList)];

  if (isSlashSharpChordSuffix(suffix)) {
    if (sharpMap.size > 0) {
      return [...sharpMap.entries()]
        .sort((a, b) => a[0].localeCompare(b[0]))
        .map(([frets, url]) => ({ frets, sourceChart: url }));
    }
    if (uniqueSharp.length > 0) {
      return uniqueSharp
        .sort()
        .map((frets) => ({ frets, sourceChart: undefined }));
    }
  }

  return [...chartMap.entries()]
    .sort((a, b) => a[0].localeCompare(b[0]))
    .map(([frets, url]) => {
      const pos = { frets };
      if (url) pos.sourceChart = url;
      return pos;
    });
}

function formatModule(pageUrl, key, suffix, positions, preambleExtra = '') {
  let s = preambleExtra;
  s += `// sourcePage: ${pageUrl}\n`;
  s += 'export default {\n';
  s += `  key: '${key}',\n`;
  s += `  suffix: '${suffix}',\n`;
  s += '  positions: [\n';
  for (const p of positions) {
    s += '    {\n';
    if (p.sourceChart) s += `      // sourceChart: ${p.sourceChart}\n`;
    s += `      frets: '${p.frets}',\n`;
    if (p.fingers) s += `      fingers: '${p.fingers}',\n`;
    if (p.barres != null) s += `      barres: ${p.barres},\n`;
    s += '    },\n';
  }
  s += '  ],\n};\n';
  return s;
}

function specialPreambleFor69(key) {
  return `// Site title uses ${key}6\\9; PNGs use \`banjo-${key}6_9-…\`.\n`;
}

function mergePositions(local, page) {
  const have = new Set(local.map((p) => p.frets));
  const added = page.filter((p) => !have.has(p.frets));
  return [...local, ...added];
}

/**
 * @param {string} keyFolder - Directory name under chords/, e.g. 'A', 'Ab', 'B'
 * @param {string[]} argv - process.argv slice (optional flags)
 */
export async function syncBanjoKeyFromScales(keyFolder, argv = []) {
  const cfg = WORKING_MAPS[keyFolder];
  if (!cfg) {
    throw new Error(
      `Unknown key "${keyFolder}". Known: ${Object.keys(WORKING_MAPS).join(', ')}`,
    );
  }

  const dryRun = argv.includes('--dry-run');

  const chordDir = path.resolve('src/db/banjo-open-g/chords', keyFolder);
  const replaceFromWorking = new Set(Object.values(cfg.names));

  const files = fs
    .readdirSync(chordDir)
    .filter((f) => f.endsWith('.js') && !SKIP_FILES.has(f))
    .sort();

  let updated = 0;
  for (const f of files) {
    const abs = path.join(chordDir, f);
    const text = fs.readFileSync(abs, 'utf8');
    const { key, suffix } = parseKeySuffix(text);
    const pageUrl = buildBanjoPageUrlBackslash(key, suffix);
    const replaceMode = replaceFromWorking.has(f);

    let markdown;
    try {
      markdown = await fetchMarkdownThrottled(pageUrl);
    } catch (e) {
      console.error(`SKIP ${keyFolder}/${f}: fetch failed: ${e.message}`);
      continue;
    }

    const pagePositions = buildPagePositions(markdown, key, suffix, 'banjo');
    if (pagePositions.length === 0) {
      console.warn(`WARN ${keyFolder}/${f}: no voicings extracted from page`);
      continue;
    }

    const local = parsePositionsFromModule(text);
    let next;
    if (replaceMode) {
      next = pagePositions;
    } else {
      next = mergePositions(local, pagePositions);
      const localFretsSorted = [...local.map((p) => p.frets)].sort().join('|');
      const nextFretsSorted = [...next.map((p) => p.frets)].sort().join('|');
      if (localFretsSorted === nextFretsSorted) continue;
    }

    const preamble69 = f === '69.js' ? specialPreambleFor69(key) : '';

    if (replaceMode) {
      const out = formatModule(pageUrl, key, suffix, next, preamble69);
      if (out === text) continue;
      if (!dryRun) fs.writeFileSync(abs, out, 'utf8');
      console.log(`${dryRun ? '[dry-run] ' : ''}REPLACE ${keyFolder}/${f} (${next.length} positions)`);
      updated += 1;
    } else {
      const preamble = extractPreambleNonSourcePage(text) + preamble69;
      const out = formatModule(pageUrl, key, suffix, next, preamble);
      if (out === text) continue;
      if (!dryRun) fs.writeFileSync(abs, out, 'utf8');
      const added = next.length - local.length;
      console.log(
        `${dryRun ? '[dry-run] ' : ''}MERGE ${keyFolder}/${f} (local ${local.length} → ${next.length}, +${added} new)`,
      );
      updated += 1;
    }
  }

  console.log(
    `Done [${keyFolder}, ${cfg.label}]. ${dryRun ? 'Would update' : 'Updated'} ${updated} file(s).`,
  );
  return updated;
}

async function cliMain() {
  const { keyFolder, keyList } = parseArgs(process.argv.slice(2));
  const keys = keyList && keyList.length ? keyList : keyFolder ? [keyFolder] : [];
  if (keys.length === 0) {
    console.error(
      'Usage: node scripts/sync-banjo-key-from-scales.mjs --key <A|Ab|B|...> [--dry-run]\n' +
        '   or: node scripts/sync-banjo-key-from-scales.mjs --keys C,C#,D [--dry-run]',
    );
    process.exit(1);
  }
  for (const key of keys) {
    await syncBanjoKeyFromScales(key, process.argv.slice(2));
  }
}

const isMain =
  process.argv[1] && pathToFileURL(path.resolve(process.argv[1])).href === import.meta.url;

if (isMain) {
  cliMain().catch((e) => {
    console.error(e);
    process.exit(1);
  });
}
