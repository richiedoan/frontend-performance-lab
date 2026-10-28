import { createElement } from 'react';
import { render, screen } from '@testing-library/react';
import { expect, it, vi } from 'vitest';
import { mkdtemp, realpath, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { collectionFixture } from './importer.fixture';
import { catalogPath, importPlan, validateCollection } from './importer';
import { writeSafe } from '../publication/files';
import { getExperimentRegistry } from '../../src/experiments/data/catalog/registry';
import { readCaseStudyRun } from '../../src/experiments/data/catalog/case-study-records';
import { verifyPublicEvidence } from '../../src/experiments/data/validation/public-evidence';
import { summarizeCaseStudy } from '../../src/experiments/data/summaries/case-study';
import { CaseStudy } from '../../src/experiments/components/CaseStudy';
it('renders an imported artifact through registry, evidence verification and the Case Study UI', async () => {
  const root = await mkdtemp(join(await realpath(tmpdir()), 'import-ui-test-'));
  try {
    const fixture = collectionFixture();
    for (const [path, value] of Object.entries(fixture.files))
      await writeSafe(root, path, JSON.stringify(value));
    await writeSafe(root, catalogPath, '[]');
    const plan = await validateCollection(root, fixture.identity);
    const runs = await importPlan(root, plan, false);
    const records = summarizeCaseStudy(
      getExperimentRegistry(runs).map(({ definition, runs }) => ({
        definition,
        runs: runs.map((run) =>
          readCaseStudyRun(run, definition, (artifact) =>
            verifyPublicEvidence(artifact, join(root, 'public')),
          ),
        ),
      })),
    );
    const request = vi
      .spyOn(globalThis, 'fetch')
      .mockResolvedValue(Response.json({ records }));
    try {
      render(createElement(CaseStudy));
      expect(await screen.findAllByText('300 ms')).toHaveLength(2);
      expect(screen.getAllByText('150 ms')).toHaveLength(2);
      expect(
        screen.getAllByText(/including automation and network waits/).length,
      ).toBeGreaterThan(0);
      expect(screen.getAllByRole('link', { name: /^Evidence:/ })).toHaveLength(
        2,
      );
      expect(
        request.mock.calls.every(([url]) => url === '/api/case-study'),
      ).toBe(true);
    } finally {
      request.mockRestore();
    }
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});
