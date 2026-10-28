import { expect, it } from 'vitest';
import { parseScenarioConfig, SCENARIOS } from './scenario-config';

it('uses stable defaults and canonical API parameters', () => {
  expect(parseScenarioConfig('')).toEqual({
    status: 'valid',
    config: {
      scenario: 'default',
      aggregationPasses: 20,
      seed: 20260911,
      count: 5000,
      delayMs: 0,
      simulateError: false,
    },
    apiQuery: 'seed=20260911&count=5000&delayMs=0&simulateError=false',
  });
  expect(parseScenarioConfig('count=2e1&seed=42&scenario=default')).toEqual(
    parseScenarioConfig('scenario=default&seed=42&count=20'),
  );
});
it.each(SCENARIOS)('accepts %s without passing it to the API', (scenario) => {
  const value = parseScenarioConfig(
    `scenario=${scenario}&seed=-1.25&count=0&delayMs=5000`,
  );
  expect(value.status).toBe('valid');
  if (value.status === 'valid') {
    expect(value.config).toMatchObject({
      scenario,
      seed: -1.25,
      count: 0,
      delayMs: 5000,
    });
    expect(new URLSearchParams(value.apiQuery).has('scenario')).toBe(false);
  }
});
it.each([
  'scenario=',
  'scenario=unknown',
  'scenario=default&scenario=default',
  'count=-1',
  'count=10001',
  'count=1.5',
  'count=',
  'seed=NaN',
  'seed=Infinity',
  'seed=9007199254740992',
  'seed=1&seed=2',
  'delayMs=5001',
  'simulateError=yes',
  'unknown=1',
])('rejects %s', (query) => {
  expect(parseScenarioConfig(query)).toEqual({
    status: 'invalid',
    message: expect.any(String),
  });
});
it('accepts numeric bounds and has no state shared across calls', () => {
  const before = parseScenarioConfig('');
  expect(
    parseScenarioConfig('seed=-9007199254740991&count=10000&simulateError=true')
      .status,
  ).toBe('valid');
  expect(parseScenarioConfig('seed=9007199254740991&count=0').status).toBe(
    'valid',
  );
  expect(parseScenarioConfig('')).toEqual(before);
});

it('bounds aggregation workload and keeps it out of API requests', () => {
  for (const passes of [1, 20, 100]) {
    const result = parseScenarioConfig(
      `scenario=worker-aggregation&aggregationPasses=${passes}`,
    );
    expect(result.status).toBe('valid');
    if (result.status === 'valid') {
      expect(result.config.aggregationPasses).toBe(passes);
      expect(result.apiQuery).not.toContain('aggregationPasses');
    }
  }
  for (const value of ['', '0', '101', '1.5', 'NaN', '1e2'])
    expect(
      parseScenarioConfig(
        `scenario=worker-aggregation&aggregationPasses=${value}`,
      ).status,
    ).toBe('invalid');
  expect(parseScenarioConfig('aggregationPasses=2').status).toBe('invalid');
  expect(
    parseScenarioConfig(
      'scenario=worker-aggregation&aggregationPasses=2&aggregationPasses=3',
    ).status,
  ).toBe('invalid');
});

it('gates combined mode without changing isolated or baseline defaults', () => {
  expect(parseScenarioConfig('scenario=optimized-explorer').status).toBe(
    'invalid',
  );
  const combined = parseScenarioConfig('count=250&seed=42', true);
  expect(combined).toMatchObject({
    status: 'valid',
    config: { scenario: 'optimized-explorer', count: 250, seed: 42 },
    apiQuery: 'seed=42&count=250&delayMs=0&simulateError=false',
  });
  for (const scenario of SCENARIOS.filter((value) => value !== 'default')) {
    expect(parseScenarioConfig(`scenario=${scenario}`, true)).toEqual(
      parseScenarioConfig(`scenario=${scenario}`),
    );
  }
  expect(
    parseScenarioConfig(
      'scenario=optimized-explorer&aggregationPasses=30',
      true,
    ),
  ).toMatchObject({ status: 'valid', config: { aggregationPasses: 30 } });
  expect(
    parseScenarioConfig('scenario=optimized-explorer&scenario=default', true)
      .status,
  ).toBe('invalid');
});

it('maps legacy default to combined only when opted in', () => {
  expect(parseScenarioConfig('scenario=default&count=20', true)).toMatchObject({
    status: 'valid',
    config: { scenario: 'optimized-explorer', count: 20 },
  });
  expect(parseScenarioConfig('scenario=default&count=20')).toMatchObject({
    status: 'valid',
    config: { scenario: 'default', count: 20 },
  });
});
