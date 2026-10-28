import type {
  Artifact,
  ExperimentDefinition,
  ExperimentRun,
} from '../types/experiment';
import {
  parseExperimentDefinition,
  parseExperimentRun,
} from '../validation/experiment';
import { getExperimentRegistry } from './registry';

/** Verification must check durable artifact existence, checksum and accessibility. */
export function readCaseStudyRun(
  input: unknown,
  definitionInput: unknown,
  verifyArtifact: (artifact: Artifact) => boolean = () => false,
): ExperimentRun {
  const definition: ExperimentDefinition =
    parseExperimentDefinition(definitionInput);
  const run = parseExperimentRun(input, definition);
  for (const entry of run.results) {
    if (entry.result.status !== 'measured') continue;
    const result = entry.result;
    const artifact = run.artifacts.find(
      (item) => item.path === result.evidencePath,
    )!;
    let verified = false;
    try {
      verified = verifyArtifact(artifact);
    } catch {
      /* Unreadable evidence stays unavailable. */
    }
    if (
      !verified ||
      result.aggregation !== 'median' ||
      result.sampleCount !== 5
    ) {
      entry.result = {
        status: 'not-available',
        reason: !verified
          ? 'Raw evidence has not been verified.'
          : 'Publication requires a median of five valid samples.',
      };
    }
  }
  return run;
}

export function getCaseStudyRecords(
  verifyArtifact: (artifact: Artifact) => boolean = () => false,
) {
  return getExperimentRegistry().map(({ definition, runs }) => ({
    definition,
    runs: runs.map((run) => readCaseStudyRun(run, definition, verifyArtifact)),
  }));
}
