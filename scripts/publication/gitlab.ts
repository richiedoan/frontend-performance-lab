import { requiredCheckJobs } from '../ci/required-jobs.ts';
import { requireValue, safePath, record, equal } from './files.ts';
export type Fetch = typeof fetch;
export function httpsUrl(value: string) {
  const url = new URL(value);
  requireValue(
    url.protocol === 'https:' && !url.username && !url.password && !url.hash,
    'HTTPS URL without credentials required',
  );
  return url;
}
export async function download(
  url: string,
  token: string | undefined,
  fetcher: Fetch = fetch,
  redirects = true,
): Promise<string | null> {
  let current = httpsUrl(url);
  let credential = token;
  for (let index = 0; index < 5; index++) {
    const response = await fetcher(current, {
      redirect: 'manual',
      signal: AbortSignal.timeout(60000),
      headers: credential ? { 'PRIVATE-TOKEN': credential } : {},
    });
    if ([301, 302, 303, 307, 308].includes(response.status)) {
      requireValue(redirects, 'redirect forbidden');
      current = httpsUrl(
        new URL(response.headers.get('location') ?? '', current).href,
      );
      credential = undefined; // Never forward credentials, even on a same-origin redirect.
      continue;
    }
    if (response.status === 404) return null;
    requireValue(response.ok, 'HTTP request failed');
    requireValue(
      Number(response.headers.get('content-length') ?? 0) <= 8 * 1024 * 1024,
      'response too large',
    );
    const reader = response.body?.getReader();
    requireValue(reader, 'missing response');
    const chunks: Uint8Array[] = [];
    let size = 0;
    try {
      for (;;) {
        const { done, value } = await reader.read();
        if (done) break;
        size += value.length;
        requireValue(size <= 8 * 1024 * 1024, 'response too large');
        chunks.push(value);
      }
    } finally {
      await reader.cancel();
    }
    return Buffer.concat(chunks).toString('utf8');
  }
  throw new Error('Publication validation: too many redirects');
}
export interface Job {
  id: number;
  name: string;
  status: string;
  commit: { id: string };
  pipeline: { id: number; sha: string };
}
export class GitLab {
  readonly api: string;
  readonly project: string;
  readonly pipeline: string;
  readonly commit: string;
  readonly token: string;
  readonly fetcher: Fetch;

  constructor(
    api: string,
    project: string,
    pipeline: string,
    commit: string,
    token: string,
    fetcher: Fetch = fetch,
  ) {
    this.api = api;
    this.project = project;
    this.pipeline = pipeline;
    this.commit = commit;
    this.token = token;
    this.fetcher = fetcher;
    httpsUrl(api);
    requireValue(
      /^\d+$/.test(project) && /^\d+$/.test(pipeline),
      'GitLab identity',
    );
  }
  async get(path: string) {
    return download(
      `${this.api}/projects/${this.project}/${path}`,
      this.token,
      this.fetcher,
    );
  }
  async jobs() {
    const jobs: Job[] = [];
    for (let page = 1; page <= 100; page++) {
      const body = await this.get(
        `pipelines/${this.pipeline}/jobs?include_retried=true&per_page=100&page=${page}`,
      );
      requireValue(body, 'pipeline jobs missing');
      const batch: unknown = JSON.parse(body);
      requireValue(Array.isArray(batch), 'jobs array');
      for (const value of batch) {
        const job = record(value) as unknown as Job;
        requireValue(Number.isSafeInteger(job.id) && job.id > 0, 'job ID');
        requireValue(
          [
            'created',
            'pending',
            'preparing',
            'running',
            'success',
            'failed',
            'canceled',
            'skipped',
            'manual',
            'scheduled',
            'waiting_for_resource',
          ].includes(job.status),
          'job status',
        );
        equal(job.pipeline.id, Number(this.pipeline), 'job pipeline');
        equal(job.pipeline.sha, this.commit, 'pipeline commit');
        equal(job.commit.id, this.commit, 'job commit');
        jobs.push(job);
      }
      if (batch.length < 100) return jobs;
    }
    throw new Error('Publication validation: job pagination limit');
  }
  async selectedJob() {
    const jobs = await this.jobs();
    const latest = (name: string) =>
      jobs.filter((job) => job.name === name).sort((a, b) => b.id - a.id)[0];
    for (const name of requiredCheckJobs)
      requireValue(
        latest(name)?.status === 'success',
        `${name} not successful`,
      );
    return latest('benchmark-journey');
  }
  async artifact(jobId: number, path: string) {
    return this.get(
      `jobs/${jobId}/artifacts/${safePath(path).split('/').map(encodeURIComponent).join('/')}`,
    );
  }
  async fresh(branch: string) {
    const body = await this.get(
      `repository/branches/${encodeURIComponent(branch)}`,
    );
    requireValue(body, 'branch missing');
    equal(
      record(record(JSON.parse(body)).commit).id,
      this.commit,
      'superseded commit',
    );
    const pipelines = await this.get(
      `pipelines?ref=${encodeURIComponent(branch)}&order_by=id&sort=desc&per_page=1`,
    );
    requireValue(pipelines, 'pipelines missing');
    const values = JSON.parse(pipelines);
    requireValue(
      Array.isArray(values) && values.length === 1,
      'pipeline freshness',
    );
    equal(record(values[0]).id, Number(this.pipeline), 'superseded pipeline');
  }
}
