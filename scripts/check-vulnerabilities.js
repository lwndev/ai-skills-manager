#!/usr/bin/env node

/**
 * Check for security vulnerabilities in dependencies
 * Exit code 0 if no moderate+ vulnerabilities, 1 otherwise
 */

const { execSync } = require('child_process');

const MIN_SEVERITY = process.env.MIN_AUDIT_LEVEL || 'moderate';

console.log('\nRunning security audit...');
console.log('─'.repeat(50));

try {
  // Run npm audit and capture output
  const output = execSync(`npm audit --audit-level=${MIN_SEVERITY} --json`, {
    encoding: 'utf8',
    stdio: ['pipe', 'pipe', 'pipe'],
  });

  const audit = JSON.parse(output);

  // Check if there are vulnerabilities
  const { metadata } = audit;
  if (!metadata || !metadata.vulnerabilities) {
    console.log('\x1b[32m✓ No vulnerabilities found\x1b[0m\n');
    process.exit(0);
  }

  const vulns = metadata.vulnerabilities;
  const total = vulns.info + vulns.low + vulns.moderate + vulns.high + vulns.critical;

  if (total === 0) {
    console.log('\x1b[32m✓ No vulnerabilities found\x1b[0m\n');
    process.exit(0);
  }

  // Display vulnerability summary
  console.log('Vulnerabilities found:');
  if (vulns.info > 0) console.log(`  ℹ Info:     ${vulns.info}`);
  if (vulns.low > 0) console.log(`  ⚠ Low:      ${vulns.low}`);
  if (vulns.moderate > 0)
    console.log(`  \x1b[33m⚠ Moderate: ${vulns.moderate}\x1b[0m`);
  if (vulns.high > 0) console.log(`  \x1b[31m✗ High:     ${vulns.high}\x1b[0m`);
  if (vulns.critical > 0)
    console.log(`  \x1b[31m✗ Critical: ${vulns.critical}\x1b[0m`);

  console.log('\n' + '─'.repeat(50));

  // Count actionable vulnerabilities (moderate and above)
  const actionable = vulns.moderate + vulns.high + vulns.critical;

  if (actionable > 0) {
    console.log(`\x1b[31m✗ Found ${actionable} ${MIN_SEVERITY}+ vulnerabilities\x1b[0m`);
    console.log('\nRun \x1b[36mnpm audit\x1b[0m for details');
    console.log('Run \x1b[36mnpm audit fix\x1b[0m to attempt automatic fixes\n');
    process.exit(1);
  } else {
    console.log(
      `\x1b[32m✓ No ${MIN_SEVERITY}+ vulnerabilities (${vulns.info + vulns.low} low/info)\x1b[0m\n`
    );
    process.exit(0);
  }
} catch (error) {
  // npm audit exits with code 1 if vulnerabilities are found
  if (error.status === 1 && error.stdout) {
    try {
      const audit = JSON.parse(error.stdout);
      const { metadata } = audit;

      if (metadata && metadata.vulnerabilities) {
        const vulns = metadata.vulnerabilities;

        // Display vulnerability summary
        console.log('Vulnerabilities found:');
        if (vulns.info > 0) console.log(`  ℹ Info:     ${vulns.info}`);
        if (vulns.low > 0) console.log(`  ⚠ Low:      ${vulns.low}`);
        if (vulns.moderate > 0)
          console.log(`  \x1b[33m⚠ Moderate: ${vulns.moderate}\x1b[0m`);
        if (vulns.high > 0) console.log(`  \x1b[31m✗ High:     ${vulns.high}\x1b[0m`);
        if (vulns.critical > 0)
          console.log(`  \x1b[31m✗ Critical: ${vulns.critical}\x1b[0m`);

        console.log('\n' + '─'.repeat(50));

        const actionable = vulns.moderate + vulns.high + vulns.critical;
        console.log(`\x1b[31m✗ Found ${actionable} ${MIN_SEVERITY}+ vulnerabilities\x1b[0m`);
        console.log('\nRun \x1b[36mnpm audit\x1b[0m for details');
        console.log('Run \x1b[36mnpm audit fix\x1b[0m to attempt automatic fixes\n');
        process.exit(1);
      }
    } catch (parseError) {
      console.error('\x1b[31m✗ Failed to parse audit output\x1b[0m');
      console.error(error.stdout || error.message);
      process.exit(1);
    }
  } else {
    console.error('\x1b[31m✗ Failed to run npm audit\x1b[0m');
    console.error(error.message);
    process.exit(1);
  }
}
