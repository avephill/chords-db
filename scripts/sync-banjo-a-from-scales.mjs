#!/usr/bin/env node
/**
 * Sync banjo-open-g/chords/A/*.js from Scales-Chords.
 * @see scripts/sync-banjo-key-from-scales.mjs
 *
 * Usage:
 *   node scripts/sync-banjo-a-from-scales.mjs
 *   node scripts/sync-banjo-a-from-scales.mjs --dry-run
 */

import { syncBanjoKeyFromScales } from './sync-banjo-key-from-scales.mjs';

const argv = process.argv.slice(2);
syncBanjoKeyFromScales('A', argv).catch((e) => {
  console.error(e);
  process.exit(1);
});
