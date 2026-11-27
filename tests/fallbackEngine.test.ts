import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  generateFallbackAskResponse,
  generateFallbackDailyPlan,
} from '../server/lib/fallbackEngine.ts';
import { askSaansAssistant, generateDailyPlan } from '../server/lib/gemini.ts';
import {
  buildDemoAirQualityData,
  DEMO_PERSONAS,
} from '../shared/demoScenarios.ts';
import {
  AskSaansPayloadSchema,
  DailyPlanPayloadSchema,
  type AirQualityData,
  type HouseholdProfile,
} from '../shared/types.ts';

function makeProfile(overrides: Partial<HouseholdProfile> = {}): HouseholdProfile {
  const air = buildDemoAirQualityData('moderate_haze');
  return {
    ...DEMO_PERSONAS[0].profile,
    location: air.location,
    onboardingCompleted: true,
    ...overrides,
  };
}

function makeAirData(overrides: Partial<AirQualityData> = {}): AirQualityData {
  const base = buildDemoAirQualityData('moderate_haze');
  return {
    ...base,
    ...overrides,
  };
}

describe('fallback engine with missing GEMINI_API_KEY', () => {
  it('returns schema-valid fallback responses when GEMINI_API_KEY is missing or blank', async () => {
    const prevKey = process.env.GEMINI_API_KEY;
    process.env.GEMINI_API_KEY = '   ';
    try {
      const air = buildDemoAirQualityData('worsening_inversion');
      const profile = makeProfile({ location: air.location });

      const plan = await generateDailyPlan(profile, air);
      assert.equal(plan.source, 'fallback');
      assert.equal(plan.fallbackCode, 'missing_key');
      assert.equal(DailyPlanPayloadSchema.safeParse(plan).success, true);

      const ask = await askSaansAssistant('How is the air tomorrow?', [], profile, air);
      assert.equal(ask.source, 'fallback');
      assert.equal(ask.fallbackCode, 'missing_key');
      assert.equal(AskSaansPayloadSchema.safeParse(ask).success, true);
    } finally {
      if (prevKey === undefined) delete process.env.GEMINI_API_KEY;
      else process.env.GEMINI_API_KEY = prevKey;
    }
  });
});

describe('fallback engine with invalid environmental inputs and missing pollutants', () => {
  it('never leaks null, NaN, or fabricated AQI 0 when environmental readings are invalid or missing', () => {
    const invalidAqiValues: Array<number | null> = [
      null,
      Number.NaN,
      -20,
      Number.POSITIVE_INFINITY,
    ];

    for (const invalidAqi of invalidAqiValues) {
      const air = makeAirData({
        current: {
          usAqi: invalidAqi,
          europeanAqi: null,
          pm25: null,
          pm10: null,
          no2: null,
          so2: null,
          o3: null,
        },
        hourly: [],
        summary: {
          dominantPollutant: 'pm25',
          dominantPollutantLabel: 'PM2.5 (Fine Particulate Matter)',
          trendDirection: 'stable',
          trendDelta6h: 0,
          trendNote: 'Hourly forecast trend is temporarily unavailable.',
          peakWindow: null,
          lowerWindow: null,
          tomorrowOutlook: null,
        },
      });
      const profile = makeProfile({ location: air.location });

      const plan = generateFallbackDailyPlan(profile, air, 'Unavailable test', 'missing_key');
      assert.equal(DailyPlanPayloadSchema.safeParse(plan).success, true);

      const serializedPlan = JSON.stringify(plan);
      assert.ok(!serializedPlan.includes('null US AQI'));
      assert.ok(!serializedPlan.includes('NaN'));
      assert.ok(!serializedPlan.includes('Current US AQI: 0'));
      assert.match(plan.headline, /unavailable/i);

      // Walk question must NOT say "reasonable time for a walk" when AQI is unavailable
      const walkReply = generateFallbackAskResponse(
        'Is it a good time to go for a walk?',
        profile,
        air,
        'Unavailable test',
        'missing_key',
      );
      assert.equal(AskSaansPayloadSchema.safeParse(walkReply).success, true);
      assert.match(walkReply.answer, /unavailable|precautionary/i);
      assert.ok(!/reasonable time for a walk/i.test(walkReply.answer));
      assert.ok(!walkReply.answer.includes('null'));
      assert.ok(!walkReply.answer.includes('NaN'));

      // Home and commute questions also remain clean and schema-valid
      const homeReply = generateFallbackAskResponse(
        'Should I open my windows at home?',
        profile,
        air,
        'Unavailable test',
        'missing_key',
      );
      assert.equal(AskSaansPayloadSchema.safeParse(homeReply).success, true);
      assert.ok(!homeReply.answer.includes('null'));
      assert.ok(!homeReply.answer.includes('NaN'));

      const commuteReply = generateFallbackAskResponse(
        'How should I plan my commute?',
        profile,
        air,
        'Unavailable test',
        'missing_key',
      );
      assert.equal(AskSaansPayloadSchema.safeParse(commuteReply).success, true);
      assert.ok(!commuteReply.answer.includes('null'));
      assert.ok(!commuteReply.answer.includes('NaN'));
    }
  });
});

describe('fallback Ask SAANS question categories', () => {
  it('routes every major question category with appropriate impactFraming and grounded data', () => {
    const severeAir = buildDemoAirQualityData('severe_winter_smog');
    const profile = makeProfile({
      location: severeAir.location,
      commuteType: 'two_wheeler',
      hasAirPurifier: false,
      cookingFuel: 'lpg_gas',
    });

    const categories: Array<{
      question: string;
      expectedFraming: 'personal_exposure' | 'wider_emissions' | 'both';
      expectedMatch: RegExp;
    }> = [
      {
        question: 'Is it okay to run in the park outside?',
        expectedFraming: 'personal_exposure',
        expectedMatch: /indoors/i,
      },
      {
        question: 'How should I manage windows and cooking indoors at home?',
        expectedFraming: 'personal_exposure',
        expectedMatch: /Windows & Ventilation/i,
      },
      {
        question: 'What should I change about my office commute?',
        expectedFraming: 'both',
        expectedMatch: /N95|Personal exposure/i,
      },
      {
        question: 'What does tomorrow forecast look like?',
        expectedFraming: 'personal_exposure',
        expectedMatch: /Tomorrow/i,
      },
      {
        question: 'How can I reduce my environmental footprint and emissions?',
        expectedFraming: 'wider_emissions',
        expectedMatch: /cumulative greenhouse gas|separately/i,
      },
      {
        question: 'Give me a quick overview of today.',
        expectedFraming: 'both',
        expectedMatch: /Personal exposure/i,
      },
    ];

    for (const { question, expectedFraming, expectedMatch } of categories) {
      const reply = generateFallbackAskResponse(
        question,
        profile,
        severeAir,
        'Fallback test',
        'missing_key',
      );
      assert.equal(
        AskSaansPayloadSchema.safeParse(reply).success,
        true,
        `Fallback reply for "${question}" must pass AskSaansPayloadSchema`,
      );
      assert.equal(reply.source, 'fallback');
      assert.equal(reply.impactFraming, expectedFraming);
      assert.match(reply.answer, expectedMatch);
      assert.ok(reply.dataPointsUsed.length >= 3);
      assert.ok(reply.followUpSuggestions.length >= 1);
      // Never claims forecast periods are "completely safe" as an assertion
      assert.ok(!/is completely safe/i.test(reply.answer));
    }
  });
});

describe('fallback engine US AQI severity boundary alignment (100/101, 150/151, 200/201)', () => {
  it('aligns fallback plan severity strictly with US EPA AQI breakpoints', () => {
    const profile = makeProfile({
      commuteType: 'car',
      hasAirPurifier: false,
      children: 1,
    });

    const planFor = (aqi: number) =>
      generateFallbackDailyPlan(
        profile,
        makeAirData({
          current: {
            usAqi: aqi,
            europeanAqi: 50,
            pm25: 50,
            pm10: 80,
            no2: 20,
            so2: 10,
            o3: 30,
          },
        }),
        'Boundary test',
        'missing_key',
      );

    // 100 (Moderate) vs 101 (Elevated / Sensitive Groups)
    assert.match(planFor(100).headline, /^Moderate modelled air/i);
    assert.match(planFor(101).headline, /^Sensitive Groups air/i);

    // 150 (Sensitive Groups) vs 151 (Unhealthy)
    assert.match(planFor(150).headline, /^Sensitive Groups air/i);
    assert.match(planFor(151).headline, /^Unhealthy modelled air/i);

    // 200 (Unhealthy) vs 201 (Very Unhealthy / Severe)
    assert.match(planFor(200).headline, /^Unhealthy modelled air/i);
    assert.match(planFor(201).headline, /^Heavy .* smog day/i);
  });
});
