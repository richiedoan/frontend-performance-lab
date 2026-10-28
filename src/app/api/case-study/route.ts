import { investigationRecords } from '../../../experiments/data/catalog/investigations';
import { verifiedSuggestions } from '../../../experiments/data/validation/investigation';
import { verifyInvestigationFile } from '../../../experiments/data/validation/investigation-files';
import { getCaseStudyRecords } from '../../../experiments/data/catalog/case-study-records';
import { summarizeCaseStudy } from '../../../experiments/data/summaries/case-study';
import { verifyPublicEvidence } from '../../../experiments/data/validation/public-evidence';
export const dynamic = 'force-dynamic';
export function GET() {
  try {
    return Response.json({
      investigations: verifiedSuggestions(
        investigationRecords,
        verifyInvestigationFile,
      ),
      records: summarizeCaseStudy(getCaseStudyRecords(verifyPublicEvidence)),
    });
  } catch {
    return Response.json(
      { error: 'Experiment records could not be validated.' },
      { status: 500 },
    );
  }
}
