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
(or `npm install` / `npm run build`) Generates `lib/*.json`, `lib/instruments.json`, and **`lib/index.js`** (aggregate re-export of every instrument JSON via `scripts/sync-chords-db-lib.mjs`). Commit those when you add instruments so `package.json` `"main": "lib/index.js"` stays complete for dependents.

```
yarn test
```
Make some testing of the new added chords. Very useful to detect basic mistakes.

## How to use

All this information is packed in a JSON library, that you can use to render visually
with a utility able to parse this information.

You can take a look of the current state of the database with this SVG rendering tool:

[![chords-db](https://raw.githubusercontent.com/tombatossals/react-chords/webpage/src/images/react-chords.png)](https://tombatossals.github.io/react-chords)

## Internet Chord Database (ICDb) import workflow

Several banjo-family instruments in this repo are imported from **[Internet Chord Database](https://internetchorddatabase.com)** (`/ChordCharts/...` pages).

### Canonical source policy

- `src/db/**` should contain canonical instrument modules only (`*.js`, key indexes, tests).
- Import artifacts (`_raw_v*.html` and readable debug text) are **not** kept in `src/db`.
- Import workspace is `scripts/icdb-data/<instrument>/<Key>/`.

### Reusable import scripts

| Purpose | Script |
| --- | --- |
| Download `_raw_v1..v4.html` for all keys | `scripts/download-icdb.ps1` (use thin instrument wrappers) |
| Generate from StaticCharts `alt="..."` | `scripts/generate-icdb-staticcharts.ps1` |
| Generate from composite `SingleFingering_v2` sprites | `scripts/generate-banjo-icdb-composite.ps1` + `scripts/parse-icdb-composite-table.mjs` |
| Optional composite drift/finger merge report | `scripts/merge-banjo-composite-fingers.mjs` |

### Instrument wrappers currently present

| Instrument folder | Download wrapper | Generator wrapper |
| --- | --- | --- |
| `banjo-open-c` | `download-banjo-open-c-icdb.ps1` | `generate-banjo-open-c-icdb-composite.ps1` |
| `banjo-standard-c-drop-c` | `download-banjo-standard-c-drop-c-icdb.ps1` | `generate-banjo-standard-c-drop-c-icdb-composite.ps1` |
| `banjo-open-g` | `download-banjo-open-g-icdb.ps1` | `generate-banjo-open-g-from-icdb.ps1` |
| `banjo-d-f#-tuning` | `download-banjo-d-fsharp-tuning-icdb.ps1` | `generate-banjo-d-fsharp-tuning-from-icdb.ps1` |
| `banjo-d-tuning` | `download-banjo-d-tuning-icdb.ps1` | `generate-banjo-d-tuning-from-icdb.ps1` |
| `banjo-double-c` | `download-banjo-double-c-icdb.ps1` | `generate-banjo-double-c-from-icdb.ps1` |
| `banjo-gmodal-mountain-minor-sawmill` | `download-banjo-gmodal-mountain-minor-icdb.ps1` | `generate-banjo-gmodal-mountain-minor-from-icdb.ps1` |
| `plecturn-4-string-banjo-irish-tuning` | `download-plecturn-4-string-banjo-irish-tuning-icdb.ps1` | `generate-plecturn-4-string-banjo-irish-tuning-icdb-composite.ps1` |

### Minimal process for adding a new ICDb instrument

1. Add/adjust a download wrapper that calls `download-icdb.ps1`.
2. Choose parser path from sample HTML:
   - `StaticCharts` PNG `alt` rows -> `generate-icdb-staticcharts.ps1`
   - `SingleFingering_v2` sprite tables -> `generate-banjo-icdb-composite.ps1`
3. Add instrument module wiring (`src/db.js`, `types.d.ts`, instrument `src/db/<instrument>` files/tests).
4. Run `npm test` and `npm run build`.

## Scales-Chords scraping helper (slash chords and batch pages)

For pages in the `https://www.scales-chords.com/chord/...` style, use:

`npm run scrape:scales-chords -- --url "https://www.scales-chords.com/chord/banjo/D%5CF%2523" --key D --suffix "/F#"`

Useful normalization rules built into `scripts/scrape-scales-chords.mjs`:

- `D/_F#.js` file stem `"_F#"` -> suffix `"/F#"` (chord-db notation)
- suffix `"/F#"` + key `D` -> URL chord path `D/F#`
- labels like `D/F#` and `Dmaj/F#` are treated as the same target when filtering source voicings

Batch write chord files under a key-folder tree:

`npm run scrape:scales-chords -- --urls-file "scripts/scales-chords-urls.txt" --out-root "src/db/banjo-open-g/chords"`

### Verifying frets against Scales-Chords (banjo)

`npm run verify:scales-chords -- --file "src/db/banjo-open-g/chords/A/_F#.js"`

- Slash chords in bookmarks use a **single path segment** with a backslash between key and bass, URL-encoded (example: `A/F#` → `.../chord/banjo/A%5CF%23`). The verifier builds that form by default (`scripts/verify-scales-chords-frets.mjs`).
- If the page you want uses a **different** path shape (e.g. `.../banjo/A/F%23`), pass it explicitly: `--url "https://www.scales-chords.com/chord/banjo/A/F%23"`.
- Slash-chord PNGs use a letter + **`s`** for sharp bass notes: **`_Fs`**, **`_Cs`**, **`_Gs`** (e.g. `banjo-A_Fs-…`, `banjo-Am_Cs-…`). Natural bass uses the plain letter + hyphen (e.g. `banjo-A_F-…`, `banjo-A_C-…`). The fetched chord page may still embed only natural-bass images for some `/F#` URLs; the verifier can fall back to `// sourceChart` lines when those URLs use the `…s` form.
- Extension chords like **`9#11`**, **`7#9`**, **`maj7#5`** keep the usual stems in filenames (`banjo-A9-…`, `banjo-A7-…`, `banjo-Amaj7-…`); the sharp is in the chord **page** URL (`A9%2311`, `A7%239`, `Amaj7%235`).
