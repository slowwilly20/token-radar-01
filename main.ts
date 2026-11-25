// A token launch radar entry (Node 22, standard library only).
//
// The program reads the sealed snapshot from the make.fun kit
// (/input/snapshot.json, or --input <file|dir>), scores every pre-token protocol with the model
// in lib/model.ts, writes the ranked board to /output/board.json, and copies this repository's
// dashboard/ and screenshots/ to /output. Last, it writes /output/dossier.json, the summary the
// judge reads, with the vendored make.fun library.
//
// The dashboard is a static page, no framework and no network: dashboard/index.html,
// dashboard/app.css and dashboard/app.js read /output/data.js, which this program writes from
// the same board.
//
// Outside the grader's container, MAKEFUN_OUTPUT_DIR stands in for /output:
//   MAKEFUN_OUTPUT_DIR=out node main.ts --input ../token-radar-01-kit/input/snapshot.json
//
// The snapshot is verified against the kit's kit.json when the input sits inside an unpacked
// kit (input/snapshot.json next to kit.json): a hash mismatch refuses the build, so a tampered
// snapshot can never produce a board.

import { copyFileSync, existsSync, mkdirSync, readFileSync, readdirSync, statSync, writeFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { boardIssue, buildRadar, dataScript, parseSnapshot, watchlistAnomalies } from './lib/model.ts';
import { buildDossier } from './vendor/makefun-board.ts';

const here = fileURLToPath(new URL('.', import.meta.url));

/** The scorer's own caps (reference/gate.json): the text cap shapes the bytes, the rest refuse. */
const TEXT_MAX_BYTES = 65_536;
const SCREENSHOT_CAPS = { max: 4, max_bytes: 524_288 };
const IMAGE_NAME = /^[A-Za-z0-9_][A-Za-z0-9._-]{0,127}$/;

/** The kit's recorded sha256 of input/snapshot.json, from kit.json next to the input. */
const KIT_SNAPSHOT_SHA256 = '42a71213519479f3a180cc5010cbbf6bd18a2447fa0ad29e4c5122b6c9184393';

/** --name <value> out of the arguments, or the fallback. */
function arg(name: string, fallback: string): string {
  const at = process.argv.indexOf(`--${name}`);
  if (at >= 0 && at + 1 < process.argv.length) return process.argv[at + 1]!;
  const withEquals = process.argv.find((a) => a.startsWith(`--${name}=`));
  return withEquals === undefined ? fallback : withEquals.slice(name.length + 3);
}

const inputArg = arg('input', '/input');
const inputFile = inputArg.endsWith('.json') ? inputArg : join(inputArg, 'snapshot.json');
if (!existsSync(inputFile)) {
  process.stderr.write(`token radar: no snapshot at ${inputFile}: pass --input <snapshot.json|directory> or mount the sealed /input\n`);
  process.exit(2);
}
const out = arg('output', process.env.MAKEFUN_OUTPUT_DIR ?? '/output');

const snapshotRaw = readFileSync(inputFile, 'utf8');
const snapshotSha256 = createHash('sha256').update(snapshotRaw).digest('hex');

// When the input sits inside an unpacked kit, the kit's own kit.json records the sealed
// snapshot's hash: refuse a build from anything else.
const kitJsonPath = join(dirname(inputFile), '..', 'kit.json');
if (existsSync(kitJsonPath)) {
  const kit = JSON.parse(readFileSync(kitJsonPath, 'utf8')) as {
    files?: { path: string; sha256: string }[];
  };
  const entry = (kit.files ?? []).find((f) => f.path === 'input/snapshot.json');
  const expected = entry?.sha256 ?? KIT_SNAPSHOT_SHA256;
  if (snapshotSha256 !== expected) {
    process.stderr.write(
      `token radar: snapshot hash mismatch: kit.json records ${expected}, the file hashes to ${snapshotSha256}. Refusing to build from a tampered snapshot.\n`,
    );
    process.exit(2);
  }
} else if (snapshotSha256 !== KIT_SNAPSHOT_SHA256) {
  process.stderr.write(
    `token radar: WARNING: the input is not inside an unpacked kit and its sha256 ${snapshotSha256} is not the kit's sealed snapshot (${KIT_SNAPSHOT_SHA256}). Building anyway from this file; the board will record the hash it used.\n`,
  );
}

const snapshot = parseSnapshot(snapshotRaw);
const anomalies = watchlistAnomalies(snapshot);
for (const a of anomalies) process.stderr.write(`token radar: watchlist anomaly: ${a}\n`);
const { board, radar } = buildRadar(snapshot, snapshotSha256);
const issue = boardIssue(board, snapshot);
if (issue !== null) {
  process.stderr.write(`token radar: the model wrote a board the gate refuses: ${issue}\n`);
  process.exit(1);
}

mkdirSync(out, { recursive: true });
writeFileSync(join(out, 'board.json'), `${JSON.stringify({ rows: board })}\n`);
writeFileSync(join(out, 'data.js'), dataScript(radar));

/** Copy one directory's regular files into `to`, skipping names that start with a dot. */
function copyFiles(from: string, to: string): string[] {
  if (!existsSync(from)) return [];
  mkdirSync(to, { recursive: true });
  const copied: string[] = [];
  for (const name of readdirSync(from)) {
    if (name.startsWith('.')) continue;
    const path = join(from, name);
    if (!statSync(path).isFile()) continue;
    copyFileSync(path, join(to, name));
    copied.push(name);
  }
  return copied;
}

copyFiles(join(here, 'dashboard'), join(out, 'dashboard'));
const shots = copyFiles(join(here, 'screenshots'), join(out, 'screenshots'));
if (shots.length < 3) {
  process.stderr.write(`token radar: screenshots/ holds ${shots.length} image${shots.length === 1 ? '' : 's'}: hand in 3, the board, a detail view and a filtered view\n`);
  process.exit(1);
}
for (const name of shots) {
  if (!IMAGE_NAME.test(name)) {
    process.stderr.write(`token radar: screenshots/${name}: a name is letters, digits and . _ -, 1 to 128 characters\n`);
    process.exit(1);
  }
}

// The dossier is written last: the scorer rebuilds it from this /output and compares bytes.
writeFileSync(join(out, 'dossier.json'), buildDossier(out, { text_max_bytes: TEXT_MAX_BYTES, screenshots: SCREENSHOT_CAPS, dashboard: { max_files: 400, max_bytes: 4_194_304 } }));

process.stdout.write(
  `token radar: ${snapshot.protocols.length} protocols, ${snapshot.watchlist.length} on the watchlist, ${board.length} rows scored (${radar.early_size} early, ${radar.live_size} live set aside)\n` +
    `token radar: snapshot sha256 ${snapshotSha256}\n` +
    `token radar: wrote ${join(out, 'board.json')}, ${join(out, 'data.js')}, ${join(out, 'dashboard')} (3 files), ${join(out, 'screenshots')} (${shots.length} images) and ${join(out, 'dossier.json')}\n` +
    `token radar: top 5:\n` +
    board
      .slice(0, 5)
      .map((r) => `  #${r.rank} ${r.name} [${r.category ?? 'Other'}] TVL ${r.tvl_usd.toLocaleString('en-US')} implied $${r.implied_value_usd.toLocaleString('en-US')}\n`)
      .join(''),
);
