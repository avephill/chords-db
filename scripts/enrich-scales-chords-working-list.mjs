#!/usr/bin/env node
import fs from 'fs';
import path from 'path';

const DEFAULT_FILE = path.join(
  process.cwd(),
  'src',
  'db',
  'banjo-open-g',
  'chords',
  'Banjo-chords-working.txt'
);

function parseArgs(argv) {
  const args = {
    file: DEFAULT_FILE,
    instrument: 'banjo',
    concurrency: 12,
  };
  for (let i = 0; i < argv.length; i += 1) {
    const a = argv[i];
    const n = argv[i + 1];
    if (a === '--file' && n) {
      args.file = path.resolve(n);
      i += 1;
    } else if (a === '--instrument' && n) {
      args.instrument = n.toLowerCase();
      i += 1;
    } else if (a === '--concurrency' && n) {
      args.concurrency = Number.parseInt(n, 10) || args.concurrency;
      i += 1;
    }
  }
  return args;
}

function parseLine(line) {
  if (!line.trim()) return null;
  const [main, ...rest] = line.split('##');
  const comment = rest.length ? `##${rest.join('##').trim()}` : '';
  const parts = main.trim().split(/\s+/);
  const chord = parts[0];
  const existingUrl = parts.find((p) => p.startsWith('http://') || p.startsWith('https://')) || '';
  return { chord, existingUrl, comment };
}

function chordToPathVariants(chord) {
  const variants = [];
  const add = (v) => {
    if (v && !variants.includes(v)) variants.push(v);
  };

  const slashStyle = chord.replace('/', '\\');
  add(slashStyle);

  const slashParts = slashStyle.split('\\');
  const main = slashParts[0];
  const bass = slashParts[1];

  const m69 = /^([A-G](?:#|b)?m)69$/;
  const maj69 = /^([A-G](?:#|b)?)69$/;
  if (m69.test(main)) {
    add(main.replace(m69, '$1 69') + (bass ? `\\${bass}` : ''));
  } else if (maj69.test(main)) {
    add(main.replace(maj69, '$1 69') + (bass ? `\\${bass}` : ''));
  }

  return variants;
}

function buildChordUrl(instrument, pathToken) {
  return `https://www.scales-chords.com/chord/${instrument}/${encodeURIComponent(pathToken)}`;
}

async function fetchViaJina(url) {
  const u = new URL(url);
  const source = `http://${u.host}${u.pathname}${u.search}`;
  const jina = `https://r.jina.ai/${source}`;
  const res = await fetch(jina);
  if (!res.ok) return '';
  return res.text();
}

function normalizeLabel(label) {
  return label.replace(/\s+/g, '').toLowerCase();
}

function chordLabelVariants(chord) {
  const variants = new Set();
  const slash = chord.replace('/', '\\');
  variants.add(normalizeLabel(slash));

  const parts = slash.split('\\');
  const main = parts[0];
  const bass = parts[1];
  if (bass && /^[A-G](?:#|b)?$/i.test(main)) {
    variants.add(normalizeLabel(`${main}maj\\${bass}`));
    variants.add(normalizeLabel(`${main}major\\${bass}`));
  }
  return variants;
}

function extractVoicingStats(markdown, instrument, chord) {
  const labelSet = chordLabelVariants(chord);
  const rx =
    /Fretboard image for the ([^"]+?) chord on (?:left handled |left handed )?([a-zA-Z-]+) frets:\s*([xX0-9 ]+)/g;
  const all = new Set();
  const leftHand = new Set();
  const matched = new Set();

  let m;
  while ((m = rx.exec(markdown)) !== null) {
    const label = normalizeLabel(m[1]);
    const inst = m[2].toLowerCase();
    const frets = m[3].trim().replace(/\s+/g, ' ');
    if (inst !== instrument) continue;
    all.add(frets);
    const isLh = /left handled|left handed/.test(m[0]);
    if (isLh) leftHand.add(frets);
    if (labelSet.has(label)) matched.add(frets);
  }

  return {
    anyBanjo: all.size,
    targetVoicings: matched.size,
    leftOnly:
      matched.size === 0 && leftHand.size > 0 && all.size > 0 && leftHand.size === all.size,
  };
}

function detectWarning(markdown, instrument, chord) {
  if (!markdown || !/Banjo Chord/i.test(markdown)) {
    return '';
  }
  const directChartRegex = new RegExp(
    `(?:^|\\n)!\\[Image[^\\n]* chord on ${instrument} frets:`,
    'i'
  );
  const hasDirectCharts = directChartRegex.test(markdown || '');
  const alias = /actually is a/i.test(markdown);
  if (!hasDirectCharts) {
    return 'WARNING: THIS HAS NO CHORDS ASSOCIATED, ONLY INVERSIONS. DO NOT ADD THIS FILE';
  }
  if (alias) {
    return 'WARNING: THIS PAGE IS AN ALIAS/DUPLICATE OF ANOTHER CHORD. VERIFY BEFORE ADDING';
  }
  return '';
}

async function chooseBestUrl(instrument, chord) {
  const variants = chordToPathVariants(chord);
  let fallback = buildChordUrl(instrument, variants[0]);

  for (const v of variants) {
    const url = buildChordUrl(instrument, v);
    const md = await fetchViaJina(url);
    if (!md) continue;
    if (!/Banjo Chord/i.test(md)) continue;
    const stats = extractVoicingStats(md, instrument, chord);
    // Best case: this URL has voicings specifically for our target chord label.
    if (stats.targetVoicings > 0) {
      return { url, markdown: md };
    }
    // Accept a parseable chord page as fallback.
    fallback = url;
    if (!fallback) fallback = url;
  }

  const md = await fetchViaJina(fallback);
  return { url: fallback, markdown: md };
}

async function runPool(items, worker, concurrency) {
  const results = new Array(items.length);
  let idx = 0;

  async function loop() {
    while (true) {
      const current = idx;
      idx += 1;
      if (current >= items.length) break;
      results[current] = await worker(items[current], current);
    }
  }

  const workers = [];
  const c = Math.max(1, concurrency);
  for (let i = 0; i < c; i += 1) workers.push(loop());
  await Promise.all(workers);
  return results;
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  const raw = fs.readFileSync(args.file, 'utf8');
  const lines = raw.split(/\r?\n/).filter((l) => l.trim().length > 0);
  const parsed = lines.map(parseLine).filter(Boolean);

  const enriched = await runPool(
    parsed,
    async (row, i) => {
      const { url, markdown } = await chooseBestUrl(args.instrument, row.chord);
      const warning = detectWarning(markdown || '', args.instrument, row.chord);
      const comment = warning ? `## ${warning}` : row.comment;
      if ((i + 1) % 50 === 0) {
        console.log(`processed ${i + 1}/${parsed.length}`);
      }
      return {
        chord: row.chord,
        url,
        comment: warning ? `## ${warning}` : '',
      };
    },
    args.concurrency
  );

  const out = enriched
    .map((r) => {
      let line = `${r.chord} ${r.url}`.trimEnd();
      if (r.comment) line += ` ${r.comment}`;
      return line;
    })
    .join('\n');

  fs.writeFileSync(args.file, `${out}\n`);

  const warnCount = enriched.filter((r) => r.comment && /WARNING:/i.test(r.comment)).length;
  console.log(`updated ${args.file}`);
  console.log(`total lines: ${enriched.length}`);
  console.log(`warnings: ${warnCount}`);
}

main().catch((err) => {
  console.error(err?.message || err);
  process.exit(1);
});
