import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  askSaansAssistant,
  classifyGeminiError,
  executeGeminiWithRetry,
  generateDailyPlan,
  isRetryableGeminiError,
  sanitizeErrorText,
  type GeminiContentClient,
} from '../server/lib/gemini.ts';
import {
  buildDemoAirQualityData,
  DEMO_PERSONAS,
} from '../shared/demoScenarios.ts';
import {
  AskSaansPayloadSchema,
  DailyPlanPayloadSchema,
} from '../shared/types.ts';

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

function makeValidPlanJson(): string {
  const item = (id: string, impactCategory: 'personal_exposure' | 'wider_emissions' | 'both') => ({
    id,
    title: `Action ${id}`,
    action: 'Take a specific practical step based on current modelled air quality.',
    whyRecommended: 'Grounded in supplied US AQI and household setup.',
    triggers: ['US AQI 268', 'No air purifier'],
    expectedBenefit: 'Lowers household exposure during elevated particulate hours.',
    impactCategory,
    priority: 'high' as const,
    timeframe: '08:00 – 10:00',
  });

  return JSON.stringify({
    headline: 'Heavy PM2.5 smog in New Delhi: protect indoor air today.',
    heroSummary: {
      currentConditions:
        'Modelled US AQI is 268 (Very Unhealthy) with elevated PM2.5.',
      avoidToday: ['Vigorous outdoor play for children during peak hours'],
      prioritiseToday: ['Keep street-facing windows shut and damp-mop indoor dust'],
      bestLowerWindowNote:
        'Forecast shows a relatively lower-pollution afternoon window (not completely safe).',
      immediateAction: 'Close exterior windows and move active play indoors now.',
    },
    blocks: {
      morning: [item('m1', 'personal_exposure')],
      afternoon: [item('a1', 'wider_emissions')],
      evening: [item('e1', 'personal_exposure')],
      tomorrow: [item('t1', 'both')],
    },
    transparencyNote:
      'Generated from supplied modelled environmental readings and household preferences.',
  });
}

function makeValidAskJson(): string {
  return JSON.stringify({
    answer:
      'Modelled US AQI in New Delhi is 268 (Very Unhealthy). Move outdoor walks indoors and use enclosed transit if travel is essential.',
    keyTakeaway: 'Avoid outdoor walks now and keep exterior windows closed.',
    impactFraming: 'personal_exposure',
    dataPointsUsed: ['Location: New Delhi', 'US AQI: 268'],
    followUpSuggestions: ['When should I ventilate my home?'],
  });
}

describe('Gemini integration with deterministic mocked client', () => {
  const noDelayRetry = {
    maxRetries: 2,
    baseDelayMs: 1,
    maxDelayMs: 2,
    sleep: async () => {},
  };

  it('accepts valid structured JSON from Gemini for daily plan and Ask SAANS', async () => {
    const airData = buildDemoAirQualityData('severe_winter_smog');
    const profile = {
      ...DEMO_PERSONAS[0].profile,
      location: airData.location,
      onboardingCompleted: true,
    };

    const planClient: GeminiContentClient = {
      models: {
        generateContent: async () => ({ text: makeValidPlanJson() }),
      },
    };
    const plan = await generateDailyPlan(profile, airData, {
      client: planClient,
      retryOptions: noDelayRetry,
    });
    assert.equal(plan.source, 'gemini');
    assert.equal(DailyPlanPayloadSchema.safeParse(plan).success, true);

    const askClient: GeminiContentClient = {
      models: {
        generateContent: async () => ({ text: makeValidAskJson() }),
      },
    };
    const ask = await askSaansAssistant('Can I walk outside?', [], profile, airData, {
      client: askClient,
      retryOptions: noDelayRetry,
    });
    assert.equal(ask.source, 'gemini');
    assert.equal(AskSaansPayloadSchema.safeParse(ask).success, true);
  });

  it('falls back immediately without retrying when Gemini returns invalid JSON or fails schema validation', async () => {
    const airData = buildDemoAirQualityData('severe_winter_smog');
    const profile = {
      ...DEMO_PERSONAS[0].profile,
      location: airData.location,
      onboardingCompleted: true,
    };

    let planAttempts = 0;
    const invalidSchemaPlanClient: GeminiContentClient = {
      models: {
        generateContent: async () => {
          planAttempts++;
          return { text: JSON.stringify({ headline: 'Too short' }) };
        },
      },
    };
    const plan = await generateDailyPlan(profile, airData, {
      client: invalidSchemaPlanClient,
      retryOptions: noDelayRetry,
    });
    assert.equal(planAttempts, 1);
    assert.equal(plan.source, 'fallback');
    assert.equal(plan.fallbackCode, 'validation_failed');
    assert.equal(DailyPlanPayloadSchema.safeParse(plan).success, true);

    let askAttempts = 0;
    const malformedAskClient: GeminiContentClient = {
      models: {
        generateContent: async () => {
          askAttempts++;
          return { text: 'not valid json {' };
        },
      },
    };
    const ask = await askSaansAssistant('Should I open windows?', [], profile, airData, {
      client: malformedAskClient,
      retryOptions: noDelayRetry,
    });
    assert.equal(askAttempts, 1);
    assert.equal(ask.source, 'fallback');
    assert.equal(ask.fallbackCode, 'validation_failed');
    assert.equal(AskSaansPayloadSchema.safeParse(ask).success, true);
  });

  it('retries transient upstream 503 failures up to retry limit and falls back cleanly after exhaustion', async () => {
    const airData = buildDemoAirQualityData('severe_winter_smog');
    const profile = {
      ...DEMO_PERSONAS[0].profile,
      location: airData.location,
      onboardingCompleted: true,
    };

    // Succeeds on 3rd attempt (2 retries)
    let recoveryAttempts = 0;
    const recoveringClient: GeminiContentClient = {
      models: {
        generateContent: async () => {
          recoveryAttempts++;
          if (recoveryAttempts < 3) {
            throw makeApiError(503, 'Service Unavailable');
          }
          return { text: makeValidAskJson() };
        },
      },
    };
    const recovered = await askSaansAssistant('Walk now?', [], profile, airData, {
      client: recoveringClient,
      retryOptions: noDelayRetry,
    });
    assert.equal(recoveryAttempts, 3);
    assert.equal(recovered.source, 'gemini');

    // Persistent 503 hits retry cap (1 initial + 2 retries = 3 attempts) and falls back
    let failingAttempts = 0;
    const always503Client: GeminiContentClient = {
      models: {
        generateContent: async () => {
          failingAttempts++;
          throw makeApiError(503, 'Service Unavailable');
        },
      },
    };
    const fallbackPlan = await generateDailyPlan(profile, airData, {
      client: always503Client,
      retryOptions: noDelayRetry,
    });
    assert.equal(failingAttempts, 3);
    assert.equal(fallbackPlan.source, 'fallback');
    assert.equal(fallbackPlan.fallbackCode, 'upstream_error');
    assert.equal(DailyPlanPayloadSchema.safeParse(fallbackPlan).success, true);
  });

  it('never exposes secrets from upstream Gemini errors in fallback responses', async () => {
    const airData = buildDemoAirQualityData('moderate_haze');
    const profile = {
      ...DEMO_PERSONAS[2].profile,
      location: airData.location,
      onboardingCompleted: true,
    };
    const fakeSecret = ['AI', 'za', 'SySecretIntegrationTest', '9876543210'].join('');

    const secretThrowingClient: GeminiContentClient = {
      models: {
        generateContent: async () => {
          throw makeApiError(
            401,
            `Unauthorized x-goog-api-key: ${fakeSecret} url=https://generativelanguage.googleapis.com?key=${fakeSecret}`,
          );
        },
      },
    };

    const plan = await generateDailyPlan(profile, airData, {
      client: secretThrowingClient,
      retryOptions: noDelayRetry,
    });
    assert.equal(plan.source, 'fallback');
    assert.equal(plan.fallbackCode, 'invalid_credentials');
    assert.ok(!JSON.stringify(plan).includes(fakeSecret));

    const ask = await askSaansAssistant('Commute advice?', [], profile, airData, {
      client: secretThrowingClient,
      retryOptions: noDelayRetry,
    });
    assert.equal(ask.source, 'fallback');
    assert.equal(ask.fallbackCode, 'invalid_credentials');
    assert.ok(!JSON.stringify(ask).includes(fakeSecret));
  });
});
