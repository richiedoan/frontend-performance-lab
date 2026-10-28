import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  agentRules: false,
  env: {
    NEXT_PUBLIC_ENABLE_OPTIMIZE:
      process.env.ENABLE_OPTIMIZE === '1' ? '1' : '0',
  },
  reactStrictMode: true,
  outputFileTracingIncludes: {
    '/api/case-study': [
      './public/evidence/**/*',
      './src/experiments/data/catalog/published-runs.json',
    ],
  },
};

export default nextConfig;
