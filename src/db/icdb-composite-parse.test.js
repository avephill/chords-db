/* global it, describe, expect */

import { execFileSync } from 'child_process';
import path from 'path';
import fs from 'fs';
import os from 'os';

const parserScript = path.join(
  __dirname,
  '../../scripts/parse-icdb-composite-table.mjs'
);

function parseTableInnerHtml(inner) {
  const tmp = path.join(os.tmpdir(), `icdb-parse-${process.pid}-${Date.now()}.html`);
  fs.writeFileSync(tmp, inner, 'utf8');
  try {
    const out = execFileSync(process.execPath, [parserScript, tmp], {
      encoding: 'utf8',
    });
    if (out.trim() === 'null') return null;
    return JSON.parse(out);
  } finally {
    try {
      fs.unlinkSync(tmp);
    } catch (e) {
      /* ignore */
    }
  }
}

/** Minimal 5-column ICDb-style grid for Ab+ → x4112 / 04112 (golden case from composite parser plan). */
const GOLDEN_AB_AUG_INNER = `
<tr>
<td class="Fret_v2 FretM_v2"><img class="ChordChart_v2" src="\\images\\M\\Top_Empty_x.png" /></td>
<td class="Fret_v2 FretM_v2"><img class="ChordChart_v2" src="\\images\\M\\Nut_o_LB.png" /></td>
<td class="Fret_v2 FretM_v2"><img class="ChordChart_v2" src="\\images\\M\\Nut.png" /></td>
<td class="Fret_v2 FretM_v2"><img class="ChordChart_v2" src="\\images\\M\\Nut.png" /></td>
<td class="Fret_v2 FretM_v2"><img class="ChordChart_v2" src="\\images\\M\\Nut_RB.png" /></td>
</tr>
<tr>
<td class="Fret_v2 FretM_v2"><img class="ChordChart_v2" src="\\images\\M\\String_Empty.png" /></td>
<td class="Fret_v2 FretM_v2"><img class="ChordChart_v2" src="\\images\\M\\String.png" /></td>
<td class="Fret_v2 FretM_v2"><img class="ChordChart_v2" src="\\images\\M\\String_1.png" /></td>
<td class="Fret_v2 FretM_v2"><img class="ChordChart_v2" src="\\images\\M\\String_1.png" /></td>
<td class="Fret_v2 FretM_v2"><img class="ChordChart_v2" src="\\images\\M\\String.png" /></td>
</tr>
<tr>
<td class="Fret_v2 FretM_v2"><img class="ChordChart_v2" src="\\images\\M\\Fret_Empty.png" /></td>
<td class="Fret_v2 FretM_v2"><img class="ChordChart_v2" src="\\images\\M\\Fret_LB.png" /></td>
<td class="Fret_v2 FretM_v2"><img class="ChordChart_v2" src="\\images\\M\\Fret.png" /></td>
<td class="Fret_v2 FretM_v2"><img class="ChordChart_v2" src="\\images\\M\\Fret.png" /></td>
<td class="Fret_v2 FretM_v2"><img class="ChordChart_v2" src="\\images\\M\\Fret_RB.png" /></td>
</tr>
<tr>
<td class="Fret_v2 FretM_v2"><img class="ChordChart_v2" src="\\images\\M\\String_Empty.png" /></td>
<td class="Fret_v2 FretM_v2"><img class="ChordChart_v2" src="\\images\\M\\String.png" /></td>
<td class="Fret_v2 FretM_v2"><img class="ChordChart_v2" src="\\images\\M\\String.png" /></td>
<td class="Fret_v2 FretM_v2"><img class="ChordChart_v2" src="\\images\\M\\String.png" /></td>
<td class="Fret_v2 FretM_v2"><img class="ChordChart_v2" src="\\images\\M\\String_2.png" /></td>
</tr>
<tr>
<td class="Fret_v2 FretM_v2"><img class="ChordChart_v2" src="\\images\\M\\Fret_Empty.png" /></td>
<td class="Fret_v2 FretM_v2"><img class="ChordChart_v2" src="\\images\\M\\Fret_LB.png" /></td>
<td class="Fret_v2 FretM_v2"><img class="ChordChart_v2" src="\\images\\M\\Fret.png" /></td>
<td class="Fret_v2 FretM_v2"><img class="ChordChart_v2" src="\\images\\M\\Fret.png" /></td>
<td class="Fret_v2 FretM_v2"><img class="ChordChart_v2" src="\\images\\M\\Fret_RB.png" /></td>
</tr>
<tr>
<td class="Fret_v2 FretM_v2"><img class="ChordChart_v2" src="\\images\\M\\String_Empty.png" /></td>
<td class="Fret_v2 FretM_v2"><img class="ChordChart_v2" src="\\images\\M\\String.png" /></td>
<td class="Fret_v2 FretM_v2"><img class="ChordChart_v2" src="\\images\\M\\String.png" /></td>
<td class="Fret_v2 FretM_v2"><img class="ChordChart_v2" src="\\images\\M\\String.png" /></td>
<td class="Fret_v2 FretM_v2"><img class="ChordChart_v2" src="\\images\\M\\String.png" /></td>
</tr>
<tr>
<td class="Fret_v2 FretM_v2"><img class="ChordChart_v2" src="\\images\\M\\Fret_Empty.png" /></td>
<td class="Fret_v2 FretM_v2"><img class="ChordChart_v2" src="\\images\\M\\Fret_LB.png" /></td>
<td class="Fret_v2 FretM_v2"><img class="ChordChart_v2" src="\\images\\M\\Fret.png" /></td>
<td class="Fret_v2 FretM_v2"><img class="ChordChart_v2" src="\\images\\M\\Fret.png" /></td>
<td class="Fret_v2 FretM_v2"><img class="ChordChart_v2" src="\\images\\M\\Fret_RB.png" /></td>
</tr>
<tr>
<td class="Fret_v2 FretM_v2"><img class="ChordChart_v2" src="\\images\\M\\String_Empty.png" /></td>
<td class="Fret_v2 FretM_v2"><img class="ChordChart_v2" src="\\images\\M\\String_4.png" /></td>
<td class="Fret_v2 FretM_v2"><img class="ChordChart_v2" src="\\images\\M\\String.png" /></td>
<td class="Fret_v2 FretM_v2"><img class="ChordChart_v2" src="\\images\\M\\String.png" /></td>
<td class="Fret_v2 FretM_v2"><img class="ChordChart_v2" src="\\images\\M\\String.png" /></td>
</tr>
<tr>
<td class="Fret_v2 FretM_v2"><img class="ChordChart_v2" src="\\images\\M\\Fret_Empty.png" /></td>
<td class="Fret_v2 FretM_v2"><img class="ChordChart_v2" src="\\images\\M\\Fret_LB.png" /></td>
<td class="Fret_v2 FretM_v2"><img class="ChordChart_v2" src="\\images\\M\\Fret.png" /></td>
<td class="Fret_v2 FretM_v2"><img class="ChordChart_v2" src="\\images\\M\\Fret.png" /></td>
<td class="Fret_v2 FretM_v2"><img class="ChordChart_v2" src="\\images\\M\\Fret_RB.png" /></td>
</tr>
`;

describe('ICDb composite table parser (scripts/parse-icdb-composite-table.mjs)', () => {
  it('parses golden Ab+ grid to x4112 / 04112', () => {
    expect(parseTableInnerHtml(GOLDEN_AB_AUG_INNER)).toEqual({
      frets: 'x4112',
      fingers: '04112',
    });
  });
});
