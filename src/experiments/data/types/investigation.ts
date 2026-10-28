import type { Artifact, MissingResult } from './experiment';
export interface Investigation {
  schemaVersion: 1;
  id: string;
  experimentId: string;
  status: 'draft' | 'verified';
  question: string;
  aiHypothesis: string;
  evidenceInspected: { artifact: Artifact; finding: string }[];
  sourceLocations: {
    path: string;
    startLine: number;
    endLine: number;
    revision: string;
  }[];
  decision: 'pending' | 'accepted' | 'rejected';
  decisionSummary: string;
  reasoning: string;
  relatedDiff: Artifact | MissingResult;
  measurements: {
    before: Artifact | MissingResult;
    after: Artifact | MissingResult;
    conditions: string | MissingResult;
  };
  verification: { reviewer: string; verifiedAt: string } | null;
}
