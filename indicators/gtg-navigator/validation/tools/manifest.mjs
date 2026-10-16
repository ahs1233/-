// Generates a baseline manifest from the repository state and the Pine input
// declarations. Code facts only: TradingView run facts (feed, ticker, session,
// history range) are recorded per run by whoever executed it, never guessed here.
// Usage: node indicators/gtg-navigator/validation/tools/manifest.mjs [out.json]
import { execFileSync } from 'node:child_process';
import { readFileSync, writeFileSync } from 'node:fs';

const DIR = 'indicators/gtg-navigator';
const git = (...a) => execFileSync('git', a, { encoding: 'utf8' }).trim();
const blob = (p) => git('rev-parse', `HEAD:${p}`);

const pinePath = `${DIR}/gtg_navigator_v0.4.7.pine`;
const pine = readFileSync(pinePath, 'utf8');
const inputs = [];
const re = /^(\w+)\s*=\s*input\.(int|float|bool|string|timeframe)\((.*)\)\s*$/gm;
for (const m of pine.matchAll(re)) {
  const [, name, kind, args] = m;
  const def = args.match(/^\s*("[^"]*"|[^,]+)/)[1].trim();
  const minv = args.match(/minval\s*=\s*([-\d.]+)/);
  const maxv = args.match(/maxval\s*=\s*([-\d.]+)/);
  const grp = args.match(/group\s*=\s*(\w+)/);
  inputs.push({
    name, kind,
    default: kind === 'bool' ? def === 'true' : kind === 'int' || kind === 'float' ? Number(def) : JSON.parse(def),
    ...(minv ? { minval: Number(minv[1]) } : {}), ...(maxv ? { maxval: Number(maxv[1]) } : {}),
    ...(grp ? { group: grp[1] } : {}),
  });
}
let behind = null, ahead = null;
try { [behind, ahead] = git('rev-list', '--left-right', '--count', 'origin/main...HEAD').split(/\s+/).map(Number); } catch { /* no origin/main */ }

const manifest = {
  schema: 'gtg-navigator/baseline-manifest@1',
  generated_utc: new Date().toISOString(),
  timezone_of_timestamps: 'UTC',
  repository: 'https://github.com/ahs1233/-',
  branch: git('rev-parse', '--abbrev-ref', 'HEAD'),
  commit: git('rev-parse', 'HEAD'),
  commit_subject: git('log', '-1', '--format=%s'),
  branch_vs_origin_main: { ahead, behind },
  files: {
    current: {
      pine: { path: pinePath, blob: blob(pinePath), lines: pine.split('\n').length - (pine.endsWith('\n') ? 1 : 0) },
      reference: { path: `${DIR}/reference/engine.mjs`, blob: blob(`${DIR}/reference/engine.mjs`) },
      tests: { path: `${DIR}/reference/engine.test.mjs`, blob: blob(`${DIR}/reference/engine.test.mjs`) },
      readme: { path: `${DIR}/README.md`, blob: blob(`${DIR}/README.md`) },
    },
    legacy: { pine: { path: `${DIR}/gtg_navigator_v0.4.6.pine`, blob: blob(`${DIR}/gtg_navigator_v0.4.6.pine`) } },
  },
  runtime: { node: process.version, platform: process.platform },
  pine_static: {
    version_directive: (pine.match(/^\/\/@version=(\d+)/m) || [])[1] ?? null,
    request_security_calls: (pine.match(/request\.security\(/g) || []).length,
    plot_calls: (pine.match(/^plot\(/gm) || []).length,
    alertconditions: (pine.match(/^alertcondition\(/gm) || []).length,
  },
  inputs,
  debug_inputs_of_interest: Object.fromEntries(inputs.filter((i) => ['strictDebug', 'validationMode', 'studyExtraBars'].includes(i.name)).map((i) => [i.name, i.default])),
  tradingview_run: {
    status: 'NOT_RUN in this task at this commit',
    required_fields: ['feed/exchange', 'full ticker (syminfo.tickerid)', 'chart timeframe', 'chart type', 'session', 'exchange timezone', 'syminfo.mintick', 'first/last bar time (UTC)', 'chart bars loaded', 'A1/A2 timeframes and bars available', 'engine window W and engine rows', 'input overrides vs defaults'],
  },
};
const out = process.argv[2];
const json = JSON.stringify(manifest, null, 2) + '\n';
if (out) writeFileSync(out, json); else process.stdout.write(json);
