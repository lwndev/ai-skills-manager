/**
 * Shared helpers for e2e tests.
 *
 * All helpers invoke the CLI via `node dist/cli.js` and never import
 * application code directly, keeping tests true end-to-end.
 */

import { execSync } from 'child_process';
import * as fs from 'fs/promises';
import * as os from 'os';
import * as path from 'path';

/** Absolute path to the compiled CLI entry point. */
export const CLI_PATH = path.join(process.cwd(), 'dist', 'cli.js');

/** Result returned by `runCli`. */
export interface CliResult {
  stdout: string;
  stderr: string;
  exitCode: number;
}

/**
 * Run the CLI with the given arguments.
 *
 * Never throws – non-zero exit codes are captured in the result.
 */
export function runCli(
  args: string,
  options: { cwd?: string; env?: Record<string, string> } = {}
): CliResult {
  try {
    const stdout = execSync(`node "${CLI_PATH}" ${args}`, {
      encoding: 'utf-8',
      stdio: ['pipe', 'pipe', 'pipe'],
      cwd: options.cwd,
      env: { ...process.env, ...options.env },
    });
    return { stdout, stderr: '', exitCode: 0 };
  } catch (error: unknown) {
    const err = error as {
      status?: number;
      stdout?: string;
      stderr?: string;
    };
    return {
      stdout: err.stdout ?? '',
      stderr: err.stderr ?? '',
      exitCode: err.status ?? 1,
    };
  }
}

/**
 * Scaffold a skill via the CLI and return the result plus the skill directory.
 */
export function scaffoldSkill(
  name: string,
  outputDir: string,
  extraFlags = ''
): { result: CliResult; skillDir: string } {
  const result = runCli(
    `scaffold "${name}" --output "${outputDir}" --description "Test skill" --force ${extraFlags}`
  );
  return { result, skillDir: path.join(outputDir, name) };
}

/**
 * Package a skill via the CLI and return the result plus the expected
 * package path.
 */
export function packageSkill(
  skillDir: string,
  outputDir: string,
  extraFlags = ''
): { result: CliResult; packagePath: string } {
  const skillName = path.basename(skillDir);
  const result = runCli(`package "${skillDir}" -o "${outputDir}" --force ${extraFlags}`);
  return {
    result,
    packagePath: path.join(outputDir, `${skillName}.skill`),
  };
}

/**
 * Create a SKILL.md manually with custom YAML frontmatter.
 *
 * Returns the path to the skill directory.
 */
export async function createSkillManually(
  baseDir: string,
  name: string,
  frontmatter: Record<string, unknown>,
  body = '# Instructions\n\nDo the thing.\n'
): Promise<string> {
  const skillDir = path.join(baseDir, name);
  await fs.mkdir(skillDir, { recursive: true });

  const yamlLines: string[] = [];
  for (const [key, value] of Object.entries(frontmatter)) {
    if (typeof value === 'object' && value !== null && !Array.isArray(value)) {
      yamlLines.push(`${key}:`);
      for (const [k, v] of Object.entries(value as Record<string, unknown>)) {
        yamlLines.push(`  ${k}: ${formatYamlValue(v)}`);
      }
    } else if (Array.isArray(value)) {
      yamlLines.push(`${key}:`);
      for (const item of value) {
        if (typeof item === 'object' && item !== null) {
          const entries = Object.entries(item as Record<string, unknown>);
          yamlLines.push(`  - ${entries[0][0]}: ${formatYamlValue(entries[0][1])}`);
          for (let i = 1; i < entries.length; i++) {
            yamlLines.push(`    ${entries[i][0]}: ${formatYamlValue(entries[i][1])}`);
          }
        } else {
          yamlLines.push(`  - ${formatYamlValue(item)}`);
        }
      }
    } else {
      yamlLines.push(`${key}: ${formatYamlValue(value)}`);
    }
  }

  const content = `---\n${yamlLines.join('\n')}\n---\n\n${body}`;
  await fs.writeFile(path.join(skillDir, 'SKILL.md'), content, 'utf-8');
  return skillDir;
}

function formatYamlValue(value: unknown): string {
  if (typeof value === 'string') return value;
  if (typeof value === 'boolean') return value ? 'true' : 'false';
  if (typeof value === 'number') return String(value);
  return JSON.stringify(value);
}

/** Create a temporary directory with an optional prefix. */
export async function createTempDir(prefix = 'asm-e2e-'): Promise<string> {
  return fs.mkdtemp(path.join(os.tmpdir(), prefix));
}

/** Remove a directory tree. */
export async function cleanupDir(dir: string): Promise<void> {
  await fs.rm(dir, { recursive: true, force: true });
}
