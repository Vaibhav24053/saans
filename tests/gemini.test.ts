import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  askSaansAssistant,
  classifyGeminiError,
  executeGeminiWithRetry,
  generateDailyPlan,
  isRetryableGeminiError,
  sanitizeErrorText,
} from '../server/lib/gemini.ts';
import {
  buildDemoAirQualityData,
  DEMO_PERSONAS,
} from '../shared/demoScenarios.ts';

const MODEL = 'gemini-3.5-flash-lite';

function makeApiError(status: number, message: string): Error & { status: number } {
  const err = new Error(message) as Error & { status: number };
  err.status = status;
  return err;
}

describe('classifyGeminiError', () => {
  it('classifies 404 as model_unavailable', () => {
    const res = classifyGeminiError(
      makeApiError(404, 'models/gemini-3.5-flash-lite is not found for API version v1beta'),
      MODEL,
    );
    assert.equal(res.code, 'model_unavailable');
    assert.match(res.userMessage, /gemini-3\.5-flash-lite/);
  });

  it('classifies embedded 404 NOT_FOUND JSON as model_unavailable', () => {
    const res = classifyGeminiError(
      new Error('{"error":{"code":404,"message":"Model is no longer available","status":"NOT_FOUND"}}'),
      MODEL,
    );
    assert.equal(res.code, 'model_unavailable');
  });

  it('classifies 429 and quota errors as rate_limited', () => {
    const byStatus = classifyGeminiError(makeApiError(429, 'Too many requests'), MODEL);
    assert.equal(byStatus.code, 'rate_limited');

    const byMessage = classifyGeminiError(
      new Error('{"error":{"code":429,"message":"Quota exceeded","status":"RESOURCE_EXHAUSTED"}}'),
      MODEL,
    );
    assert.equal(byMessage.code, 'rate_limited');
  });

  it('classifies 401 and 403 as invalid_credentials', () => {
    const r401 = classifyGeminiError(makeApiError(401, 'Unauthorized: API_KEY_INVALID'), MODEL);
    assert.equal(r401.code, 'invalid_credentials');

    const r403 = classifyGeminiError(makeApiError(403, 'PERMISSION_DENIED for this project'), MODEL);
    assert.equal(r403.code, 'invalid_credentials');
  });

  it('classifies 502, 503, and 504 as transient upstream_error and NEVER model_unavailable', () => {
    const r502 = classifyGeminiError(makeApiError(502, 'Bad Gateway'), MODEL);
    assert.equal(r502.code, 'upstream_error');

    const r503 = classifyGeminiError(
      makeApiError(
        503,
        '{"error":{"code":503,"message":"This model is currently experiencing high demand and is temporarily unavailable.","status":"UNAVAILABLE"}}',
      ),
      MODEL,
    );
    assert.equal(r503.code, 'upstream_error');
    assert.notEqual(r503.code, 'model_unavailable');

    const r503WithoutStatusProp = classifyGeminiError(
      new Error(
        '{"error":{"code":503,"message":"The model is overloaded and unavailable right now","status":"UNAVAILABLE"}}',
      ),
      MODEL,
    );
    assert.equal(r503WithoutStatusProp.code, 'upstream_error');

    const r504 = classifyGeminiError(makeApiError(504, 'Gateway Timeout'), MODEL);
    assert.equal(r504.code, 'upstream_error');
    assert.notEqual(r504.code, 'model_unavailable');
  });

  it('classifies client timeouts as timeout and schema errors as validation_failed', () => {
    const rTimeout = classifyGeminiError(new Error('Gemini request timed out after 18000ms'), MODEL);
    assert.equal(rTimeout.code, 'timeout');

    const rValidation = classifyGeminiError(
      new Error('Gemini output validation failed: Required'),
      MODEL,
    );
    assert.equal(rValidation.code, 'validation_failed');
  });

  it('never leaks raw API keys or credentials in userMessage', () => {
    const fakeKey = ['AQ', '.', 'FakeTestKey', '1234567890abcdefghijk'].join('');
    const res = classifyGeminiError(
      makeApiError(401, `Invalid key ${fakeKey} on https://example.test?key=${fakeKey}`),
      MODEL,
    );
    assert.equal(res.code, 'invalid_credentials');
    assert.ok(!res.userMessage.includes(fakeKey));
  });
});

describe('isRetryableGeminiError and executeGeminiWithRetry', () => {
  it('marks 502/503/504 and timeout as retryable, and 401/403/404/429/validation as non-retryable', () => {
    assert.equal(isRetryableGeminiError(makeApiError(502, 'Bad Gateway'), MODEL), true);
    assert.equal(isRetryableGeminiError(makeApiError(503, 'Service Unavailable'), MODEL), true);
    assert.equal(isRetryableGeminiError(makeApiError(504, 'Gateway Timeout'), MODEL), true);
    assert.equal(isRetryableGeminiError(new Error('Gemini request timed out after 18000ms'), MODEL), true);

    assert.equal(isRetryableGeminiError(makeApiError(401, 'Unauthorized'), MODEL), false);
    assert.equal(isRetryableGeminiError(makeApiError(403, 'Forbidden'), MODEL), false);
    assert.equal(isRetryableGeminiError(makeApiError(404, 'Not Found'), MODEL), false);
    assert.equal(isRetryableGeminiError(makeApiError(429, 'Quota exceeded'), MODEL), false);
    assert.equal(isRetryableGeminiError(new Error('Gemini output validation failed'), MODEL), false);
  });

  it('retries transient 503 failures and succeeds within retry bound', async () => {
    let attempts = 0;
    const delays: number[] = [];
    const result = await executeGeminiWithRetry(
      async () => {
        attempts++;
        if (attempts < 3) {
          throw makeApiError(503, 'This model is currently experiencing high demand');
        }
        return 'ok-on-third';
      },
      MODEL,
      {
        maxRetries: 2,
        baseDelayMs: 100,
        maxDelayMs: 500,
        sleep: async (ms) => {
          delays.push(ms);
        },
      },
    );

    assert.equal(result, 'ok-on-third');
    assert.equal(attempts, 3);
    assert.deepEqual(delays, [100, 200]);
  });

  it('caps retries at maxRetries when 503 persists', async () => {
    let attempts = 0;
    const delays: number[] = [];
    await assert.rejects(
      () =>
        executeGeminiWithRetry(
          async () => {
            attempts++;
            throw makeApiError(503, 'Service Unavailable');
          },
          MODEL,
          {
            maxRetries: 2,
            baseDelayMs: 50,
            maxDelayMs: 200,
            sleep: async (ms) => {
              delays.push(ms);
            },
          },
        ),
      /Service Unavailable/,
    );
    assert.equal(attempts, 3);
    assert.deepEqual(delays, [50, 100]);
  });

  it('does NOT retry 401, 403, 429, or 404', async () => {
    for (const [status, msg] of [
      [401, 'Unauthorized'],
      [403, 'Permission denied'],
      [429, 'Rate limit exceeded'],
      [404, 'Model not found'],
    ] as const) {
      let attempts = 0;
      const delays: number[] = [];
      await assert.rejects(() =>
        executeGeminiWithRetry(
          async () => {
            attempts++;
            throw makeApiError(status, msg);
          },
          MODEL,
          {
            maxRetries: 2,
            sleep: async (ms) => {
              delays.push(ms);
            },
          },
        ),
      );
      assert.equal(attempts, 1, `HTTP ${status} must not be retried`);
      assert.deepEqual(delays, []);
    }
  });
});

describe('sanitizeErrorText', () => {
  it('redacts API keys, query parameters, and bearer tokens', () => {
    const fakeAq = ['AQ', '.', 'TestSecretValue_', '1234567890abcdef'].join('');
    const fakeAiza = ['AI', 'za', 'SyFakeKeyValue', '1234567890abcdef'].join('');
    const fakeToken = ['mySecretToken', '12345'].join('');
    const fakeBearer = ['Bear', 'er ', fakeToken].join('');
    const raw = `Request failed for https://api.test/v1?key=${fakeAq} Authorization: ${fakeBearer} alt=${fakeAiza}`;
    const cleaned = sanitizeErrorText(raw);
    assert.ok(!cleaned.includes(fakeAq));
    assert.ok(!cleaned.includes(fakeAiza));
    assert.ok(!cleaned.includes(fakeToken));
    assert.match(cleaned, /\[REDACTED\]/);
  });
});

describe('rules-based fallback preservation', () => {
  it('returns valid rules-based fallback when GEMINI_API_KEY is unset', async () => {
    const prevKey = process.env.GEMINI_API_KEY;
    delete process.env.GEMINI_API_KEY;
    try {
      const airData = buildDemoAirQualityData('severe_winter_smog');
      const profile = {
        ...DEMO_PERSONAS[0].profile,
        location: airData.location,
        onboardingCompleted: true,
      };
      const plan = await generateDailyPlan(profile, airData);
      assert.equal(plan.source, 'fallback');
      assert.equal(plan.fallbackCode, 'missing_key');
      assert.ok(plan.blocks.morning.length >= 1);

      const ask = await askSaansAssistant('Should we open windows?', [], profile, airData);
      assert.equal(ask.source, 'fallback');
      assert.equal(ask.fallbackCode, 'missing_key');
      assert.ok(ask.answer.length > 20);
    } finally {
      if (prevKey !== undefined) process.env.GEMINI_API_KEY = prevKey;
    }
  });
});
