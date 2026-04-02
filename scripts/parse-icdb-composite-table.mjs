/**
 * Parse inner HTML of ICDb <table class="SingleFingering_v2"> (rows of /images/M/*.png).
 * stdin: full inner HTML of the table element (between <table> and </table>).
 * stdout: JSON { frets, fingers } or null
 * Used by generate-banjo-icdb-composite.ps1 and scripts/merge-banjo-composite-fingers.mjs; see README ICDb section.
 */
import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { resolve } from 'path';

function fretToHexChar(n) {
  if (n < 0 || n > 15) return null;
  return n.toString(16);
}

function basenameFromSrc(src) {
  const m = String(src).match(/images[/\\]M[/\\]([^"]+)/i);
  if (!m) return null;
  return m[1].split(/[/\\]/).pop();
}

function stem(bn) {
  if (!bn) return '';
  const i = bn.lastIndexOf('.');
  return i >= 0 ? bn.slice(0, i) : bn;
}

function isFretRow(cells) {
  return cells.every((b) => {
    const s = stem(b);
    return /^(Fret|LowerNut)/i.test(s);
  });
}

function nutMute(st) {
  return /^(Top_Empty_x|TopString_x|Nut_x)/i.test(st);
}

function nutOpen(st) {
  if (nutMute(st)) return false;
  if (/^Top_Empty_o/i.test(st)) return true;
  if (/^TopString_o/i.test(st)) return true;
  if (/^Nut/i.test(st)) return true;
  if (/^TopString($|_)/i.test(st) && !/x/i.test(st)) return true;
  return false;
}

function stringGray(st) {
  return /^String_gray/i.test(st);
}

export function parseCompositeTableInnerHtml(tableInner) {
  const trRe = /<tr\b[^>]*>(.*?)<\/tr>/gis;
  const rows = [];
  let m;
  while ((m = trRe.exec(tableInner)) !== null) {
    const trContent = m[1];
    if (/NotFound5String/i.test(trContent)) continue;
    const tdRe = /<td\b[^>]*>(.*?)<\/td>/gis;
    const tds = [];
    let dm;
    while ((dm = tdRe.exec(trContent)) !== null) {
      const tdHtml = dm[1];
      const imgM = /<img[^>]+src="([^"]+)"/i.exec(tdHtml);
      if (imgM) {
        const bn = basenameFromSrc(imgM[1]);
        if (bn) tds.push(bn);
      }
    }
    if (tds.length === 0) continue;
    if (tds.length === 6) rows.push(tds.slice(1));
    else if (tds.length === 5) rows.push(tds);
  }
  if (rows.length === 0) return null;

  let fretOffset = 0;
  const firstTr = /<tr\b[^>]*>(.*?)<\/tr>/is.exec(tableInner);
  const frLabel = firstTr && /TopFretName[^>]*>(\d+)\s*(?:&nbsp;)?>/i.exec(firstTr[1]);
  if (frLabel) fretOffset = parseInt(frLabel[1], 10);

  const frets = Array(5).fill(null);
  const fingers = Array(5).fill('0');

  const nut = rows[0];
  for (let c = 0; c < 5; c++) {
    const st = stem(nut[c]);
    if (nutMute(st)) {
      frets[c] = 'x';
      fingers[c] = '0';
    } else if (nutOpen(st)) {
      const fc = fretToHexChar(fretOffset);
      if (!fc) return null;
      frets[c] = fc;
      fingers[c] = '0';
    } else {
      return null;
    }
  }

  let slot = 0;
  for (let ri = 1; ri < rows.length; ri++) {
    const line = rows[ri];
    if (isFretRow(line)) continue;

    const fretNum = fretOffset + slot + 1;
    const fChar = fretToHexChar(fretNum);
    if (!fChar) return null;

    for (let c = 0; c < 5; c++) {
      const st = stem(line[c]);
      if (stringGray(st)) {
        frets[c] = 'x';
        fingers[c] = '0';
        continue;
      }
      if (/^String_Empty/i.test(st)) continue;

      const sn = /^String_(\d)$/i.exec(st);
      if (sn) {
        frets[c] = fChar;
        fingers[c] = sn[1];
        continue;
      }
      if (/^String_F$/i.test(st)) {
        frets[c] = fChar;
        fingers[c] = '4';
        continue;
      }
      if (/^String$/i.test(st)) continue;
      return null;
    }
    slot += 1;
  }

  if (frets.some((f) => f == null)) return null;
  return { frets: frets.join(''), fingers: fingers.join('') };
}

function main() {
  const inputPath = process.argv[2];
  const raw = inputPath ? readFileSync(inputPath, 'utf8') : readFileSync(0, 'utf8');
  const out = parseCompositeTableInnerHtml(raw);
  process.stdout.write(out ? JSON.stringify(out) : 'null');
}

const isMain =
  process.argv[1] &&
  resolve(fileURLToPath(import.meta.url)) === resolve(process.argv[1]);
if (isMain) main();
