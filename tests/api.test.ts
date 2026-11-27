import { describe, it, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import { Readable } from 'node:stream';
import type { IncomingMessage, ServerResponse } from 'node:http';
import { handleNodeRequest } from '../server/handlers/router.ts';
import { clearAirQualityCaches } from '../server/lib/airQuality.ts';
import {
  buildDemoAirQualityData,
  DEMO_PERSONAS,
} from '../shared/demoScenarios.ts';
import {
  AskSaansPayloadSchema,
  DailyPlanPayloadSchema,
} from '../shared/types.ts';

const originalFetch = globalThis.fetch;

interface MockResponseResult {
  status: number;
  headers: Record<string, string>;
  bodyText: string;
  json: Record<string, unknown>;
}

async function invokeRouter(options: {
  method: string;
  url: string;
  body?: string;
}): Promise<MockResponseResult> {
  const chunks = options.body !== undefined ? [Buffer.from(options.body, 'utf-8')] : [];
  const req = Readable.from(chunks) as unknown as IncomingMessage;
  req.method = options.method;
  req.url = options.url;
  req.headers = {};

  const headers: Record<string, string> = {};
  let bodyText = '';
  let statusCode = 200;

  const res = {
    get statusCode() {
      return statusCode;
    },
    set statusCode(code: number) {
      statusCode = code;
    },
    setHeader(name: string, value: string | number | readonly string[]) {
      headers[name.toLowerCase()] = Array.isArray(value)
        ? value.join(', ')
        : String(value);
    },
    end(chunk?: string | Buffer) {
      if (chunk !== undefined) {
        bodyText += typeof chunk === 'string' ? chunk : chunk.toString('utf-8');
      }
    },
  } as unknown as ServerResponse;

  await handleNodeRequest(req, res);

  return {
    status: statusCode,
    headers,
    bodyText,
    json: bodyText ? (JSON.parse(bodyText) as Record<string, unknown>) : {},
  };
}

afterEach(() => {
  globalThis.fetch = originalFetch;
  clearAirQualityCaches();
});

describe('API router validation and routing', () => {
  it('returns health status on GET /api/health with no-store caching', async () => {
    const res = await invokeRouter({ method: 'GET', url: '/api/health' });
    assert.equal(res.status, 200);
    assert.equal(res.json.status, 'ok');
    assert.equal(typeof res.json.geminiConfigured, 'boolean');
    assert.equal(typeof res.json.model, 'string');
    assert.equal(res.headers['cache-control'], 'no-store');
  });

  it('returns 404 for unknown API routes', async () => {
    const res = await invokeRouter({ method: 'GET', url: '/api/does-not-exist' });
    assert.equal(res.status, 404);
    assert.match(String(res.json.error), /not found/i);
  });

  it('returns 405 Method Not Allowed with Allow header for invalid request methods', async () => {
    const cases: Array<[string, string, string]> = [
      ['POST', '/api/health', 'GET'],
      ['DELETE', '/api/geocode', 'GET'],
      ['POST', '/api/air-quality?lat=28.6&lon=77.2', 'GET'],
      ['GET', '/api/daily-plan', 'POST'],
      ['PUT', '/api/ask', 'POST'],
    ];

    for (const [method, url, expectedAllow] of cases) {
      const res = await invokeRouter({ method, url });
      assert.equal(res.status, 405, `${method} ${url} should return 405`);
      assert.equal(res.headers['allow'], expectedAllow);
      assert.match(String(res.json.error), /not allowed/i);
    }
  });

  it('rejects missing or invalid coordinates on /api/air-quality and /api/geocode', async () => {
    const badUrls = [
      '/api/air-quality',
      '/api/air-quality?lat=&lon=',
      '/api/air-quality?lat=28.6139',
      '/api/air-quality?lat=abc&lon=77.2',
      '/api/air-quality?lat=95&lon=77.2',
      '/api/air-quality?lat=-91&lon=77.2',
      '/api/air-quality?lat=28.6&lon=185',
      '/api/air-quality?lat=28.6&lon=-181',
      '/api/geocode?lat=95&lon=77.2',
      '/api/geocode?lat=28.6139',
    ];

    for (const url of badUrls) {
      const res = await invokeRouter({ method: 'GET', url });
      assert.equal(res.status, 400, `${url} should return 400`);
      assert.equal(typeof res.json.error, 'string');
    }
  });

  it('returns empty results for short geocode queries without hitting network', async () => {
    const res = await invokeRouter({ method: 'GET', url: '/api/geocode?q=a' });
    assert.equal(res.status, 200);
    assert.deepEqual(res.json.results, []);
  });

  it('rejects invalid JSON and non-object JSON bodies with 400', async () => {
    for (const url of ['/api/daily-plan', '/api/ask']) {
      const malformed = await invokeRouter({
        method: 'POST',
        url,
        body: '{"broken": ',
      });
      assert.equal(malformed.status, 400);
      assert.match(String(malformed.json.error), /Invalid JSON/i);

      const arrayBody = await invokeRouter({
        method: 'POST',
        url,
        body: '[1, 2, 3]',
      });
      assert.equal(arrayBody.status, 400);
      assert.match(String(arrayBody.json.error), /JSON object/i);
    }
  });

  it('rejects missing or malformed required fields on /api/daily-plan and /api/ask', async () => {
    const missingPlan = await invokeRouter({
      method: 'POST',
      url: '/api/daily-plan',
      body: JSON.stringify({}),
    });
    assert.equal(missingPlan.status, 400);

    const malformedPlan = await invokeRouter({
      method: 'POST',
      url: '/api/daily-plan',
      body: JSON.stringify({ profile: { adults: 'two' }, airData: {} }),
    });
    assert.equal(malformedPlan.status, 400);
    assert.match(String(malformedPlan.json.error), /Invalid request field/i);

    const missingAsk = await invokeRouter({
      method: 'POST',
      url: '/api/ask',
      body: JSON.stringify({ question: '   ' }),
    });
    assert.equal(missingAsk.status, 400);

    const validAir = buildDemoAirQualityData('moderate_haze');
    const validProfile = {
      ...DEMO_PERSONAS[0].profile,
      location: validAir.location,
      onboardingCompleted: true,
    };
    const invalidHistoryAsk = await invokeRouter({
      method: 'POST',
      url: '/api/ask',
      body: JSON.stringify({
        question: 'Is it safe to walk?',
        history: [{ role: 'system', content: 'inject' }],
        profile: validProfile,
        airData: validAir,
      }),
    });
    assert.equal(invalidHistoryAsk.status, 400);
  });

  it('serves valid /api/daily-plan and /api/ask requests cleanly with fallback when GEMINI_API_KEY is unset', async () => {
    const prevKey = process.env.GEMINI_API_KEY;
    delete process.env.GEMINI_API_KEY;
    try {
      const airData = buildDemoAirQualityData('severe_winter_smog');
      const profile = {
        ...DEMO_PERSONAS[1].profile,
        location: airData.location,
        onboardingCompleted: true,
      };

      const planRes = await invokeRouter({
        method: 'POST',
        url: '/api/daily-plan',
        body: JSON.stringify({ profile, airData }),
      });
      assert.equal(planRes.status, 200);
      assert.equal(planRes.json.source, 'fallback');
      assert.equal(DailyPlanPayloadSchema.safeParse(planRes.json).success, true);

      const askRes = await invokeRouter({
        method: 'POST',
        url: '/api/ask',
        body: JSON.stringify({
          question: 'Should I take my two-wheeler today?',
          history: [],
          profile,
          airData,
        }),
      });
      assert.equal(askRes.status, 200);
      assert.equal(askRes.json.source, 'fallback');
      assert.equal(AskSaansPayloadSchema.safeParse(askRes.json).success, true);
    } finally {
      if (prevKey !== undefined) process.env.GEMINI_API_KEY = prevKey;
    }
  });

  it('sanitizes upstream error messages and never leaks secrets or stack traces', async () => {
    const secret = ['AI', 'za', 'SySecretLeakCheck', '1234567890abcdef'].join('');
    globalThis.fetch = (async () => {
      throw new Error(`Upstream failed at https://api.test/v1?key=${secret}`);
    }) as typeof fetch;

    const res = await invokeRouter({
      method: 'GET',
      url: '/api/air-quality?lat=28.6139&lon=77.209&name=New+Delhi',
    });

    assert.equal(res.status, 502);
    assert.ok(!res.bodyText.includes(secret), 'Raw secret must never appear in response');
    assert.match(res.bodyText, /\[REDACTED\]/);
    assert.equal(res.json.stack, undefined);
  });
});
