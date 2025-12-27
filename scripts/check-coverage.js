#!/usr/bin/env node

/**
 * Check test coverage meets minimum threshold
 * Exit code 0 if coverage >= 80%, 1 otherwise
 */

const fs = require('fs');
const path = require('path');

const COVERAGE_THRESHOLDS = {
  statements: 80,
  branches: 80,
  functions: 75, // Slightly lower due to interactive CLI functions
  lines: 80,
};
const COVERAGE_FILE = path.join(__dirname, '../coverage/coverage-summary.json');

// Check if coverage file exists
if (!fs.existsSync(COVERAGE_FILE)) {
  console.error('❌ Coverage file not found. Run tests first: npm run test:coverage');
  process.exit(1);
}

// Read coverage summary
const coverage = JSON.parse(fs.readFileSync(COVERAGE_FILE, 'utf8'));
const total = coverage.total;

// Check each metric
const metrics = ['statements', 'branches', 'functions', 'lines'];
const results = {};
let allPassed = true;

console.log('\nCoverage Report:');
console.log('─'.repeat(50));

for (const metric of metrics) {
  const pct = total[metric].pct;
  const threshold = COVERAGE_THRESHOLDS[metric];
  results[metric] = pct;
  const status = pct >= threshold ? '✓' : '✗';
  const color = pct >= threshold ? '\x1b[32m' : '\x1b[31m';

  console.log(
    `${color}${status}\x1b[0m ${metric.padEnd(12)} ${pct.toFixed(2)}% (threshold: ${threshold}%)`
  );

  if (pct < threshold) {
    allPassed = false;
  }
}

console.log('─'.repeat(50));

if (allPassed) {
  console.log('\x1b[32m✓ All coverage metrics meet their thresholds\x1b[0m\n');
  process.exit(0);
} else {
  console.log('\x1b[31m✗ Coverage below threshold for one or more metrics\x1b[0m\n');
  process.exit(1);
}
