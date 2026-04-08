/**
 * Regenerate lib/index.js from lib/*.json so package "main" re-exports every instrument JSON.
 * Run after generating JSON (see npm run build). Keeps consumers independent of a plugin postinstall.
 */
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, '..');
const libDir = path.join(root, 'lib');

if (!fs.existsSync(libDir)) {
  console.warn('sync-chords-db-lib: skip (no lib/)');
  process.exit(0);
}

const files = fs
  .readdirSync(libDir)
  .filter((f) => f.endsWith('.json') && f !== 'instruments.json')
  .sort();

function idFromBase(base) {
  return 'chordsDb_' + base.replace(/[^a-zA-Z0-9]/g, '_');
}

const imports = [];
const props = [];
for (const file of files) {
  const base = file.slice(0, -5);
  const id = idFromBase(base);
  // Escape URL-fragment markers in import specifiers (e.g. '#' in filenames).
  const importPath = file.replace(/#/g, '%23');
  imports.push(`import * as ${id} from './${importPath}';`);
  props.push(`  ${JSON.stringify(base)}: ${id}`);
}

const out =
  imports.join('\n') +
  '\n\nconst ChordsDB = {\n' +
  props.join(',\n') +
  '\n};\nexport default ChordsDB;\n';

fs.writeFileSync(path.join(libDir, 'index.js'), out);
console.log('sync-chords-db-lib:', files.length, 'instruments -> lib/index.js');
