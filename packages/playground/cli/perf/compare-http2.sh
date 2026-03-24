#!/usr/bin/env bash
#
# Compare HTTP/1.1 vs HTTP/2 performance for Playground CLI.
# Usage: ./packages/playground/cli/perf/compare-http2.sh

ROUNDS=4
SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
ARTIFACTS_DIR="$SCRIPT_DIR/artifacts"
WORKSPACE_ROOT="$(cd "$SCRIPT_DIR/../../../.." && pwd)"

cd "$WORKSPACE_ROOT"

echo "============================================"
echo " HTTP/1.1 vs HTTP/2 Benchmark Comparison"
echo "============================================"
echo "Rounds per environment: $ROUNDS"
echo ""

BASELINE_FILE=""
HTTP2_FILE=""

# --- Run 1: Baseline (HTTP/1.1) ---
echo ">>> [1/2] Running baseline (HTTP/1.1)..."
echo ""
if npx nx perf playground-cli -- --rounds="$ROUNDS"; then
  BASELINE_FILE=$(ls -t "$ARTIFACTS_DIR"/benchmark-*.json | head -1)
  echo ""
  echo "Baseline results saved: $BASELINE_FILE"
else
  echo ""
  echo "WARNING: Baseline run had failures. Checking if partial results exist..."
  BASELINE_FILE=$(ls -t "$ARTIFACTS_DIR"/benchmark-*.json | head -1)
  # Check if the file has actual results
  if node -e "const r=JSON.parse(require('fs').readFileSync('$BASELINE_FILE','utf8')); process.exit(r.results.length>0?0:1)" 2>/dev/null; then
    echo "Using partial results from: $BASELINE_FILE"
  else
    echo "ERROR: No usable baseline results."
    BASELINE_FILE=""
  fi
fi
echo ""

echo "Cooling down for 10 seconds..."
sleep 10

# --- Run 2: HTTP/2 ---
echo ">>> [2/2] Running HTTP/2..."
echo ""
if npx nx perf playground-cli -- --rounds="$ROUNDS" --http2; then
  HTTP2_FILE=$(ls -t "$ARTIFACTS_DIR"/benchmark-*.json | head -1)
  echo ""
  echo "HTTP/2 results saved: $HTTP2_FILE"
else
  echo ""
  echo "WARNING: HTTP/2 run had failures. Checking if partial results exist..."
  HTTP2_FILE=$(ls -t "$ARTIFACTS_DIR"/benchmark-*.json | head -1)
  if [ "$HTTP2_FILE" = "$BASELINE_FILE" ]; then
    echo "ERROR: No new HTTP/2 results file was created."
    HTTP2_FILE=""
  elif node -e "const r=JSON.parse(require('fs').readFileSync('$HTTP2_FILE','utf8')); process.exit(r.results.length>0?0:1)" 2>/dev/null; then
    echo "Using partial results from: $HTTP2_FILE"
  else
    echo "ERROR: No usable HTTP/2 results."
    HTTP2_FILE=""
  fi
fi
echo ""

# --- Compare ---
if [ -z "$BASELINE_FILE" ] || [ -z "$HTTP2_FILE" ]; then
  echo "Cannot compare: one or both benchmark runs produced no results."
  exit 1
fi

echo ""
echo "============================================"
echo " COMPARISON"
echo "============================================"
echo ""
echo "Baseline file: $BASELINE_FILE"
echo "HTTP/2 file:   $HTTP2_FILE"
echo ""

node -e "
const fs = require('fs');
const baseline = JSON.parse(fs.readFileSync(process.argv[1], 'utf8'));
const http2 = JSON.parse(fs.readFileSync(process.argv[2], 'utf8'));

function fmt(ms) {
  if (ms === undefined || ms === null) return '—';
  return ms < 1000 ? ms.toFixed(0) + 'ms' : (ms / 1000).toFixed(2) + 's';
}

function delta(b, h) {
  if (b === undefined || h === undefined) return '—';
  const pct = ((h - b) / b * 100).toFixed(1);
  const sign = pct > 0 ? '+' : '';
  const indicator = pct > 2 ? ' ↑ slower' : pct < -2 ? ' ↓ faster' : ' ≈ same';
  return sign + pct + '%' + indicator;
}

const envNames = [...new Set([
  ...baseline.results.map(r => r.environment),
  ...http2.results.map(r => r.environment),
])];

for (const env of envNames) {
  const b = baseline.results.find(r => r.environment === env);
  const h = http2.results.find(r => r.environment === env);
  if (!b && !h) continue;

  console.log('--- ' + env + ' ---');
  console.log('');

  const col1 = 22;
  const col2 = 14;
  const col3 = 14;
  const header = 'Metric'.padEnd(col1) + 'HTTP/1.1'.padEnd(col2) + 'HTTP/2'.padEnd(col3) + 'Delta';
  console.log(header);
  console.log('-'.repeat(70));

  const allMetrics = new Set([
    ...Object.keys(b?.metrics || {}),
    ...Object.keys(h?.metrics || {}),
  ]);
  const metrics = [...allMetrics].sort();

  for (const m of metrics) {
    const bv = b?.metrics?.[m];
    const hv = h?.metrics?.[m];
    const row = m.padEnd(col1) + fmt(bv).padEnd(col2) + fmt(hv).padEnd(col3) + delta(bv, hv);
    console.log(row);
  }
  console.log('');
}

console.log('Platform: ' + baseline.platform + ' ' + baseline.arch);
console.log('Node: ' + baseline.nodeVersion);
console.log('CPUs: ' + baseline.cpus);
console.log('Baseline date: ' + baseline.date);
console.log('HTTP/2 date:   ' + http2.date);
console.log('');
" "$BASELINE_FILE" "$HTTP2_FILE"
