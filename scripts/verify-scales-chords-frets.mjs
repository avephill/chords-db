#!/usr/bin/env node
/**
 * Compare banjo chord .js frets against Scales-Chords markdown (via r.jina.ai).
 *
 * URL convention for slash chords (matches site bookmarks):
 *   A/F# in data -> path segment Key\\Bass -> https://www.scales-chords.com/chord/banjo/A%5CF%23
 *   Am/Eb -> Am\\Eb -> https://www.scales-chords.com/chord/banjo/Am%5CEb
 * Forward-slash paths (e.g. .../banjo/A/F%23) are a different shape; use --url if needed.
 *
 * Sharp bass in slash-chord PNGs uses **`s`** after the bass letter: `_Fs`, `_Cs`, `_Gs`
 * (e.g. `banjo-A_Fs-…`, `banjo-Am_Cs-…`). Natural bass uses the plain letter + hyphen (`_F-`, `_C-`).
 * For `/F#`, `/C#`, `/G#`, `m/F#`, … compare against those `…s` chart URLs when present.
 *
 * Usage:
 *   node scripts/verify-scales-chords-frets.mjs --file src/db/banjo-open-g/chords/A/_F#.js
 *   node scripts/verify-scales-chords-frets.mjs --file ... --url "https://www.scales-chords.com/chord/banjo/A%5CF%23"
 *
 * Chords with `#` in the path (e.g. A7#9 → …/A7%239) are double-encoded when fetching via Jina so the correct page is returned.
 */

import fs from 'fs';
import https from 'https';
import path from 'path';
import { pathToFileURL } from 'url';

function parseArgs(argv) {
  let file = null;
  let url = null;
  let instrument = 'banjo';
  for (let i = 0; i < argv.length; i += 1) {
    if (argv[i] === '--file' && argv[i + 1]) {
      file = argv[i + 1];
      i += 1;
    } else if (argv[i] === '--url' && argv[i + 1]) {
      url = argv[i + 1];
      i += 1;
    } else if (argv[i] === '--instrument' && argv[i + 1]) {
      instrument = argv[i + 1];
      i += 1;
    }
  }
  return { file, url, instrument };
}

/** Slash chords: single path segment Key\\Bass (Scales-Chords backslash form). */
export function buildBanjoPageUrlBackslash(key, suffix) {
  if (suffix.startsWith('/')) {
    const bass = suffix.slice(1);
    return `https://www.scales-chords.com/chord/banjo/${encodeURIComponent(`${key}\\${bass}`)}`;
  }
  if (suffix.startsWith('m/')) {
    const bass = suffix.slice(2);
    return `https://www.scales-chords.com/chord/banjo/${encodeURIComponent(`${key}m\\${bass}`)}`;
  }
  if (suffix === 'major') {
    return `https://www.scales-chords.com/chord/banjo/${encodeURIComponent(key)}`;
  }
  if (suffix === 'minor' || suffix === 'm') {
    return `https://www.scales-chords.com/chord/banjo/${encodeURIComponent(`${key}m`)}`;
  }
  return `https://www.scales-chords.com/chord/banjo/${encodeURIComponent(key + suffix)}`;
}

export function spaceFretsToDb(spaced) {
  return spaced
    .trim()
    .split(/\s+/)
    .map((t) => {
      const tl = t.toLowerCase();
      if (tl === 'x') return 'x';
      const n = Number.parseInt(tl, 10);
      if (Number.isNaN(n) || n < 0) throw new Error(`bad token: ${t}`);
      return n.toString(16);
    })
    .join('');
}

/** e.g. `4-2-2-2-2` or `x-x-11-11-12` -> db fret string */
export function hyphenFretsToDb(hyphenSegment) {
  const parts = hyphenSegment.split('-');
  return parts
    .map((t) => {
      const tl = t.toLowerCase();
      if (tl === 'x') return 'x';
      const n = Number.parseInt(tl, 10);
      if (Number.isNaN(n) || n < 0) throw new Error(`bad hyphen token: ${t}`);
      return n.toString(16);
    })
    .join('');
}

/**
 * Sharp-bass banjo chart URLs: `.../banjo-…_(Fs|Cs|Gs)-…-v-<frets>.png`.
 */
export function extractSharpBassChartFretsFromUrls(markdown) {
  const scoped = scopeBanjoChordPageMarkdown(markdown);
  const re =
    /https?:\/\/[^)\s]+\/banjo-.+?_(Fs|Cs|Gs)-[^)\s]*-v-([^.)]+)\.(?:png|jpg)/gi;
  const out = [];
  let m;
  while ((m = re.exec(scoped)) !== null) {
    try {
      out.push(hyphenFretsToDb(m[2]));
    } catch {
      /* skip malformed */
    }
  }
  return out;
}

/** Parse db fret string directly from chart PNG URL `...-v-<hyphen-frets>.png`. */
export function fretsFromBanjoChartUrl(url) {
  const m = /-v-([^.)]+)\.(?:png|jpg)/i.exec(url);
  if (!m) return null;
  try {
    return hyphenFretsToDb(m[1]);
  } catch {
    return null;
  }
}

/** Sharp-bass slash map: fret -> URL, scoped + stem-filtered when ctx is slash. */
export function extractSharpBassChartMap(markdown, key, suffix) {
  const scoped = scopeBanjoChordPageMarkdown(markdown);
  const re =
    /(https?:\/\/[^)\s]+\/banjo-.+?_(Fs|Cs|Gs)-[^)\s]*-v-([^.)]+)\.(?:png|jpg))/gi;
  const map = new Map();
  const isSlash = suffix.startsWith('/') || suffix.startsWith('m/');
  let m;
  while ((m = re.exec(scoped)) !== null) {
    if (isSlash && !banjoSlashChartUrlMatchesChord(key, suffix, m[1])) continue;
    try {
      const db = hyphenFretsToDb(m[3]);
      if (!map.has(db)) map.set(db, m[1]);
    } catch {
      /* skip */
    }
  }
  return map;
}

export function isSlashSharpChordSuffix(suffix) {
  return (
    (suffix.startsWith('/') || suffix.startsWith('m/')) &&
    suffix.includes('#') &&
    !/^\d/.test(suffix)
  );
}

function sourceChartUrlIsSharpBassBanjo(url) {
  return /\/banjo-.+?_(Fs|Cs|Gs)-/.test(url);
}

function extractSourceChartUrlsFromFile(text) {
  const re = /\/\/\s*sourceChart:\s*(\S+)/g;
  const urls = [];
  let m;
  while ((m = re.exec(text)) !== null) urls.push(m[1]);
  return urls;
}

function fretsFromSourceChartUrl(url) {
  const m = /-v-([^.)]+)\.(?:png|jpg)/i.exec(url);
  if (!m) return null;
  try {
    return hyphenFretsToDb(m[1]);
  } catch {
    return null;
  }
}

function parseChordModule(text) {
  const keyM = /key:\s*'([^']+)'/.exec(text);
  const suffixM = /suffix:\s*'([^']+)'/.exec(text);
  if (!keyM || !suffixM) throw new Error('could not parse key/suffix from chord module');
  const frets = [];
  const re = /frets:\s*'([^']+)'/g;
  let m;
  while ((m = re.exec(text)) !== null) frets.push(m[1]);
  return { key: keyM[1], suffix: suffixM[1], frets };
}

export function sliceBeforeHorizontal(md) {
  const cut = md.search(/##\s+Horizontal Chord Charts/i);
  return cut >= 0 ? md.slice(0, cut) : md;
}

/**
 * Keep only the main chord chart region of the Jina markdown. Sections like
 * "Inversions on banjo" list other slash chords (wrong PNG stems) and must be excluded
 * — same cut list as import-banjo-open-g-from-working-list.mjs.
 */
export function scopeBanjoChordPageMarkdown(md) {
  const cutMarkers = [
    /##\s+Horizontal Chord Charts/i,
    /##\s+.*Inversions on banjo/i,
    /##\s+.*Inversions\s*\(/i,
    /##\s+.*chord charts for left handed banjo/i,
    /##\s+Chords related to/i,
  ];
  let cut = md.length;
  for (const marker of cutMarkers) {
    const m = marker.exec(md);
    if (m && m.index < cut) cut = m.index;
  }
  return md.slice(0, cut);
}

/**
 * PNG path segment after `banjo-` and before the layout token ending in `-l-v`
 * (e.g. `-a-n-l-v`, `-b-n-l-v`, `-a-flat-l-v`, `-b-flat-l-v`, `-c-n-l-v`, …).
 */
export function extractBanjoChartStemFromUrl(url) {
  const u = url.replace(/\\/g, '/');
  const m = /\/banjo-(.+?)-((?:[a-z]+-)+l)-v-/i.exec(u);
  return m ? m[1] : null;
}

/** Bass letter(s) from suffix `/Eb` or `m/C#` → filename tokens used on scales-chords PNGs (enharmonic variants). */
function bassNoteToBanjoFileTokens(bass) {
  const t = {
    C: ['C'],
    D: ['D'],
    E: ['E'],
    F: ['F'],
    G: ['G'],
    A: ['A', 'Bbb'],
    B: ['B', 'Cb'],
    'C#': ['Cs', 'Db'],
    'D#': ['Ds', 'Eb'],
    'F#': ['Fs', 'Gb'],
    'G#': ['Gs', 'Ab'],
    'A#': ['As', 'Bb'],
    Db: ['Db', 'Cs'],
    Eb: ['Eb', 'Ds'],
    Gb: ['Gb', 'Fs'],
    Ab: ['Ab', 'Gs'],
    Bb: ['Bb', 'As'],
  };
  return t[bass] || [bass];
}

/**
 * Acceptable `banjo-<stem>-…` stems for slash chords (major or minor triad / bass).
 */
export function expectedSlashBanjoChartStems(key, suffix) {
  const keyToken = key.replace(/#/g, 's');
  let rootPrefix;
  let bass;
  if (suffix.startsWith('m/')) {
    rootPrefix = `${keyToken}m`;
    bass = suffix.slice(2);
  } else if (suffix.startsWith('/')) {
    rootPrefix = keyToken;
    bass = suffix.slice(1);
  } else {
    return null;
  }
  const tokens = bassNoteToBanjoFileTokens(bass);
  return tokens.map((tok) => `${rootPrefix}_${tok}`);
}

export function banjoSlashChartUrlMatchesChord(key, suffix, url) {
  const expected = expectedSlashBanjoChartStems(key, suffix);
  if (!expected || !url) return true;
  const stem = extractBanjoChartStemFromUrl(url);
  if (!stem) return false;
  return expected.some((e) => stem === e);
}

/**
 * Extract banjo voicings from markdown using chart URL filenames only:
 * fret string -> first chart image URL seen for that voicing.
 * No OCR/image-derived fret lines are used.
 * @param {{ key?: string, suffix?: string }} [ctx] - when set for slash chords, drops charts whose PNG stem does not match this chord (excludes inversion sections if any slip through).
 */
export function extractBanjoCharts(markdown, instrument, ctx) {
  if (instrument.toLowerCase() !== 'banjo') return new Map();
  const scoped = scopeBanjoChordPageMarkdown(markdown);
  const map = new Map();
  const isSlash =
    ctx && ctx.suffix && (ctx.suffix.startsWith('/') || ctx.suffix.startsWith('m/'));
  // URL may contain `)` (e.g. …Aadd(11)-…png), so stop at whitespace/`)`.
  const rx = /https?:\/\/[^\s]+?\/chord-charts\/banjo-[^\s]+?\.(?:png|jpg)/gi;
  let m;
  while ((m = rx.exec(scoped)) !== null) {
    const url = m[0];
    if (isSlash && ctx && !banjoSlashChartUrlMatchesChord(ctx.key, ctx.suffix, url)) continue;
    const db = fretsFromBanjoChartUrl(url);
    if (!db) continue;
    if (!map.has(db)) map.set(db, url);
  }

  return map;
}

function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

/** r.jina.ai may return 429 when called in bursts; retry with backoff. */
export async function fetchMarkdown(pageUrl, { maxAttempts = 5 } = {}) {
  const u = new URL(pageUrl);
  // r.jina.ai treats `%23` in the path like a URL fragment; double-encode so A7#9 pages resolve.
  const pathForJina = u.pathname.replace(/%23/g, '%2523');
  const jina = `https://r.jina.ai/http://${u.host}${pathForJina}${u.search}`;
  let lastErr;
  for (let attempt = 0; attempt < maxAttempts; attempt += 1) {
    try {
      const body = await new Promise((resolve, reject) => {
        https
          .get(jina, { headers: { 'User-Agent': 'verify-scales-chords-frets/1' } }, (res) => {
            if (res.statusCode && res.statusCode >= 400) {
              res.resume();
              reject(new Error(`fetch failed: ${res.statusCode} ${jina}`));
              return;
            }
            const chunks = [];
            res.on('data', (c) => chunks.push(c));
            res.on('end', () => resolve(Buffer.concat(chunks).toString('utf8')));
            res.on('error', reject);
          })
          .on('error', reject);
      });
      return body;
    } catch (e) {
      lastErr = e;
      const msg = e && e.message ? e.message : String(e);
      if (msg.includes('429') && attempt < maxAttempts - 1) {
        await sleep(2800 * (attempt + 1));
        continue;
      }
      throw e;
    }
  }
  throw lastErr;
}

function titleLine(markdown) {
  const m = /^#\s+([^\n]+)/m.exec(markdown);
  return m ? m[1].trim() : '';
}

function multisetEqual(a, b) {
  if (a.length !== b.length) return false;
  const sa = [...a].sort();
  const sb = [...b].sort();
  return sa.every((v, i) => v === sb[i]);
}

async function main() {
  const { file, url: urlArg, instrument } = parseArgs(process.argv.slice(2));
  if (!file) {
    console.error('Usage: node scripts/verify-scales-chords-frets.mjs --file <chord.js> [--url <page>]');
    process.exit(1);
  }

  const abs = path.resolve(file);
  const text = fs.readFileSync(abs, 'utf8');
  const mod = parseChordModule(text);
  const pageUrl = urlArg || buildBanjoPageUrlBackslash(mod.key, mod.suffix);

  console.log(`file: ${abs}`);
  console.log(`key: ${mod.key}  suffix: ${mod.suffix}`);
  console.log(`pageUrl: ${pageUrl}`);

  const markdown = await fetchMarkdown(pageUrl);
  console.log(`pageTitle: ${titleLine(markdown)}`);

  const chartMap = extractBanjoCharts(markdown, instrument, {
    key: mod.key,
    suffix: mod.suffix,
  });
  const pageFretsFromMd = [...chartMap.keys()];

  const sharpFromPage = extractSharpBassChartFretsFromUrls(markdown);
  const uniqueSharpFromPage = [...new Set(sharpFromPage)];

  let pageFrets = pageFretsFromMd;
  let compareMode = 'chart_url_frets';

  if (isSlashSharpChordSuffix(mod.suffix)) {
    const srcUrls = extractSourceChartUrlsFromFile(text);
    const sharpUrls = srcUrls.filter(sourceChartUrlIsSharpBassBanjo);
    const fretsFromFileCharts = sharpUrls.map(fretsFromSourceChartUrl).filter(Boolean);

    if (uniqueSharpFromPage.length > 0 && multisetEqual(mod.frets, uniqueSharpFromPage)) {
      pageFrets = uniqueSharpFromPage;
      compareMode = 'banjo_sharp_bass_png_urls';
      console.log('\nUsing banjo-*_(Fs|Cs|Gs)- chart URLs from page markdown (sharp bass PNGs).');
    } else if (
      sharpUrls.length > 0 &&
      fretsFromFileCharts.length === sharpUrls.length &&
      multisetEqual(mod.frets, [...new Set(fretsFromFileCharts)])
    ) {
      pageFrets = [...new Set(fretsFromFileCharts)];
      compareMode = 'sourceChart_sharp_bass';
      console.log(
        '\nComparing to // sourceChart lines with banjo-*_(Fs|Cs|Gs)- filenames (page HTML may omit or only partly list them).',
      );
    } else if (uniqueSharpFromPage.length > 0) {
      console.log(
        '\nNote: Page lists some sharp-bass (_Fs/_Cs/_Gs) PNGs but not a full matching set; falling back to fretboard lines in markdown.',
      );
    }
  }

  const missingOnPage = mod.frets.filter((f) => !pageFrets.includes(f));
  const extraOnPage = pageFrets.filter((f) => !mod.frets.includes(f));

  const ok = multisetEqual(mod.frets, pageFrets);

  console.log('\nLocal frets:', mod.frets.join(', '));
  console.log(`Page frets (${compareMode}):`, [...pageFrets].sort().join(', '));
  if (missingOnPage.length) console.log('MISSING on page (in file, not on page):', missingOnPage.join(', '));
  if (extraOnPage.length) console.log('EXTRA on page (on page, not in file):', extraOnPage.join(', '));

  if (ok && missingOnPage.length === 0 && extraOnPage.length === 0) {
    console.log('\nOK: fret multisets match.');
    process.exitCode = 0;
    return;
  }
  console.log('\nMISMATCH: update file or page URL.');
  process.exitCode = 1;
}

const isMain =
  process.argv[1] && pathToFileURL(path.resolve(process.argv[1])).href === import.meta.url;

if (isMain) {
  main()
    .then(() => {
      process.exit(process.exitCode ?? 0);
    })
    .catch((e) => {
      console.error(e.message || e);
      process.exit(1);
    });
}
