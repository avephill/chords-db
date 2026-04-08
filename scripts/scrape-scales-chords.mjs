#!/usr/bin/env node
/**
 * Scrape chord voicings from scales-chords.com pages and optionally write chord-db modules.
 *
 * Examples:
 *   node scripts/scrape-scales-chords.mjs --url "https://www.scales-chords.com/chord/banjo/D%5CF%2523" --key D --suffix "/F#"
 *   node scripts/scrape-scales-chords.mjs --url "https://www.scales-chords.com/chord/banjo/D%5CF%2523" --out-file "src/db/banjo-open-g/chords/D/_F#.js" --key D --suffix "/F#"
 *   node scripts/scrape-scales-chords.mjs --urls-file "scripts/scales-chords-urls.txt" --out-root "src/db/banjo-open-g/chords"
 */
import fs from 'fs';
import path from 'path';

function parseArgs(argv) {
  const out = {
    url: [],
    urlsFile: null,
    outFile: null,
    outRoot: null,
    key: null,
    suffix: null,
    instrument: 'banjo',
    help: false,
  };

  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    const next = argv[i + 1];
    if (arg === '--help' || arg === '-h') out.help = true;
    else if (arg === '--url' && next) {
      out.url.push(next);
      i += 1;
    } else if (arg === '--urls-file' && next) {
      out.urlsFile = next;
      i += 1;
    } else if (arg === '--out-file' && next) {
      out.outFile = next;
      i += 1;
    } else if (arg === '--out-root' && next) {
      out.outRoot = next;
      i += 1;
    } else if (arg === '--key' && next) {
      out.key = next;
      i += 1;
    } else if (arg === '--suffix' && next) {
      out.suffix = next;
      i += 1;
    } else if (arg === '--instrument' && next) {
      out.instrument = next.toLowerCase();
      i += 1;
    }
  }
  return out;
}

function printHelp() {
  console.log(`Usage:
  node scripts/scrape-scales-chords.mjs [options]

Options:
  --url <url>           Scales-Chords page URL (repeatable)
  --urls-file <path>    Text file containing one URL per line
  --key <key>           Chord key for filtering/writing (e.g. D)
  --suffix <suffix>     chord-db suffix (e.g. /F#, major, m7)
  --instrument <name>   Source instrument in URL and labels (default: banjo)
  --out-file <path>     Write one chord module file
  --out-root <path>     Batch write files to <out-root>/<Key>/<stem>.js
  --help                Show this help

Notes:
  - Uses https://r.jina.ai/http://... as fetch proxy (bypasses site bot blocks).
  - URL name forms are normalized with helpers like:
      file stem "_F#" -> suffix "/F#" -> URL path "D/F#".`);
}

function escapeRegExp(v) {
  return v.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function fileStemToSuffix(stem) {
  if (!stem) return 'major';
  if (stem.startsWith('_')) return '/' + stem.slice(1);
  if (stem === 'minor') return 'minor';
  return stem;
}

function suffixToFileStem(suffix) {
  if (suffix === 'major') return 'major';
  if (suffix === 'minor' || suffix === 'm') return 'minor';
  if (suffix.startsWith('/')) return '_' + suffix.slice(1);
  return suffix;
}

function buildChordPath(key, suffix) {
  if (suffix.startsWith('/')) return `${key}/${suffix.slice(1)}`;
  if (suffix === 'major') return key;
  if (suffix === 'minor' || suffix === 'm') return `${key}m`;
  return `${key}${suffix}`;
}

function encodeChordPath(pathLike) {
  return pathLike
    .split('/')
    .map((seg) => encodeURIComponent(seg))
    .join('/');
}

function extractFromChordPath(urlLike) {
  const url = new URL(urlLike);
  const parts = url.pathname.split('/').filter(Boolean);
  const chordPartIdx = parts.findIndex((p) => p === 'chord');
  if (chordPartIdx < 0 || chordPartIdx + 2 >= parts.length) return null;

  const instrument = decodeURIComponent(parts[chordPartIdx + 1]);
  const first = decodeURIComponent(parts[chordPartIdx + 2] || '');
  const second = decodeURIComponent(parts[chordPartIdx + 3] || '');

  if (second) {
    return { instrument, key: first, suffix: `/${second}` };
  }

  const m = /^([A-G](?:#|b)?)(.*)$/.exec(first);
  if (!m) return null;
  const key = m[1];
  const rem = m[2];
  if (!rem) return { instrument, key, suffix: 'major' };
  if (rem === 'm') return { instrument, key, suffix: 'minor' };
  return { instrument, key, suffix: rem };
}

function isTargetLabel(label, key, suffix) {
  if (!key || !suffix) return true;
  const flat = label.replace(/\s+/g, '');

  if (suffix.startsWith('/')) {
    const bass = suffix.slice(1);
    const rx = new RegExp(`^${escapeRegExp(key)}(?:maj|major)?\\\\${escapeRegExp(bass)}$`, 'i');
    return rx.test(flat);
  }

  if (suffix === 'major') {
    const rx = new RegExp(`^${escapeRegExp(key)}(?:maj|major)?$`, 'i');
    return rx.test(flat);
  }

  if (suffix === 'minor') {
    const rx = new RegExp(`^${escapeRegExp(key)}(?:m|minor)$`, 'i');
    return rx.test(flat);
  }

  const rx = new RegExp(`^${escapeRegExp(key)}${escapeRegExp(suffix)}$`, 'i');
  return rx.test(flat);
}

function spaceFretsToDbFrets(spaceFrets) {
  return spaceFrets
    .trim()
    .split(/\s+/)
    .map((token) => {
      if (token.toLowerCase() === 'x') return 'x';
      const n = Number.parseInt(token, 10);
      if (Number.isNaN(n) || n < 0) throw new Error(`invalid fret token "${token}"`);
      return n.toString(16);
    })
    .join('');
}

function extractVoicings(markdown, { instrument, key, suffix }) {
  const rows = [];
  const seen = new Set();
  const rx =
    /Fretboard image for the ([^"]+?) chord on (?:left handled |left handed )?([a-zA-Z-]+) frets:\s*([xX0-9 ]+)/g;

  let match;
  while ((match = rx.exec(markdown)) !== null) {
    const label = match[1].trim();
    const inst = match[2].toLowerCase();
    const spaced = match[3].trim().replace(/\s+/g, ' ');
    if (inst !== instrument.toLowerCase()) continue;
    if (!isTargetLabel(label, key, suffix)) continue;

    const dbFrets = spaceFretsToDbFrets(spaced);
    if (seen.has(dbFrets)) continue;
    seen.add(dbFrets);
    rows.push({ label, spaced, dbFrets });
  }
  return rows;
}

async function fetchThroughJina(sourceUrl) {
  const url = new URL(sourceUrl);
  const httpSource = `http://${url.host}${url.pathname}${url.search}`;
  const proxyUrl = `https://r.jina.ai/${httpSource}`;
  const res = await fetch(proxyUrl);
  if (!res.ok) {
    throw new Error(`fetch failed: ${res.status} ${res.statusText} (${proxyUrl})`);
  }
  return res.text();
}

function chordModuleSource(key, suffix, voicings) {
  const positions = voicings
    .map((v) => `    {\n      frets: '${v.dbFrets}',\n    }`)
    .join(',\n');
  return `export default {\n  key: '${key}',\n  suffix: '${suffix}',\n  positions: [\n${positions},\n  ],\n};\n`;
}

function ensureDir(dir) {
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  if (args.help) {
    printHelp();
    process.exit(0);
  }

  const urls = [...args.url];
  if (args.urlsFile) {
    const fromFile = fs
      .readFileSync(args.urlsFile, 'utf8')
      .split(/\r?\n/)
      .map((x) => x.trim())
      .filter((x) => x && !x.startsWith('#'));
    urls.push(...fromFile);
  }

  if (urls.length === 0) {
    if (args.key && args.suffix) {
      const chordPath = buildChordPath(args.key, args.suffix);
      urls.push(`https://www.scales-chords.com/chord/${args.instrument}/${encodeChordPath(chordPath)}`);
    } else {
      printHelp();
      process.exit(1);
    }
  }

  for (const url of urls) {
    const derived = extractFromChordPath(url) || {};
    const key = args.key || derived.key;
    const suffix = args.suffix || derived.suffix;
    const instrument = args.instrument || derived.instrument || 'banjo';
    if (!key || !suffix) {
      throw new Error(`could not derive key/suffix from URL: ${url}`);
    }

    const markdown = await fetchThroughJina(url);
    const voicings = extractVoicings(markdown, { instrument, key, suffix });
    console.log(`\n${key}${suffix} (${url})`);
    if (voicings.length === 0) {
      console.log('  no voicings extracted');
      continue;
    }
    for (const v of voicings) {
      console.log(`  - ${v.spaced}  ->  ${v.dbFrets}`);
    }

    const source = chordModuleSource(key, suffix, voicings);
    if (args.outFile) {
      ensureDir(path.dirname(args.outFile));
      fs.writeFileSync(args.outFile, source);
      console.log(`  wrote ${args.outFile}`);
    }
    if (args.outRoot) {
      const keyDir = path.join(args.outRoot, key);
      const stem = suffixToFileStem(suffix);
      const outPath = path.join(keyDir, `${stem}.js`);
      ensureDir(keyDir);
      fs.writeFileSync(outPath, source);
      console.log(`  wrote ${outPath}`);
    }
  }
}

main().catch((err) => {
  console.error(err.message || err);
  process.exit(1);
});
