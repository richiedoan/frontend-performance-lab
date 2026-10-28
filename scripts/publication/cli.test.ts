// @vitest-environment node
import { spawnSync } from 'node:child_process';
import { mkdtemp, readFile, realpath, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, expect, it } from 'vitest';

const roots: string[] = [];
afterEach(async () => {
  await Promise.all(
    roots.splice(0).map((root) => rm(root, { recursive: true, force: true })),
  );
});

it.each([false, true])(
  'runs the publication CLI with native Node and enforces gates (enabled: %s)',
  async (enabled) => {
    const root = await mkdtemp(join(await realpath(tmpdir()), 'publication-cli-'));
    roots.push(root);
    const result = spawnSync(
      process.execPath,
      [join(process.cwd(), 'scripts/publication/cli.ts'), '--dry-run'],
      {
        cwd: root,
        // Do not inherit CI opt-ins, credentials, or Node transform options.
        env: { NODE_ENV: 'test', PUBLICATION_ENABLED: String(enabled) },
        encoding: 'utf8',
        timeout: 10_000,
      },
    );
    expect(result.error).toBeUndefined();
    expect(result.status, result.stderr).toBe(enabled ? 1 : 0);
    const report = JSON.parse(
      await readFile(join(root, 'reports/publication.json'), 'utf8'),
    );
    expect(report).toMatchObject({
      status: enabled ? 'failed' : 'not-deployed',
      phase: 'gates',
    });
    if (enabled) {
      expect(result.stderr).toContain('Publication failed.');
    } else {
      expect(report.reason).toBe('disabled');
      expect(JSON.parse(result.stdout)).toEqual(report);
    }
  },
);
