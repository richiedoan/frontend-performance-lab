// @vitest-environment node
import { expect, it } from 'vitest';
import { mkdtemp, writeFile, rm, symlink, readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { createHash } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { compareBudgets, type VerifiedSummary } from './budget';
import { loadVerifiedSummary, verifiedFile } from './budget-evidence';
import { profile } from './environment';
function fixture(value = 100): VerifiedSummary {
  return {
    sha256: 'a'.repeat(64),
    approach: 'optimized',
    experiment: 'search-input',
    workload: {
      id: 'fixture-typing',
      version: '1',
      actionsSha256: 'b'.repeat(64),
    },
    environment: {
      nodeVersion: profile.nodeVersion,
      yarnVersion: profile.yarnVersion,
      playwrightVersion: profile.playwrightVersion,
      browser: {
        version: profile.chromeVersion,
        revision: profile.chromeRevision,
        distribution: 'Chrome for Testing',
        executable: '/fixture',
        sha256: 'c'.repeat(64),
        product: 'fixture',
      },
      viewport: profile.viewport,
      locale: profile.locale,
      timezoneId: profile.timezoneId,
      online: true,
      applied: {
        cpuRate: profile.cpuRate,
        network: profile.network,
        cacheDisabled: true,
        cacheCleared: true,
        freshContext: true,
        headless: true,
        serviceWorkers: 'block',
      },
      storage: { cookies: 0, origins: 0 },
      dataset: {
        seed: profile.seed,
        recordCount: profile.recordCount,
        generatorVersion: 1,
        sha256: 'd'.repeat(64),
      },
      source: {
        commitSha: 'e'.repeat(40),
        dirty: false,
        status: '',
        patchSha256: 'f'.repeat(64),
      },
      os: {
        platform: 'fixture',
        release: '1',
        arch: 'fixture',
        cpu: 'fixture',
        totalMemory: 1024,
      },
      plan: {
        measuredIterations: 5,
        warmupIterations: 0,
        cacheState: profile.cacheState,
      },
    },
    metrics: {
      'search-duration': {
        status: 'measured',
        value,
        unit: 'ms',
        extraction: 'fixture-input-to-last-result-v1',
        evidencePath: 'raw.json',
      },
    },
  };
}
function compare(value: number, tolerance = 0) {
  const reference = fixture();
  reference.approach = 'baseline';
  return compareBudgets(
    fixture(value),
    reference,
    ['search-duration'],
    tolerance,
  );
}
it('accepts improvement/equality, rejects regression and respects inclusive tolerance', () => {
  expect(compare(90).status).toBe('pass');
  expect(compare(100).status).toBe('pass');
  expect(compare(100.001).status).toBe('regression');
  expect(compare(101.999999, 0.02).status).toBe('pass');
  expect(compare(102, 0.02).status).toBe('pass');
  expect(compare(102.000001, 0.02).status).toBe('regression');
  expect(() => compare(100, NaN)).toThrow();
});
it('handles zero reference without percentage division or absolute allowance', () => {
  const reference = fixture(0);
  reference.approach = 'baseline';
  expect(
    compareBudgets(fixture(0), reference, ['search-duration'], 0.1).status,
  ).toBe('pass');
  expect(
    compareBudgets(fixture(0.001), reference, ['search-duration'], 0.1).status,
  ).toBe('regression');
});
it('never passes missing, incompatible environment, units or workload', () => {
  const reference = fixture();
  reference.approach = 'baseline';
  const missing = fixture();
  missing.metrics = {};
  expect(compareBudgets(missing, reference, ['search-duration']).status).toBe(
    'unavailable',
  );
  const incompatible = fixture();
  incompatible.environment = structuredClone(incompatible.environment);
  incompatible.environment.os.cpu = 'different';
  expect(
    compareBudgets(incompatible, reference, ['search-duration']).status,
  ).toBe('invalid');
  const wrong = fixture();
  wrong.workload.version = '2';
  expect(compareBudgets(wrong, reference, ['search-duration']).status).toBe(
    'invalid',
  );
  const unit = fixture();
  const m = unit.metrics['search-duration'];
  if (m?.status === 'measured') m.unit = 'bytes';
  expect(compareBudgets(unit, reference, ['search-duration']).status).toBe(
    'invalid',
  );
});
it('requires exact approval hash for optimized reference', () => {
  expect(compareBudgets(fixture(), fixture(), ['search-duration']).status).toBe(
    'invalid',
  );
  expect(
    compareBudgets(fixture(), fixture(), ['search-duration'], 0, 'a'.repeat(64))
      .status,
  ).toBe('pass');
});
it('verifies checksum and median from raw samples; rejects tampering and preserves failed/missing evidence', async () => {
  const dir = await mkdtemp(join(tmpdir(), 'budget-fixture-'));
  // Synthetic test data only. The real label below exercises the production parser in a temporary directory.
  async function save(name: string, value: unknown) {
    const bytes = JSON.stringify(value);
    await writeFile(join(dir, name), bytes);
    return {
      path: name,
      sha256: createHash('sha256').update(bytes).digest('hex'),
    };
  }
  try {
    const f = fixture();
    const environment = await save('environment.json', {
      schemaVersion: 1,
      status: 'passed',
      failures: [],
      observed: f.environment,
    });
    const raw = {
      evidenceKind: 'real',
      metric: 'search-duration',
      unit: 'ms',
      extraction: 'fixture-input-to-last-result-v1',
      approach: f.approach,
      experiment: f.experiment,
      workload: f.workload,
      environmentSha256: environment.sha256,
      samples: [90, 100, 101, 100, 999].map((value, i) => ({
        iteration: i + 1,
        status: 'passed',
        value,
        reason: 'fixture failure',
      })),
    };
    const summary = {
      schemaVersion: 1,
      kind: 'regression-budget-summary',
      evidenceKind: 'real',
      approach: f.approach,
      experiment: f.experiment,
      workload: f.workload,
      environment,
      metrics: {
        'search-duration': {
          status: 'measured',
          value: 100,
          unit: 'ms',
          aggregation: 'median',
          sampleCount: 5,
          extraction: raw.extraction,
          evidence: await save('raw.json', raw),
        },
      },
    };
    await save('summary.json', summary);
    const load = () => loadVerifiedSummary(join(dir, 'summary.json'));
    expect((await load()).metrics['search-duration']?.status).toBe('measured');
    summary.metrics['search-duration'].value = 99;
    await save('summary.json', summary);
    expect((await load()).metrics['search-duration']?.status).toBe('invalid');
    summary.metrics['search-duration'].value = 100;
    raw.samples[0].status = 'failed';
    summary.metrics['search-duration'].evidence = await save('raw.json', raw);
    await save('summary.json', summary);
    expect((await load()).metrics['search-duration']?.status).toBe(
      'unavailable',
    );
    await writeFile(join(dir, 'raw.json'), '{}');
    expect((await load()).metrics['search-duration']?.status).toBe('invalid');
    await rm(join(dir, 'raw.json'));
    expect((await load()).metrics['search-duration']?.status).toBe(
      'unavailable',
    );
    await expect(
      verifiedFile(dir, { path: '../escape', sha256: 'a'.repeat(64) }),
    ).rejects.toThrow('Unsafe');
    await symlink(join(dir, 'environment.json'), join(dir, 'link.json'));
    await expect(
      verifiedFile(dir, { path: 'link.json', sha256: environment.sha256 }),
    ).rejects.toThrow('Symlink');
    // Exercise the opt-in CLI's exit code without generating real artifacts.
    try {
      execFileSync(
        process.execPath,
        [
          'scripts/benchmark/budget-cli.ts',
          join(dir, 'summary.json'),
          join(dir, 'summary.json'),
        ],
        { stdio: 'pipe' },
      );
      throw new Error('CLI unexpectedly passed');
    } catch (error) {
      expect((error as { status: number }).status).toBe(2);
    }
    expect(
      (await readFile(join(dir, 'summary.json'), 'utf8')).length,
    ).toBeGreaterThan(0);
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
});
