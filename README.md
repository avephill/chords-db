# chords-db
This is a javascript database of string instruments chords. Open, free to use, easily improved with more chords. 
Contributions are welcomed, still a lot of chords (and instruments) missing. 
Use the pull request feature of Github to add your desired chords if you want to contribute.

Take a look at the chords database of an instrument to understand the schema used to register new chords.
For example, let's take a look at the `Dsus2` chords of guitar. We can see this information in the `D/sus2.js` file:

```
export default {
  key: 'D',
  suffix: 'sus2',
  positions: [{
    frets: '0320xx',
    fingers: '031000'
  },
  {
    frets: '55775x',
    fingers: '114310',
    barres: 5,
    capo: true
  }]
}

```

Each *position* define a new chord variation of the `Dsus2` chord.
We must define the *frets* needed to obtain the chord in the respective strings.
We can define too the *fingers* information for easy reading of the chord.
If the chord need to barre some string, we will define if in the *barre* field. If
you want the barre be represented with capo, you can define the "capo" property too.

## How to build/contribute

This project is using *yarn* as package manager, so all the basic command related to 
the project lifecycle are bound to it. Three basic commands

```
yarn install
yarn build
```
Generates a new version of the library when new chords are added.

```
yarn test
```
Make some testing of the new added chords. Very useful to detect basic mistakes.

## How to use

All this information is packed in a JSON library, that you can use to render visually
with a utility able to parse this information.

You can take a look of the current state of the database with this SVG rendering tool:

[![chords-db](https://raw.githubusercontent.com/tombatossals/react-chords/webpage/src/images/react-chords.png)](https://tombatossals.github.io/react-chords)

## Internet Chord Database (ICDb) banjo imports

Chord pages for several **5-string banjo** tunings in this repo were built from **[Internet Chord Database](https://internetchorddatabase.com)** chart URLs (under `/ChordCharts/…`). Downloaded HTML is stored per key as `_raw_v1.html` … `_raw_v4.html` under `src/db/<instrument>/chords/<Key>/`, then generators emit the `*.js` chord modules.

ICDb pages use two different voicing layouts; the import pipeline must match the page:

| Form | What to look for in HTML | Generators / parsers |
| --- | --- | --- |
| **StaticCharts** | `StaticCharts\…png` images with `alt="…"` comma-separated fret list (and optional fingering) | `scripts/generate-banjo-open-g-from-icdb.ps1` and the other `generate-banjo-*-from-icdb.ps1` scripts (same pattern; `generate-banjo-open-g-from-icdb.mjs` is an optional Node copy of the open-G script). |
| **Composite sprite grid** | `<table class="SingleFingering_v2">` built from `/images/M/*.png` cells | `scripts/generate-banjo-icdb-composite.ps1` (wrappers: `generate-banjo-open-c-icdb-composite.ps1`, `generate-banjo-standard-c-drop-c-icdb-composite.ps1`) plus `scripts/parse-icdb-composite-table.mjs`. |

**Instruments currently wired to ICDb scripts** (see `scripts/download-banjo-*-icdb.ps1` and matching `generate-banjo-*`):

| Instrument folder | Download script | Primary generator |
| --- | --- | --- |
| `banjo-open-c` | `download-banjo-open-c-icdb.ps1` | `generate-banjo-open-c-icdb-composite.ps1` (composite) |
| `banjo-standard-c-drop-c` | `download-banjo-standard-c-drop-c-icdb.ps1` | `generate-banjo-standard-c-drop-c-icdb-composite.ps1` (composite). There is also `generate-banjo-standard-c-drop-c-from-icdb.ps1` for **StaticCharts-only** pages if you ever need that path. |
| `banjo-open-g` | No dedicated downloader in `scripts/`; follow `download-banjo-open-c-icdb.ps1` against the [Open G tuning](https://internetchorddatabase.com/ChordCharts/5-String_Banjo_Open_G_Tuning/) chart URL | `generate-banjo-open-g-from-icdb.ps1` |
| `banjo-d-f#-tuning` | `download-banjo-d-fsharp-tuning-icdb.ps1` | `generate-banjo-d-fsharp-tuning-from-icdb.ps1` |
| `banjo-d-tuning` | `download-banjo-d-tuning-icdb.ps1` | `generate-banjo-d-tuning-from-icdb.ps1` |
| `banjo-double-c` | `download-banjo-double-c-icdb.ps1` (and `download-banjo-double-c-remaining.ps1` if used) | `generate-banjo-double-c-from-icdb.ps1` |
| `banjo-gmodal-mountain-minor-sawmill` | `download-banjo-gmodal-mountain-minor-icdb.ps1` | `generate-banjo-gmodal-mountain-minor-from-icdb.ps1` |

**Consistency check:** `node scripts/merge-banjo-composite-fingers.mjs` compares raw composite tables to existing chord files (fills missing `fingers` when fret strings match exactly; logs borderline `x`/open differences). It writes `scripts/composite-finger-merge-review.txt` (gitignored). If chord files were already generated from the same composite HTML, this usually updates nothing—only drift or hand-edits show up. For instruments whose chords came from **StaticCharts** alts, sprite-derived fret strings often do not match stored positions (different voicings or chart offset), so the script may update no files until those layouts are aligned in the generator.

### Prompt for an agent adding a new ICDb instrument

Copy and adapt the following (replace placeholders):

> In `chords-db`, add a new instrument under `src/db/<instrument>/` using **Internet Chord Database** (`https://internetchorddatabase.com`). Find the chart URL for this tuning under `/ChordCharts/`. Add a PowerShell `scripts/download-banjo-<name>-icdb.ps1` that mirrors `scripts/download-banjo-open-c-icdb.ps1`: save per-key `_raw_v1.html`–`_raw_v4.html` into `src/db/<instrument>/chords/<Key>/`. Open saved HTML: if voicings use **StaticCharts** PNG `alt` text, extend the pattern in `generate-banjo-open-g-from-icdb.ps1`. If the page uses **SingleFingering_v2** sprite tables only, extend `generate-banjo-icdb-composite.ps1` (or add a wrapper like `generate-banjo-open-c-icdb-composite.ps1`) and use `parse-icdb-composite-table.mjs`. Register the instrument in `src/generate`, add tests, and run `yarn test` and `yarn build`.
